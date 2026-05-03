# LineOps KDS

## Overview

Production-ready multi-tenant LineOps KDS built as a pnpm monorepo. Real-time order management for commercial kitchens with WebSocket push updates, bump bar keyboard navigation, and a manager dashboard.

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

Tables: `enterprises`, `stores`, `stations`, `devices`, `orders`, `order_items`, `kds_config_templates`, `kds_station_configs`, `device_health_events`, `modifier_color_settings`

Hierarchy: Enterprise → Store → Station → Device; Order → OrderItems (linked to stations)

`device_health_events` records per-device online/offline/ping_reached/ping_timeout events with optional latencyMs.

## Key Features

- **KDS Display** (`/`): Live order grid, station filtering tabs (with live order count badges), keyboard bump bar (←→ navigate, SPACE/Enter bump), configurable recall key (default Backspace), physical bump bar presets (Logic Controls / POS-X / MMF / Custom), virtual bump bar (◄ BUMP ↩Recall ▶ with live elapsed timer), elapsed-time color coding (yellow >9m, red >15m), rush/VIP order highlighting, resolution-aware auto-zoom, long-order font scaling + 2-col layout + overflow badge
- **Per-Station Urgency Thresholds**: Each station has its own warn/alert minute targets (Fryer 4/7m, Cold 6/10m, Dessert 8/13m, Grill/Other 9/15m). `timerColor`, `UrgencyBar`, escalation flash, age-heatmap coloring, and footer warn/alert counts all use per-order thresholds derived from station mix. Configurable in Settings → **Station Targets** (⚠ warn / 🔴 alert inputs per station). Multi-station orders use the most permissive threshold.
- **Order Hold**: Press `H` or click ⏸ on any card to put an order on hold — amber border, dimmed 58%, "⏸ HOLD" badge, skipped in bump-bar navigation; bumping auto-clears hold; hold count shown in footer
- **Quick Column Control**: `− N +` button in header for instant 2–6 column grid resize without opening settings
- **Age Heatmap Strip**: Toggle in Quick Settings — compact row of all active tickets sorted oldest-first, color-coded green/amber/red; click to focus; scrollable
- **Session Stats**: Footer shows bumped count + held count for the current session
- **Ping Flash Overlay**: Full-screen green ring + badge when `kds_ping` WS event received — confirms display is wired correctly before service. 1.6s animated overlay with device ID.
- **Now Serving strip** + **Recent/recall tray**: independent `showNowServing` and `showRecentBumped` toggles; recall any bumped order via keyboard, virtual bar, or Quick Actions panel
- **Modifier Color Customization**: per-category color configuration (Remove/No/Hold, Extra/Add/Double, Normal) stored in `modifier_color_settings` DB table — `GET/PUT /api/modifier-colors`; changes broadcast to all displays via WS; configurable from Template Builder back-office under the "Colors" tab
- **Config Templates**: save/apply/delete named configs per store; push-to-all via WebSocket broadcast; export/import JSON — `kds_config_templates` DB table + REST API
- **Station Config Management** (`/station-configs`): assign a named template config to each kitchen station; push to all displays at that station over WS; copy configs between stations — `kds_station_configs` DB table + REST endpoints (`PUT/GET /api/stations/:id/config`, `POST /api/stations/:id/push-config`, `POST /api/stations/copy-config`)
- **Per-device config push** (`POST /api/devices/:id/push-config`): targeted WS push to a single display by device ID; machine-local settings (zoom, bump bar, keys) always preserved
- **Per-device Ping** (`POST /api/devices/:id/ping`): sends `kds_ping` WS event to specific display; records `ping_reached`/`ping_timeout` health event; display shows 1.6s flash overlay
- **Device Health History** (`GET /api/devices/:id/health`): per-device timeline of online/offline/ping events stored in `device_health_events`; collapsible panel in Devices page; auto-refreshes after ping
- **Live device registry**: displays auto-register via WS on connect (`{ type: "register", deviceId }`); `GET /api/devices/online` returns live device IDs; server maintains `Map<deviceId, WebSocket>`; status column updated to online/offline in DB on connect/disconnect
- **Quick Actions panel** (⚡ FAB): bump focused order, recall last, recall list (expandable), footer bar toggle
- **Manager Dashboard** (`/dashboard`): Active orders summary, avg ticket time, rush count, online devices, per-station load bars, real-time activity feed
- **Orders Page** (`/orders`): Tabular order history with bump/status management
- **Devices Page** (`/devices`): Device status monitoring (online/idle/offline) with per-device Push Config dropdown, Ping button, and collapsible Health History panel
- **Setup Page** (`/setup`): Hierarchical config — enterprises, stores, stations, devices

## POS Integration Layer

All adapters live in `artifacts/api-server/src/lib/pos/`. Each returns `AdapterResult` from `types.ts`.

