#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  LineOps KDS — Frontend (Display) Setup Script (Linux)
#
#  Deploys ONLY the KDS Display frontend on a kitchen screen device.
#  Requires a running LineOps KDS Back-Office server to connect to.
#
#  Usage:
#    sudo bash lineops-kds-frontend-setup.sh --api-url http://192.168.1.10
#
#  Or download and run:
#    curl -fsSL https://github.com/abhaypatial/Lineops_KDS/raw/main/install/lineops-kds-frontend-setup.sh \
#      | sudo bash -s -- --api-url http://192.168.1.10
#
#  What it does:
#    1. Installs Docker on the display device
#    2. Clones the repo
#    3. Starts ONLY the KDS display service (no database or API)
#    4. Opens Chromium in kiosk mode pointed at the display URL
#
#  Network: each display connects to the back-office server over Wi-Fi,
#  wired Ethernet, or any combination. The --api-url can be any reachable
#  LAN address (e.g. 192.168.1.10, 10.0.0.5).
#
#  Typical deployment:
#    - 1x Back-office server:       lineops-backoffice-setup.sh
#    - N× Kitchen display screens:  lineops-kds-frontend-setup.sh --api-url <server-ip>
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

INSTALL_DIR="/opt/lineops-kds"
REPO_URL="https://github.com/abhaypatial/Lineops_KDS"
KDS_VERSION="${KDS_VERSION:-main}"
API_URL=""
KIOSK_URL="http://localhost/kds"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'
CYN='\033[0;36m'; WHT='\033[1;37m'; DIM='\033[2m'; RST='\033[0m'
ORG='\033[0;33m'

info()    { echo -e "${CYN}  →${RST} $*"; }
ok()      { echo -e "${GRN}  ✓${RST} $*"; }
warn()    { echo -e "${YLW}  ⚠${RST}  $*"; }
die()     { echo -e "${RED}  ✗ error:${RST} $*" >&2; exit 1; }
section() { echo ""; echo -e "${WHT}  ── $* ${DIM}─────────────────────────────────────────${RST}"; echo ""; }

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --kiosk-url) KIOSK_URL="$2"; shift 2 ;;
    *) warn "Unknown argument: $1"; shift ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || die "Please run as root: sudo bash lineops-kds-frontend-setup.sh --api-url <server>"
[[ -n "$API_URL" ]] || die "Specify the back-office server: --api-url http://192.168.1.10"

clear
echo -e "${ORG}"
echo "   LineOps KDS — Display Setup"
echo -e "${RST}${DIM}   Kitchen Screen  ·  Connects to: ${API_URL}${RST}"
echo ""

section "System requirements"
[[ "$(uname -s)" == "Linux" ]] || die "Linux only."
ok "Linux $(uname -m)"

section "Docker"
if ! command -v docker &>/dev/null; then
  info "Installing Docker ..."
  curl -fsSL https://get.docker.com | sh
  ok "Docker installed"
else
  ok "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"
fi
docker info &>/dev/null || { systemctl start docker 2>/dev/null || service docker start 2>/dev/null || die "Cannot start Docker."; }

section "Installing LineOps KDS"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  git -C "$INSTALL_DIR" pull --ff-only origin "$KDS_VERSION" 2>/dev/null && ok "Updated" || warn "Using existing files."
elif command -v git &>/dev/null; then
  git clone --depth 1 --branch "$KDS_VERSION" "$REPO_URL" "$INSTALL_DIR" && ok "Repository cloned"
else
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "${REPO_URL}/archive/refs/heads/${KDS_VERSION}.tar.gz" | tar xz --strip-components=1 -C "$INSTALL_DIR"
  ok "Files downloaded"
fi

section "Configuring display"
ENV_FILE="${INSTALL_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# LineOps KDS Display — generated $(date -u +"%Y-%m-%d %H:%M UTC")
# Remote back-office API server
VITE_API_URL=${API_URL}
EOF
  ok ".env generated"
else
  # Update API URL in existing .env
  if grep -q "VITE_API_URL" "$ENV_FILE"; then
    sed -i "s|VITE_API_URL=.*|VITE_API_URL=${API_URL}|" "$ENV_FILE"
  else
    echo "VITE_API_URL=${API_URL}" >> "$ENV_FILE"
  fi
  ok "API URL updated in .env → ${API_URL}"
fi

section "Starting KDS display"
cd "$INSTALL_DIR"
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build kds-frontend
ok "KDS display service started"

# ── Optional: Chromium kiosk mode ────────────────────────────────────────────
section "Kiosk mode"
if command -v chromium-browser &>/dev/null || command -v chromium &>/dev/null; then
  CHROMIUM=$(command -v chromium-browser 2>/dev/null || command -v chromium)
  # Create autostart entry for the current user's display
  AUTOSTART_DIR="/etc/xdg/autostart"
  mkdir -p "$AUTOSTART_DIR"
  cat > "${AUTOSTART_DIR}/lineops-kds-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=LineOps KDS Display
Exec=${CHROMIUM} --kiosk --noerrdialogs --disable-infobars --no-first-run --enable-features=OverlayScrollbar ${KIOSK_URL}
Terminal=false
EOF
  ok "Chromium kiosk autostart configured → ${KIOSK_URL}"
else
  warn "Chromium not found. Open ${KIOSK_URL} manually on this device."
  info "To install: apt-get install -y chromium-browser"
fi

echo ""
echo -e "${ORG}  ══════════════════════════════════════════════════════════${RST}"
echo ""
echo -e "  ${GRN}✓  LineOps KDS Display is running!${RST}"
echo ""
echo -e "  ${WHT}KDS Display URL:${RST}   ${CYN}http://localhost/${RST}"
echo -e "  ${WHT}Back-office API:${RST}   ${CYN}${API_URL}${RST}"
echo ""
echo -e "  ${DIM}Reboot this device to start Chromium in kiosk mode automatically.${RST}"
echo ""
echo -e "${ORG}  ══════════════════════════════════════════════════════════${RST}"
echo ""
