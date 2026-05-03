# LineOps KDS — Architecture

> **This is a technical reference for developers.**
> If you are setting up or operating LineOps KDS, you don't need to read this — go to [docs/INSTALL.md](INSTALL.md) instead.

---

## Overview

LineOps KDS is made up of four pieces that run together:

| Piece | What it does |
|---|---|
| **nginx** | The front door — receives all requests on port 80 and routes them to the right service |
| **KDS frontend** | The web app displayed on kitchen screens — built with React |
| **API server** | Handles all data (orders, stations, devices) and pushes real-time updates to every screen |
| **PostgreSQL** | The database — stores all orders, configuration, and event history |

```
                         ┌─────────────────────────────────────────────────┐
                         │                   nginx / proxy                  │
                         │     0.0.0.0:80  (Wi-Fi · LAN · Ethernet)        │
                         └───────────┬─────────────────────┬───────────────┘
                                     │ /                   │ /api  /ws
                          ┌──────────▼────────┐   ┌───────▼──────────────┐
  Browser / KDS tablet ──►│  KDS Frontend     │   │   API Server          │
                          │  React + Vite     │   │   Express 5 + ws      │
                          │  @workspace/kds   │   │   @workspace/api-server│
                          └──────────┬────────┘   └───────┬──────────────┘
                                     │ WebSocket            │ Drizzle ORM
                                     │ (real-time push)     │
                                     └──────────┬───────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │     PostgreSQL         │
                                    │   @workspace/db        │
                                    └───────────────────────┘
```

---

## Monorepo Layout

```
lineops-kds/
├── artifacts/
│   ├── api-server/          # Express REST + WebSocket server
│   │   └── src/
│   │       ├── routes/      # Route handlers (orders, devices, integrations, …)
│   │       ├── lib/
│   │       │   ├── pos/     # POS adapter modules (one file per POS)
│   │       │   ├── ws.ts    # WebSocket broadcast
│   │       │   ├── apiKey.ts
│   │       │   └── outboundWebhook.ts
│   │       └── index.ts
│   └── kds/                 # React + Vite KDS frontend
│       └── src/
│           ├── components/  # UI components (layout, logo, order cards, …)
│           ├── hooks/       # WebSocket hook, KDS data hooks
│           └── pages/       # Dashboard, KDS display, Orders, Devices, Setup
├── lib/
│   ├── db/                  # Database schema + client (@workspace/db)
│   │   └── src/schema/      # Table definitions (enterprises, stores, stations, …)
│   ├── api-spec/            # OpenAPI YAML spec (@workspace/api-spec)
│   ├── api-zod/             # Generated validation schemas from OpenAPI
│   └── api-client-react/    # Generated React Query hooks from OpenAPI
├── docker/                  # Dockerfiles + nginx config
├── docs/                    # This documentation
├── bin/kds                  # Bash CLI
└── install.sh               # One-liner Linux installer
```

---

## Database Schema

```
Enterprise (multi-tenant root)
  └── Store (restaurant location)
        ├── Station (grill / cold / fryer / dessert / …)
        │     └── Device (physical KDS tablet registered to this station)
        └── Order
              └── OrderItem (linked to a Station)

Supporting tables:
  api_keys               — per-store API keys for Generic POS push
  integration_events     — audit log of every POS push / webhook received
  outbound_webhooks      — registered webhooks to fire on LineOps events
```

### Hierarchy rules

- One **Enterprise** can have many **Stores** (multi-location support)
- One **Store** has many **Stations** (e.g. Grill, Cold Prep, Fryer, Dessert, Bar)
- One **Station** has many **Devices** (multiple tablets per station is allowed)
- One **Order** has many **OrderItems**, each `OrderItem.stationId` routes it to the right station

---

## How an order flows through the system

### POS → KDS (order creation)

