# LineOps KDS — Install Guide

## One-prompt install

### Linux (Debian, Ubuntu, RHEL, Rocky, etc.)

```bash
curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/linux.sh | sudo bash
```

### Windows (PowerShell — run as Administrator)

```powershell
irm https://github.com/abhaypatial/Lineops_KDS/raw/main/install/windows.ps1 | iex
```

---

## What the installer does

1. **Checks for Docker** — installs it automatically on Linux if missing.
2. **Downloads the KDS** to `/opt/kds` (Linux) or `C:\LineOps\KDS` (Windows).
3. **Generates a `.env`** file with secure random secrets.
4. **Builds and starts** all services via Docker Compose.
5. **Installs the `kds` CLI** (Linux only) so you can manage the system from the terminal.
6. **Prints the URL** your kitchen screens should navigate to.

---

## After install

| URL | Purpose |
|-----|---------|
| `http://<server-ip>/` | KDS display — put this on every kitchen screen |
| `http://<server-ip>/dashboard` | Management dashboard |
| `http://<server-ip>/setup` | First-run setup (enterprise → store → stations) |
| `http://<server-ip>/integration-hub` | Connect your POS system |

---

## Configuration

Edit `/opt/kds/.env` (Linux) or `C:\LineOps\KDS\.env` (Windows) then restart:

```bash
kds restart          # Linux
docker compose restart  # Windows (from the install directory)
```

### Key variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | _(none)_ | Password protecting the management pages. Leave blank for open access on a trusted LAN. |
| `ALLOW_TEST_ORDERS` | `true` | Set to `false` to hide the test-order button on production kitchen screens. |
| `HIDDEN_INTEGRATIONS` | _(none)_ | Comma-separated POS IDs to hide, e.g. `square,clover`. |
| `HOST_PORT` | `80` | Change if port 80 is already in use. |

---

## CLI reference (Linux)

```
kds status          Show live system overview (DB, uptime, orders, devices)
kds start           Start all services
kds stop            Stop all services
kds restart         Restart all services
kds logs [service]  Tail logs (api | web | db | proxy)
kds ip              Show LAN IP and URLs for kitchen screens
kds update          Pull latest version and restart
kds orders          List active orders
kds stations        List stations
kds keys            Manage API keys
kds webhooks        Manage outbound webhooks
```

---

## Upgrading

```bash
kds update          # Linux — pulls latest images and restarts
```

Windows: re-run the install script with `.\install\windows.ps1`.
