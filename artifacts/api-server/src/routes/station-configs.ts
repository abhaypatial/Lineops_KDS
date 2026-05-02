import { Router } from "express";
import { db, kdsStationConfigsTable, devicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { broadcast, broadcastToDevice, stripMachineLocal } from "../lib/ws";

const router = Router();

router.get("/stations/:id/config", async (req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(kdsStationConfigsTable)
    .where(eq(kdsStationConfigsTable.stationId, req.params.id));
  res.json(row ?? null);
});

router.put("/stations/:id/config", async (req, res): Promise<void> => {
  const { config } = req.body as { config?: unknown };
  if (!config) {
    res.status(400).json({ error: "config required" });
    return;
  }
  const [row] = await db
    .insert(kdsStationConfigsTable)
    .values({ stationId: req.params.id, config })
    .onConflictDoUpdate({
      target: kdsStationConfigsTable.stationId,
      set: { config, updatedAt: new Date() },
    })
    .returning();
  res.json(row);
});

router.post("/stations/:id/push-config", async (req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(kdsStationConfigsTable)
    .where(eq(kdsStationConfigsTable.stationId, req.params.id));
  if (!row) {
    res.status(404).json({ error: "No config saved for this station" });
    return;
  }

  const allDevices = await db.select().from(devicesTable);
  const assigned = allDevices.filter((d) =>
    (d.stationIds as string[]).includes(req.params.id),
  );

  const safe = stripMachineLocal(row.config as Record<string, unknown>);
  let devicesReached = 0;
  for (const device of assigned) {
    if (broadcastToDevice(device.id, { type: "kds_config_push", payload: { config: safe } })) {
      devicesReached++;
    }
  }

  broadcast({ type: "kds_config_push", payload: { config: safe, stationId: req.params.id } });

  res.json({ ok: true, devicesFound: assigned.length, devicesReached });
});

router.post("/stations/copy-config", async (req, res): Promise<void> => {
  const { fromStationId, toStationId } = req.body as {
    fromStationId?: string;
    toStationId?: string;
  };
  if (!fromStationId || !toStationId) {
    res.status(400).json({ error: "fromStationId and toStationId required" });
    return;
  }
  const [src] = await db
    .select()
    .from(kdsStationConfigsTable)
    .where(eq(kdsStationConfigsTable.stationId, fromStationId));
  if (!src) {
    res.status(404).json({ error: "No config saved for source station" });
    return;
  }
  const [row] = await db
    .insert(kdsStationConfigsTable)
    .values({ stationId: toStationId, config: src.config })
    .onConflictDoUpdate({
      target: kdsStationConfigsTable.stationId,
      set: { config: src.config, updatedAt: new Date() },
    })
    .returning();
  res.json(row);
});

export default router;
