# LineOps KDS — Feature Reference

Complete overview of every feature in the system, how to enable/disable it, and where to configure it.

---

## 1. Real-Time Kitchen Display (KDS)

**What it does:** Displays live in-progress orders on a full-screen kiosk. Orders are colour-coded by urgency (green → amber → red), grouped by station, and update instantly via WebSocket.

**How to access:** Open the root URL `/` in any browser. The screen enters fullscreen automatically.

**Key controls:**
| Key | Action |
|-----|--------|
| `SPACE` / `Enter` | Bump (complete) the focused order |
| `←` / `→` | Navigate between orders |
| `R` | Force-refresh order list |
| `F4` | Exit fullscreen / kiosk mode |
| `Escape` | Close settings panel |

---

## 2. Test Order Injection

**What it does:** Injects a realistic random order into the system so you can test the display without a real POS integration.

**Activate:** Set the environment variable `ALLOW_TEST_ORDERS=true` in your `.env` file or `docker-compose.yml`. Restart the API server.

**Deactivate:** Remove or set `ALLOW_TEST_ORDERS=false`. The Test button and the empty-screen inject link both disappear.

**Runtime toggle (no restart):** Go to **Setup → Production tab** and flip the "Test order injection" switch. Takes effect immediately.

### Station-Aware Injection

The Test button is **station-aware** — it injects items relevant to whatever you're currently viewing:

| Current view | Injected order |
|---|---|
| A specific station tab (e.g. Grill) | Items from that station only |
| All-stations tab (Multi mode) | Mixed items from multiple stations |
| Expo mode | Multi-station order (2–3 stations) to test cross-station expo flow |

---

## 3. Admin Password Protection

**What it does:** Locks all management endpoints (`/api/admin/*`, `/api/stations`, `/api/stores`) behind a password. The KDS display, POS webhooks, and `/api/config` remain public.

**Activate:** Set `ADMIN_PASSWORD=yourpassword` in `.env` / `docker-compose.yml` and restart the API server.

**Deactivate:** Leave `ADMIN_PASSWORD` unset (blank or missing) — auth is fully disabled.

**Logging in:** A `/login` page appears automatically. Enter the password; it is stored in `localStorage` and injected as a Bearer token on every API call. A 401 response from any protected endpoint redirects back to `/login`.

---

## 4. Hidden Integrations

**What it does:** Removes specific POS integration tiles from the Integration Hub so installers only see the systems you actually support.

**Activate:** Set `HIDDEN_INTEGRATIONS=square,clover` (comma-separated integration IDs) in `.env` / `docker-compose.yml` and restart.

**Runtime toggle (no restart):** Go to **Setup → Production tab → Hidden Integrations** — check/uncheck any integration to hide or show it instantly.

**Deactivate:** Leave `HIDDEN_INTEGRATIONS` unset or empty; all integrations are visible.

---

## 5. Multi-Tenant / Multi-Store

**What it does:** Each store gets its own isolated order stream. The KDS auto-selects the first store on load.

**How it works:** Every order, station, and WebSocket event is scoped to a `storeId`. Adding a second store via the API automatically appears as a store selector in the KDS header.

---

## 6. Station Modes

**What it does:** Changes which orders each screen shows.

| Mode | Description |
|------|-------------|
| **Multi** | All stations — full overview with tab filter bar |
| **Single** | One station only (Grill, Fryer, Cold, Dessert, Other) |
| **Expo** | Expediter view — sees all orders, bump button labelled "Fire" |

**How to switch:** Open the ⚙ Settings panel (top-right gear icon) → **KDS Mode**, or use the ⚡ Quick Settings FAB (bottom-right).

### Expo Mode Enhancements

**Spotlight** — the focused/first order is always featured with an expanded card in Expo mode (independent of the "featured first" toggle).

**Now Serving strip** — when the expo bumps (fires) an order, it moves to a green "NOW SERVING" bar above the footer showing order number and customer name. Entries auto-expire after 45 seconds.

**Send mode** — controls when an order is considered ready to fire:

