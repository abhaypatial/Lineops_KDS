# Adding a New POS Adapter — Developer Guide

This guide walks through every change needed to add support for a new POS system to LineOps KDS.

---

## Overview of what you touch

1. `artifacts/api-server/src/lib/pos/<name>.ts` — the adapter function
2. `artifacts/api-server/src/routes/integrations.ts` — the HTTP route + capabilities entry
3. `.env.example` — document the new env vars
4. `docs/integrations/README.md` — add setup steps for the POS
5. `replit.md` — update the integrations list

---

## Step 1 — Write the adapter

Create `artifacts/api-server/src/lib/pos/<posname>.ts`.

Most POS systems use a single webhook (POST). Use this template:

```ts
// artifacts/api-server/src/lib/pos/myfancypos.ts

import { createHmac } from "crypto";
import type { AdapterResult } from "./types";

/**
 * MyFancyPOS adapter.
 *
 * Webhook format: POST JSON signed with HMAC-SHA256 in X-MyPos-Signature
 * Events to process: "ORDER_CREATED", "ORDER_UPDATED"
 * Env var: MYFANCYPOS_WEBHOOK_SECRET
 */
export function myFancyPosAdapter(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
): AdapterResult {
  // 1. Verify signature
  const sig = headers["x-mypos-signature"] as string | undefined;
  if (secret && sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (sig !== expected) throw new Error("MyFancyPOS: invalid signature");
  }

  // 2. Parse body
  const body = JSON.parse(rawBody) as Record<string, unknown>;
  const eventType = String(body.eventType ?? "");

  // 3. Filter to order-relevant events only
  if (!["ORDER_CREATED", "ORDER_UPDATED"].includes(eventType)) {
    return { shouldProcess: false };
  }

  // 4. Extract items
  const items = (body.lineItems ?? []) as Record<string, unknown>[];
  if (!items.length) return { shouldProcess: false };

  // 5. Return normalised order
  return {
    shouldProcess: true,
    order: {
      externalId:   String(body.orderId ?? ""),
      orderNumber:  String(body.orderNumber ?? body.checkNumber ?? ""),
      customerName: String(body.customerName ?? ""),
      priority:     "normal",
      notes:        String(body.notes ?? ""),
      items: items.map(item => ({
        name:      String(item.name ?? "Item"),
        quantity:  Number(item.quantity ?? 1),
        stationId: "other",  // or use mapStation() from "./types"
        modifiers: [],
        notes:     "",
      })),
    },
  };
}
```

### Key types

```ts
// From artifacts/api-server/src/lib/pos/types.ts

interface NormalisedOrder {
  externalId:    string;          // POS-side order / check ID
  orderNumber:   string;          // Number shown on the KDS card
  customerName?: string;
  notes?:        string;
  priority:      "normal" | "rush" | "vip";
  items:         NormalisedItem[];
}

interface NormalisedItem {
  name:       string;
  quantity:   number;
  stationId:  string;    // Must match a station ID in the DB
  modifiers?: string[];
  notes?:     string;
}

interface AdapterResult {
  shouldProcess: boolean;
  order?: NormalisedOrder;
}
```

### Station routing

Use `mapStation(categoryLabel, stationMap?)` from `./types` to map POS category labels to station IDs:

```ts
import { mapStation } from "./types";
stationId: mapStation(item.categoryName ?? ""),
```

Default keywords: `grill/hot/pizza/pasta → grill`, `fryer/fried → fryer`, `cold/salad/beverage/bar → cold`, `dessert/sweet → dessert`.

---

## Step 2 — Add the HTTP route

Open `artifacts/api-server/src/routes/integrations.ts`.

### 2a. Import your adapter

```ts
import { myFancyPosAdapter } from "../lib/pos/myfancypos";
```

### 2b. Add the webhook route

Add this block after the other POS routes, before the Generic endpoint:

```ts
// MyFancyPOS
router.post("/integrations/myfancypos/webhook", async (req, res): Promise<void> => {
  const storeId = req.query.storeId as string;
  const store = await getStoreOrFail(storeId, res); if (!store) return;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.MYFANCYPOS_WEBHOOK_SECRET ?? "";
  await handlePosWebhook(
    null as never,
    "myfancypos",
    storeId,
    myFancyPosAdapter as Adapter,
    secret,
    rawBody,
    req.headers as Record<string, string | string[] | undefined>,
    res,
  );
});
```

### 2c. Register in the capabilities list

In the `router.get("/integrations", ...)` handler, add an entry to the `integrations` array:

```ts
{
  id:       "myfancypos",
  name:     "MyFancyPOS",
  status:   "available",
  webhook:  "/api/integrations/myfancypos/webhook",
  docs:     "https://docs.myfancypos.com/webhooks",
  events:   ["ORDER_CREATED", "ORDER_UPDATED"],
  authType: "hmac_sha256",
  envVar:   "MYFANCYPOS_WEBHOOK_SECRET",
},
```

---

## Step 3 — Document environment variables

Add to `.env.example`:

```bash
# MyFancyPOS — set in MyFancyPOS Back Office → Developer → Webhooks → Signing Secret
# MYFANCYPOS_WEBHOOK_SECRET=change_me
```

---

## Step 4 — Update the integration user guide

Add a setup section to `docs/integrations/README.md` following the pattern of the other POS entries (endpoint URL, event selection, env var, restart command).

---

## Step 5 — Update replit.md

Add the new POS to the integrations list in `replit.md` so future AI assistants know about it.

---

## Special case: RPC push model (like Volante VE)

If the POS does not use a single webhook but instead pushes structured data to multiple endpoints (like Volante's `rpc/master-trans` + `rpc/kitchen-jobs` pattern), you cannot use the shared `handlePosWebhook` helper. Instead:

1. Write a dedicated module (`artifacts/api-server/src/lib/pos/<name>.ts`) with its own types and processing functions — see `volante.ts` as the reference
2. Add multiple `router.put(...)` handlers in `integrations.ts` (GET/PUT as needed)
3. Use module-level state (e.g. an in-memory cache) if the POS requires correlation between multiple calls
4. Document the full data flow in `docs/integrations/<NAME>.md`

---

## Testing your adapter

### Unit test (quick)

```bash
# Start the API server and inject a test payload
STORE_ID=$(curl -sf localhost:80/api/stores | node -e "...")

curl -X POST "localhost:80/api/integrations/myfancypos/webhook?storeId=$STORE_ID" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"ORDER_CREATED","orderId":"test-1","orderNumber":"42","lineItems":[{"name":"Burger","quantity":1}]}'
```

### Check integration events

```bash
curl "localhost:80/api/integrations/events?storeId=$STORE_ID&limit=5"
```

Both `received: true` and `processed: true` in the response mean the adapter worked correctly.

### Check the KDS display

Open `http://localhost/` — the order should appear on the KDS grid immediately after a successful push.

---

## Adapter checklist

- [ ] Signature verification passes (or skips gracefully when secret is empty)
- [ ] Non-order events return `{ shouldProcess: false }` (silently ignored)
- [ ] All required `NormalisedItem` fields are populated (`name`, `quantity`, `stationId`)
- [ ] `externalId` is unique enough to prevent duplicate orders on retry
- [ ] Error thrown on invalid signature (not silently swallowed)
- [ ] Env var documented in `.env.example`
- [ ] Route registered in capabilities list (`GET /api/integrations`)
- [ ] Setup guide added to `docs/integrations/README.md`
