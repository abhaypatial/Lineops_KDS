# LineOps KDS

Production-ready Kitchen Display System for commercial kitchens. Multi-tenant, real-time, self-hosted on any Linux server. Displays run in full-screen kiosk mode on any tablet, mini-PC, or Raspberry Pi connected to a kitchen screen.

---

## Features

- **Live order grid** — orders appear the instant they are fired from the POS, no polling
- **Multi-station filtering** — each KDS display shows only its own station (Grill, Cold, Fryer, Dessert, etc.)
- **WebSocket push** — sub-100 ms order delivery to every connected display
- **Kiosk mode** — auto-fullscreen on launch, browser chrome hidden, F4 to exit
- **Bump bar support** — keyboard navigation (←/→) and bump (Space/Enter) without touching the screen
- **Test order injection** — fire a realistic test order instantly from the KDS display or CLI
- **Live event monitor** — real-time WebSocket feed showing every POS event as it arrives (great for integration testing)
- **Manager dashboard** — active orders, avg ticket time, rush count, online devices, per-station load
- **Order history** — full tabular log with bump/recall/status management
- **Device management** — monitor every KDS display's online/idle/offline state
- **Hierarchical setup** — Enterprise → Store → Station → Device configuration
- **POS integration layer** — Square, Toast, Clover, Lightspeed K-Series, Volante VE, Generic/Custom
- **Docker + systemd deployment** — one-liner install on any Linux server; `kds` CLI for ops
- **systemd services** — backend and kiosk display both managed as proper system services

---

## Quick Start (Development)

```bash
# Prerequisites: Node.js 24+, pnpm 9+, PostgreSQL
git clone <repo>
pnpm install
cp .env.example .env          # fill in DATABASE_URL at minimum

pnpm --filter @workspace/db run push

# Two terminals (or use the Replit workflow)
pnpm --filter @workspace/api-server run dev   # API + WebSocket :8080
pnpm --filter @workspace/kds run dev          # KDS frontend :19773
```

Open `http://localhost/` — KDS display (auto-fullscreens, press F4 to exit).

---

## Production Install

**Linux (one-liner):**
```bash
sudo bash install.sh
```

**Windows (Docker Desktop):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1
```

Full step-by-step for all platforms: **[docs/INSTALL.md](docs/INSTALL.md)**

---

## Kiosk Mode

The KDS display at `/` is designed to run as a dedicated kitchen display:

- **Auto-fullscreen** — requests fullscreen automatically on load
- **F4** — exits fullscreen (only keyboard shortcut that works in kiosk)
- **Test button** — small "Test" button in the header fires a random order instantly
- **Empty state** — when no orders are active, shows a prominent "Inject a test order" button

For a fully locked-down display (browser chrome completely hidden), launch Chromium via the systemd display service:

```bash
sudo systemctl start lineops-kds-display
```

See [docs/INSTALL.md — Setting up a dedicated KDS display](docs/INSTALL.md#setting-up-a-dedicated-kds-display-kiosk-mode) for the full setup.

---

## Docker / systemd Deployment

```bash
cp .env.example .env
docker compose up -d
```

| File | Platform | Purpose |
|---|---|---|
| `docker-compose.yml` | All | Orchestrates postgres + api + web + nginx |
| `docker/Dockerfile.api` | All | Multi-stage build for the API server |
| `docker/Dockerfile.web` | All | Vite build + nginx for the KDS frontend |
| `docker/nginx.conf` | All | Reverse proxy — routes `/api`, `/ws`, `/` |
| `docker/lineops-kds.service` | Linux | systemd service — starts the Docker Compose stack on boot |
| `docker/lineops-kds-display.service` | Linux | systemd service — launches Chromium kiosk on the display machine |
| `install.sh` | Linux/macOS | One-liner installer |
| `install.ps1` | Windows | PowerShell installer — Docker Desktop |
| `bin/kds` | Linux/macOS | Bash CLI — terminal commands for ops |
| `bin/kds.ps1` | Windows | PowerShell CLI — same commands as `bin/kds` |
| `.env.example` | All | Environment variable reference |

### Network layout

```
LAN clients (tablets, KDS screens)
        │
      :80 (nginx)
        ├── /          → KDS frontend
        ├── /api/*     → API server
        └── /ws        → WebSocket (same API process)

API → PostgreSQL (internal Docker network, no public port)
```

---

## CLI

```bash
kds status              # Live system overview
kds orders              # List active orders
kds orders bump 101     # Bump order #101
kds orders recall 101   # Recall bumped order
kds orders add          # Inject a CLI test order
kds stations            # List stations
kds devices             # List KDS displays
kds logs [api|web|db]   # Tail service logs
kds ip                  # Show LAN IP + connection URLs
kds start / stop / restart / update
```

---

## App Pages

| URL | Page | Purpose |
|---|---|---|
| `/` | **KDS Display** | Full-screen order grid, station tabs, bump bar |
| `/dashboard` | **Manager Dashboard** | Stats, station load, activity feed |
| `/orders` | **Order History** | All orders with bump/recall/status management |
| `/devices` | **Devices** | KDS display status monitoring (online/idle/offline) |
| `/template-builder` | **Template Builder** | Visual grid editor — drag zones, pick presets, export JSON |
| `/integration-hub` | **Integration Hub** | POS system config, live event feed, API keys, webhooks |
| `/setup` | **Setup** | Enterprise → Store → Station → Device hierarchy |
| `/live` | **Live Monitor** | Real-time WebSocket event feed for POS integration testing |

---

## POS Integrations

| POS | Mode | Guide |
|---|---|---|
| Volante Systems VE | RPC push (PUT, native) | [docs/integrations/VOLANTE.md](docs/integrations/VOLANTE.md) |
| Square | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Toast POS | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Clover | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Lightspeed K-Series | Webhook | [docs/integrations/README.md](docs/integrations/README.md) |
| Generic / Custom | REST push | [docs/integrations/README.md](docs/integrations/README.md) |

---

## Configuration

See [`.env.example`](.env.example) for all options. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session signing |
| `VOLANTE_STATION_MAP` | No | JSON: KDS Terminal ID → station ID e.g. `{"1":"grill","2":"cold"}` |
| `SQUARE_WEBHOOK_SECRET` | No | Square webhook signing key |
| `TOAST_WEBHOOK_SECRET` | No | Toast webhook signing key |

---

## Documentation

| Document | Purpose |
|---|---|
| **[docs/INSTALL.md](docs/INSTALL.md)** | Complete installation guide — Windows, Docker, systemd, kiosk display setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, component map |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [docs/integrations/README.md](docs/integrations/README.md) | Connecting each POS system |
| [docs/integrations/VOLANTE.md](docs/integrations/VOLANTE.md) | Volante VE deep-dive |
| [docs/integrations/DEVELOPER.md](docs/integrations/DEVELOPER.md) | Adding a new POS adapter |

---

## Development Commands

```bash
pnpm run typecheck                              # Full typecheck
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks/schemas
pnpm --filter @workspace/db run push           # Push DB schema (dev only)
```