| POS | Mode | Adapter file | Route(s) |
|---|---|---|---|
| Volante VE | RPC push (PUT) | `volante.ts` | `rpc/master-trans` + `rpc/kitchen-jobs` |
| Square | Webhook POST | `square.ts` | `square/webhook` |
| Toast POS | Webhook POST | `toast.ts` | `toast/webhook` |
| Clover | Webhook POST | `clover.ts` | `clover/webhook` |
| Lightspeed K-Series | Webhook POST | `lightspeed.ts` | `lightspeed/webhook` |
| Generic / Custom | REST POST + API key | `generic.ts` | `orders` |

### Volante VE — station routing

VE sends a `pluginId` integer (the "KDS Terminal ID" from VE Back Office → Terminal group) in every kitchen job. LineOps maps this to a station ID via `VOLANTE_STATION_MAP` env var: `{"1":"grill","2":"cold"}`. Without it, `MenuItem.groupName` keyword heuristics are used as fallback. See `docs/integrations/VOLANTE.md`.

### Adding a new POS

See `docs/integrations/DEVELOPER.md` for the full step-by-step.

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
kds devices             # List registered KDS displays (shows online/offline WS status)
kds devices push <id> <tplId>  # Push config template to a specific display
kds templates           # List saved display templates
kds logs [api|web|db]   # Tail logs
kds ip                  # Show LAN IP and URLs
kds start / stop / restart / update
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## AI Agent Documentation

| File | For |
|---|---|
| `CLAUDE.md` | Claude / Anthropic — comprehensive guide, all conventions |
| `GEMINI.md` | Gemini / Google — Gemini-specific tips + architecture summary |
| `CHATGPT.md` | ChatGPT / OpenAI — quick-start + key files table |

## Documentation

| File | Purpose |
|---|---|
| `README.md` | Project overview, quickstart, Docker install, CLI reference |
| `docs/ARCHITECTURE.md` | System design, data flow, station routing, deployment network |
| `docs/ai.md` | AI assistant context — tech stack, patterns, what NOT to do |
| `docs/integrations/README.md` | How to connect each POS (Square, Toast, Clover, Lightspeed, Generic) |
| `docs/integrations/VOLANTE.md` | Volante VE deep-dive — printer types, RPC setup, data mapping |
| `docs/integrations/DEVELOPER.md` | How to add a new POS adapter (step-by-step with template) |
| `docs/UPDATE-GUIDE.md` | How to push a software update to already-installed machines (Docker, source, CLI) |

## Important Notes

- After running codegen, `lib/api-zod/src/index.ts` must only export from `./generated/api` (codegen may generate a duplicate export from `./generated/types` — remove it to avoid TS2308)
- API server auto-seeds on startup if no enterprises exist (`lib/seed.ts`)
- Express 5: async handlers need `Promise<void>` return type; early returns use `res.status().json(); return;` pattern
- WebSocket broadcasts fire on order create/bump/item-status changes to invalidate React Query caches on all connected clients
- Zod import: always `from "zod"`, never `from "zod/v4"` — esbuild cannot resolve the v4 subpath
- Logging: use `req.log` in route handlers, `logger` singleton elsewhere — never `console.log` in server code
- Volante VE uses RPC push (PUT), not a single POST webhook — see `docs/integrations/VOLANTE.md`
- `vite.config.ts` must not throw when `PORT`/`BASE_PATH` are unset — Docker build stages run without them; use defaults instead
- CORS: `app.use(cors())` is wide-open by default. For locked-down deployments, set `CORS_ORIGIN` env var to restrict origins
- Device status (`online`/`offline`) is now kept in sync in the DB automatically on every WS connect/disconnect
- Rate limiting: `posWebhookLimiter` (500/min) on `/api/integrations`, `apiLimiter` (300/min) on all `/api`, `strictLimiter` (60/min) on `/orders/clear-all` and `/orders/:id/bump` — middleware in `artifacts/api-server/src/middleware/rate-limit.ts`
- Concurrent POS orders: `createOrderFromNormalised` uses `db.transaction()` + `.onConflictDoNothing()` with the `orders_store_pos_order_uniq` partial unique index — handles 20+ simultaneous orders and duplicate webhooks safely
- Manual `POST /orders` is also wrapped in a DB transaction — order + items insert atomically, preventing partial order state on crash
- DB connection pool: `max: 20`, `idleTimeoutMillis: 30s`, `connectionTimeoutMillis: 5s` — handles high-concurrency order bursts without exhausting connections
- JSON body size capped at 512 KB (`express.json({ limit: "512kb" })`) to prevent large-payload DoS
- WS messages capped at 64 KB per message — oversized frames are logged and dropped in `ws.ts`
- `GET /orders` limit raised from 100 → 500 to support busy venues with hundreds of simultaneous active orders
- Footer appearance customisable per-template: `footerBg` (background hex) and `footerAccentColor` (bump bar button accent) stored in KdsConfig and configurable via Template Builder → Colors tab. Both default to theme/amber fallback if not set.
- Docker build: `Dockerfile.web` builder uses `node:24-slim` (not Alpine) because `pnpm-workspace.yaml` excludes `@rollup/rollup-linux-x64-musl`; Alpine's musl libc cannot load the glibc rollup binary
