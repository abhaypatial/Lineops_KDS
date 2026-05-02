# LineOps KDS — ChatGPT / OpenAI Agent Guide

See **`CLAUDE.md`** for the comprehensive developer guide. This file supplements it with
ChatGPT-specific guidance.

---

## Quick start

1. Read `CLAUDE.md` fully before making any changes — it contains all conventions, rules,
   and architecture details.
2. This is a pnpm monorepo. Never install packages with `npm` or `yarn`. Always use:
   `pnpm --filter @workspace/<package> add <dep>`
3. Always verify TypeScript compiles cleanly: `pnpm run typecheck`

---

## Most important files

| Purpose | File |
|---|---|
| DB schema (all tables) | `lib/db/src/schema/*.ts` |
| API routes entry | `artifacts/api-server/src/routes/index.ts` |
| WebSocket logic | `artifacts/api-server/src/lib/ws.ts` |
| KDS display (main) | `artifacts/kds/src/pages/index.tsx` |
| KDS routing | `artifacts/kds/src/App.tsx` |
| OpenAPI spec | `lib/api-spec/src/openapi.yaml` |
| Environment vars | `CLAUDE.md` → Environment variables section |

---

## Key conventions

- **Logging**: `req.log` in route handlers, `logger` from `./lib/logger` elsewhere.
  Never `console.log` in server code.
- **Zod**: Import from `"zod"`, not `"zod/v4"`.
- **Route handlers**: Always typed as `async (req, res): Promise<void>`, always `return`
  after sending a response.
- **Generated code**: `lib/api-zod/` and `lib/api-client-react/` are Orval-generated.
  Do not edit them manually.
- **Schema push**: After any DB schema change: `pnpm --filter @workspace/db run push`
- **WS targeting**: `broadcastToDevice(id, event)` for one device, `broadcast(event)` for all.

---

## Architecture at a glance

```
artifacts/kds (React/Vite)
  └── hooks/use-kds-websocket.ts   ← WS client, handles all incoming events
  └── pages/index.tsx              ← Main KDS display (~1960 lines)
  └── pages/devices.tsx            ← Device management + health history
  └── pages/station-configs.tsx    ← Station config assignment

artifacts/api-server (Express 5)
  └── routes/devices.ts            ← Device CRUD + push-config + ping
  └── routes/orders.ts             ← Order management
  └── lib/ws.ts                    ← WebSocket server + deviceRegistry
  └── lib/pos/                     ← POS adapter layer

lib/db
  └── src/schema/                  ← One file per table, push with drizzle-kit
```
