import { createHash, randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ── Key generation ─────────────────────────────────────────────────────────

/** Returns { raw, hash, prefix }. Store only hash; return raw once. */
export function generateApiKey() {
  const raw    = "kds_live_" + randomBytes(24).toString("hex");
  const hash   = hashKey(raw);
  const prefix = raw.slice(0, 16) + "…";
  return { raw, hash, prefix };
}

export function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

// ── Express middleware ──────────────────────────────────────────────────────

export interface AuthedRequest extends Request {
  apiKey?: { id: string; storeId: string; permissions: string[] };
}

/**
 * Validates `Authorization: Bearer kds_live_xxx` header.
 * Attaches `req.apiKey` on success. Returns 401 on failure.
 */
export async function requireApiKey(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token.startsWith("kds_live_")) {
    res.status(401).json({ error: "Missing or invalid API key" });
    return;
  }

  const hash = hashKey(token);
  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.isActive, true)));

  if (!key) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    res.status(401).json({ error: "API key expired" });
    return;
  }

  // Update last used (fire-and-forget)
  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, key.id))
    .catch(() => {/* non-fatal */});

  req.apiKey = { id: key.id, storeId: key.storeId, permissions: key.permissions as string[] };
  next();
}

/** Check a specific permission on an already-authed request. */
export function hasPermission(req: AuthedRequest, perm: string) {
  return req.apiKey?.permissions.includes(perm) || req.apiKey?.permissions.includes("*");
}
