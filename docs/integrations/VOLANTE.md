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

## Printer Type → Station Mapping

This is the most important concept for a correct setup.

In VE Back Office, each kitchen printer or display is assigned a **Printer Type** (a UUID). When VE fires a chit, the `KitchenChitJobEntity.printerTypeId` field tells LineOps which printer/station that chit is destined for.

LineOps stores a mapping from VE's printer type UUIDs to LineOps station IDs:

```
VOLANTE_PRINTER_STATION_MAP='{"ve-uuid-of-grill-printer": "grill", "ve-uuid-of-cold-printer": "cold"}'
```

**Without this mapping**, LineOps falls back to keyword matching on `MenuItem.groupName` (e.g. "Hot Mains" → `grill`, "Cold Starters" → `cold`). This fallback works but is less precise.

### Finding your VE printer type UUIDs

1. In VE Back Office, go to **Kitchen Display Setup → Printer Types**
2. Note the UUID (or internal ID) of each printer type assigned to a kitchen display
3. Match these UUIDs to your LineOps station IDs (visible in KDS **Setup → Stations**)

### Example mapping

```bash
# VE Printer Types → LineOps Station IDs
VOLANTE_PRINTER_STATION_MAP='{
  "11111111-aaaa-bbbb-cccc-ddddeeee0001": "grill",
  "11111111-aaaa-bbbb-cccc-ddddeeee0002": "cold",
  "11111111-aaaa-bbbb-cccc-ddddeeee0003": "fryer",
  "11111111-aaaa-bbbb-cccc-ddddeeee0004": "dessert"
}'
```

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

# Printer type → station mapping (JSON)
VOLANTE_PRINTER_STATION_MAP={"uuid1":"grill","uuid2":"cold"}

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
