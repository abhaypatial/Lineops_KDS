# Volante Systems VE POS — Integration Guide

This guide explains how to connect Volante VE POS to LineOps KDS so that every kitchen fire from VE appears instantly on your kitchen screens.

---

## What you need before starting

- Volante VE version that includes the **External KDS** feature (POS API v2026.02 or newer)
- LineOps KDS installed and reachable on your network (on the same LAN as the VE server, or a public URL)
- Your LineOps **Store ID** — find it in **Setup → Stores** in the KDS interface

---

## How it works (plain English)

When a VE cashier fires items to the kitchen, VE automatically sends the order details to LineOps over your network. LineOps receives them, figures out which kitchen station each item goes to, and pushes everything to your KDS screens in under a second.

There are no manual steps after setup — orders flow automatically.

VE sends two messages every time an order is fired (this is how Volante's own KDS protocol works):
1. **Full order details** — what was ordered, by whom, with modifiers
2. **Kitchen job** — which items go to which printer/station

LineOps handles both automatically.

---

## Setup — Step by Step

### Step 1 — Map your stations

This is the only real configuration step. You need to tell LineOps which VE kitchen station corresponds to which LineOps station.

In **VE Back Office → Kitchen Display Setup**, each terminal group has a **KDS Terminal ID** (a small number like 1, 2, 3). You'll use these numbers to build the mapping.

In your LineOps `.env` file, add:
```
VOLANTE_STATION_MAP={"1":"grill","2":"cold","3":"fryer","4":"dessert"}
```

Replace the numbers and names to match your own setup. The numbers come from VE Back Office; the names (`grill`, `cold`, etc.) must match the station IDs in your LineOps **Setup → Stations** page.

**Example — "The Crown Hotel":**

| VE Terminal Group | KDS Terminal ID | LineOps Station |
|---|---|---|
| Crown — Hot Kitchen | 1 | `grill` |
| Crown — Cold Side | 2 | `cold` |
| Crown — Fry Station | 3 | `fryer` |
| Crown — Pastry | 4 | `dessert` |

This becomes:
```
VOLANTE_STATION_MAP={"1":"grill","2":"cold","3":"fryer","4":"dessert"}
```

> **No mapping set?** LineOps will try to guess the station from the item's category name (e.g. "Hot Mains" → grill). This works for basic setups but the explicit mapping above is more reliable.

### Step 2 — Set a security secret

This is a shared password that VE and LineOps use to verify orders are genuine. You create the value — make it something long and random.

Add to your `.env`:
```
VOLANTE_WEBHOOK_SECRET=some-long-random-string-you-made-up
```

You'll enter the same value in VE Back Office in the next step.

### Step 3 — Restart LineOps to apply changes

```bash
kds restart
```

### Step 4 — Configure VE Back Office

In VE Back Office, find **Kitchen Displays → External KDS** (the exact menu path varies slightly by VE version — ask your Volante support rep if you can't find it).

Enter these values:

| VE Setting | What to enter |
|---|---|
| **master-trans Endpoint** | `http://<lineops-server>/api/integrations/volante/rpc/master-trans?storeId=<your-store-id>` |
| **kitchen-jobs Endpoint** | `http://<lineops-server>/api/integrations/volante/rpc/kitchen-jobs?storeId=<your-store-id>` |
| **Auth Secret** | The same value you set for `VOLANTE_WEBHOOK_SECRET` |
| **Format** | JSON |

Replace `<lineops-server>` with the IP address or hostname of your LineOps server (e.g. `192.168.1.50`). If LineOps is on the same network as VE, use the LAN IP — no internet required.

### Step 5 — Test it

Fire a test order from a VE terminal and check:

1. Open **Integration Hub** in LineOps
2. Look at the **Live Event Feed** in the middle column
3. You should see two events appear: `master-trans-update` then `kitchen-job`
4. The order should appear on the KDS display immediately

If nothing appears, check **Live Monitor** (in the sidebar) and **Integration Hub → Live Event Feed** for error messages. The most common issue is a wrong server address or a mismatched secret.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No events appear at all | VE can't reach the LineOps server | Check the IP address in VE Back Office. Try pinging the LineOps server from the VE machine. |
| Events appear but show "error" | Wrong `VOLANTE_WEBHOOK_SECRET` | Make sure the secret in `.env` and VE Back Office match exactly |
| Orders appear on wrong station | Station mapping mismatch | Check your `VOLANTE_STATION_MAP` — compare the numbers to VE Back Office → Kitchen Display Setup |
| Orders appear but items are missing | Items filtered as void | Items marked as voided in VE are intentionally skipped by LineOps |

---

<details>
<summary><strong>For developers — technical reference</strong></summary>

### RPC push flow

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

The response to `kitchen-jobs` is the same array echoed back with `bestResult: "COMPLETE"` — this signals to VE that an external KDS accepted the chit.

### Field mapping reference

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

### Items silently ignored

| VE condition | Behaviour |
|---|---|
| `TransItem.voidTypeId > 0` | Item is voided — skipped |
| `KitchenChitJobEntity.itemIds` is empty | Void-only chit — entire job skipped |
| `TransItem.type === "option"` | Modifier — attached to parent item, not a separate KDS line |
| Any non-kitchen event type | Logged to `integration_events.processed = false`, not dispatched |

### Pull mode (LineOps calls VE API)

When LineOps needs to call VE's API (e.g. to verify transaction details), it authenticates using VE's OAuth2 client credentials flow:

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

Configure pull mode credentials in `.env`:
```
VOLANTE_HOST=https://your-site.volantecloud.com
VOLANTE_CLIENT_ID=your-client-id
VOLANTE_CLIENT_SECRET=your-client-secret
```

</details>
