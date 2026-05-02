# LineOps KDS — POS Integration Guide

This guide explains how to connect each supported POS system to LineOps KDS.

> For Volante Systems VE POS, see the dedicated guide: [VOLANTE.md](VOLANTE.md)
> For adding a brand-new POS adapter, see: [DEVELOPER.md](DEVELOPER.md)

---

## How it works

When a POS fires items to the kitchen, it sends an HTTP request to the LineOps KDS API. LineOps normalises the payload, creates a KDS order in the database, and broadcasts it in real time to all connected KDS displays.

All POS endpoints require a `?storeId=<uuid>` query parameter identifying which store the order belongs to. Find your store's UUID in the KDS **Setup → Stores** page.

---

## Generic / Custom POS

Use this if your POS supports outbound HTTP webhooks with a custom JSON payload, or if you are building your own integration.

**Endpoint**
```
POST /api/integrations/orders
Authorization: X-API-Key <your-key>
Content-Type: application/json
```

**Payload**
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

**Generate an API key**

Use the Setup page → API Keys, or via the CLI:
```bash
kds keys create "My POS" orders:write
```

---

## Square

**Prerequisites**: Square Developer account, a Square application with Webhooks enabled.

**Steps**

1. In [Square Developer Dashboard](https://developer.squareup.com), open your app → **Webhooks**
2. Add an endpoint URL:
   ```
   https://<your-server>/api/integrations/square/webhook?storeId=<uuid>
   ```
3. Select events: `order.created`, `order.updated`, `payment.created`
4. Copy the **Signature Key** from Square
5. Add to your `.env`:
   ```
   SQUARE_WEBHOOK_SECRET=<signature-key>
   ```
6. Restart LineOps: `kds restart`

---

## Toast POS

**Prerequisites**: Toast back-office access, an API partner token.

**Steps**

1. In Toast Back Office, go to **Integrations → API Access → Webhooks**
2. Add webhook URL:
   ```
   https://<your-server>/api/integrations/toast/webhook?storeId=<uuid>
   ```
3. Select events: `ORDER_CREATED`, `ORDER_UPDATED`
4. Copy the **Webhook Secret**
5. Add to your `.env`:
   ```
   TOAST_WEBHOOK_SECRET=<secret>
   ```
6. Restart LineOps: `kds restart`

---

## Clover

**Prerequisites**: Clover merchant account, an approved Clover app.

**Steps**

1. In [Clover Developer Dashboard](https://www.clover.com/developers), open your app
2. Go to **Webhooks** and register:
   ```
   https://<your-server>/api/integrations/clover/webhook?storeId=<uuid>
   ```
3. Select events: `CREATE`, `UPDATE`
4. Clover authenticates via OAuth bearer token — add it to your `.env`:
   ```
   CLOVER_WEBHOOK_SECRET=<oauth-bearer-token>
   ```
5. Restart LineOps: `kds restart`

---

## Lightspeed K-Series (Kounta)

**Prerequisites**: Lightspeed Restaurant account with API access.

**Steps**

1. In Lightspeed Back Office, go to **Settings → Webhooks**
2. Add endpoint URL:
   ```
   https://<your-server>/api/integrations/lightspeed/webhook?storeId=<uuid>
   ```
3. Select events: `order.created`, `order.updated`
4. Copy the **Signing Secret**
5. Add to your `.env`:
   ```
   LIGHTSPEED_WEBHOOK_SECRET=<secret>
   ```
6. Restart LineOps: `kds restart`

---

## Verify an integration is working

After setup, check the event log:
```bash
curl "http://localhost/api/integrations/events?storeId=<uuid>&limit=20"
```

Or tail the API log:
```bash
kds logs api
```

---

## Integration capabilities endpoint

List all configured integrations and their endpoints:
```bash
curl http://localhost/api/integrations
```

---

## Security

- All webhook endpoints verify the HMAC-SHA256 signature provided by the POS before processing the payload
- Volante VE also supports TLS mutual auth on the local network
- The Generic endpoint uses per-store API keys with permission scopes (`orders:write`)
- Integration events (including errors) are logged in the `integration_events` table for auditing
