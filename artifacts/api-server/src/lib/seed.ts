import { db, enterprisesTable, storesTable, stationsTable, devicesTable, ordersTable, orderItemsTable } from "@workspace/db";
import { logger } from "./logger";
import { randomUUID } from "crypto";

export async function seed(): Promise<void> {
  const existing = await db.select().from(enterprisesTable).limit(1);
  if (existing.length > 0) {
    logger.info("Seed data already exists, skipping");
    return;
  }

  logger.info("Seeding initial data...");

  const enterpriseId = randomUUID();
  await db.insert(enterprisesTable).values({
    id: enterpriseId,
    name: "Demo Hospitality Group",
    slug: "demo-group",
    config: {},
  });

  const storeId = randomUUID();
  await db.insert(storesTable).values({
    id: storeId,
    enterpriseId,
    name: "Main Street Kitchen",
    location: "123 Main St, Downtown",
    timezone: "America/New_York",
    config: {},
  });

  const grillId = randomUUID();
  const coldId = randomUUID();
  const fryId = randomUUID();
  const dessertId = randomUUID();

  await db.insert(stationsTable).values([
    { id: grillId, storeId, name: "Grill", color: "#ef4444", sortOrder: 0 },
    { id: coldId, storeId, name: "Cold Prep", color: "#3b82f6", sortOrder: 1 },
    { id: fryId, storeId, name: "Fryer", color: "#f59e0b", sortOrder: 2 },
    { id: dessertId, storeId, name: "Dessert", color: "#8b5cf6", sortOrder: 3 },
  ]);

  await db.insert(devicesTable).values([
    {
      id: randomUUID(),
      storeId,
      name: "KDS-01 (Grill)",
      deviceToken: randomUUID(),
      stationIds: [grillId, fryId],
      status: "online",
      lastSeenAt: new Date(),
      config: {},
    },
    {
      id: randomUUID(),
      storeId,
      name: "KDS-02 (Cold)",
      deviceToken: randomUUID(),
      stationIds: [coldId, dessertId],
      status: "idle",
      lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
      config: {},
    },
  ]);

  // Seed 6 orders across different statuses
  const ordersData = [
    { num: "101", status: "in_progress", priority: "rush", customer: "Table 5", minsAgo: 8 },
    { num: "102", status: "pending", priority: "normal", customer: "Table 12", minsAgo: 2 },
    { num: "103", status: "ready", priority: "vip", customer: "Table 3", minsAgo: 15 },
    { num: "104", status: "pending", priority: "normal", customer: "To Go #44", minsAgo: 1 },
    { num: "105", status: "in_progress", priority: "normal", customer: "Table 7", minsAgo: 5 },
    { num: "100", status: "completed", priority: "normal", customer: "Table 1", minsAgo: 30 },
  ] as const;

  const itemTemplates: Record<string, { name: string; stationId: string; modifiers?: string[] }[]> = {
    "101": [
      { name: "Smash Burger", stationId: grillId, modifiers: ["No onions", "Extra cheese"] },
      { name: "Truffle Fries", stationId: fryId, modifiers: ["Light salt"] },
    ],
    "102": [
      { name: "Caesar Salad", stationId: coldId, modifiers: ["Dressing on side"] },
      { name: "Grilled Chicken", stationId: grillId, modifiers: [] },
    ],
    "103": [
      { name: "NY Strip Steak", stationId: grillId, modifiers: ["Medium rare", "No sauce"] },
      { name: "Crème Brûlée", stationId: dessertId, modifiers: [] },
    ],
    "104": [
      { name: "Veggie Wrap", stationId: coldId, modifiers: ["Extra hummus"] },
      { name: "Sweet Potato Fries", stationId: fryId, modifiers: [] },
    ],
    "105": [
      { name: "BBQ Ribs", stationId: grillId, modifiers: ["Extra sauce"] },
      { name: "Coleslaw", stationId: coldId, modifiers: [] },
      { name: "Onion Rings", stationId: fryId, modifiers: [] },
    ],
    "100": [
      { name: "Fish & Chips", stationId: fryId, modifiers: [] },
    ],
  };

  for (const o of ordersData) {
    const orderId = randomUUID();
    const createdAt = new Date(Date.now() - o.minsAgo * 60 * 1000);
    const completedAt = o.status === "completed" ? new Date(Date.now() - 5 * 60 * 1000) : undefined;
    await db.insert(ordersTable).values({
      id: orderId,
      storeId,
      orderNumber: o.num,
      status: o.status,
      priority: o.priority,
      customerName: o.customer,
      createdAt,
      startedAt: o.status !== "pending" ? createdAt : undefined,
      completedAt,
    });

    const items = itemTemplates[o.num] ?? [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await db.insert(orderItemsTable).values({
        id: randomUUID(),
        orderId,
        stationId: item.stationId,
        name: item.name,
        quantity: 1,
        modifiers: item.modifiers ?? [],
        status: o.status === "completed" ? "ready" : o.status === "ready" ? "ready" : "pending",
        sortOrder: i,
      });
    }
  }

  logger.info("Seed data inserted successfully");
}
