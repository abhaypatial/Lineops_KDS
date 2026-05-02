import { Router } from "express";
import { db, devicesTable, kdsConfigTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateDeviceBody,
  UpdateDeviceBody,
  ListDevicesQueryParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { broadcastToDevice, stripMachineLocal, getRegisteredDeviceIds } from "../lib/ws";

const router = Router();

router.get("/devices", async (req, res): Promise<void> => {
  const params = ListDevicesQueryParams.parse(req.query);
  if (params.storeId) {
    const devices = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.storeId, params.storeId))
      .orderBy(devicesTable.createdAt);
    res.json(devices);
    return;
  }
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);
  res.json(devices);
});

router.post("/devices", async (req, res): Promise<void> => {
  const body = CreateDeviceBody.parse(req.body);
  const [device] = await db
    .insert(devicesTable)
    .values({
      id: randomUUID(),
      deviceToken: randomUUID(),
      status: "offline",
      ...body,
    })
    .returning();
  res.status(201).json(device);
});

router.get("/devices/online", async (req, res): Promise<void> => {
  const ids = getRegisteredDeviceIds();
  res.json({ deviceIds: ids, count: ids.length });
});

router.get("/devices/:id", async (req, res): Promise<void> => {
  const [device] = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.id, req.params.id));
  if (!device) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(device);
});

router.patch("/devices/:id", async (req, res): Promise<void> => {
  const body = UpdateDeviceBody.parse(req.body);
  const [device] = await db
    .update(devicesTable)
    .set({ ...body, lastSeenAt: new Date() })
    .where(eq(devicesTable.id, req.params.id))
    .returning();
  if (!device) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(device);
});

router.post("/devices/:id/push-config", async (req, res): Promise<void> => {
  const { templateId, config } = req.body as { templateId?: string; config?: Record<string, unknown> };

  const [device] = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.id, req.params.id));
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  let raw: Record<string, unknown>;

  if (templateId) {
    const [tpl] = await db
      .select()
      .from(kdsConfigTemplatesTable)
      .where(eq(kdsConfigTemplatesTable.id, templateId));
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    raw = tpl.config as Record<string, unknown>;
  } else if (config) {
    raw = config;
  } else {
    res.status(400).json({ error: "templateId or config required" });
    return;
  }

  const safe = stripMachineLocal(raw);
  const reached = broadcastToDevice(device.id, { type: "kds_config_push", payload: { config: safe } });

  res.json({ ok: true, reached, deviceName: device.name, deviceId: device.id });
});

export default router;
