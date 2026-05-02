# Volante Systems VE POS — Integration Guide

LineOps KDS integrates with Volante VE using the **native RPC push model** from Volante's official POS API (`v2026.02.1684`). This is the same protocol VE uses to communicate between its own terminal software and cloud services.

---

## How VE talks to LineOps

Unlike other POS systems that send a single webhook, VE pushes **two RPC calls** on every kitchen fire:

```
VE POS Server (local network)
    │
    ├─ PUT /api/integrations/volante/rpc/master-trans
    │    Body: MasterTransEntity[]   ← full transaction with all items
    │    (LineOps caches this in memory, keyed by masterTransObjectId)
    │
    └─ PUT /api/integrations/volante/rpc/kitchen-jobs
         Body: KitchenChitJobEntity[]  ← which items fired to which printer
         (LineOps resolves items from cache → creates KDS order → broadcasts)
```

VE always sends `master-trans` before `kitchen-jobs` to ensure the transaction is cached before the job arrives.

The response to `kitchen-jobs` is the same array back with `bestResult: "COMPLETE"` — this signals to VE that an external KDS accepted the chit.

---

## KDS Terminal ID → Station Mapping

This is the only configuration needed to route orders to the right kitchen station.

In VE Back Office, every **Terminal group** has a **KDS Terminal ID** field — a simple integer (1, 2, 3, …). VE sends this number in every kitchen job it fires. LineOps maps these integers to station IDs.

```
VOLANTE_STATION_MAP='{"1":"grill","2":"cold","3":"fryer","4":"dessert"}'
```

That's it. No UUIDs, no API calls — just the integers you can read directly from the VE Back Office screen.

### How to find your KDS Terminal IDs

1. In VE Back Office, go to **Kitchen Display Setup**
2. For each **Terminal group**, note the **KDS Terminal ID** (integer on the right side of the terminal row)
3. Match each integer to your LineOps station ID (visible in KDS **Setup → Stations**)

### Example Back Office → LineOps mapping

| VE Back Office Terminal group | KDS Terminal ID | LineOps Station ID |
|---|---|---|
| "Cecilias QSR — Grill" | 1 | `grill` |
| "Cecilias QSR — Cold Side" | 2 | `cold` |
| "Cecilias QSR — Fryer" | 3 | `fryer` |
| "Cecilias QSR — Dessert" | 4 | `dessert` |

```bash
VOLANTE_STATION_MAP='{"1":"grill","2":"cold","3":"fryer","4":"dessert"}'
```

**Without this mapping**, LineOps falls back to keyword matching on `MenuItem.groupName` (e.g. "Hot Mains" → `grill`, "Cold Starters" → `cold`). This fallback works for basic installs but is less precise.

---

## Setup Steps

### 1. Prerequisites

- Volante VE version that supports the External KDS RPC feature (POS API v2026.02+)
- LineOps KDS installed and accessible on the local network (or cloud)
- Your LineOps store UUID (Setup → Stores in the KDS UI)

### 2. Configure environment variables

In your `.env`:

```bash
# HMAC signing secret — set the same value in VE Back Office
VOLANTE_WEBHOOK_SECRET=a-long-random-string

# KDS Terminal ID → station mapping (JSON).
# Keys = "KDS Terminal ID" integers from VE Back Office → Terminal group.
# Values = LineOps station IDs from your Stations setup page.
VOLANTE_STATION_MAP={"1":"grill","2":"cold","3":"fryer"}

# Optional: pull mode credentials (LineOps calls VE API)
VOLANTE_HOST=https://your-site.volantecloud.com
VOLANTE_CLIENT_ID=your-client-id
VOLANTE_CLIENT_SECRET=your-client-secret
```

Apply and restart:
```bash
kds restart
```

### 3. Configure VE Back Office

In VE Back Office → **Kitchen Displays → External KDS** (exact path may vary by VE version):

