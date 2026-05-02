import { Router } from "express";
import { db, ordersTable, orderItemsTable, stationsTable, devicesTable } from "@workspace/db";
import { eq, and, gte, count, ne } from "drizzle-orm";
import {
  GetDashboardSummaryQueryParams,
  GetRecentActivityQueryParams,
  GetStationLoadQueryParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

async function countRows(query: Promise<{ count: number }[]>): Promise<number> {
  const rows = await query;
  return rows[0]?.count ?? 0;
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const params = GetDashboardSummaryQueryParams.parse(req.query);
  const storeFilter = params.storeId ? eq(ordersTable.storeId, params.storeId) : undefined;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pendingCount = await countRows(
    db.select({ count: count() }).from(ordersTable).where(and(storeFilter, eq(ordersTable.status, "pending")))
  );
  const inProgressCount = await countRows(
    db.select({ count: count() }).from(ordersTable).where(and(storeFilter, eq(ordersTable.status, "in_progress")))
  );
  const readyCount = await countRows(
    db.select({ count: count() }).from(ordersTable).where(and(storeFilter, eq(ordersTable.status, "ready")))
  );
  const completedToday = await countRows(
    db.select({ count: count() }).from(ordersTable).where(and(storeFilter, eq(ordersTable.status, "completed"), gte(ordersTable.completedAt, todayStart)))
  );
  const rushCount = await countRows(
    db.select({ count: count() }).from(ordersTable).where(
      and(storeFilter, eq(ordersTable.priority, "rush"), ne(ordersTable.status, "completed"), ne(ordersTable.status, "cancelled"))
    )
  );
  const onlineDevices = await countRows(
    db.select({ count: count() }).from(devicesTable).where(
      params.storeId
        ? and(eq(devicesTable.storeId, params.storeId), eq(devicesTable.status, "online"))
        : eq(devicesTable.status, "online")
    )
  );

  res.json({
    totalActive: pendingCount + inProgressCount + readyCount,
    totalPending: pendingCount,
    totalInProgress: inProgressCount,
    totalReady: readyCount,
    totalCompletedToday: completedToday,
    avgCompletionSeconds: 0,
    rushCount,
    onlineDevices,
  });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.parse(req.query);
  const limit = params.limit ?? 20;

  const recent = await db
    .select()
    .from(ordersTable)
    .where(params.storeId ? eq(ordersTable.storeId, params.storeId) : undefined)
    .orderBy(ordersTable.createdAt)
    .limit(limit);

  const events = recent.map((order) => ({
    id: randomUUID(),
    type:
      order.status === "completed"
        ? ("order_bumped" as const)
        : order.status === "ready"
          ? ("order_ready" as const)
          : ("order_created" as const),
    orderId: order.id,
    orderNumber: order.orderNumber,
    stationName: undefined,
    message: `Order #${order.orderNumber} ${order.status === "completed" ? "completed" : order.status === "ready" ? "marked ready" : "created"}${order.customerName ? ` for ${order.customerName}` : ""}`,
    timestamp: order.completedAt ?? order.createdAt,
  }));

  res.json(events);
});

router.get("/dashboard/station-load", async (req, res): Promise<void> => {
  const params = GetStationLoadQueryParams.parse(req.query);

  const stations = await db
    .select()
    .from(stationsTable)
    .where(params.storeId ? eq(stationsTable.storeId, params.storeId) : undefined)
    .orderBy(stationsTable.sortOrder);

  const result = await Promise.all(
    stations.map(async (station) => {
      const pendingCount = await countRows(
        db.select({ count: count() }).from(orderItemsTable).where(and(eq(orderItemsTable.stationId, station.id), eq(orderItemsTable.status, "pending")))
      );
      const inProgressCount = await countRows(
        db.select({ count: count() }).from(orderItemsTable).where(and(eq(orderItemsTable.stationId, station.id), eq(orderItemsTable.status, "in_progress")))
      );
      const readyCount = await countRows(
        db.select({ count: count() }).from(orderItemsTable).where(and(eq(orderItemsTable.stationId, station.id), eq(orderItemsTable.status, "ready")))
      );

      return {
        stationId: station.id,
        stationName: station.name,
        color: station.color ?? "#6366f1",
        pendingCount,
        inProgressCount,
        readyCount,
        totalActive: pendingCount + inProgressCount + readyCount,
      };
    }),
  );

  res.json(result);
});

export default router;