| Mode | Behaviour |
|------|-----------|
| **Expo fires manually** _(default)_ | Expo presses the Fire / bump button themselves |
| **All stations done** | Order fires automatically the moment every item on every station is checked off |

Configure in ⚙ Settings → KDS Mode → "Fire order when", or in the ⚡ Quick Settings panel.

---

## 7. Display Settings Panel

Open with the **⚙ gear icon** in the top-right header. All settings persist in `localStorage`.

### Layout
- **Grid columns** — 1, 2, 3, or 4 columns
- **Featured first (wider)** — newest/urgent order spans extra columns
- **Featured span** — override auto-width (1–4 cols)
- **Density** — Compact / Normal / Comfortable card padding
- **Font size** — Sm / Md / Lg

### Card Content Toggles
Toggle any of these on/off per-device:
- Order number, Customer name, Order type badge
- Notes, Allergens, Station colours, Modifier colours
- Item checkboxes (mark individual items done), Urgency bar

---

## 8. Sound Alerts

**What it does:** Plays an audio chime whenever a new order arrives. Uses the Web Audio API — no audio files required, works offline.

**Activate:** Open ⚙ Settings → **Sound Alerts** → toggle "Alert on new order" on.

**Deactivate:** Toggle "Alert on new order" off.

### Age Escalation Alerts

**What it does:** Automatically alerts staff when an order has been waiting too long.

| Threshold | Sound | Visual |
|-----------|-------|--------|
| 9 minutes (WARN) | Bell chime (single) | Amber pulsing border glow |
| 15 minutes (ALERT) | Triple rapid blip | Red flashing border glow |

The visual border animation runs continuously from the moment a threshold is crossed until the order is bumped. Sound fires once per threshold crossing.

**Activate/Deactivate:** Open ⚙ Settings → **Sound Alerts** → "Age escalation alerts" toggle. Also available in the ⚡ Quick Settings FAB.

**Default:** On.

### Options
| Setting | Values | Default |
|---------|--------|---------|
| Volume slider | 0 – 100% | 70% |

### Per-Station Chimes
Each station can play a **different** chime so cooks only react to their own station:

| Chime | Sound | Default for |
|-------|-------|-------------|
| `ding` | Clean sine tone, 0.9 s decay | Grill, Other |
| `bell` | Three-harmonic chord, 1.4 s decay | Cold, Dessert |
| `blip` | Quick electronic sweep, 0.18 s | Fryer |
| `off` | Silent for this station | — |

**How to configure:** Open ⚙ Settings → Sound Alerts → **Per-station chimes**. Click any chime button to hear a preview and apply it.

The system detects which station(s) are in each new order and plays the matching chime(s) sequentially (350 ms apart if multiple stations are in one order). If all station chimes are `off`, the global chime plays as fallback.

---

## 9. Physical Bump Bar

**What it does:** Lets kitchen staff use a dedicated hardware bump bar instead of touching the screen.

**Activate:** Open ⚙ Settings → **Bump Bar** → toggle "Physical bump bar" on.

**Deactivate:** Toggle off. Keyboard shortcuts remain active regardless.

### Device Presets
| Preset | Bump key | Prev | Next |
|--------|----------|------|------|
| Keyboard (default) | `Space` | `←` | `→` |
| Logic Controls BB2002U | `F1` | `F11` | `F12` |
| POS-X BumpBar | `1` | `−` | `+` |
| MMF Val-u Line | `F1` | `F7` | `F8` |
| Custom | record any key | record any key | record any key |

**Custom binding:** Select "Custom" preset, then click a key slot and press the physical key on your bump bar to record it. Settings persist across restarts.

**Gamepad/HID controller mode:** If your bump bar presents as a USB gamepad, enable Physical Bump Bar → any preset. The Gamepad API polls automatically: **Button A** = bump, **D-pad L/R** or **L1/R1** = navigate.

---

## 10. Fullscreen / Kiosk Mode

**What it does:** Hides the browser chrome for a clean kiosk look.

**Activate:** The KDS enters fullscreen automatically 500 ms after page load.

