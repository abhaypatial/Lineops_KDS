/**
 * Volante Systems VE POS — real API integration.
 *
 * Integration architecture (from official API docs):
 *
 *   VE POS (server) ──► LineOps KDS (client via RPC push)
 *
 *   VE pushes two RPC endpoints on every kitchen fire:
 *     PUT /api/integrations/volante/rpc/master-trans   → MasterTransEntity[]
 *     PUT /api/integrations/volante/rpc/kitchen-jobs   → KitchenChitJobEntity[]
 *
 *   LineOps caches the full master-trans payload keyed by masterTransObjectId.
 *   When kitchen-jobs arrive, it resolves the transaction, filters to the fired
 *   itemIds, and creates KDS orders. VE also supports polling:
 *     GET /api/integrations/volante/rpc/kitchen-jobs   → job status response
 *
 * Auth (for LineOps to call back into VE, i.e. pull mode):
 *   POST https://{ve_host}/auth/auth/token
 *   Body: { grant_type: "client", client: "<clientId>", password: "<clientSecret>", requestTime: ISO8601 }
 *   Response: { success: true, access_token, refresh_token, accessTokenExpiry, refreshTokenExpiry }
 *
 * Env vars:
 *   VOLANTE_HOST            Base URL of the VE server (e.g. https://acme.volantecloud.com)
 *   VOLANTE_CLIENT_ID       OAuth2 client id ("client" field)
 *   VOLANTE_CLIENT_SECRET   OAuth2 client secret ("password" field)
 *   VOLANTE_WEBHOOK_SECRET  Optional HMAC-SHA256 secret for signature verification
 *
 * References:
 *   pos   API v2026.02.1684  – /v1/rpc/kitchen-jobs, /v1/rpc/master-trans
 *   auth  API v1.3.0         – /auth/auth/token
 *   menu  API v1.3.0         – MenuItem.kitchenName, MenuItem.groupName
 *   txn   API v1.3.0         – MasterTrans, Trans, TransItem, TransOption
 */

import { createHmac } from "crypto";
import type { NormalisedItem, StationMap } from "./types";
import { mapStation } from "./types";

// ── Volante API Types ─────────────────────────────────────────────────────────

export interface VeMenuItem {
  menuItemId?: string;
  name?: string;
  kitchenName?: string;
  catName?: string;
  groupName?: string;
  printerTypes?: string[];
  plu?: string;
}

export interface VeKitchenPrinting {
  kdsBatchId?: number;
  course?: number;
}

export interface VeTransItemBase {
  transItemId: number;
  type: "item" | "option" | string;
  userQty: number;
  details: VeMenuItem;
  notes?: string[];
  chit?: VeKitchenPrinting;
  active?: boolean;
  voidTypeId?: number;
  externalReferenceId?: string;
}

export interface VeTransItem extends VeTransItemBase {
  type: "item";
  platterNum?: number;
  homeTransId?: number;
}

export interface VeTransOption extends VeTransItemBase {
  type: "option";
  parentItemId: number;
  parentOptionId?: number;
  optionSetId?: string;
  note?: string;
}

export interface VeServiceInfo {
  submitTime?: string;
  destination?: string;
  phoneNumber?: string;
  customerName?: string;
  orderNotes?: string;
  orderNum?: string;
  serviceTime?: string;
}

export interface VeTrans {
  transId: number;
  seatNum?: number;
  guestName?: string;
  phoneNumber?: string;
  items: (VeTransItem | VeTransOption)[];
  notes?: Record<string, string>;
}

/** MasterTransEntity — full transaction from PUT /v1/rpc/master-trans */
export interface VeMasterTransEntity {
  id?: string;                // MongoDB ObjectId string (masterTransObjectId)
  masterTransId: number;      // POS integer check number
  orderNum?: string;          // alphanumeric order number shown on receipt
  name?: string;              // table name / check name
  tableId?: string;
  storeId: string;
  tenantId: string;
  closed?: boolean;
  del?: boolean;
  serviceInfo?: VeServiceInfo;
  transList: VeTrans[];
  modifiedTime?: string;
}

