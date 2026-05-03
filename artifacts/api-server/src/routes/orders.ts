import { Router } from "express";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  CreateOrderBody,
  UpdateOrderBody,
  UpdateOrderItemStatusBody,
  ListOrdersQueryParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { broadcast } from "../lib/ws";
import { strictLimiter } from "../middleware/rate-limit";

const router = Router();

async function getOrderWithItems(orderId: string) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId))
    .orderBy(orderItemsTable.sortOrder);
  const elapsedSeconds = order.completedAt
    ? Math.floor((order.completedAt.getTime() - order.createdAt.getTime()) / 1000)
    : Math.floor((Date.now() - order.createdAt.getTime()) / 1000);
  return { ...order, items, elapsedSeconds };
}

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.parse(req.query);

  const conditions = [];
  if (params.storeId) conditions.push(eq(ordersTable.storeId, params.storeId));
  if (params.status) conditions.push(eq(ordersTable.status, params.status));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(500);

  // Attach items
  if (orders.length === 0) {
    res.json([]);
    return;
  }
  const orderIds = orders.map((o) => o.id);
  const allItems = await db
    .select()
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, orderIds))
    .orderBy(orderItemsTable.sortOrder);

  const itemsByOrderId = allItems.reduce(
    (acc, item) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push(item);
      return acc;
    },
    {} as Record<string, typeof allItems>,
  );

  const result = orders.map((o) => ({
    ...o,
    items: itemsByOrderId[o.id] ?? [],
    elapsedSeconds: o.completedAt
      ? Math.floor((o.completedAt.getTime() - o.createdAt.getTime()) / 1000)
      : Math.floor((Date.now() - o.createdAt.getTime()) / 1000),
  }));

  // Filter by stationId if provided
  if (params.stationId) {
    const filtered = result
      .filter((o) => o.items.some((item) => item.stationId === params.stationId))
      .map((o) => ({
        ...o,
        items: o.items.filter((item) => item.stationId === params.stationId),
      }));
    res.json(filtered);
    return;
  }

  res.json(result);
});

router.post("/orders", async (req, res): Promise<void> => {
  const body = CreateOrderBody.parse(req.body);

  const { order, items } = await db.transaction(async (tx) => {
    const orderId = randomUUID();
    const [order] = await tx
      .insert(ordersTable)
      .values({
        id: orderId,
        storeId: body.storeId,
        posOrderId: body.posOrderId ?? null,
        orderNumber: body.orderNumber,
        status: "pending",
        priority: body.priority ?? "normal",
        customerName: body.customerName ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    const itemRows = (body.items ?? []).length > 0
      ? await tx
          .insert(orderItemsTable)
          .values(
            (body.items ?? []).map((item, idx) => ({
              id: randomUUID(),
              orderId,
              stationId: item.stationId,
              name: item.name,
              quantity: item.quantity,
              modifiers: item.modifiers ?? [],
              notes: item.notes ?? null,
              status: "pending" as const,
              sortOrder: item.sortOrder ?? idx,
            })),
          )
          .returning()
      : [];

    return { order, items: itemRows };
  });

  const result = { ...order, items, elapsedSeconds: 0 };

  broadcast({
    type: "order_created",
    payload: { orderId: order.id, storeId: body.storeId, orderNumber: body.orderNumber },
  });

  res.status(201).json(result);
});

router.post("/orders/clear-all", strictLimiter, async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string | undefined;

  const conditions = [inArray(ordersTable.status, ["in_progress", "pending"] as const)];
  if (storeId) conditions.push(eq(ordersTable.storeId, storeId));

  const cleared = await db
    .update(ordersTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(...conditions))
    .returning();

  if (cleared.length > 0) {
    await db
      .update(orderItemsTable)
      .set({ status: "ready" })
      .where(
        and(
          inArray(orderItemsTable.orderId, cleared.map(o => o.id)),
          eq(orderItemsTable.status, "pending"),
        ),
      );
    broadcast({ type: "orders_cleared", payload: { count: cleared.length, storeId: storeId ?? "" } });
  }

  req.log.info({ count: cleared.length }, "All active orders cleared");
  res.json({ ok: true, cleared: cleared.length });
});

router.post("/orders/:id/recall", async (req, res): Promise<void> => {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, req.params.id));

  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [recalled] = await db
    .update(ordersTable)
    .set({ status: "in_progress", completedAt: null, startedAt: new Date() })
    .where(eq(ordersTable.id, req.params.id))
    .returning();

  await db
    .update(orderItemsTable)
    .set({ status: "pending" })
    .where(eq(orderItemsTable.orderId, req.params.id));

  const result = await getOrderWithItems(recalled.id);
  broadcast({
    type: "order_updated",
    payload: { orderId: recalled.id, storeId: recalled.storeId, orderNumber: recalled.orderNumber },
  });

  req.log.info({ orderId: recalled.id, orderNumber: recalled.orderNumber }, "Order recalled");
  res.json(result);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const order = await getOrderWithItems(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(order);
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const body = UpdateOrderBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body };
  if (body.status === "in_progress") updateData.startedAt = new Date();
  if (body.status === "completed" || body.status === "ready") {
    updateData.completedAt = new Date();
  }
  const [order] = await db
    .update(ordersTable)
    .set(updateData)
    .where(eq(ordersTable.id, req.params.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const result = await getOrderWithItems(order.id);
  broadcast({
    type: "order_updated",
    payload: { orderId: order.id, storeId: order.storeId, orderNumber: order.orderNumber },
  });
  res.json(result);
});

router.post("/orders/:id/bump", strictLimiter, async (req, res): Promise<void> => {
  const orderId = req.params["id"] as string;
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [bumped] = await db
    .update(ordersTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(ordersTable.id, orderId))
    .returning();
  // Mark all items ready
  await db
    .update(orderItemsTable)
    .set({ status: "ready" })
    .where(
      and(eq(orderItemsTable.orderId, orderId), eq(orderItemsTable.status, "pending")),
    );
  const result = await getOrderWithItems(bumped.id);
  broadcast({
    type: "order_bumped",
    payload: { orderId: bumped.id, storeId: bumped.storeId, orderNumber: bumped.orderNumber },
  });
  res.json(result);
});

router.patch("/orders/:id/items/:itemId/status", async (req, res): Promise<void> => {
  const body = UpdateOrderItemStatusBody.parse(req.body);
  const [item] = await db
    .update(orderItemsTable)
    .set({ status: body.status })
    .where(
      and(
        eq(orderItemsTable.id, req.params.itemId),
        eq(orderItemsTable.orderId, req.params.id),
      ),
    )
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, req.params.id));
  if (order) {
    broadcast({
      type: "item_status_updated",
      payload: { orderId: order.id, storeId: order.storeId, orderNumber: order.orderNumber },
    });
  }

  res.json(item);
});

export default router;
