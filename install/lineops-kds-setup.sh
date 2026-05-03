#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  LineOps KDS — Full-Stack Setup Script (Linux)
#
#  Installs the complete LineOps KDS stack:
#    PostgreSQL · API Server · KDS Display · Back-office Dashboard
#
#  Run on any Linux machine with a single command:
#
#    curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-setup.sh | sudo bash
#
#  What it does:
#    1. Installs Docker & Compose plugin if not present
#    2. Clones / updates the LineOps KDS repo to /opt/lineops-kds
#    3. Generates a .env file with cryptographically random secrets
#    4. Builds and starts all services via Docker Compose
#    5. Installs the `kds` management CLI to /usr/local/bin
#    6. Prints the URLs your kitchen screens and managers should open
#
#  Requirements: Linux x86_64 / arm64, root/sudo, internet access for setup
#  Network: server listens on all interfaces (0.0.0.0:80) — Wi-Fi, LAN, and Ethernet all work
#  Tested on: Ubuntu 22.04+, Debian 12+, RHEL 9+, Raspberry Pi OS (64-bit)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

INSTALL_DIR="/opt/lineops-kds"
CLI_PATH="/usr/local/bin/kds"
REPO_URL="https://github.com/abhaypatial/Lineops_KDS"
KDS_VERSION="${KDS_VERSION:-main}"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'
CYN='\033[0;36m'; WHT='\033[1;37m'; DIM='\033[2m'; RST='\033[0m'
ORG='\033[0;33m'

info()    { echo -e "${CYN}  →${RST} $*"; }
ok()      { echo -e "${GRN}  ✓${RST} $*"; }
warn()    { echo -e "${YLW}  ⚠${RST}  $*"; }
die()     { echo -e "${RED}  ✗ error:${RST} $*" >&2; exit 1; }
section() { echo ""; echo -e "${WHT}  ── $* ${DIM}─────────────────────────────────────────${RST}"; echo ""; }

[[ "$(id -u)" -eq 0 ]] || die "Please run as root: sudo bash lineops-kds-setup.sh"

clear
echo -e "${ORG}"
echo "   ██╗     ██╗███╗  ██╗███████╗ ██████╗ ██████╗ ███████╗"
echo "   ██║     ██║████╗ ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝"
echo "   ██║     ██║██╔██╗██║█████╗  ██║   ██║██████╔╝███████╗"
echo "   ██║     ██║██║╚████║██╔══╝  ██║   ██║██╔═══╝ ╚════██║"
echo "   ███████╗██║██║ ╚███║███████╗╚██████╔╝██║     ███████║"
echo "   ╚══════╝╚═╝╚═╝  ╚══╝╚══════╝ ╚═════╝ ╚═╝     ╚══════╝"
echo -e "${RST}${DIM}   Kitchen Display System  ·  Full-Stack Setup  ·  v1.3.0${RST}"
echo ""

# ── System requirements ───────────────────────────────────────────────────────
section "System requirements"

[[ "$(uname -s)" == "Linux" ]] || die "This installer is for Linux only. Use lineops-kds-setup.ps1 for Windows."
ok "Linux $(uname -m) detected"

# ── Docker ────────────────────────────────────────────────────────────────────
section "Docker"

if ! command -v docker &>/dev/null; then
  info "Docker not found — installing via get.docker.com ..."
  curl -fsSL https://get.docker.com | sh
  ok "Docker installed"
else
  ok "Docker found: $(docker --version | awk '{print $3}' | tr -d ',')"
fi

if ! docker info &>/dev/null 2>&1; then
  info "Starting Docker daemon ..."
  systemctl start docker 2>/dev/null || service docker start 2>/dev/null || \
    die "Could not start Docker. Start it manually then re-run."
fi

if ! docker compose version &>/dev/null 2>&1; then
  info "Installing Docker Compose plugin ..."
  ARCH=$(uname -m)
  COMPOSE_URL="https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-${ARCH}"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "$COMPOSE_URL" -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  ok "Docker Compose v2 installed"
else
  ok "Docker Compose v2: $(docker compose version --short)"
fi

