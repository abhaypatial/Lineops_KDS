import { Router } from "express";
import { db, devicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateDeviceBody,
  UpdateDeviceBody,
  ListDevicesQueryParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

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

export default router;
