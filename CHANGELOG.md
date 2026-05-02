# Changelog

All notable changes to LineOps KDS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] - 2026-05-02

Initial production release of LineOps KDS — a real-time, multi-tenant Kitchen Display System
for commercial kitchens.

### Added

#### KDS Display (`/`)
- Live order grid with real-time WebSocket push — sub-100 ms delivery to every display
- Multi-station tabs (All Orders, Grill, Cold Prep, Fryer, Dessert) — each screen only shows its station's items
- Order cards with RUSH and VIP priority badges; per-station item colour coding
- Animated countdown timers that shift green → yellow → red as ticket time elapses
- Bump bar: `Space` / `Enter` to bump the focused order, `←` / `→` to navigate, `R` to refresh
- Kiosk mode: auto-requests fullscreen on load, `F4` to exit — browser chrome fully hidden
- Test order injection button in header for instant pipeline verification
- Empty-state "Inject a test order" shortcut when kitchen is idle

#### Manager Dashboard (`/dashboard`)
- Four live stat cards: Active Orders, Avg Ticket Time, Rush Orders, Online Devices
- Station Load panel — pending / cooking / ready item counts per station with proportional progress bars
- Live Activity Feed streaming recent order events (created, ready, completed) in real time

#### Order History (`/orders`)
- Full order log with status (pending / in_progress / ready / completed)
- RUSH and VIP priority badges with distinct colour coding
- Inline **BUMP** and **RECALL** actions directly from the table row
- Elapsed time column for every order

#### Device Management (`/devices`)
- Device cards showing ONLINE / IDLE / OFFLINE state with colour-coded badges
- Assigned station tags displayed per device
- Last-seen timestamp for every registered display

#### Template Builder (`/template-builder`)
- Six built-in preset templates: Full House, Grill Focus, Station Split, Expo Command, Bar & Kitchen, Blank Canvas
- Interactive grid canvas editor — 1–4 columns × 1–3 rows; click any empty cell to assign a zone
- Click an existing zone to configure or remove it
- Zone Config panel: station assignment, display label, font size
- Template Settings panel: name, description, card density (compact / normal / comfortable), grid size, full card content toggles (order number, customer name, order notes, allergen badges, station colours, modifier colours, urgency bar)
- Duplicate and Delete template actions
- Import JSON / Export JSON for template sharing and cross-device backup

#### Integration Hub (`/integration-hub`)
- POS system list — Square, Toast, Clover, Lightspeed K-Series, Volante VE, Custom/Generic — each with real-time connection status derived from integration event timestamps
- Configuration panel per POS: webhook URL, auth type, signing secret, Volante station mapping JSON
- Live event feed polling every 5 s — shows source, event type, reference ID, success / error / ignored status with 30-day retention
- Three right-hand tabs:
  - **API Keys** — list all keys, generate a new one (raw key shown once on creation), revoke any key
  - **Webhooks** — list outbound destinations, register a new endpoint, toggle active / inactive
  - **API Docs** — inline endpoint reference with copy-to-clipboard curl examples for all major routes

#### System Setup (`/setup`)
- Four-tab hierarchy wizard: Enterprises → Stores → Stations → Devices
- Create/read at each level with cascading context (select enterprise → see its stores → configure stations)

#### Live Monitor (`/live`)
- Real-time WebSocket event feed — every order event streamed as it arrives
- Expandable event rows revealing the full raw JSON payload
- "Inject Test Order" button for immediate pipeline testing
- Connection status indicator with automatic reconnect on drop

#### POS Integration Layer
- Six adapter implementations: Square, Toast, Clover, Lightspeed K-Series, Volante VE (push + pull modes), Generic/Custom REST push
- Inbound webhook signature verification per POS (HMAC-SHA256 or bearer token)
- Volante VE push mode: KDS Terminal ID → station mapping via `VOLANTE_STATION_MAP` environment variable
- Volante VE pull mode: OAuth2 client-credentials with automatic token refresh; polls for new kitchen jobs
- Integration events stored in the database with 30-day retention for audit, replay, and status derivation
- API key authentication for all inbound POS calls — per-store keys with permission scopes (`orders:read`, `orders:write`)

#### Deployment & Ops
- Docker Compose stack: PostgreSQL 16, Express API server, Vite-built KDS frontend, nginx reverse proxy
- `HOST_PORT` environment variable for resolving port 80 conflicts (e.g. IIS on Windows)
- `install.sh` — one-liner Linux/macOS installer (auto-installs Docker and Docker Compose if missing, generates `.env` with secure random secrets, starts all services, installs `kds` CLI)
- `install.ps1` — PowerShell Windows installer for Docker Desktop (same steps, same output)
- `bin/kds` — Bash CLI with full ops command set: `status`, `orders [bump|recall|add]`, `stations`, `devices`, `integrations [events]`, `keys [create|revoke]`, `webhooks`, `logs`, `ip`, `start` / `stop` / `restart` / `update`
- `bin/kds.ps1` — PowerShell CLI with full parity to `bin/kds`, using `Invoke-RestMethod` and `docker compose`
- systemd `lineops-kds.service` — auto-starts the Docker Compose stack on server boot
- systemd `lineops-kds-display.service` — auto-launches Chromium in kiosk mode on the display machine with configurable `KDS_URL`
- Multi-stage Dockerfiles for both the API server and KDS frontend — minimal production image sizes

#### Data Model
- Tables: `enterprises`, `stores`, `stations`, `devices`, `orders`, `order_items`, `api_keys`, `integration_events`, `outbound_webhooks`
- Drizzle ORM with Zod-validated schemas; fully typed across API and frontend
- OpenAPI-first contract — React Query hooks and Zod schemas auto-generated from the spec

#### Documentation
- `README.md` — feature overview, quick start (Linux + Windows), all pages, POS integrations, CLI reference, configuration table
- `CHANGELOG.md` — this file; semantic versioning, Keep a Changelog format
- `docs/INSTALL.md` — Windows Docker Desktop (Option 0), Linux one-liner, Manual Docker Compose, systemd setup, kiosk display configuration, full config reference, Windows/Linux troubleshooting sections
- `docs/ARCHITECTURE.md` — system design, data flow, component map
- `docs/integrations/README.md` — setup guide for Square, Toast, Clover, Lightspeed, and Generic webhook integrations
- `docs/integrations/VOLANTE.md` — Volante VE deep-dive (push mode, pull mode, station mapping, testing)
- `docs/integrations/DEVELOPER.md` — step-by-step guide for adding a new POS adapter

---

[Unreleased]: https://github.com/your-org/lineops-kds/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/lineops-kds/releases/tag/v1.0.0
