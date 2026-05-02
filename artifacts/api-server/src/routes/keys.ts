import { Router } from "express";
import { randomUUID } from "crypto";
import { db, apiKeysTable, storesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { generateApiKey } from "../lib/apiKey";
import { z } from "zod";

const router = Router();

const CreateKeyBody = z.object({
  storeId:     z.string().min(1),
  name:        z.string().min(1).max(80),
  permissions: z.array(z.string()).default(["orders:read", "orders:write"]),
  expiresAt:   z.string().datetime().optional(),
});

// List all API keys for a store (hashes/prefixes only — never raw keys)
router.get("/keys", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string | undefined;
  const rows = storeId
    ? await db.select().from(apiKeysTable).where(eq(apiKeysTable.storeId, storeId))
    : await db.select().from(apiKeysTable);

  res.json({
    keys: rows.map(k => ({
      id:          k.id,
      storeId:     k.storeId,
      name:        k.name,
      keyPrefix:   k.keyPrefix,
      permissions: k.permissions,
      isActive:    k.isActive,
      lastUsedAt:  k.lastUsedAt,
      expiresAt:   k.expiresAt,
      createdAt:   k.createdAt,
    })),
  });
});

// Create a new API key — returns the raw key ONCE
router.post("/keys", async (req, res): Promise<void> => {
  const body = CreateKeyBody.parse(req.body);

  // Verify store exists
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, body.storeId));
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const { raw, hash, prefix } = generateApiKey();

  const [key] = await db.insert(apiKeysTable).values({
    id:          randomUUID(),
    storeId:     body.storeId,
    name:        body.name,
    keyHash:     hash,
    keyPrefix:   prefix,
    permissions: body.permissions,
    isActive:    true,
    expiresAt:   body.expiresAt ? new Date(body.expiresAt) : null,
  }).returning();

  // Return raw key once — it cannot be retrieved again
  res.status(201).json({
    key: {
      id:        key.id,
      name:      key.name,
      keyPrefix: key.keyPrefix,
      rawKey:    raw,   // ← shown once only
      permissions: key.permissions,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    },
    warning: "Store this key securely — it will not be shown again.",
  });
});

// Revoke (deactivate) an API key
router.delete("/keys/:id", async (req, res): Promise<void> => {
  const [key] = await db
    .update(apiKeysTable)
    .set({ isActive: false })
    .where(eq(apiKeysTable.id, req.params.id))
    .returning();
  if (!key) { res.status(404).json({ error: "Key not found" }); return; }
  res.json({ revoked: true, id: key.id });
});

export default router;