if ! command -v jq &>/dev/null; then
  info "Installing jq ..."
  if   command -v apt-get &>/dev/null; then apt-get install -y -q jq
  elif command -v yum     &>/dev/null; then yum install -y -q jq
  elif command -v dnf     &>/dev/null; then dnf install -y -q jq
  else warn "jq not found — install manually for full CLI support."
  fi
fi

# ── Download / update repo ────────────────────────────────────────────────────
section "Installing LineOps KDS"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Updating existing install at ${INSTALL_DIR} ..."
  git -C "$INSTALL_DIR" pull --ff-only origin "$KDS_VERSION" || \
    warn "Git pull failed — continuing with existing files."
  ok "Repository updated"
elif command -v git &>/dev/null; then
  info "Cloning repository to ${INSTALL_DIR} ..."
  git clone --depth 1 --branch "$KDS_VERSION" "$REPO_URL" "$INSTALL_DIR"
  ok "Repository cloned"
else
  info "Downloading release archive ..."
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "${REPO_URL}/archive/refs/heads/${KDS_VERSION}.tar.gz" \
    | tar xz --strip-components=1 -C "$INSTALL_DIR"
  ok "Files downloaded"
fi

# ── Generate .env ─────────────────────────────────────────────────────────────
section "Configuring environment"

ENV_FILE="${INSTALL_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping (delete it to regenerate secrets)."
else
  DB_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)
  SESSION_SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 40)
  cat > "$ENV_FILE" <<EOF
# Generated by LineOps KDS installer on $(date -u +"%Y-%m-%d %H:%M UTC")
# Edit to customise your installation. Keep this file private.

DB_PASSWORD=${DB_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}

# ── Admin access (leave blank for trusted LAN with no password) ──────────────
# ADMIN_PASSWORD=change_me

# ── Feature flags ─────────────────────────────────────────────────────────────
# ALLOW_TEST_ORDERS=true

# ── Network ───────────────────────────────────────────────────────────────────
# HOST_PORT=80
EOF
  ok ".env generated with secure random secrets"
fi

# ── Install CLI ───────────────────────────────────────────────────────────────
section "Installing kds CLI"

if [[ -f "${INSTALL_DIR}/bin/kds" ]]; then
  cp "${INSTALL_DIR}/bin/kds" "$CLI_PATH"
  chmod +x "$CLI_PATH"
  sed -i "s|KDS_DIR=.*|KDS_DIR=\"${INSTALL_DIR}\"|" "$CLI_PATH" 2>/dev/null || true
  ok "kds CLI installed at ${CLI_PATH}"
else
  warn "bin/kds not found — CLI not installed. Run 'kds --help' after first start."
fi

# ── Build and start ───────────────────────────────────────────────────────────
section "Starting LineOps KDS services"

cd "$INSTALL_DIR"
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build --remove-orphans
ok "All services started (postgres · api-server · kds-display · nginx)"

# ── Access info ───────────────────────────────────────────────────────────────
LAN_IP=$(ip -4 addr show scope global 2>/dev/null \
  | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 \
  || hostname -I 2>/dev/null | awk '{print $1}' \
  || echo "your-server-ip")

echo ""
echo -e "${ORG}  ══════════════════════════════════════════════════════════${RST}"
echo ""
echo -e "  ${GRN}✓  LineOps KDS is running!${RST}"
echo ""
echo -e "  ${WHT}KDS Display (kitchen screens):${RST}  ${CYN}http://${LAN_IP}/${RST}"
echo -e "  ${WHT}Back-office dashboard:${RST}          ${CYN}http://${LAN_IP}/dashboard${RST}"
echo -e "  ${WHT}API health check:${RST}               ${CYN}http://${LAN_IP}/api/health${RST}"
echo ""
echo -e "  Point kitchen tablets and wall displays at the KDS Display URL."
echo -e "  Managers and expo staff use the Back-office dashboard."
echo ""
echo -e "  ${DIM}Run  ${RST}kds status${DIM}  for a live system overview.${RST}"
echo -e "  ${DIM}Run  ${RST}kds --help${DIM}   for all available commands.${RST}"
echo ""
echo -e "${ORG}  ══════════════════════════════════════════════════════════${RST}"
echo ""
