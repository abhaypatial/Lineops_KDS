#!/usr/bin/env tsx
/**
 * LineOps KDS — Docker deployment bundle exporter
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run export-docker
 *
 * Output:
 *   dist/LineOps_KDS_Deploy.zip
 *
 * The zip contains everything needed to run LineOps KDS on any machine
 * that has Docker + Docker Compose installed:
 *
 *   LineOps_KDS_Deploy/
 *   ├── docker-compose.yml
 *   ├── .env.example
 *   ├── start.sh          ← Linux / macOS / WSL one-click launcher
 *   ├── start.ps1         ← Windows PowerShell one-click launcher
 *   ├── README-deploy.md
 *   └── docker/
 *       ├── Dockerfile.api
 *       ├── Dockerfile.web
 *       ├── nginx.conf
 *       ├── nginx-kds-default.conf
 *       ├── lineops-kds.service         (systemd – server auto-start)
 *       └── lineops-kds-display.service (systemd – kiosk display auto-start)
 */

import fs   from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIST = path.join(ROOT, "dist");
const TMP  = path.join(DIST, "LineOps_KDS_Deploy");
const OUT  = path.join(DIST, "LineOps_KDS_Deploy.zip");

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkdir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function cp(src: string, dest: string) {
  mkdir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  copied  ${path.relative(ROOT, src)}`);
}

function write(dest: string, content: string) {
  mkdir(path.dirname(dest));
  fs.writeFileSync(dest, content, "utf8");
  console.log(`  wrote   ${path.relative(DIST, dest)}`);
}

function clean(p: string) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

// ── Clean previous output ────────────────────────────────────────────────────

console.log("\n  LineOps KDS — Docker deploy bundle\n");
clean(TMP);
clean(OUT);
mkdir(TMP);
mkdir(path.join(TMP, "docker"));

// ── 1. Copy existing files ────────────────────────────────────────────────────

cp(path.join(ROOT, "docker-compose.yml"),                    path.join(TMP, "docker-compose.yml"));
cp(path.join(ROOT, ".env.example"),                          path.join(TMP, ".env.example"));
cp(path.join(ROOT, "docker/Dockerfile.api"),                 path.join(TMP, "docker/Dockerfile.api"));
cp(path.join(ROOT, "docker/Dockerfile.web"),                 path.join(TMP, "docker/Dockerfile.web"));
cp(path.join(ROOT, "docker/nginx.conf"),                     path.join(TMP, "docker/nginx.conf"));
cp(path.join(ROOT, "docker/nginx-kds-default.conf"),         path.join(TMP, "docker/nginx-kds-default.conf"));
cp(path.join(ROOT, "docker/lineops-kds.service"),            path.join(TMP, "docker/lineops-kds.service"));
cp(path.join(ROOT, "docker/lineops-kds-display.service"),    path.join(TMP, "docker/lineops-kds-display.service"));

// ── 2. Generate start.sh (Linux / macOS / WSL) ───────────────────────────────

write(path.join(TMP, "start.sh"), `#!/usr/bin/env bash
# LineOps KDS — one-click launcher (Linux / macOS / WSL)
# Requirements: Docker 24+ with the Compose plugin (docker compose)
set -euo pipefail

BOLD="\\033[1m"
GREEN="\\033[0;32m"
AMBER="\\033[0;33m"
RESET="\\033[0m"

echo ""
echo -e "\${BOLD}LineOps KDS — Docker deploy\${RESET}"
echo "──────────────────────────────────────"

# ── Check Docker ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "\${AMBER}Docker not found.\${RESET}"
  echo "  Install from https://docs.docker.com/get-docker/ and re-run this script."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "\${AMBER}Docker Compose plugin not found.\${RESET}"
  echo "  Install Docker Desktop or run: sudo apt-get install docker-compose-plugin"
  exit 1
fi

echo -e "  Docker: \$(docker --version)"

# ── Generate .env from .env.example if missing ──────────────────────────────
if [ ! -f .env ]; then
  echo ""
  echo "  No .env found — generating one with secure random secrets..."
  cp .env.example .env

  DB_PASS=\$(LC_ALL=C tr -dc 'A-Za-z0-9_-' </dev/urandom | head -c 32 || true)
  SESSION=\$(LC_ALL=C tr -dc 'A-Za-z0-9_-' </dev/urandom | head -c 64 || true)

  # Replace placeholder values
  sed -i.bak "s|DB_PASSWORD=change_me|DB_PASSWORD=\${DB_PASS}|" .env
  sed -i.bak "s|SESSION_SECRET=change_me_to_a_long_random_string|SESSION_SECRET=\${SESSION}|" .env
  rm -f .env.bak

  echo -e "  \${GREEN}✓ .env created with random secrets\${RESET}"
else
  echo "  .env already exists — skipping secret generation"
fi

# ── Pull + build + start ─────────────────────────────────────────────────────
echo ""
echo "  Starting containers (this may take a few minutes on first run)..."
echo ""
docker compose up -d --build --remove-orphans

# ── Print access info ────────────────────────────────────────────────────────
echo ""
echo -e "\${GREEN}──────────────────────────────────────\${RESET}"
echo -e "\${GREEN}  LineOps KDS is running!\${RESET}"
echo -e "\${GREEN}──────────────────────────────────────\${RESET}"
echo ""

HOST_PORT=\${HOST_PORT:-80}
echo -e "  Local URL  \${BOLD}http://localhost:\${HOST_PORT}/\${RESET}"
echo ""

# Show LAN IPs so kitchen displays can connect
if command -v ip &>/dev/null; then
  IPS=\$(ip -4 addr show scope global | grep inet | awk '{print \$2}' | cut -d/ -f1)
elif command -v ipconfig &>/dev/null; then
  IPS=\$(ipconfig 2>/dev/null | grep -i "IPv4" | awk '{print \$NF}')
elif command -v ifconfig &>/dev/null; then
  IPS=\$(ifconfig 2>/dev/null | grep 'inet ' | awk '{print \$2}' | grep -v 127.0.0.1)
fi

if [ -n "\${IPS:-}" ]; then
  echo "  LAN addresses (for kitchen display tablets):"
  while IFS= read -r ip; do
    echo -e "    \${BOLD}http://\${ip}:\${HOST_PORT}/\${RESET}"
  done <<< "\$IPS"
fi

echo ""
echo "  To stop:   docker compose down"
echo "  Logs:      docker compose logs -f"
echo "  Status:    docker compose ps"
echo ""

# ── Optional: install as systemd service ────────────────────────────────────
if command -v systemctl &>/dev/null; then
  echo "  To start automatically on boot:"
  echo "    sudo cp docker/lineops-kds.service /etc/systemd/system/"
  echo "    sudo systemctl daemon-reload && sudo systemctl enable --now lineops-kds"
  echo ""
fi
`);

// Make start.sh executable
try { execSync(`chmod +x ${path.join(TMP, "start.sh")}`); } catch { /* ignore on Windows */ }

// ── 3. Generate start.ps1 (Windows PowerShell) ───────────────────────────────

write(path.join(TMP, "start.ps1"), `# LineOps KDS — one-click launcher (Windows PowerShell)
# Requirements: Docker Desktop for Windows with "Use Docker Compose V2" enabled
param(
  [int]$Port = 80
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "LineOps KDS — Docker deploy" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "──────────────────────────────────────"

# ── Check Docker ──────────────────────────────────────────────────────────────
try {
  $null = docker --version
} catch {
  Write-Host "ERROR: Docker not found." -ForegroundColor Red
  Write-Host "  Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
  exit 1
}

try {
  $null = docker compose version
} catch {
  Write-Host "ERROR: Docker Compose plugin not found." -ForegroundColor Red
  Write-Host "  Ensure Docker Desktop is up to date and Compose V2 is enabled."
  exit 1
}

Write-Host "  Docker: $(docker --version)"

# ── Generate .env if missing ──────────────────────────────────────────────────
if (-not (Test-Path ".env")) {
  Write-Host ""
  Write-Host "  No .env found — generating with secure random secrets..." -ForegroundColor Yellow
  Copy-Item ".env.example" ".env"

  Add-Type -AssemblyName System.Web
  $dbPass  = [System.Web.Security.Membership]::GeneratePassword(32, 4)
  $session = [System.Web.Security.Membership]::GeneratePassword(64, 8)

  (Get-Content ".env") \`
    -replace "DB_PASSWORD=change_me",                           "DB_PASSWORD=$dbPass" \`
    -replace "SESSION_SECRET=change_me_to_a_long_random_string","SESSION_SECRET=$session" \`
    | Set-Content ".env"

  Write-Host "  .env created with random secrets." -ForegroundColor Green
} else {
  Write-Host "  .env already exists — skipping."
}

# ── Start ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Starting containers (first run may take a few minutes)..."
Write-Host ""
docker compose up -d --build --remove-orphans

# ── Print access info ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "──────────────────────────────────────" -ForegroundColor Green
Write-Host "  LineOps KDS is running!" -ForegroundColor Green
Write-Host "──────────────────────────────────────" -ForegroundColor Green
Write-Host ""
Write-Host "  Local URL:  http://localhost:$Port/"
Write-Host ""

$ips = (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual |
        Where-Object { $_.IPAddress -notlike "169.*" -and $_.IPAddress -ne "127.0.0.1" } |
        Select-Object -ExpandProperty IPAddress)
if ($ips) {
  Write-Host "  LAN addresses (for kitchen tablets):"
  foreach ($ip in $ips) {
    Write-Host "    http://$($ip):$Port/" -ForegroundColor Cyan
  }
}

Write-Host ""
Write-Host "  To stop:   docker compose down"
Write-Host "  Logs:      docker compose logs -f"
Write-Host "  Status:    docker compose ps"
Write-Host ""
`);

// ── 4. Generate README-deploy.md ─────────────────────────────────────────────

write(path.join(TMP, "README-deploy.md"), `# LineOps KDS — Deployment Guide

## Requirements

| | Minimum |
|---|---|
| Docker | 24+ |
| Docker Compose | v2 (included in Docker Desktop) |
| RAM | 1 GB |
| Disk | 4 GB |
| OS | Linux, macOS, Windows 10/11, Raspberry Pi OS 64-bit |

---

## One-click start

### Linux / macOS / WSL

\`\`\`bash
chmod +x start.sh
./start.sh
\`\`\`

### Windows PowerShell (run as Administrator)

\`\`\`powershell
.\\start.ps1
\`\`\`

That's it. The script will:
1. Check Docker is available
2. Generate \`.env\` with random database + session secrets (only on first run)
3. Build and start all containers
4. Print the URL + every LAN IP kitchen tablets can connect to

---

## Services

| Container | Role | Port |
|---|---|---|
| \`kds-proxy\` | Nginx — single entry point | \`:80\` (public) |
| \`kds-web\` | React KDS frontend | internal |
| \`kds-api\` | Express REST + WebSocket | \`:3000\` localhost only |
| \`kds-db\` | PostgreSQL 16 | internal |

All four containers share an isolated Docker network. Only port \`:80\` is exposed.

---

## POS Integration — Volante VE (Primary)

1. In **VE Back Office → Kitchen Display Setup**, set the KDS URL to:
   \`http://<server-ip>/api/integrations/volante/rpc/\`
2. Set \`VOLANTE_WEBHOOK_SECRET\` in \`.env\` to the same value configured in VE.
3. Set \`VOLANTE_STATION_MAP\` (JSON) mapping VE KDS Terminal IDs → LineOps station names.
4. Restart: \`docker compose restart api\`

### Other POS systems

Set the matching \`*_WEBHOOK_SECRET\` in \`.env\` and configure the webhook URL in your POS dashboard:

| POS | Endpoint |
|---|---|
| Square | \`http://<ip>/api/integrations/square/webhook\` |
| Toast | \`http://<ip>/api/integrations/toast/webhook\` |
| Clover | \`http://<ip>/api/integrations/clover/webhook\` |
| Lightspeed K | \`http://<ip>/api/integrations/lightspeed/webhook\` |
| Generic | \`http://<ip>/api/integrations/orders\` (API key auth) |

---

## Auto-start on boot (Linux / systemd)

\`\`\`bash
sudo cp docker/lineops-kds.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lineops-kds
\`\`\`

To also auto-start a kiosk display on the same machine:

\`\`\`bash
sudo cp docker/lineops-kds-display.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lineops-kds-display
\`\`\`

---

## Useful commands

\`\`\`bash
docker compose logs -f          # live logs
docker compose ps               # container status
docker compose restart api      # reload after .env changes
docker compose down             # stop everything
docker compose down -v          # stop + wipe database
\`\`\`

---

## Changing the port

If port 80 is already in use, edit \`.env\`:

\`\`\`
HOST_PORT=8080
\`\`\`

Then restart: \`docker compose up -d\`

---

## GitHub

[github.com/abhaypatial/Lineops_KDS](https://github.com/abhaypatial/Lineops_KDS)
`);

// ── 5. Create zip with Python (no zip binary on Nix) ─────────────────────────

console.log("\n  Building zip archive...");

const py = `
import zipfile, os, time

ROOT  = ${JSON.stringify(TMP)}
OUT   = ${JSON.stringify(OUT)}
PREFIX = "LineOps_KDS_Deploy"

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
        for fname in filenames:
            full = os.path.join(dirpath, fname)
            rel  = os.path.relpath(full, ROOT)
            arc  = os.path.join(PREFIX, rel)
            try:
                mtime = os.path.getmtime(full)
                if mtime < 315532800:
                    os.utime(full, (315532800, 315532800))
            except Exception:
                pass
            zf.write(full, arc)
            count += 1

size = os.path.getsize(OUT)
print(f"{count} files, {size/1024:.0f} KB")
`;

const result = execSync(`python3 -c '${py.replace(/'/g, "\\'")}'`, { encoding: "utf8" }).trim();

// ── Done ─────────────────────────────────────────────────────────────────────

const sizeMB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`\n  ✓  dist/LineOps_KDS_Deploy.zip  (${result} — ${sizeMB} MB)\n`);
console.log("  Contents:");
console.log("    start.sh            ← Linux/macOS/WSL one-click launcher");
console.log("    start.ps1           ← Windows PowerShell one-click launcher");
console.log("    docker-compose.yml  ← Full stack definition");
console.log("    .env.example        ← Environment template");
console.log("    README-deploy.md    ← Quick-start guide");
console.log("    docker/             ← Dockerfiles + nginx + systemd units");
console.log("");
