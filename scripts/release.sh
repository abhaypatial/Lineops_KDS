#!/usr/bin/env bash
# LineOps KDS — Release helper (Linux / macOS)
# Wraps the TypeScript release script via pnpm.
#
# Usage:
#   ./scripts/release.sh patch
#   ./scripts/release.sh minor
#   ./scripts/release.sh major
#   ./scripts/release.sh 2.1.0
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
pnpm --filter @workspace/scripts run release -- "${1:-}"
