# LineOps KDS

Production-ready Kitchen Display System for commercial kitchens. Multi-tenant, real-time, self-hosted on any Linux server. Displays run in full-screen kiosk mode on any tablet, mini-PC, or Raspberry Pi connected to a kitchen screen.

---

## Features

- **Instant order display** — orders appear on every kitchen screen within a second of being fired from the POS
- **Per-station views** — each screen only shows the items for its station (Grill, Cold Prep, Fryer, Dessert, etc.)
- **Kiosk mode** — launches full-screen automatically; no browser bars or buttons visible; press F4 to exit
- **Bump bar** — keyboard (Space/Enter to bump, ← → to navigate), physical USB bump bars (Logic Controls, POS-X, MMF presets + custom key recording), and on-screen virtual bump buttons; configurable **Recall key** (default Backspace) pulls back the last bumped order
- **RUSH & VIP badges** — priority orders are highlighted in red/gold with a visible label and urgent timer colour
- **Now Serving strip** — bumped orders flash in a green "Now Serving" strip for pickup callout; independent toggle for the strip and the recent-recall tray below it
- **Order recall** — recall any recently bumped order from the Quick Actions panel, virtual bump bar, or by pressing the recall key on a physical bump bar
- **Config Templates** — save the current KDS layout as a named template; one-click push to every connected display; export/import JSON for cross-site backup
- **Station Config Management** — assign a saved config template to each kitchen station from the backend admin; push it to all displays at that station over WebSocket with one click; copy configs between stations; CLI: `kds devices push <deviceId> <templateId>` for per-display targeting
- **Live device registry** — every KDS display registers itself via WebSocket on connect; `GET /api/devices/online` returns currently connected device IDs; per-device config push reaches a display in real-time or returns `reached: false` if offline
- **Resolution-aware auto-zoom** — display automatically scales to fill any screen size without blank edges; manual override with Ctrl +/−/0
- **Long-order handling** — cards with many items automatically reduce font size and switch to a two-column item layout; all items are always visible with no truncation or overflow badge
- **Quick Actions panel** — single-tap: bump focused order, recall last order, open recall list, toggle footer bar; accessible from the ⚡ FAB
- **Flexible UI controls** — toggle the footer bar, virtual bump bar, Now Serving strip, and recent-recall tray independently; each has a self-hide × button for one-tap dismissal without opening Settings
- **Test order button** — fire a test order to any station instantly, straight from the KDS screen or CLI
- **Manager dashboard** — active orders, average ticket time, rush count, online screens, and per-station workload at a glance
- **Order history** — full log of every order with bump, recall, and status controls
- **Screen management** — see which KDS displays are online, idle, or offline
- **Multi-location setup** — manage multiple restaurants, each with their own stations and screens
- **POS integrations** — Square, Toast POS, Clover, Lightspeed K-Series, Volante VE, and any custom POS via webhook
- **One-command install** — runs on any Linux server; Windows PowerShell installer; `kds` CLI for day-to-day ops
- **Auto-start on boot** — backend and kiosk display both start automatically when the server powers on
- **Any network type** — displays connect over wired Ethernet, Wi-Fi, or a mix; the server binds to all interfaces automatically; no internet required after install

---

## Quick Start

The fastest way to get LineOps KDS running — no technical knowledge needed:

**Linux (full stack):**
```bash
curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-setup.sh | sudo bash
```

**Windows (Docker Desktop must be running):**
```powershell
irm https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-setup.ps1 | iex
```

**Back-office only** (API server + dashboard, no KDS display):
```bash
curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-backoffice-setup.sh | sudo bash
```

**KDS display only** (connect to a remote back-office server):
```bash
curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-frontend-setup.sh | sudo bash -s -- --api-url http://192.168.1.10
```

Then open `http://localhost` in any browser — the KDS display loads full-screen. Press **F4** to exit kiosk mode.

---

## Quick Start (for developers — running without Docker)

```bash
# Prerequisites: Node.js 24+, pnpm 9+, PostgreSQL running locally
git clone <repo>
pnpm install
cp .env.example .env          # fill in DATABASE_URL at minimum

pnpm --filter @workspace/db run push   # set up database tables

# Run both in separate terminals:
pnpm --filter @workspace/api-server run dev   # API server
pnpm --filter @workspace/kds run dev          # KDS frontend
```

Open `http://localhost/` — the KDS display loads automatically.

---

## Production Install

**Linux (full stack):**
```bash
curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-setup.sh | sudo bash
```

**Windows:**
```powershell
irm https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-setup.ps1 | iex
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
| `install/lineops-kds-setup.sh` | Linux | Full-stack installer — all services |
| `install/lineops-kds-setup.ps1` | Windows | PowerShell full-stack installer |
| `install/lineops-backoffice-setup.sh` | Linux | Back-office only (API + dashboard) |
| `install/lineops-kds-frontend-setup.sh` | Linux | KDS display only (remote API) |
| `install/linux.sh` | Linux | Legacy — redirects to lineops-kds-setup.sh |
| `install/windows.ps1` | Windows | Legacy — redirects to lineops-kds-setup.ps1 |
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