| VE Setting | Value |
|---|---|
| **master-trans Endpoint** | `PUT https://<lineops-server>/api/integrations/volante/rpc/master-trans?storeId=<uuid>` |
| **kitchen-jobs Endpoint** | `PUT https://<lineops-server>/api/integrations/volante/rpc/kitchen-jobs?storeId=<uuid>` |
| **Auth Secret** | Same value as `VOLANTE_WEBHOOK_SECRET` |
| **Format** | JSON |

> If your LineOps KDS is on the same LAN as the VE server, use the LAN IP:
> `http://192.168.1.50/api/integrations/volante/rpc/master-trans?storeId=<uuid>`
> No internet access is required.

### 4. Test the connection

Fire a test order from VE and check:

```bash
# See the last 10 integration events
curl "http://localhost/api/integrations/events?storeId=<uuid>&limit=10"

# Or tail the API log
kds logs api
```

A successful fire shows two events: `master-trans-update` and `kitchen-job`.

---

## Data mapping reference

| VE Field | LineOps Field | Notes |
|---|---|---|
| `MasterTrans.orderNum` | `Order.orderNumber` | POS check/order number |
| `MasterTrans.name` | `Order.customerName` (fallback) | Table name or check name |
| `MasterTrans.serviceInfo.customerName` | `Order.customerName` | Guest name (preferred) |
| `MasterTrans.serviceInfo.orderNotes` | `Order.notes` | Order-level special instructions |
| `Trans.guestName` | `Order.customerName` (fallback) | Per-seat guest name |
| `TransItem.details.kitchenName` | `OrderItem.name` | Display name on KDS screen |
| `TransItem.details.name` | `OrderItem.name` | Fallback if kitchenName is blank |
| `TransItem.userQty` | `OrderItem.quantity` | Quantity |
| `TransOption.details.kitchenName` + `.note` | `OrderItem.modifiers[]` | Modifier options |
| `TransItem.notes[]` | `OrderItem.notes` | Item-level allergy / special notes |
| `KitchenChitJobEntity.printerTypeId` | `OrderItem.stationId` | Via `VOLANTE_PRINTER_STATION_MAP` |
| `TransItem.details.groupName` | `OrderItem.stationId` | Fallback keyword matching |

### Items that are silently ignored

| VE condition | Behaviour |
|---|---|
| `TransItem.voidTypeId > 0` | Item is voided — skipped |
| `KitchenChitJobEntity.itemIds` is empty | Void-only chit — entire job skipped |
| `TransItem.type === "option"` | Modifier — attached to parent item, not a separate KDS line |
| Any non-kitchen event type | Logged to `integration_events.processed = false`, not dispatched |

---

## Authentication (pull mode)

When LineOps needs to call VE's API (e.g. to query menu items or verify transaction details), it authenticates using the VE OAuth2 client credentials flow:

```http
POST https://{ve_host}/auth/auth/token
Content-Type: application/json

{
  "grant_type": "client",
  "client": "<VOLANTE_CLIENT_ID>",
  "password": "<VOLANTE_CLIENT_SECRET>",
  "requestTime": "2026-05-02T12:00:00.000Z"
}
```

Response: `{ "success": true, "access_token": "...", "refresh_token": "...", "accessTokenExpiry": "..." }`

The `VeAuthClient` class in `artifacts/api-server/src/lib/pos/volante.ts` handles this automatically, including token caching and refresh.

---

## Local network deployment note

Volante VE typically runs on-premise. LineOps KDS is installed on the same LAN (e.g. on a server or the KDS terminal itself). All VE → LineOps traffic stays on the local network.

- VE server sends RPC pushes to `http://192.168.x.x/api/integrations/volante/rpc/*`
- KDS tablets (also on LAN) connect to `http://192.168.x.x/` for the display
- No internet access is required at runtime

If LineOps is hosted in the cloud, configure VE's external KDS endpoint with the public HTTPS URL and ensure the HMAC signature verification is enabled (`VOLANTE_WEBHOOK_SECRET`).
