# Kitchen Display System (KDS)

## Overview

Production-ready multi-tenant Kitchen Display System built as a pnpm monorepo. Real-time order management for commercial kitchens with WebSocket push updates, bump bar keyboard navigation, and a manager dashboard.

## Architecture

pnpm workspace monorepo with TypeScript throughout. Contract-first API via OpenAPI → Orval codegen.

### Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/kds` | `artifacts/kds/` | React + Vite frontend (KDS display, dashboard, orders, devices, setup) |
| `@workspace/api-server` | `artifacts/api-server/` | Express 5 REST API + WebSocket server |
| `@workspace/db` | `lib/db/` | Drizzle ORM schema + client (PostgreSQL) |
| `@workspace/api-spec` | `lib/api-spec/` | OpenAPI spec (single source of truth) |
| `@workspace/api-zod` | `lib/api-zod/` | Generated Zod schemas from OpenAPI |
| `@workspace/api-client-react` | `lib/api-client-react/` | Generated React Query hooks from OpenAPI |

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **Frontend**: React 19, Vite, TailwindCSS, shadcn/ui, TanStack Query, wouter
- **Backend**: Express 5, pino logging
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v4), drizzle-zod
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Real-time**: WebSocket (`ws` package) with exponential backoff reconnect
- **Build**: esbuild

## Database Schema

Tables: `enterprises`, `stores`, `stations`, `devices`, `orders`, `order_items`

Hierarchy: Enterprise → Store → Station → Device; Order → OrderItems (linked to stations)

## Key Features

- **KDS Display** (`/`): Live order grid, station filtering tabs, keyboard bump bar (←→ navigate, SPACE/Enter bump), elapsed-time color coding (yellow >10m, red >15m), rush/VIP order highlighting
- **Manager Dashboard** (`/dashboard`): Active orders summary, avg ticket time, rush count, online devices, per-station load bars, real-time activity feed
- **Orders Page** (`/orders`): Tabular order history with bump/status management
- **Devices Page** (`/devices`): Device status monitoring (online/idle/offline)
- **Setup Page** (`/setup`): Hierarchical config — enterprises, stores, stations, devices

## Routing

- `/` → KDS frontend (port 19773)
- `/api` → API server REST routes (port 8080)
- `/ws` → WebSocket server (port 8080, same process as API)

## Docker / Linux Deployment

The full stack can be self-hosted on any Linux machine via Docker Compose.

### Files
| File | Purpose |
|---|---|
| `docker-compose.yml` | Orchestrates postgres + api + web + nginx proxy |
| `docker/Dockerfile.api` | Multi-stage build for the API server |
| `docker/Dockerfile.web` | Vite build + nginx for the KDS frontend |
| `docker/nginx.conf` | Reverse proxy: routes `/api`, `/ws`, and `/` |
| `bin/kds` | Bash CLI — terminal commands for order/device management |
| `install.sh` | One-liner Linux installer (Docker, Compose, CLI, .env) |
| `.env.example` | Environment variable reference |

### Network Architecture
- **nginx proxy** listens on `:80` — this is the public port KDS tablets connect to
- **api** container only exposes `127.0.0.1:3000` (CLI access only)
- **db** has no public ports (internal only)
- KDS displays on the LAN connect to `http://<server-ip>/`

### One-liner Install (Linux)
```bash
sudo bash install.sh
```

### CLI Commands
```bash
kds status              # Live system overview
kds orders              # List active orders
kds orders bump 101     # Bump order #101
kds orders recall 101   # Recall a bumped order
kds orders add          # Add a test order
kds stations            # List stations
kds devices             # List registered KDS displays
kds templates           # List saved display templates
kds logs [api|web|db]   # Tail logs
kds ip                  # Show LAN IP and URLs
kds start / stop / restart / update
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Important Notes

- After running codegen, `lib/api-zod/src/index.ts` must only export from `./generated/api` (codegen may generate a duplicate export from `./generated/types` — remove it to avoid TS2308)
- API server auto-seeds on startup if no enterprises exist (`lib/seed.ts`)
- Express 5: async handlers need `Promise<void>` return type; early returns use `res.status().json(); return;` pattern
- WebSocket broadcasts fire on order create/bump/item-status changes to invalidate React Query caches on all connected clients
