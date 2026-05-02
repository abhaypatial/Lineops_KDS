import { Router } from "express";
import { randomUUID } from "crypto";
import { db, ordersTable, orderItemsTable, integrationEventsTable, storesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { broadcast } from "../lib/ws";
import { fireWebhooks } from "../lib/outboundWebhook";
import { requireApiKey, type AuthedRequest } from "../lib/apiKey";
import { squareAdapter }     from "../lib/pos/square";
import { toastAdapter }      from "../lib/pos/toast";
import { cloverAdapter }     from "../lib/pos/clover";
import { lightspeedAdapter } from "../lib/pos/lightspeed";
import { volanteAdapter }    from "../lib/pos/volante";
import { genericAdapter }    from "../lib/pos/generic";
import type { NormalisedOrder } from "../lib/pos/types";
import { z } from "zod";

const router = Router();

// ── Shared: persist a normalised order into the DB ─────────────────────────

async function createOrderFromNormalised(
  normalised: NormalisedOrder,
  storeId: string,
): Promise<typeof ordersTable.$inferSelect> {
  const orderId = randomUUID();
  const [order] = await db.insert(ordersTable).values({
    id:           orderId,
    storeId,
    orderNumber:  normalised.orderNumber,
    customerName: normalised.customerName ?? null,
    notes:        normalised.notes ?? null,
    priority:     normalised.priority,
    status:       "pending",
    posOrderId:   normalised.externalId,
  }).returning();

  await db.insert(orderItemsTable).values(
    normalised.items.map((item, idx) => ({
      id:        randomUUID(),
      orderId,
      stationId: item.stationId,
      name:      item.name,
      quantity:  item.quantity,
      modifiers: item.modifiers ?? [],
      notes:     item.notes ?? null,
      status:    "pending" as const,
      sortOrder: idx,
    })),
  );

  broadcast({
    type:    "order_created",
    payload: { orderId, storeId, orderNumber: normalised.orderNumber },
  });

  await fireWebhooks("order.created", storeId, {
    orderId, orderNumber: normalised.orderNumber, source: "pos_integration",
  });

  return order;
}

// ── Shared handler for all POS webhook adapters ────────────────────────────

type Adapter = (
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
) => ReturnType<typeof squareAdapter>;

async function handlePosWebhook(
  req: ReturnType<typeof Router>["use"] extends (path: string, ...handlers: infer H) => unknown ? never : never,
  source: string,
  storeId: string,
  adapter: Adapter,
  secret: string,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  resObj: Parameters<Parameters<typeof router.post>[1]>[1],
): Promise<void> {
  const eventId = randomUUID();

  try {
    const result = adapter(headers, rawBody, secret);

    // Log the event regardless
    await db.insert(integrationEventsTable).values({
      id:         eventId,
      storeId,
      source,
      eventType:  "webhook",
      externalId: result.order?.externalId ?? null,
      payload:    JSON.parse(rawBody),
      processed:  result.shouldProcess,
    });

    if (!result.shouldProcess || !result.order) {
      resObj.json({ received: true, processed: false, reason: "event_ignored" });
      return;
    }

    const order = await createOrderFromNormalised(result.order, storeId);

    await db.update(integrationEventsTable)
      .set({ orderId: order.id })
      .where(eq(integrationEventsTable.id, eventId));

    resObj.json({ received: true, processed: true, orderId: order.id, orderNumber: order.orderNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.insert(integrationEventsTable).values({
      id:        eventId,
      storeId,
      source,
      eventType: "webhook_error",
      payload:   { raw: rawBody.slice(0, 2000) },
      processed: false,
      error:     msg,
    }).catch(() => {/* non-fatal */});
    resObj.status(400).json({ error: msg });
  }
}

// ── POS Webhook endpoints ──────────────────────────────────────────────────
// Each endpoint requires ?storeId=xxx and reads the webhook secret from the DB
// (in production this would be stored per-integration in the DB; here we use env vars as fallback)

const getStoreOrFail = async (storeId: string, res: Parameters<Parameters<typeof router.post>[1]>[1]) => {
  if (!storeId) { res.status(400).json({ error: "storeId query param required" }); return null; }
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
  if (!store) { res.status(404).json({ error: "Store not found" }); return null; }
  return store;
};

// Square
router.post("/integrations/square/webhook", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string;
  const store = await getStoreOrFail(storeId, res); if (!store) return;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.SQUARE_WEBHOOK_SECRET ?? "";
  await handlePosWebhook(null as never, "square", storeId, squareAdapter as Adapter, secret, rawBody, req.headers as Record<string, string | string[] | undefined>, res);
});

// Toast
router.post("/integrations/toast/webhook", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string;
  const store = await getStoreOrFail(storeId, res); if (!store) return;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.TOAST_WEBHOOK_SECRET ?? "";
  await handlePosWebhook(null as never, "toast", storeId, toastAdapter as Adapter, secret, rawBody, req.headers as Record<string, string | string[] | undefined>, res);
});

// Clover
router.post("/integrations/clover/webhook", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string;
  const store = await getStoreOrFail(storeId, res); if (!store) return;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.CLOVER_WEBHOOK_SECRET ?? "";
  await handlePosWebhook(null as never, "clover", storeId, cloverAdapter as Adapter, secret, rawBody, req.headers as Record<string, string | string[] | undefined>, res);
});