/** KitchenChitJobEntity — from PUT /v1/rpc/kitchen-jobs */
export interface VeKitchenChitJob {
  id: string;                         // UUID of the kitchen job
  tenantId: string;
  masterTransObjectId: string;        // links to VeMasterTransEntity.id
  masterTransId: number;              // POS check number
  storeId: string;
  terminalId: string;
  printerTypeId?: string;             // UUID of VE printer type (unused — use pluginId instead)
  itemIds?: number[];                 // transItemIds fired in this chit (unique)
  voidItemIds?: number[];             // transItemIds that were voided
  bestResult?: "UNKNOWN" | "QUEUED" | "SENT" | "COMPLETE";
  createTime: string;
  printTime?: string;
  configId?: string;
  /**
   * KDS Terminal ID — the integer you set in VE Back Office under
   * Kitchen Display Setup → Terminal group → "KDS Terminal ID".
   * This is the simplest, most reliable station routing key.
   *
   * In LineOps, map these to station IDs via VOLANTE_STATION_MAP:
   *   VOLANTE_STATION_MAP='{"1":"grill","2":"cold","3":"fryer"}'
   */
  pluginId?: number;
  primaryPrint?: unknown;             // raw VE print engine payload — not needed by KDS
}

/**
 * Maps VE KDS Terminal ID integers to LineOps station IDs.
 *
 * The key is the "KDS Terminal ID" integer visible in VE Back Office under
 * Kitchen Display Setup → Terminal group (e.g. "1", "2", "3").
 * The value is the LineOps station ID from your Stations setup page.
 *
 * Set via environment variable as a JSON object (keys must be strings):
 *   VOLANTE_STATION_MAP='{"1":"grill","2":"cold","3":"fryer","4":"dessert"}'
 *
 * When a chit's pluginId matches a key, all items in that chit go to that
 * station.  Falls back to MenuItem.groupName keyword matching when absent.
 */
export type VeStationMap = Record<string, string>;

export interface VeMasterTransUpdateResult {
  success?: boolean;
  updated?: number;
  failed?: number;
}

// ── Module-level transaction cache ────────────────────────────────────────────
// Keyed by masterTransObjectId (MongoDB _id string) and also by masterTransId
// (integer, as string) for cross-reference.

interface CacheEntry {
  trans: VeMasterTransEntity;
  receivedAt: number;
}

const TX_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const txCacheById  = new Map<string, CacheEntry>(); // by masterTransObjectId
const txCacheByNum = new Map<number, string>();     // masterTransId → objectId

function pruneCache(): void {
  const cutoff = Date.now() - TX_CACHE_TTL_MS;
  for (const [key, entry] of txCacheById) {
    if (entry.receivedAt < cutoff) {
      txCacheByNum.delete(entry.trans.masterTransId);
      txCacheById.delete(key);
    }
  }
}

/** Store a batch of master transactions received from VE. */
export function cacheMasterTrans(transList: VeMasterTransEntity[]): void {
  pruneCache();
  for (const tx of transList) {
    if (!tx.id) continue;
    const entry: CacheEntry = { trans: tx, receivedAt: Date.now() };
    txCacheById.set(tx.id, entry);
    txCacheByNum.set(tx.masterTransId, tx.id);
  }
}

