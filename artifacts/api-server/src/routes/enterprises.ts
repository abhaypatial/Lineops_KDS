import { Router } from "express";
import { db, enterprisesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateEnterpriseBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

router.get("/enterprises", async (req, res): Promise<void> => {
  const enterprises = await db.select().from(enterprisesTable).orderBy(enterprisesTable.createdAt);
  res.json(enterprises);
});

router.post("/enterprises", async (req, res): Promise<void> => {
  const body = CreateEnterpriseBody.parse(req.body);
  const [enterprise] = await db
    .insert(enterprisesTable)
    .values({ id: randomUUID(), ...body })
    .returning();
  res.status(201).json(enterprise);
});

router.get("/enterprises/:id", async (req, res): Promise<void> => {
  const [enterprise] = await db
    .select()
    .from(enterprisesTable)
    .where(eq(enterprisesTable.id, req.params.id));
  if (!enterprise) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(enterprise);
});

export default router;
