# LineOps KDS — AI Assistant Context

This file helps AI assistants (Claude, GPT-4, Gemini, etc.) understand the project quickly and work efficiently without reading every file. Read this before making any changes.

---

## What this project is

A **real-time, multi-tenant Kitchen Display System** (KDS) for commercial restaurants. Orders fire from a POS system → appear instantly on KDS tablets mounted in the kitchen → kitchen staff bump them when complete. Built as a self-hosted Docker app that runs entirely on the restaurant's local network.

---

## Tech Stack (quick reference)

| Layer | Tech | Notes |
|---|---|---|
| Runtime | Node.js 24 | Both services |
| Language | TypeScript 5.9 | Strict mode everywhere |
| Monorepo | pnpm workspaces | See workspace structure below |
| Frontend | React 19 + Vite + TailwindCSS + shadcn/ui | `artifacts/kds/` |
| Routing (client) | wouter | Not react-router |
| Data fetching | TanStack Query (React Query) | Generated hooks from OpenAPI |
| Backend | Express 5 | `artifacts/api-server/` |
| Real-time | `ws` WebSocket | Same process as Express, `/ws` path |
| Database | PostgreSQL + Drizzle ORM | `lib/db/` |
| Validation | Zod (import from `"zod"`, NOT `"zod/v4"`) | esbuild can't resolve v4 subpath |
| Logging | pino | Use `req.log` in handlers, `logger` singleton elsewhere — never `console.log` |
| API contract | OpenAPI YAML → Orval codegen | Contract-first |
| Build | esbuild (API) + Vite (frontend) | |

---

## Monorepo packages

```
@workspace/kds              artifacts/kds/          React frontend
@workspace/api-server       artifacts/api-server/   Express API + WebSocket
@workspace/db               lib/db/                 Drizzle schema + client
@workspace/api-spec         lib/api-spec/           OpenAPI YAML (source of truth)
@workspace/api-zod          lib/api-zod/            Generated Zod schemas
@workspace/api-client-react lib/api-client-react/   Generated React Query hooks
```

**Leaf packages** (`artifacts/*`): checked with `tsc --noEmit`, never emit declarations.
**Lib packages** (`lib/*`): composite, emit declarations, listed in root `tsconfig.json`.

---

## Key file locations

| What | Where |
|---|---|
| DB schema tables | `lib/db/src/schema/*.ts` (enterprises, stores, stations, devices, orders, order_items, api_keys, integration_events, outbound_webhooks) |
| POS adapters | `artifacts/api-server/src/lib/pos/` — one file per POS |
| Integration routes | `artifacts/api-server/src/routes/integrations.ts` |
| WebSocket broadcast | `artifacts/api-server/src/lib/ws.ts` |
| Station mapping | `artifacts/api-server/src/lib/pos/types.ts` — `mapStation()` + `DEFAULT_STATION_MAP` |
| Sidebar / layout | `artifacts/kds/src/components/layout.tsx` |
| Logo component | `artifacts/kds/src/components/logo.tsx` |
| Favicon | `artifacts/kds/public/favicon.svg` |
| OpenAPI spec | `lib/api-spec/openapi.yaml` |
| Docker setup | `docker-compose.yml`, `docker/Dockerfile.api`, `docker/Dockerfile.web`, `docker/nginx.conf` |
| CLI | `bin/kds` |
| Installer | `install.sh` |
| Env vars reference | `.env.example` |

---

## Patterns to follow

### Express handlers

```ts
// Always explicitly return void; use early return after res.json/status
router.post("/route", async (req, res): Promise<void> => {
  const x = req.query.x as string;
  if (!x) { res.status(400).json({ error: "x required" }); return; }
  // ...
  res.json({ ok: true });
});
```

### Adding a DB query

Import from `@workspace/db` — never write raw SQL:
```ts
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
const rows = await db.select().from(ordersTable).where(eq(ordersTable.storeId, id));
```

### WebSocket broadcast after state change

```ts
import { broadcast } from "../lib/ws";
broadcast({ type: "order_created", payload: { orderId, storeId } });
```

### Zod imports

```ts
import { z } from "zod";        // correct
import { z } from "zod/v4";     // WRONG — esbuild cannot resolve this subpath
```

### Logging

```ts
// In a route handler:
req.log.info({ orderId }, "Order bumped");

// Outside a request context:
import { logger } from "../lib/logger";
logger.warn("WebSocket client disconnected unexpectedly");
```

---

## POS integration architecture

Every POS adapter in `artifacts/api-server/src/lib/pos/` exports a function that:
- Takes raw headers + body string + HMAC secret
- Returns `AdapterResult`: `{ shouldProcess: boolean; order?: NormalisedOrder }`

**Exception: Volante VE** — uses an RPC push model with two separate PUT endpoints and a transaction cache. See `volante.ts` and `docs/integrations/VOLANTE.md`.

Adding a new POS: see `docs/integrations/DEVELOPER.md`.

---

## Common tasks (what to touch)

| Task | Files to edit |
|---|---|
| Add a new API endpoint | `lib/api-spec/openapi.yaml` → run codegen → `artifacts/api-server/src/routes/` |
| Add a new POS adapter | `artifacts/api-server/src/lib/pos/<name>.ts` + `routes/integrations.ts` |
| Add a DB table | `lib/db/src/schema/<name>.ts` + re-export in `lib/db/src/schema/index.ts` → run `db push` |
| Change sidebar nav | `artifacts/kds/src/components/layout.tsx` |
| Change a UI page | `artifacts/kds/src/pages/<page>.tsx` |
| Change KDS display (kiosk) | `artifacts/kds/src/pages/index.tsx` |
| Change live monitor page | `artifacts/kds/src/pages/live.tsx` |
| Change branding / logo | `artifacts/kds/src/components/logo.tsx` + `artifacts/kds/public/favicon.svg` |
| Change station routing heuristics | `artifacts/api-server/src/lib/pos/types.ts` — `DEFAULT_STATION_MAP` |
| Add test order menu items | `artifacts/api-server/src/routes/test.ts` — `MENU_ITEMS` array |

---

## What NOT to do

- Do not use `console.log` anywhere in the API server — use `req.log` or the `logger` singleton
- Do not import `from "zod/v4"` — use `from "zod"`
- Do not run `pnpm dev` at the workspace root — use `restart_workflow` or filter by package
- Do not add leaf packages (`artifacts/*`) to root `tsconfig.json` references
- Do not call services directly on their port (e.g. `:8080`) — always go through `localhost:80` proxy
- Do not hardcode the PORT — always read `process.env.PORT`
- Do not create mock/placeholder data when real data is available
- Do not import across artifacts — shared code belongs in `lib/`

---

## Token-saving tips for AI

- Read `lib/db/src/schema/index.ts` to see all exported table names before writing DB queries
- Read `artifacts/api-server/src/lib/pos/types.ts` for the `NormalisedOrder`, `NormalisedItem`, `AdapterResult`, `StationMap` types before writing any POS adapter
- The OpenAPI spec at `lib/api-spec/openapi.yaml` is the single source of truth for all REST routes — check it before adding routes to avoid duplicates
- All integration events are logged to `integration_events` table — check `lib/db/src/schema/integration_events.ts` for the schema before writing to it
- The `broadcast()` function in `lib/ws.ts` takes `{ type: string; payload: unknown }` — no other signature
