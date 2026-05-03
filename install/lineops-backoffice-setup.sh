#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  LineOps KDS — Back-Office Setup Script (Linux)
#
#  Deploys the management layer only (no KDS display):
#    PostgreSQL · API Server · Back-office Dashboard
#
#  Use this when you want a central management server that kitchen screens
#  connect to remotely over Wi-Fi, wired Ethernet, or any mix of both.
#  Run lineops-kds-frontend-setup.sh on each kitchen display device to
#  connect it to this server. Server binds to 0.0.0.0:80 automatically.
#
#  Run with:
#    curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-backoffice-setup.sh | sudo bash
#
#  Or after cloning:
#    sudo bash install/lineops-backoffice-setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

INSTALL_DIR="/opt/lineops-kds"
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

[[ "$(id -u)" -eq 0 ]] || die "Please run as root: sudo bash lineops-backoffice-setup.sh"

clear
echo -e "${ORG}"
echo "   LineOps KDS — Back-Office Setup"
echo -e "${RST}${DIM}   PostgreSQL · API Server · Management Dashboard${RST}"
echo ""

section "System requirements"
[[ "$(uname -s)" == "Linux" ]] || die "Linux only."
ok "Linux $(uname -m) detected"

section "Docker"
if ! command -v docker &>/dev/null; then
  info "Installing Docker ..."
  curl -fsSL https://get.docker.com | sh
  ok "Docker installed"
else
  ok "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"
fi
docker info &>/dev/null || { systemctl start docker 2>/dev/null || service docker start 2>/dev/null || die "Cannot start Docker."; }
docker compose version &>/dev/null || die "Docker Compose v2 not found. Update Docker Desktop."

section "Installing LineOps KDS"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  git -C "$INSTALL_DIR" pull --ff-only origin "$KDS_VERSION" 2>/dev/null && ok "Repository updated" || warn "Git pull failed — using existing files."
elif command -v git &>/dev/null; then
  git clone --depth 1 --branch "$KDS_VERSION" "$REPO_URL" "$INSTALL_DIR" && ok "Repository cloned"
else
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "${REPO_URL}/archive/refs/heads/${KDS_VERSION}.tar.gz" | tar xz --strip-components=1 -C "$INSTALL_DIR"
  ok "Files downloaded"
fi

section "Configuring environment"
ENV_FILE="${INSTALL_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn ".env exists — skipping generation."
else
  DB_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)
  SESSION_SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 40)
  cat > "$ENV_FILE" <<EOF
# LineOps KDS Back-Office — generated $(date -u +"%Y-%m-%d %H:%M UTC")
DB_PASSWORD=${DB_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
# ADMIN_PASSWORD=change_me
# HOST_PORT=80
EOF
  ok ".env generated"
fi

section "Starting Back-Office services"
cd "$INSTALL_DIR"
# Start only back-office components (no KDS display frontend)
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build --remove-orphans postgres api-server
ok "Back-office services started (postgres · api-server)"

LAN_IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "your-server-ip")

echo ""
echo -e "${ORG}  ══════════════════════════════════════════════════════════${RST}"
echo ""
echo -e "  ${GRN}✓  LineOps KDS Back-Office is running!${RST}"
echo ""
echo -e "  ${WHT}Management dashboard:${RST}   ${CYN}http://${LAN_IP}/dashboard${RST}"
echo -e "  ${WHT}API endpoint:${RST}           ${CYN}http://${LAN_IP}/api${RST}"
echo -e "  ${WHT}Health check:${RST}           ${CYN}http://${LAN_IP}/api/health${RST}"
echo ""
echo -e "  ${DIM}On each kitchen screen device, run:${RST}"
echo -e "  ${CYN}  sudo bash lineops-kds-frontend-setup.sh --api-url http://${LAN_IP}${RST}"
echo ""
echo -e "${ORG}  ══════════════════════════════════════════════════════════${RST}"
echo ""
