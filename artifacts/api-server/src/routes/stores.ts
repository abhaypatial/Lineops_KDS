import { Router } from "express";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateStoreBody, ListStoresQueryParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

router.get("/stores", async (req, res): Promise<void> => {
  const params = ListStoresQueryParams.parse(req.query);
  if (params.enterpriseId) {
    const stores = await db
      .select()
      .from(storesTable)
      .where(eq(storesTable.enterpriseId, params.enterpriseId))
      .orderBy(storesTable.createdAt);
    res.json(stores);
    return;
  }
  const stores = await db.select().from(storesTable).orderBy(storesTable.createdAt);
  res.json(stores);
});

router.post("/stores", async (req, res): Promise<void> => {
  const body = CreateStoreBody.parse(req.body);
  const [store] = await db
    .insert(storesTable)
    .values({ id: randomUUID(), ...body })
    .returning();
  res.status(201).json(store);
});

router.get("/stores/:id", async (req, res): Promise<void> => {
  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.id, req.params.id));
  if (!store) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(store);
});

export default router;
