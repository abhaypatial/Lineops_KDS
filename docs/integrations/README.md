# LineOps KDS — POS Integration Guide

This guide explains how to connect each supported POS system to LineOps KDS so that orders fired from the POS appear on your kitchen screens instantly.

> **Volante Systems VE POS** has its own dedicated guide: [VOLANTE.md](VOLANTE.md)
>
> **Adding a brand-new POS system** (for developers): [DEVELOPER.md](DEVELOPER.md)

---

## How it works

When a cashier fires items to the kitchen in your POS, the POS sends an automatic notification to LineOps KDS over your local network (or internet). LineOps receives it, figures out which station each item belongs to, and instantly pushes the order to every connected kitchen screen.

You don't need to touch the LineOps server after setup — orders appear automatically.

---

## Before you start — find your Store ID

Every integration needs to know which of your stores the orders belong to.

1. Open the LineOps KDS web interface
2. Go to **Setup → Stores**
3. Copy the long ID shown next to your store name (looks like: `e3c4adaf-30a3-41c7-826e...`)

You'll use this ID in the webhook URL for every integration below.

---

## Generic / Custom POS

Use this if your POS can send orders to a custom web address (sometimes called "webhook", "HTTP push", or "third-party integration"), or if you're building a custom connector.

**Where to send orders:**
```
POST https://<your-server>/api/integrations/orders
```

**Required header:**
```
X-API-Key: <your-api-key>
```

**What to send (JSON):**
```json
{
  "orderNumber": "101",
  "customerName": "Smith",
  "priority": "normal",
  "notes": "Allergy: nuts",
  "items": [
    {
      "name": "Ribeye Steak",
      "quantity": 1,
      "stationId": "grill",
      "modifiers": ["Medium rare", "No butter"],
      "notes": "Well done on outside"
    }
  ]
}
```

**Getting an API key:**

Option A — through the KDS interface: go to **Integration Hub → API Keys → Generate new API key**

Option B — through the CLI:
```bash
kds keys create "My POS System" orders:write
```

The key is shown once when created — save it somewhere safe.

---

## Square

**What you need first:** A Square Developer account and a Square application with Webhooks turned on. If you haven't set this up before, [Square's developer guide](https://developer.squareup.com/docs/webhooks/overview) walks through it.

**Steps:**

1. Log in to the [Square Developer Dashboard](https://developer.squareup.com) and open your application
2. Click **Webhooks** in the left menu
3. Add a new endpoint with this URL (swap in your server address and Store ID):
   ```
   https://<your-server>/api/integrations/square/webhook?storeId=<your-store-id>
   ```
4. Enable these events: `order.created`, `order.updated`, `payment.created`
5. Square will show you a **Signature Key** — copy it
6. Open your LineOps `.env` file and add:
   ```
   SQUARE_WEBHOOK_SECRET=<paste-the-signature-key-here>
   ```
7. Apply the change: `kds restart`

**To test:** Fire a test order in Square and check **Integration Hub → Live Event Feed** in LineOps — you should see the event appear within a few seconds.

---

## Toast POS

**What you need first:** Access to Toast Back Office and an API partner token.

**Steps:**

1. Log in to Toast Back Office
2. Go to **Integrations → API Access → Webhooks**
3. Add a new webhook with this URL:
   ```
   https://<your-server>/api/integrations/toast/webhook?storeId=<your-store-id>
   ```
4. Enable these events: `ORDER_CREATED`, `ORDER_UPDATED`
5. Toast will show you a **Webhook Secret** — copy it
6. Add to your `.env` file:
   ```
   TOAST_WEBHOOK_SECRET=<paste-the-secret-here>
   ```
7. Apply the change: `kds restart`

---

## Clover

**What you need first:** A Clover merchant account and an approved Clover app.

**Steps:**

1. Log in to the [Clover Developer Dashboard](https://www.clover.com/developers) and open your app
2. Go to **Webhooks** and register this URL:
   ```
   https://<your-server>/api/integrations/clover/webhook?storeId=<your-store-id>
   ```
3. Enable events: `CREATE`, `UPDATE`
4. Clover uses an access token (a password that proves it's really Clover sending the data). Find your token in Clover's app settings under **OAuth** or **API Access** and add it to your `.env`:
   ```
   CLOVER_WEBHOOK_SECRET=<your-clover-access-token>
   ```
5. Apply the change: `kds restart`

---

## Lightspeed K-Series (Kounta)

**What you need first:** A Lightspeed Restaurant account with API access enabled.

**Steps:**

1. Log in to Lightspeed Back Office
2. Go to **Settings → Webhooks**
3. Add a new webhook with this URL:
   ```
   https://<your-server>/api/integrations/lightspeed/webhook?storeId=<your-store-id>
   ```
4. Enable events: `order.created`, `order.updated`
5. Lightspeed will show you a **Signing Secret** — copy it
6. Add to your `.env` file:
   ```
   LIGHTSPEED_WEBHOOK_SECRET=<paste-the-secret-here>
   ```
7. Apply the change: `kds restart`

---

## Verifying an integration is working

The easiest way is through the LineOps interface:

1. Open **Integration Hub** in the LineOps menu
2. Look at **Live Event Feed** in the centre column
3. Fire a test order from your POS — an event should appear within 2–3 seconds
4. Green tick = received and processed correctly. Red dot = something went wrong (click the event to see details)

Alternatively, check **Live Monitor** from the sidebar — this shows all activity in real time.

---

## Security

All the secrets and signing keys you set up above are how LineOps verifies that the orders it receives are genuinely coming from your POS and not from someone else. LineOps checks every incoming message before processing it. If the check fails (wrong or missing key), the message is rejected and logged — it will never appear on your kitchen screens.
