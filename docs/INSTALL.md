# LineOps KDS — Installation Guide

This guide covers every supported installation method, from a one-liner Docker install to a fully automated kiosk display running on a dedicated kitchen screen.

---

## What you are installing

LineOps KDS is a web application that runs on a Linux server and is accessed from kitchen display tablets/screens over your local network. There are two components:

| Component | What it is |
|---|---|
| **Backend stack** | Docker Compose — PostgreSQL, API server, KDS web app, nginx proxy |
| **Display service** | Chromium running in full-screen kiosk mode on the kitchen display machine |

The backend can run on any Linux server (even a Raspberry Pi 4). Display clients can be any device with a browser on the same network.

---

## System Requirements

### Server (backend)

| Item | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 20.04+, Debian 11+, RHEL 8+, **Windows 10/11** | Ubuntu 22.04 LTS |
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB | 20 GB |
| Network | 100 Mbps LAN | Gigabit LAN |
| Software | Docker 24+, Docker Compose v2 | — |

### Display machine (per KDS screen)

| Item | Minimum |
|---|---|
| OS | Ubuntu 22.04 Desktop, Raspberry Pi OS (64-bit), Windows 10/11 (browser-only) |
| RAM | 2 GB |
| Display | Any HDMI screen 1280×720+ |
| Browser | Chromium, Edge, or Chrome (headless install works too) |

---

## Option 0 — Windows (Docker Desktop)

> **Quickest way to test on a Windows laptop.**
> All services run inside Linux containers — no WSL2 required beyond Docker Desktop's built-in VM.

### Prerequisites

| Software | Download |
|---|---|
| Docker Desktop 4.x+ | https://www.docker.com/products/docker-desktop/ |
| PowerShell 5.1+ | Pre-installed on Windows 10/11 |
| Git (optional) | https://git-scm.com/download/win |

> Docker Desktop must be running (whale icon in the taskbar) before you start.

### Quick start

Open **PowerShell** (not CMD) in the repo folder:

```powershell
# 1. Allow the installer script to run (one-time, this session only)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 2. Run the installer — generates .env, builds images, starts all services
.\install.ps1

# 3. Open the KDS in your browser
Start-Process "http://localhost"
```

The installer will:
1. Verify Docker Desktop is running
2. Generate `.env` with secure random secrets
3. Build and start all four containers (db, api, web, proxy)
4. Wait for the API health check to pass
5. Inject a test order so you can see the KDS display immediately
6. Print the local URL and LAN IP

### If port 80 is already in use (e.g. IIS)

```powershell
# Install on port 8080 instead
.\install.ps1 -Port 8080

# Then open: http://localhost:8080
```

Or edit `.env` and add `HOST_PORT=8080`, then update `docker-compose.yml`:

```yaml
  proxy:
    ports:
      - "${HOST_PORT:-80}:80"
```

### Using the Windows CLI (`kds.ps1`)

The `bin\kds.ps1` script is a full PowerShell equivalent of the Linux `kds` CLI:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

.\bin\kds.ps1 status              # Live system overview
.\bin\kds.ps1 orders              # List active orders
.\bin\kds.ps1 orders bump 101     # Bump order #101
.\bin\kds.ps1 orders recall 101   # Recall a bumped order
.\bin\kds.ps1 orders add          # Inject a test order
.\bin\kds.ps1 stations            # List kitchen stations
.\bin\kds.ps1 devices             # List registered KDS displays
.\bin\kds.ps1 integrations        # POS integration status
.\bin\kds.ps1 integrations events # Recent inbound webhook events
.\bin\kds.ps1 keys                # List API keys
.\bin\kds.ps1 inject              # Inject a test order via API
.\bin\kds.ps1 logs api            # Tail API logs
.\bin\kds.ps1 logs web            # Tail frontend logs
.\bin\kds.ps1 logs db             # Tail database logs
.\bin\kds.ps1 start               # Start all services
.\bin\kds.ps1 stop                # Stop all services
.\bin\kds.ps1 restart             # Restart all services
.\bin\kds.ps1 help                # Full command reference
```

You can also set a persistent alias in your PowerShell profile:

```powershell
# Add to $PROFILE to use 'kds' anywhere in this repo
Set-Alias kds "$PWD\bin\kds.ps1"
```

### Manual Docker Compose on Windows

```powershell
# 1. Copy the env template
Copy-Item .env.example .env
# Edit .env in Notepad or VS Code: notepad .env

# 2. Build and start
docker compose up -d --build

# 3. Verify
Invoke-RestMethod http://localhost/api/health
# → @{status=ok; ...}