**Deactivate:** Press `F4` or click the ⤢/⤡ icon in the header.

---

## 11. Enhanced CLI Status (`kds status`)

**What it does:** Shows a full health snapshot from the terminal.

```
$ kds status
```

**Output includes:**
- Version & environment (development / production)
- Uptime (formatted as Xh Ym Zs)
- Database connection status (green = connected, red = error)
- Auth enabled/disabled + password protection status
- Test orders enabled/disabled
- Active orders count, pending items, devices online, stations active

**How to install the CLI:**
```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/abhaypatial/Lineops_KDS/main/install/linux.sh | sudo bash

# Windows (PowerShell, run as Admin)
irm https://raw.githubusercontent.com/abhaypatial/Lineops_KDS/main/install/windows.ps1 | iex
```

---

## 12. One-Prompt Install Scripts

**What it does:** Single-command installation that sets up Docker, downloads the repo, generates secrets, and starts all services.

| Script | Command |
|--------|---------|
| `install/linux.sh` | `curl -fsSL .../install/linux.sh \| sudo bash` |
| `install/windows.ps1` | `irm .../install/windows.ps1 \| iex` |

See [`install/README.md`](install/README.md) for full options including custom ports, data directories, and HTTPS setup.

---

## 13. Security Headers

**What it does:** All API responses include standard hardening headers.

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

No configuration needed — applied automatically to every response.

---

## 14. WebSocket Real-Time Updates

**What it does:** Orders appear, update, and disappear instantly without polling. Reconnects automatically with exponential backoff (1 s → 2 s → 4 s … max 30 s).

**Endpoint:** `ws[s]://<host>/ws`

**Events handled:**
| Event | Action |
|-------|--------|
| `order_created` | Plays per-station chime, refreshes order list |
| `order_updated` | Refreshes order list |
| `order_bumped` | Removes order from display |
| `item_status_updated` | Refreshes order list |

---

## 15. POS & API Integrations (Integration Hub)

**What it does:** Displays setup guides and webhook URLs for every supported POS system.

**Access:** `/setup` → **Integrations** tab.

**Supported systems:** Square, Toast, Clover, Lightspeed, TouchBistro, Revel, Aloha, Upserve, and a Generic Webhook option.

**Hide specific integrations:** See [Feature 4 — Hidden Integrations](#4-hidden-integrations).

---

## 16. Setup & Configuration UI

**Access:** `/setup`

**Tabs:**
| Tab | Contents |
|-----|----------|
| Getting Started | Quick-start checklist, WebSocket URL, API key |
| Stations | Create / rename / delete kitchen stations |
| Integrations | POS webhook setup guides |
| Production | Test order toggle, Hidden integrations list, Sign-out |

---

## 17. Quick Settings FAB

**What it does:** A floating ⚡ button in the bottom-right corner of the KDS gives instant access to the most-changed settings without opening the full settings overlay.

**How to open:** Click the ⚡ lightning bolt button above the footer (bottom-right, above the Settings gear).

**Closes:** Click ⚡ again, or click ×.

### Settings available in the Quick panel

| Setting | Description |
|---------|-------------|
| Mode | Switch between Multi / Single / Expo instantly |
| Fire order when | (Expo only) Toggle between "Expo fires manually" and "All stations done" |
| Columns | 1 / 2 / 3 / 4 grid columns |
| Sound | On / Off toggle |
| Age Escalation | On / Off toggle |

All changes take effect immediately and persist to `localStorage`.

---

## Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | API server port |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `SESSION_SECRET` | — | Session signing secret (required) |
| `ADMIN_PASSWORD` | _(unset)_ | Enable admin auth — leave blank to disable |
| `ALLOW_TEST_ORDERS` | `false` | Enable test order injection endpoint |
| `HIDDEN_INTEGRATIONS` | _(unset)_ | Comma-separated integration IDs to hide |
| `NODE_ENV` | `development` | Set to `production` for deployments |

---

*Last updated: 2026-05-02 — added age escalation alerts, expo Now Serving strip, expo send mode, expo spotlight, station-aware test inject, Quick Settings FAB.*
