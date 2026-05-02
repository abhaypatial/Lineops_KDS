import { createHmac } from "crypto";
import type { AdapterResult, StationMap } from "./types";
import { mapStation } from "./types";

/**
 * Volante Systems VE POS adapter.
 *
 * Volanté VE fires kitchen orders via HTTP POST when a check is sent to
 * the kitchen or a course is fired. The payload is a JSON envelope signed
 * with HMAC-SHA256 in the `X-Volante-Signature` header.
 *
 * Configuration:
 *   1. In VE Back Office → Kitchen Displays → External KDS, set:
 *      - Endpoint URL : https://<your-server>/api/integrations/volante/webhook?storeId=<id>
 *      - Auth Secret  : any random string — set as VOLANTE_WEBHOOK_SECRET in your .env
 *      - Format       : JSON  (not XML)
 *      - Fire Mode    : On Course Fire  (or On Send, depending on workflow)
 *
 * VE POS JSON envelope (v2 kitchen-fire format):
 * {
 *   "event"       : "kitchen.order.fired",   // or "kitchen.item.voided"
 *   "posId"       : "POS-01",
 *   "siteId"      : "SITE-001",
 *   "checkNumber" : "1042",
 *   "tableRef"    : "T12",                   // table or seat reference
 *   "guestName"   : "Smith",                 // optional
 *   "course"      : 1,                       // course number
 *   "priority"    : "normal",                // "normal" | "rush" | "vip"
 *   "items"       : [
 *     {
 *       "seq"        : 1,
 *       "name"       : "Grilled Salmon",
 *       "qty"        : 1,
 *       "courseName" : "Main",
 *       "menuGroup"  : "Hot Mains",
 *       "modifiers"  : ["No lemon", "Sauce on side"],
 *       "notes"      : "Allergy: shellfish"
 *     }
 *   ]
 * }
 *
 * Signature: HMAC-SHA256(secret, rawBody) as hex, sent in X-Volante-Signature header.
 */
export function volanteAdapter(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
  stationMap?: StationMap,
): AdapterResult {
  // ── Signature verification ────────────────────────────────────────────────
  const sig = headers["x-volante-signature"] as string | undefined;
  if (secret && sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (sig !== expected) throw new Error("Volante VE: invalid webhook signature");
  }

  const body = JSON.parse(rawBody) as Record<string, unknown>;
  const event = String(body.event ?? "");

  // Only process kitchen fire events; ignore voids and other event types
  const relevant = ["kitchen.order.fired", "kitchen.course.fired", "kitchen.send"];
  if (!relevant.includes(event)) return { shouldProcess: false };

  const items = (body.items ?? []) as Record<string, unknown>[];
  if (!items.length) return { shouldProcess: false };

  const tableRef   = String(body.tableRef ?? body.table ?? "");
  const checkNum   = String(body.checkNumber ?? body.check_number ?? body.checkNum ?? "VE000");
  const guestName  = String(body.guestName ?? body.guest_name ?? tableRef ?? "");
  const priorityRaw= String(body.priority ?? "normal").toLowerCase();
  const priority   =
    priorityRaw === "rush" ? "rush"
    : priorityRaw === "vip" ? "vip"
    : "normal";

  return {
    shouldProcess: true,
    order: {
      externalId:   String(body.posId ?? body.pos_id ?? "") + "-" + checkNum,
      orderNumber:  checkNum,
      customerName: guestName || undefined,
      priority,
      notes:        String(body.notes ?? ""),
      items: items.map((item) => {
        const category = String(item.menuGroup ?? item.menu_group ?? item.courseName ?? item.name ?? "");
        return {
          name:      String(item.name ?? "Item"),
          quantity:  Number(item.qty ?? item.quantity ?? 1),
          stationId: mapStation(category, stationMap),
          modifiers: ((item.modifiers ?? []) as string[]).filter(Boolean),
          notes:     String(item.notes ?? ""),
        };
      }),
    },
  };
}
