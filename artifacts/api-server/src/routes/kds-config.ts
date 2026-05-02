import { Router } from "express";
import { db, kdsConfigTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { broadcast } from "../lib/ws";

const router = Router();

router.get("/kds/templates", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(kdsConfigTemplatesTable)
    .orderBy(kdsConfigTemplatesTable.createdAt);
  res.json(rows);
});

router.get("/kds/templates/active", async (req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(kdsConfigTemplatesTable)
    .where(eq(kdsConfigTemplatesTable.isActive, true));
  res.json(row ?? null);
});

router.post("/kds/templates", async (req, res): Promise<void> => {
  const { name, config } = req.body as { name?: string; config?: unknown };
  if (!name || !config) {
    res.status(400).json({ error: "name and config required" });
    return;
  }
  const [row] = await db
    .insert(kdsConfigTemplatesTable)
    .values({ id: randomUUID(), name, config, isActive: false })
    .returning();
  res.json(row);
});

router.post("/kds/templates/active", async (req, res): Promise<void> => {
  const { name, config } = req.body as { name?: string; config?: unknown };
  if (!config) {
    res.status(400).json({ error: "config required" });
    return;
  }
  await db
    .update(kdsConfigTemplatesTable)
    .set({ isActive: false })
    .where(eq(kdsConfigTemplatesTable.isActive, true));
  const [row] = await db
    .insert(kdsConfigTemplatesTable)
    .values({ id: randomUUID(), name: name ?? "Broadcast", config, isActive: true })
    .returning();

  broadcast({ type: "kds_config_push", payload: { config } });

  res.json(row);
});

router.delete("/kds/templates/active", async (req, res): Promise<void> => {
  await db
    .update(kdsConfigTemplatesTable)
    .set({ isActive: false })
    .where(eq(kdsConfigTemplatesTable.isActive, true));
  res.json({ ok: true });
});

router.delete("/kds/templates/:id", async (req, res): Promise<void> => {
  await db
    .delete(kdsConfigTemplatesTable)
    .where(eq(kdsConfigTemplatesTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