function resolveTrans(job: VeKitchenChitJob): VeMasterTransEntity | undefined {
  const byId = txCacheById.get(job.masterTransObjectId);
  if (byId) return byId.trans;
  const objId = txCacheByNum.get(job.masterTransId);
  return objId ? txCacheById.get(objId)?.trans : undefined;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Build a flat item list from a master transaction, scoped to the itemIds
 * in a kitchen chit job.
 *
 * VE options (modifiers) are child TransOption records with parentItemId.
 * We attach them as modifier strings on the parent TransItem.
 */
function extractItems(
  tx: VeMasterTransEntity,
  firedItemIds: Set<number>,
  /**
   * Station override from the chit's printerTypeId — when set, ALL items in
   * this chit are assigned to this station (mirrors how VE routes chits to
   * physical displays via printer types configured in Back Office).
   */
  chitStation: string | undefined,
  stationMap?: StationMap,
): NormalisedItem[] {
  const result: NormalisedItem[] = [];

  for (const trans of tx.transList) {
    // Index all options by parentItemId
    const optionsByParent = new Map<number, VeTransOption[]>();
    for (const rawItem of trans.items) {
      if (rawItem.type === "option") {
        const opt = rawItem as VeTransOption;
        if (!optionsByParent.has(opt.parentItemId)) {
          optionsByParent.set(opt.parentItemId, []);
        }
        optionsByParent.get(opt.parentItemId)!.push(opt);
      }
    }

    for (const rawItem of trans.items) {
      if (rawItem.type !== "item") continue;
      if (!firedItemIds.has(rawItem.transItemId)) continue;
      if (rawItem.voidTypeId != null && rawItem.voidTypeId > 0) continue; // voided

      const item = rawItem as VeTransItem;
      const det  = item.details ?? {};

      // Prefer kitchenName for display; fall back to name
      const displayName = (det.kitchenName || det.name || "Item").trim();

      // Station resolution (priority order):
      //   1. printerTypeId from the chit → explicit Back Office mapping (most accurate)
      //   2. MenuItem.groupName / catName → heuristic keyword match
      const stationId = chitStation
        ?? mapStation(det.groupName || det.catName || displayName, stationMap);

      // Collect modifier strings from child TransOption records
      const opts = optionsByParent.get(item.transItemId) ?? [];
      const modifiers: string[] = opts
        .map(o => {
          const optName = (o.details?.kitchenName || o.details?.name || "").trim();
          const note    = (o.note ?? "").trim();
          return note ? (optName ? `${optName}: ${note}` : note) : optName;
        })
        .filter(Boolean);

      // Item-level notes from the TransItem.notes array
      const notes = (item.notes ?? []).filter(Boolean).join("; ");

      result.push({
        name: displayName,
        quantity: item.userQty,
        stationId,
        modifiers,
        notes,
      });
    }
  }

  return result;
}

// ── NormalisedOrder shape (inline, mirroring types.ts) ───────────────────────

export interface VeNormalisedOrder {
  externalId:   string;
  orderNumber:  string;
  customerName?: string;
  tableRef?:    string;
  priority:     "normal" | "rush" | "vip";
  notes:        string;
  items:        NormalisedItem[];
}

/**
 * Process a batch of kitchen chit jobs against the cached transactions and
 * return normalised KDS orders ready to persist.
 *
 * @param jobs         KitchenChitJobEntity array from VE RPC push
 * @param veStationMap KDS Terminal ID → LineOps stationId (from VOLANTE_STATION_MAP).
 *                     Keys are the "KDS Terminal ID" integers from VE Back Office,
 *                     stored as strings (e.g. {"1":"grill","2":"cold"}).
 * @param stationMap   Keyword → stationId fallback for groupName matching
 */
export function processKitchenJobs(
  jobs: VeKitchenChitJob[],
  veStationMap?: VeStationMap,
  stationMap?: StationMap,
): { order: VeNormalisedOrder; jobId: string }[] {
  const results: { order: VeNormalisedOrder; jobId: string }[] = [];

  for (const job of jobs) {
    // Skip void-only chits
    const firedItemIds = new Set<number>(job.itemIds ?? []);
    if (firedItemIds.size === 0) continue;

    const tx = resolveTrans(job);

    // Build order metadata from the transaction (if we have it)
    const orderNum     = tx?.orderNum ?? String(job.masterTransId);
    const tableName    = tx?.name ?? "";
    const customerName = tx?.serviceInfo?.customerName ?? undefined;
    const orderNotes   = tx?.serviceInfo?.orderNotes ?? "";

    // Resolve station from pluginId (= "KDS Terminal ID" in VE Back Office — simplest mapping)
    const chitStation = job.pluginId != null && veStationMap
      ? veStationMap[String(job.pluginId)]
      : undefined;

    // Extract items — with tx we get full detail; without we get a stub
    const items: NormalisedItem[] = tx
      ? extractItems(tx, firedItemIds, chitStation, stationMap)
      : Array.from(firedItemIds).map(id => ({
          name:      `Item #${id}`,
          quantity:  1,
          stationId: "other",
          modifiers: [] as string[],
          notes:     "(details pending — master-trans not yet received)",
        }));

    if (!items.length) continue;

    results.push({
      jobId: job.id,
      order: {
        externalId:   `ve-${job.masterTransObjectId}-${job.id}`,
        orderNumber:  orderNum,
        tableRef:     tableName || undefined,
        customerName,
        priority:     "normal",
        notes:        orderNotes,
        items,
      },
    });
  }

  return results;
}

// ── Signature verification ────────────────────────────────────────────────────

/**
 * Verify an HMAC-SHA256 signature on the raw request body.
 * VE sends the hex digest in the `X-Volante-Signature` header.
 * Returns true when valid or when no secret is configured.
 */
export function verifyVolanteSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  if (!secret) return true;
  const sig = headers["x-volante-signature"] as string | undefined;
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return sig === expected;
}

