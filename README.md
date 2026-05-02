# LineOps KDS

Production-ready Kitchen Display System for commercial kitchens. Multi-tenant, real-time, self-hosted on any Linux server or Docker host. Connects to major POS systems and runs on standard kitchen display tablets over your local network.

---

## Features

- **Live order grid** — orders appear the instant they are fired from the POS, no polling
- **Multi-station filtering** — each KDS display shows only its own station (grill, cold, fryer, dessert, etc.)
- **WebSocket push** — sub-100 ms order delivery to every connected display
- **Bump bar support** — keyboard navigation (←/→) and bump (Space/Enter) without touching the screen
- **Manager dashboard** — active orders, avg ticket time, rush count, online devices, per-station load
- **Order history** — full tabular log with bump/recall/status management
- **Device management** — monitor every KDS display's online/idle/offline state
- **Hierarchical setup** — Enterprise → Store → Station → Device configuration
- **POS integration layer** — Square, Toast, Clover, Lightspeed K-Series, Volante VE, Generic/Custom
- **Docker + CLI deployment** — one-liner install on any Linux server; `kds` CLI for ops

---

## Quick Start (Development)

```bash
# Prerequisites: Node.js 24+, pnpm 9+, PostgreSQL

git clone <repo>
pnpm install
cp .env.example .env          # fill in DATABASE_URL at minimum

# Push DB schema
pnpm --filter @workspace/db run push

# Start both services (two terminals, or use the Replit workflow)
pnpm --filter @workspace/api-server run dev   # API + WebSocket on :8080
pnpm --filter @workspace/kds run dev          # KDS frontend on :19773
```

Open `http://localhost/` for the KDS display, `http://localhost/dashboard` for the manager view.

---

## Production Install (Linux / Docker)

```bash
# One-liner on any Ubuntu/Debian/RHEL server
sudo bash install.sh
```

This installs Docker, Docker Compose, the `kds` CLI, and creates `/opt/lineops-kds` with your `.env`.

### Manual Docker Compose

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, SESSION_SECRET, and any POS secrets
docker compose up -d
```

Services started:
| Container | Role | Exposed |
|---|---|---|
| `nginx` | Reverse proxy | `:80` (public) |
| `api` | REST + WebSocket | `127.0.0.1:3000` (CLI only) |
| `web` | KDS frontend | internal only |
| `db` | PostgreSQL | internal only |

All KDS tablets on your LAN connect to `http://<server-ip>/`.

---

## CLI

The `kds` CLI is installed at `/usr/local/bin/kds` by the installer.

```bash
kds status              # Live system overview
kds orders              # List active orders
kds orders bump 101     # Bump order #101
kds orders recall 101   # Recall a bumped order
kds orders add          # Inject a test order
kds stations            # List stations
kds devices             # List registered KDS displays
kds logs [api|web|db]   # Tail service logs
kds ip                  # Show LAN IP and connection URLs
kds start               # Start all services
kds stop                # Stop all services
kds restart             # Rolling restart
kds update              # Pull latest image and restart
```

---

## Configuration

All configuration lives in `.env`. See [`.env.example`](.env.example) for every option with explanations.

Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session signing |
| `PORT` | No | API server port (default 8080) |
| `KDS_STORE_NAME` | No | Display name shown in UI |
| `VOLANTE_WEBHOOK_SECRET` | No | HMAC secret for Volante VE RPC |
| `VOLANTE_PRINTER_STATION_MAP` | No | JSON: VE printer type UUID → station ID |
| `SQUARE_WEBHOOK_SECRET` | No | Square webhook signing secret |
| `TOAST_WEBHOOK_SECRET` | No | Toast webhook signing secret |

---

## POS Integrations

| POS | Mode | Guide |
|---|---|---|
| Volante Systems VE | RPC push (native) | [docs/integrations/VOLANTE.md](docs/integrations/VOLANTE.md) |
| Square | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Toast POS | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Clover | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Lightspeed K-Series | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Generic / Custom | REST push | [docs/integrations/README.md](docs/integrations/README.md) |

Full integration guide: [docs/integrations/README.md](docs/integrations/README.md)

---

## Documentation

| Document | Purpose |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, component map |
| [docs/ai.md](docs/ai.md) | AI assistant context (codebase guide) |
| [docs/integrations/README.md](docs/integrations/README.md) | Connecting a POS system |
| [docs/integrations/VOLANTE.md](docs/integrations/VOLANTE.md) | Volante VE deep-dive |
| [docs/integrations/DEVELOPER.md](docs/integrations/DEVELOPER.md) | Adding a new POS adapter |

---

## Development Commands

```bash
pnpm run typecheck                              # Full typecheck (all packages)
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks and Zod schemas
pnpm --filter @workspace/db run push           # Push DB schema changes (dev only)
pnpm --filter @workspace/db run generate       # Generate new migration file
```
