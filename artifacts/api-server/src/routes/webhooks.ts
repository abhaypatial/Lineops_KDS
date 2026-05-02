import { Router } from "express";
import { randomUUID, randomBytes } from "crypto";
import { db, outboundWebhooksTable, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { WebhookEvent } from "@workspace/db";

const router = Router();

const ALL_EVENTS: WebhookEvent[] = [
  "order.created", "order.bumped", "order.completed", "order.recalled", "item.ready",
];

const CreateWebhookBody = z.object({
  storeId: z.string().min(1),
  name:    z.string().min(1).max(80),
  url:     z.string().url(),
  events:  z.array(z.enum(["order.created","order.bumped","order.completed","order.recalled","item.ready"])).min(1),
  secret:  z.string().optional(),
});

// List webhooks
router.get("/webhooks", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string | undefined;
  const rows = storeId
    ? await db.select().from(outboundWebhooksTable).where(eq(outboundWebhooksTable.storeId, storeId))
    : await db.select().from(outboundWebhooksTable);
  // Never return the secret in list
  res.json({
    webhooks: rows.map(w => ({ ...w, secret: w.secret.slice(0, 8) + "…" })),
    availableEvents: ALL_EVENTS,
  });
});

// Create webhook
router.post("/webhooks", async (req, res): Promise<void> => {
  const body = CreateWebhookBody.parse(req.body);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, body.storeId));
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const secret = body.secret ?? randomBytes(24).toString("hex");

  const [hook] = await db.insert(outboundWebhooksTable).values({
    id:       randomUUID(),
    storeId:  body.storeId,
    name:     body.name,
    url:      body.url,
    secret,
    events:   body.events as WebhookEvent[],
    isActive: true,
  }).returning();

  res.status(201).json({
    webhook: { ...hook, secret },   // return secret once on create
    warning: "Store the signing secret securely — it will not be shown in full again.",
  });
});

// Toggle active/inactive
router.patch("/webhooks/:id", async (req, res): Promise<void> => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const [hook] = await db
    .update(outboundWebhooksTable)
    .set({ isActive })
    .where(eq(outboundWebhooksTable.id, req.params.id))
    .returning();
  if (!hook) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({ webhook: { ...hook, secret: hook.secret.slice(0, 8) + "…" } });
});

// Delete webhook
router.delete("/webhooks/:id", async (req, res): Promise<void> => {
  const [hook] = await db
    .delete(outboundWebhooksTable)
    .where(eq(outboundWebhooksTable.id, req.params.id))
    .returning();
  if (!hook) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({ deleted: true, id: hook.id });
});

export default router;
