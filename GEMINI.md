# LineOps KDS — Gemini Agent Guide

See **`CLAUDE.md`** for the comprehensive developer guide. This file supplements it with
Gemini-specific guidance.

---

## Quick start

1. Read `CLAUDE.md` fully before making any changes.
2. Use long context to load all relevant files before editing — prefer reading entire route
   files, the full schema directory, and the target page component before writing code.
3. For large files (`artifacts/kds/src/pages/index.tsx` is ~1960 lines), use `offset`/`limit`
   to read in sections; search with `grep` before reading to find the right region.

---

## Gemini-specific tips for this codebase

- **Function calling / tool use**: Always check the file exists before reading. Paths that
  look like `lib/api-zod/src/…` are generated — do not edit them.
- **Context window usage**: The pnpm workspace has many files. Use `glob` to discover
  structure before reading deeply. Key entry points: `lib/db/src/schema/index.ts`,
  `artifacts/api-server/src/routes/index.ts`, `artifacts/kds/src/App.tsx`.
- **Code generation**: After any OpenAPI spec change, regenerate:
  `pnpm --filter @workspace/api-spec run codegen`
- **Zod imports**: Use `from "zod"` not `from "zod/v4"` in all server/route files.
- **DB schema changes**: Always run `pnpm --filter @workspace/db run push` after editing
  any file in `lib/db/src/schema/`.

---

## Architecture summary

```
Browser (KDS display) ──WebSocket──► Express API server ──► PostgreSQL
                      ◄──────────── (ws.ts manages deviceRegistry Map)
                                   ◄──── POS webhooks (Square/Toast/Clover/Volante)
```

All real-time push flows through `broadcastToDevice(deviceId, { type, payload })` in
`artifacts/api-server/src/lib/ws.ts`.