// ── VE Auth client (for pull mode) ───────────────────────────────────────────

interface VeTokenResponse {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  error?: { authErrorType: string; message?: string };
}

export class VeAuthClient {
  private accessToken?: string;
  private refreshToken?: string;
  private accessExpiry?: Date;

  constructor(
    private readonly host: string,       // e.g. https://acme.volantecloud.com
    private readonly clientId: string,   // "client" field in VE auth
    private readonly clientSecret: string,
  ) {}

  async getToken(): Promise<string> {
    if (this.accessToken && this.accessExpiry && this.accessExpiry > new Date()) {
      return this.accessToken;
    }
    if (this.refreshToken) {
      try {
        return await this.refresh();
      } catch {
        // fall through to full re-auth
      }
    }
    return this.authenticate();
  }

  private async authenticate(): Promise<string> {
    const res = await fetch(`${this.host}/auth/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:  "client",
        client:      this.clientId,
        password:    this.clientSecret,
        requestTime: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      throw new Error(`VE auth failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as VeTokenResponse;
    if (!data.success || !data.access_token) {
      throw new Error(`VE auth failed: ${data.error?.authErrorType ?? "unknown"}`);
    }
    this.storeToken(data);
    return this.accessToken!;
  }

  private async refresh(): Promise<string> {
    const res = await fetch(`${this.host}/auth/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:    "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`VE token refresh failed: HTTP ${res.status}`);
    const data = (await res.json()) as VeTokenResponse;
    if (!data.success || !data.access_token) throw new Error("VE refresh failed");
    this.storeToken(data);
    return this.accessToken!;
  }

  private storeToken(data: VeTokenResponse): void {
    this.accessToken  = data.access_token;
    this.refreshToken = data.refresh_token;
    this.accessExpiry = data.accessTokenExpiry
      ? new Date(data.accessTokenExpiry)
      : new Date(Date.now() + 3600 * 1000);
  }

  /** Call any VE API endpoint using the managed bearer token. */
  async fetch(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.getToken();
    return fetch(`${this.host}${path}`, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }
}

/** Singleton VE client, created lazily from env vars. */
let _veClient: VeAuthClient | undefined;
export function getVeClient(): VeAuthClient | undefined {
  const host   = process.env.VOLANTE_HOST;
  const cid    = process.env.VOLANTE_CLIENT_ID;
  const secret = process.env.VOLANTE_CLIENT_SECRET;
  if (!host || !cid || !secret) return undefined;
  if (!_veClient) {
    _veClient = new VeAuthClient(host, cid, secret);
  }
  return _veClient;
}