# 4. Inject a test order
Invoke-RestMethod -Method Post http://localhost/api/test/inject-order
# → Order appears on the KDS display
```

### Windows troubleshooting

**Port 80 in use (IIS or other service)**
```powershell
# Find what's using port 80
netstat -ano | Select-String ":80 "
# Stop IIS if needed: Stop-Service -Name W3SVC
# Or use -Port 8080 with install.ps1
```

**Docker Desktop not starting**
- Make sure virtualisation is enabled in BIOS
- Enable WSL2 in Docker Desktop → Settings → General → "Use WSL 2 based engine"
- Or enable Hyper-V: `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All`

**Script execution policy error**
```powershell
# Allow scripts for this session only (safest option)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**Access from other devices on the LAN**
```powershell
# Find your LAN IP
.\bin\kds.ps1 ip

# Windows Firewall — allow inbound on port 80
New-NetFirewallRule -DisplayName "LineOps KDS" -Direction Inbound `
  -Protocol TCP -LocalPort 80 -Action Allow
```

**Stopping everything**
```powershell
docker compose down          # stop and remove containers (keeps data)
docker compose down -v       # stop AND delete all data (full reset)
```

---

## Option 1 — Linux one-liner install (recommended for production)

Runs on any Ubuntu/Debian/RHEL server with or without Docker pre-installed:

```bash
curl -fsSL https://your-domain/install.sh | sudo bash
```

Or if you have the source:

```bash
sudo bash install.sh
```

This will:
1. Install Docker and Docker Compose (if missing)
2. Copy files to `/opt/lineops-kds`
3. Generate a secure `.env` with random secrets
4. Start all services with Docker Compose
5. Install the `kds` CLI at `/usr/local/bin/kds`
6. Print the LAN URL to use on KDS tablets

---

## Option 2 — Manual Docker Compose

```bash
# 1. Clone or download the release
git clone https://github.com/your-org/lineops-kds /opt/lineops-kds
cd /opt/lineops-kds

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and SESSION_SECRET

# 3. Start
docker compose up -d

# 4. Verify
curl http://localhost/api/healthz   # should return {"status":"ok"}
```

### Docker Compose services

| Service | Role | Port |
|---|---|---|
| `nginx` | Reverse proxy (public) | `:80` |
| `api` | REST + WebSocket | `127.0.0.1:3000` (internal) |
| `web` | KDS frontend | internal |
| `db` | PostgreSQL | internal |

---

## Option 3 — systemd (auto-start on boot)

Install the systemd service so the backend starts automatically when the server boots:

```bash
# Copy the service file
sudo cp /opt/lineops-kds/docker/lineops-kds.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable on boot + start now
sudo systemctl enable lineops-kds
sudo systemctl start lineops-kds

# Verify
sudo systemctl status lineops-kds
journalctl -u lineops-kds -f
```

### systemd commands reference

```bash
sudo systemctl start   lineops-kds     # start
sudo systemctl stop    lineops-kds     # stop (graceful)
sudo systemctl restart lineops-kds     # restart
sudo systemctl status  lineops-kds     # status + last logs
journalctl -u lineops-kds -f           # follow live logs
```

---

## Setting up a dedicated KDS display (kiosk mode)

This section sets up a kitchen screen so it boots directly into the KDS display, full-screen, with no browser chrome visible.

### Step 1 — Install Chromium on the display machine

**Ubuntu / Debian:**
```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
```

**Raspberry Pi OS:**
```bash
sudo apt-get install -y chromium-browser
```

### Step 2 — Create the kds system user

```bash
sudo useradd -m -s /bin/bash kds
sudo loginctl enable-linger kds     # allow services to run without login
```

### Step 3 — Install the display service

```bash
sudo cp /opt/lineops-kds/docker/lineops-kds-display.service /etc/systemd/system/

