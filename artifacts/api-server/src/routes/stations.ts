import { Router } from "express";
import { db, stationsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateStationBody, ListStationsQueryParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

router.get("/stations", async (req, res): Promise<void> => {
  const params = ListStationsQueryParams.parse(req.query);
  if (params.storeId) {
    const stations = await db
      .select()
      .from(stationsTable)
      .where(eq(stationsTable.storeId, params.storeId))
      .orderBy(asc(stationsTable.sortOrder));
    res.json(stations);
    return;
  }
  const stations = await db
    .select()
    .from(stationsTable)
    .orderBy(asc(stationsTable.sortOrder));
  res.json(stations);
});

router.post("/stations", async (req, res): Promise<void> => {
  const body = CreateStationBody.parse(req.body);
  const [station] = await db
    .insert(stationsTable)
    .values({ id: randomUUID(), ...body })
    .returning();
  res.status(201).json(station);
});

router.get("/stations/:id", async (req, res): Promise<void> => {
  const [station] = await db
    .select()
    .from(stationsTable)
    .where(eq(stationsTable.id, req.params.id));
  if (!station) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(station);
});

export default router;
