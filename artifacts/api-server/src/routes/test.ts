import { Router } from "express";
import { db, ordersTable, orderItemsTable, storesTable, stationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { broadcast } from "../lib/ws";
import { runtimeConfig } from "../lib/runtime-config";

const router = Router();

const MENU_ITEMS = [
  { name: "Ribeye Steak",    station: "grill",   mods: [["Medium rare", "Extra sauce"], ["Well done", "No butter"], []] },
  { name: "Smash Burger",    station: "grill",   mods: [["No onions", "Extra cheese"], ["Add bacon", "Gluten free bun"], []] },
  { name: "BBQ Ribs",        station: "grill",   mods: [["Extra sauce"], ["Half rack"], []] },
  { name: "Grilled Chicken", station: "grill",   mods: [["No lemon"], ["Extra herbs", "Garlic butter"], []] },
  { name: "Lamb Rack",       station: "grill",   mods: [["Rosemary jus"], ["Medium", "Mint sauce"], []] },
  { name: "Caesar Salad",    station: "cold",    mods: [["No croutons", "Extra parmesan"], ["Add chicken"], []] },
  { name: "Prawn Cocktail",  station: "cold",    mods: [["Extra sauce"], ["No lettuce"], []] },
  { name: "Coleslaw",        station: "cold",    mods: [[], ["Light mayo"], []] },
  { name: "Chips / Fries",   station: "fryer",   mods: [["Light salt"], ["Extra crispy"], ["Seasoned"]] },
  { name: "Onion Rings",     station: "fryer",   mods: [[], ["Extra crispy"], []] },
  { name: "Calamari",        station: "fryer",   mods: [[], ["Extra lemon"], []] },
  { name: "Crème Brûlée",    station: "dessert", mods: [["Extra sugar"], [], []] },
  { name: "Ice Cream",       station: "dessert", mods: [["Chocolate sauce"], ["No sauce"], ["Extra scoop"]] },
  { name: "Sticky Pudding",  station: "dessert", mods: [["Extra cream"], [], []] },
];

const PRIORITIES  = ["normal", "normal", "normal", "rush", "vip"] as const;
const NAMES       = ["Smith", "Jones", "Chen", "Garcia", "Park", "Taylor", "Wilson", "Ali", "Brown"];
const ORDER_NOTES = ["", "", "", "Allergy: nuts", "Birthday table — add candles", "VIP guest"];

/** POST /api/test/inject-order[?storeId=<uuid>]
 *
 * Injects a randomised realistic test order into the KDS.
 * Resolves the correct station IDs from the DB so items appear on the right station tabs.
 * If storeId is omitted, uses the first store in the database.
 *
 * Blocked by ALLOW_TEST_ORDERS=false env var (or runtime toggle via /api/admin/settings).
 */
router.post("/test/inject-order", async (req, res): Promise<void> => {
  if (!runtimeConfig.testOrdersEnabled) {
    res.status(403).json({ error: "Test orders are disabled on this server." });
    return;
  }

  const requestedStoreId = req.query.storeId as string | undefined;

  const [store] = requestedStoreId
    ? await db.select().from(storesTable).where(eq(storesTable.id, requestedStoreId)).limit(1)
    : await db.select().from(storesTable).limit(1);

  if (!store) {
    res.status(404).json({ error: "No store found — complete Setup first" });
    return;
  }

  const stations = await db
    .select()
    .from(stationsTable)
    .where(eq(stationsTable.storeId, store.id));

  const stationByName = new Map(
    stations.map(s => [s.name.toLowerCase().replace(/\s+/g, ""), s.id]),
  );

  function resolveStation(slug: string): string {
    for (const [key, id] of stationByName.entries()) {
      if (key.includes(slug) || slug.includes(key)) return id;
    }
    return stations[0]?.id ?? "other";
  }

  const orderNum   = String(Math.floor(Math.random() * 900) + 100);
  const tableNum   = Math.floor(Math.random() * 20) + 1;
  const priority   = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
  const customer   = NAMES[Math.floor(Math.random() * NAMES.length)];
  const orderNote  = ORDER_NOTES[Math.floor(Math.random() * ORDER_NOTES.length)];
  const count      = Math.floor(Math.random() * 3) + 2;

  const pickedItems = [...MENU_ITEMS]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  const orderId = randomUUID();

  await db.insert(ordersTable).values({
    id:           orderId,
    storeId:      store.id,
    orderNumber:  orderNum,
    customerName: customer,
    priority,
    status:       "in_progress",
    notes:        orderNote,
    createdAt:    new Date(),
  });

  const itemRows = pickedItems.map((item, i) => {
    const mods = item.mods[Math.floor(Math.random() * item.mods.length)] ?? [];
    return {
      id:        randomUUID(),
      orderId,
      storeId:   store.id,
      name:      item.name,
      quantity:  1,
      stationId: resolveStation(item.station),
      modifiers: mods,
      notes:     null as string | null,
      status:    "pending" as const,
      sortOrder: i,
      createdAt: new Date(),
    };
  });

  await db.insert(orderItemsTable).values(itemRows);

  broadcast({
    type:    "order_created",
    payload: { orderId, storeId: store.id, orderNumber: orderNum, priority, source: "test" },
  });

  req.log.info({ orderId, orderNumber: orderNum, priority }, "Test order injected");

  const [inserted] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));

  res.status(201).json({ ok: true, order: { ...inserted, items } });
});

export default router;
