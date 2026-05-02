# Changelog

All notable changes to LineOps KDS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.2.0] - 2026-05-02

### Added

#### Station Config Management
- **Station Configs page** (`/station-configs`) — new backend admin page with a card-per-station grid; assign any saved config template to a station, push it live to every display at that station, or copy a config from one station to another
- **`kds_station_configs` database table** — stores per-station config JSON with `stationId`, `config`, and `updatedAt`; unique index on `stationId`
- **`PUT /api/stations/:id/config`** — save a config object for a station; upserts on conflict
- **`POST /api/stations/:id/push-config`** — broadcast saved config to all devices assigned to the station; returns `{ devicesFound, devicesReached }` for UI feedback
- **`POST /api/stations/copy-config`** — body `{ fromStationId, toStationId }` — copies one station's saved config to another without re-selecting a template
- **`GET /api/stations/:id/config`** — now returns the full config row `{ stationId, config, updatedAt }` (previously returned only the `config` field); allows the frontend to display last-updated timestamps

#### Per-Device Config Push
- **`POST /api/devices/:id/push-config`** — push a specific template by ID to a single display by device ID; WebSocket delivery if device is online, `reached: false` in response if offline
- **Devices page — Push Config dropdown** — each device card now has a dropdown listing all saved templates; selecting one pushes config immediately; green/amber toast confirms online vs offline delivery
- **`kds devices push <deviceId> <templateId>`** CLI command — available in both `bin/kds` (Bash) and `bin/kds.ps1` (PowerShell)

#### WebSocket Device Registry
- KDS displays now send `{ type: "register", deviceId }` on WebSocket connect; the server maintains a live `Map<deviceId, WebSocket>` for targeted delivery
- **`GET /api/devices/online`** — returns an array of device IDs that have an active WebSocket connection right now
- Device registry automatically removes entries on socket close/error
- Machine-local settings (zoom, bump bar, keys) are always preserved when pushing a config — server strips them before broadcasting and displays re-apply their local overrides on receipt

### Changed
- `GET /api/stations/:id/config` response shape changed from bare config JSON to `{ stationId, config, updatedAt }` object (or `null` if no config saved)

---

## [1.1.0] - 2026-05-02

### Added

#### KDS Display — Bump Bar
- **Physical bump bar recall key** — every preset now includes a dedicated recall key: keyboard = `Backspace`, Logic Controls = `F9`, POS-X = `0`, MMF = `F9`; pressing it pulls back the last bumped order without touching the screen
- **Custom key recording** — "Custom" preset now exposes a fourth recorder row for the recall key alongside bump / prev / next
- **Virtual bump bar** — on-screen ◄ BUMP ↩Recall ▶ buttons in the footer, selectable toggle in Settings → Bump Bar and Quick Actions
- **Self-hide × buttons** — footer bar and virtual bump bar both have a one-tap × button that hides them without opening Settings

#### KDS Display — UI & Layout
- **Resolution-aware auto-zoom** — auto-zoom formula now uses `Math.min(w/1920, h/1080)` so the display fills any screen without blank bottom/right edges regardless of aspect ratio; fixes blank-space-at-bottom bug on non-1920-wide screens
- **Long-order grid fix** — grid uses `gridAutoRows: 1fr` + `alignItems: stretch` so all rows have equal height and nothing overflows; removed scroll from the main area entirely
- **Per-card font scaling** — cards automatically reduce font size as item count grows (0.92× at 6 items, 0.84× at 9, 0.75× at 12+)
- **Two-column item layout** — cards with 6+ items in a ≤3-column grid switch to two-column item rendering to maximise vertical space
- **"+N more" overflow badge** — when a card would exceed 10–14 items (density-dependent), a compact badge replaces the overflow rather than cutting content silently
- **Customer name visibility** — customer name colour raised from 45% to 80% white for clear readability at kitchen distances
- **UI brightness pass** — BUMP ↵ button (38% → 62%), 0/N completion counter (25% → 50%), footer key hints (28% → 45%), ◄ ▶ nav buttons (40% → 62%), session item counter (22% → 40%), "All ready" message (22% → 45%) all brightened

#### KDS Display — Now Serving & Recall
- **Now Serving strip toggle** — independent `showNowServing` toggle in Settings → Now Serving Strip
- **Recent / recall tray toggle** — new `showRecentBumped` config field with independent toggle; hides the grey recent-bumped row without affecting the Now Serving strip

#### KDS Display — Quick Actions Panel
- Redesigned ⚡ FAB panel; now contains exactly four focused actions:
  1. **Bump focused order** — completes the currently highlighted order and closes the panel
  2. **Recall last** — recalls the most recently bumped order
  3. **Recall list** — expands an inline list of all recallable orders for one-tap recall
  4. **Footer bar toggle** — show/hide the footer without opening full Settings

#### Config Templates
- `kds_config_templates` database table for per-store saved configurations
- REST API: `GET/POST /api/kds/templates`, `DELETE /api/kds/templates/:id`, `GET /api/kds/templates/active`
- Settings → Config Templates section: save current config as named template, apply, delete, push-to-all (broadcasts to every connected display via WebSocket), export JSON, import JSON

### Fixed
- Blank space at bottom/right when `zoom` CSS property scaled the root div down but did not compensate the element's own reported height/width — resolved by setting `height: ${100/zoom}dvh` / `width: ${100/zoom}dvw` on the root element
- Auto-zoom ignored screen height — fixed by switching from `w/1920` to `Math.min(w/1920, h/1080)`

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

[Unreleased]: https://github.com/abhaypatial/Lineops_KDS/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/abhaypatial/Lineops_KDS/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/abhaypatial/Lineops_KDS/releases/tag/v1.0.0