```
POS System
    │
    │  HTTP push (webhook or RPC)
    ▼
API Server /api/integrations/*
    │
    ├─ Verify signature / auth
    ├─ Run POS adapter (normalise to KDS order format)
    ├─ INSERT order + order_items into PostgreSQL
    ├─ Log to integration_events
    ▼
WebSocket broadcast → all connected KDS tablets
    │
    ▼
KDS grid re-renders instantly with the new order
```

### Real-time push (WebSocket)

- The API server holds an open connection to every browser/tablet (via WebSocket on `/ws`)
- Every connected screen subscribes automatically when it loads
- When any order changes (created, bumped, item status changed) the server notifies every screen in under 100 ms
- If the connection drops, the screen reconnects automatically (1 s → 2 s → 4 s backoff, max 30 s)

---

## POS Integration Layer

All POS adapters live in `artifacts/api-server/src/lib/pos/`. Each adapter:

1. Accepts the raw HTTP payload (headers + body) from the POS
2. Verifies the signature / auth token
3. Returns a normalised order (or signals to silently ignore non-order events)

The route handler in `routes/integrations.ts` then persists the normalised order and broadcasts it.

### Supported POS systems

| System | Mode | Endpoint(s) |
|---|---|---|
| Volante VE | RPC push (PUT) | `/api/integrations/volante/rpc/master-trans` + `/api/integrations/volante/rpc/kitchen-jobs` |
| Square | Webhook (POST) | `/api/integrations/square/webhook` |
| Toast POS | Webhook (POST) | `/api/integrations/toast/webhook` |
| Clover | Webhook (POST) | `/api/integrations/clover/webhook` |
| Lightspeed K-Series | Webhook (POST) | `/api/integrations/lightspeed/webhook` |
| Generic / Custom | REST push (POST) | `/api/integrations/orders` (API key auth) |

### Volante VE — special case

Volante does not use a single webhook URL. It uses an RPC push model:

```
VE POS Server (local network)
    │
    ├─ PUT /api/integrations/volante/rpc/master-trans   ← full MasterTransEntity[]
    │       (transaction cache updated in memory)
    │
    └─ PUT /api/integrations/volante/rpc/kitchen-jobs   ← KitchenChitJobEntity[]
            (itemIds resolved from cache → order created → broadcast)
```

The VE `KitchenChitJobEntity.printerTypeId` (a UUID configured in VE Back Office → Kitchen Display Setup → Printer Types) is the authoritative station selector. It maps to a LineOps station ID via `VOLANTE_PRINTER_STATION_MAP`. When absent, `MenuItem.groupName` keyword matching is used as a fallback.

See [integrations/VOLANTE.md](integrations/VOLANTE.md) for full setup.

---

## Station Routing

Every `OrderItem` is assigned a `stationId` at creation time. The routing logic (priority order):

1. **Volante only**: `KitchenChitJobEntity.printerTypeId` → `VOLANTE_PRINTER_STATION_MAP` lookup
2. **All adapters**: `MenuItem.groupName` / POS category keyword matching via `mapStation()` in `lib/pos/types.ts`
3. Fallback: `"other"` station

Default keyword → station mappings:

| Keyword | Station |
|---|---|
| grill, hot, pizza, pasta | `grill` |
| fryer, fried | `fryer` |
| cold, salad, beverage, bar, drink | `cold` |
| dessert, sweet | `dessert` |
| (anything else) | `other` |

---

## API Contract

The API is defined contract-first in `lib/api-spec/openapi.yaml`. Codegen produces:

- **Zod schemas** → `lib/api-zod/src/generated/` — used server-side for request validation
- **React Query hooks** → `lib/api-client-react/src/generated/` — used client-side for data fetching

Regenerate after spec changes:
```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Deployment Network (Docker)

```
Internet / LAN
      │
   :80 (nginx)
      ├── /          → web container (Vite build served by nginx)
      ├── /api/*     → api container :3000
      └── /ws        → api container :3000 (WebSocket upgrade)

api container → PostgreSQL (internal Docker network, no public port)
```

KDS tablets on the restaurant's LAN connect to `http://<server-ip>/`. No internet access is required after initial install — all traffic stays on the local network.
