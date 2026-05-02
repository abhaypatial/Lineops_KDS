#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  LineOps KDS — Release zip builder
#
#  Creates a self-contained deployment zip that a customer can download and
#  run with a single command on any Linux server.
#
#  Usage:
#    bash scripts/make-release-zip.sh [version]
#
#  Output:
#    lineops-kds-<version>.zip
#
#  Contents of the zip:
#    lineops-kds/
#      install.sh                ← run this first
#      docker-compose.yml
#      .env.example
#      bin/kds                   ← CLI tool
#      docker/
#        Dockerfile.api
#        Dockerfile.web
#        nginx.conf
#        lineops-kds.service       ← systemd backend service
#        lineops-kds-display.service ← systemd kiosk display service
#      docs/
#        INSTALL.md
#        ARCHITECTURE.md
#        integrations/
#          README.md
#          VOLANTE.md
#          DEVELOPER.md
#      README.md
#
#  The zip intentionally excludes:
#    - node_modules (installed on first run)
#    - .git history
#    - build artifacts (dist/)
#    - dev config files
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

VERSION="${1:-$(date +%Y%m%d)}"
OUTFILE="lineops-kds-${VERSION}.zip"
TMPDIR="$(mktemp -d)"
DESTDIR="${TMPDIR}/lineops-kds"

echo "Building release zip: ${OUTFILE}"

mkdir -p "${DESTDIR}/docker"
mkdir -p "${DESTDIR}/bin"
mkdir -p "${DESTDIR}/docs/integrations"

# Root files
cp install.sh             "${DESTDIR}/install.sh"
cp docker-compose.yml     "${DESTDIR}/docker-compose.yml"
cp .env.example           "${DESTDIR}/.env.example"
cp README.md              "${DESTDIR}/README.md"

# Make install.sh executable
chmod +x "${DESTDIR}/install.sh"

# Docker files
cp docker/Dockerfile.api                  "${DESTDIR}/docker/"
cp docker/Dockerfile.web                  "${DESTDIR}/docker/"
cp docker/nginx.conf                      "${DESTDIR}/docker/"
cp docker/lineops-kds.service             "${DESTDIR}/docker/"
cp docker/lineops-kds-display.service     "${DESTDIR}/docker/"

# Copy nginx-kds-default.conf if it exists
[ -f docker/nginx-kds-default.conf ] && cp docker/nginx-kds-default.conf "${DESTDIR}/docker/"

# CLI
cp bin/kds                "${DESTDIR}/bin/kds"
chmod +x                  "${DESTDIR}/bin/kds"

# Docs
cp docs/INSTALL.md                        "${DESTDIR}/docs/"
cp docs/ARCHITECTURE.md                   "${DESTDIR}/docs/"
cp docs/integrations/README.md            "${DESTDIR}/docs/integrations/"
cp docs/integrations/VOLANTE.md           "${DESTDIR}/docs/integrations/"
cp docs/integrations/DEVELOPER.md         "${DESTDIR}/docs/integrations/"

# Source code (for building images)
echo "Copying source code…"
# Copy artifacts, excluding build artifacts and dev state
for pkg in api-server kds; do
  src="artifacts/${pkg}"
  dst="${DESTDIR}/artifacts/${pkg}"
  mkdir -p "${dst}"
  cp -r "${src}/src"          "${dst}/src"    2>/dev/null || true
  cp -r "${src}/public"       "${dst}/public" 2>/dev/null || true
  cp    "${src}/package.json" "${dst}/"       2>/dev/null || true
  cp    "${src}/tsconfig.json" "${dst}/"      2>/dev/null || true
  cp    "${src}/vite.config.ts" "${dst}/"     2>/dev/null || true
  cp    "${src}/index.html"   "${dst}/"       2>/dev/null || true
  [ -f "${src}/build.mjs" ] && cp "${src}/build.mjs" "${dst}/" || true
done

# Copy lib packages (schema, api-spec, codegen output)
for pkg in db api-spec api-zod api-client-react; do
  src="lib/${pkg}"
  dst="${DESTDIR}/lib/${pkg}"
  mkdir -p "${dst}"
  cp -r "${src}/src"          "${dst}/src"    2>/dev/null || true
  cp    "${src}/package.json" "${dst}/"       2>/dev/null || true
  cp    "${src}/tsconfig.json" "${dst}/"      2>/dev/null || true
  [ -f "${src}/drizzle.config.ts" ] && cp "${src}/drizzle.config.ts" "${dst}/" || true
  [ -d "${src}/drizzle" ] && cp -r "${src}/drizzle" "${dst}/" || true
done

# Workspace config
cp pnpm-workspace.yaml    "${DESTDIR}/" 2>/dev/null || true
cp package.json           "${DESTDIR}/" 2>/dev/null || true
cp tsconfig.base.json     "${DESTDIR}/" 2>/dev/null || true
cp tsconfig.json          "${DESTDIR}/" 2>/dev/null || true
cp pnpm-lock.yaml         "${DESTDIR}/" 2>/dev/null || true

# Create zip
(cd "${TMPDIR}" && zip -r -q "${OLDPWD}/${OUTFILE}" lineops-kds/)
rm -rf "${TMPDIR}"

SIZE=$(du -sh "${OUTFILE}" | cut -f1)
echo "✓ Created ${OUTFILE} (${SIZE})"
echo ""
echo "  Customer installs with:"
echo "    unzip ${OUTFILE}"
echo "    cd lineops-kds"
echo "    sudo bash install.sh"