// Lightspeed
router.post("/integrations/lightspeed/webhook", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string;
  const store = await getStoreOrFail(storeId, res); if (!store) return;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.LIGHTSPEED_WEBHOOK_SECRET ?? "";
  await handlePosWebhook(null as never, "lightspeed", storeId, lightspeedAdapter as Adapter, secret, rawBody, req.headers as Record<string, string | string[] | undefined>, res);
});

// Volante Systems VE POS
router.post("/integrations/volante/webhook", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string;
  const store = await getStoreOrFail(storeId, res); if (!store) return;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.VOLANTE_WEBHOOK_SECRET ?? "";
  await handlePosWebhook(null as never, "volante", storeId, volanteAdapter as Adapter, secret, rawBody, req.headers as Record<string, string | string[] | undefined>, res);
});

// Generic / Custom — authenticated with API key
router.post("/integrations/orders", requireApiKey, async (req: AuthedRequest, res): Promise<void> => {
  const storeId = req.apiKey!.storeId;
  try {
    const result = genericAdapter(req.body);
    if (!result.order) { res.status(400).json({ error: "Invalid payload" }); return; }
    const order = await createOrderFromNormalised(result.order, storeId);
    await db.insert(integrationEventsTable).values({
      id:         randomUUID(),
      storeId,
      source:     "generic",
      eventType:  "order.push",
      externalId: result.order.externalId,
      payload:    req.body,
      processed:  true,
      orderId:    order.id,
    });
    res.status(201).json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// Recent integration events (admin view)
router.get("/integrations/events", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const storeId = req.query.storeId as string | undefined;

  const rows = storeId
    ? await db.select().from(integrationEventsTable)
        .where(eq(integrationEventsTable.storeId, storeId))
        .orderBy(desc(integrationEventsTable.createdAt)).limit(limit)
    : await db.select().from(integrationEventsTable)
        .orderBy(desc(integrationEventsTable.createdAt)).limit(limit);

  res.json({ events: rows });
});

// Integration status / capabilities
router.get("/integrations", (_req, res): Promise<void> => {
  res.json({
    integrations: [
      {
        id:       "square",
        name:     "Square",
        status:   "available",
        webhook:  "/api/integrations/square/webhook",
        docs:     "https://developer.squareup.com/docs/webhooks/overview",
        events:   ["order.created", "order.updated", "payment.created"],
        authType: "hmac_sha256",
        envVar:   "SQUARE_WEBHOOK_SECRET",
      },
      {
        id:       "toast",
        name:     "Toast POS",
        status:   "available",
        webhook:  "/api/integrations/toast/webhook",
        docs:     "https://doc.toasttab.com/doc/platformguide/adminWebhooksOverview.html",
        events:   ["ORDER_CREATED", "ORDER_UPDATED"],
        authType: "hmac_sha256",
        envVar:   "TOAST_WEBHOOK_SECRET",
      },
      {
        id:       "clover",
        name:     "Clover",
        status:   "available",
        webhook:  "/api/integrations/clover/webhook",
        docs:     "https://docs.clover.com/docs/webhooks",
        events:   ["CREATE", "UPDATE"],
        authType: "bearer",
        envVar:   "CLOVER_WEBHOOK_SECRET",
      },
      {
        id:       "lightspeed",
        name:     "Lightspeed K-Series",
        status:   "available",
        webhook:  "/api/integrations/lightspeed/webhook",
        docs:     "https://developers.lightspeedhq.com/restaurant/",
        events:   ["order.created", "order.updated"],
        authType: "hmac_sha256",
        envVar:   "LIGHTSPEED_WEBHOOK_SECRET",
      },
      {
        id:       "volante",
        name:     "Volante Systems VE POS",
        status:   "available",
        webhook:  "/api/integrations/volante/webhook",
        docs:     "https://www.volantesystems.com/partners/",
        events:   ["kitchen.order.fired", "kitchen.course.fired"],
        authType: "hmac_sha256",
        envVar:   "VOLANTE_WEBHOOK_SECRET",
        setupNote: "In VE Back Office → Kitchen Displays → External KDS, set the Endpoint URL and Auth Secret. Select Format: JSON and Fire Mode: On Course Fire.",
      },
      {
        id:        "generic",
        name:      "Generic / Custom POS",
        status:    "available",
        endpoint:  "/api/integrations/orders",
        method:    "POST",
        authType:  "api_key",
        docsNote:  "Use any API key with orders:write permission. POST KDS-native JSON.",
      },
    ],
  });
});

export default router;
