import { Router } from "express";
import { db, kdsConfigTemplatesTable, modifierColorSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { broadcast } from "../lib/ws";

const router = Router();

// ─── KDS Config Templates ────────────────────────────────────────────────────

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

// ─── Modifier Color Settings ─────────────────────────────────────────────────

const DEFAULT_MOD_COLORS = {
  remove: { text: "#fca5a5", dot: "#ef4444" },
  extra:  { text: "#86efac", dot: "#22c55e" },
  normal: { text: "rgba(255,255,255,0.88)", dot: "#9ca3af" },
};

router.get("/modifier-colors", async (req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(modifierColorSettingsTable)
    .where(eq(modifierColorSettingsTable.id, "default"));
  res.json(row?.colors ?? DEFAULT_MOD_COLORS);
});

router.put("/modifier-colors", async (req, res): Promise<void> => {
  const { remove, extra, normal } = req.body as {
    remove?: { text: string; dot: string };
    extra?:  { text: string; dot: string };
    normal?: { text: string; dot: string };
  };
  if (!remove?.text || !extra?.text || !normal?.text) {
    res.status(400).json({ error: "remove, extra, and normal color sets are required" });
    return;
  }
  const colors = { remove, extra, normal };
  await db
    .insert(modifierColorSettingsTable)
    .values({ id: "default", colors })
    .onConflictDoUpdate({
      target: modifierColorSettingsTable.id,
      set: { colors, updatedAt: new Date() },
    });
  broadcast({ type: "modifier_colors_update", payload: colors });
  res.json(colors);
});

export default router;