# If the KDS server is on a DIFFERENT machine, set the server IP:
sudo systemctl edit lineops-kds-display
```

In the override editor, add:
```ini
[Service]
Environment=KDS_URL=http://192.168.1.50/
```
(Replace `192.168.1.50` with the LAN IP of your KDS server.)

```bash
sudo systemctl daemon-reload
sudo systemctl enable lineops-kds-display
sudo systemctl start lineops-kds-display
```

### Step 4 — Verify kiosk mode

The screen should open Chromium in full-screen showing the KDS order grid. The browser address bar, tabs, and close button are all hidden.

**To exit kiosk mode:**
- Press **F4** (built into the KDS app — toggles fullscreen)
- Or run: `sudo systemctl stop lineops-kds-display`
- Or in a terminal: `sudo pkill chromium`

### Step 5 — Auto-login to the kds user on boot (optional)

For a completely headless start (display powers on → KDS appears), configure auto-login in your display manager.

**Ubuntu with GDM3:**
Edit `/etc/gdm3/custom.conf`:
```ini
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=kds
```

**LightDM:**
Edit `/etc/lightdm/lightdm.conf`:
```ini
[Seat:*]
autologin-user=kds
autologin-user-timeout=0
```

---

## Configuration reference

All configuration lives in `/opt/lineops-kds/.env`. Edit then restart with `kds restart`.

### Core settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | — | Random string for session signing (auto-generated by installer) |
| `DB_PASSWORD` | Yes | — | PostgreSQL password (auto-generated by installer) |
| `PORT` | No | `8080` | Internal API server port |

### POS integration

| Variable | Description |
|---|---|
| `VOLANTE_WEBHOOK_SECRET` | HMAC signing secret for Volante VE RPC push |
| `VOLANTE_STATION_MAP` | JSON: KDS Terminal ID → station ID (e.g. `{"1":"grill","2":"cold"}`) |
| `VOLANTE_HOST` | VE tenant base URL for pull mode |
| `VOLANTE_CLIENT_ID` | VE OAuth2 client ID |
| `VOLANTE_CLIENT_SECRET` | VE OAuth2 client secret |
| `SQUARE_WEBHOOK_SECRET` | Square webhook signing key |
| `TOAST_WEBHOOK_SECRET` | Toast webhook signing key |
| `CLOVER_WEBHOOK_SECRET` | Clover OAuth bearer token |
| `LIGHTSPEED_WEBHOOK_SECRET` | Lightspeed signing key |

---

## Verifying the installation

```bash
# Backend health
curl http://localhost/api/healthz
# → {"status":"ok"}

# Inject a test order (verify the full pipeline)
curl -X POST "http://localhost/api/test/inject-order"
# → Order appears on the KDS display immediately

# CLI status overview
kds status

# Check all service logs
kds logs api
kds logs web
kds logs db
```

---

## CLI reference

The `kds` CLI is installed at `/usr/local/bin/kds` by the installer.

```bash
kds status              # Live system overview (services, orders, devices)
kds orders              # List active orders
kds orders bump 101     # Bump order #101
kds orders recall 101   # Recall a bumped order
kds orders add          # Inject a test order via CLI
kds stations            # List stations
kds devices             # List registered KDS displays
kds logs [api|web|db]   # Tail service logs
kds ip                  # Show LAN IP and connection URLs
kds start               # Start all services
kds stop                # Stop all services
kds restart             # Rolling restart (no downtime)
kds update              # Pull latest images and restart
kds help                # Full command reference
```

---

## Connecting a POS system

After installation, connect your POS by following the integration guide:

- **Volante Systems VE**: [docs/integrations/VOLANTE.md](integrations/VOLANTE.md)
- **Square, Toast, Clover, Lightspeed, Generic**: [docs/integrations/README.md](integrations/README.md)

---

## Updating LineOps KDS

```bash
kds update
# — or manually:
cd /opt/lineops-kds
git pull
docker compose pull
docker compose up -d --build
```

---

## Uninstalling

```bash
# Stop services
sudo systemctl stop lineops-kds lineops-kds-display

# Remove systemd units
sudo systemctl disable lineops-kds lineops-kds-display
sudo rm /etc/systemd/system/lineops-kds*.service
sudo systemctl daemon-reload

# Remove application files (this deletes all data!)
sudo docker compose -f /opt/lineops-kds/docker-compose.yml down -v
sudo rm -rf /opt/lineops-kds
sudo rm -f /usr/local/bin/kds
```

---

## Troubleshooting

### KDS display shows "Disconnected"
- Check the API is running: `curl http://localhost/api/healthz`
- Check the API logs: `kds logs api`
- Verify the tablet/screen is on the same LAN as the server

### Orders not appearing after POS fires
- Check integration events: `curl "http://localhost/api/integrations/events?limit=10"`
- Inject a test order to verify KDS is working: `curl -X POST http://localhost/api/test/inject-order`
- Verify your POS webhook URL includes `?storeId=<uuid>`

### Chromium kiosk not starting
- Check the display service: `journalctl -u lineops-kds-display -f`
- Verify `DISPLAY=:0` is correct for your system (`echo $DISPLAY` in the kds user session)
- Try running Chromium manually: `DISPLAY=:0 chromium-browser --kiosk http://localhost/`

### Port 80 already in use
Edit `/opt/lineops-kds/docker-compose.yml` and change `"80:80"` to `"8080:80"`, then update your KDS_URL and POS webhook URLs accordingly.

### Database connection errors
- Check db container: `docker compose -f /opt/lineops-kds/docker-compose.yml ps db`
- View db logs: `kds logs db`
- Verify `DATABASE_URL` in your `.env` matches the Docker db service settings
