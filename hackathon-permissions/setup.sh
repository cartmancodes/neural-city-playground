#!/usr/bin/env bash
# Local setup for the AP GIS Permission & Construction Monitoring prototype.
# Installs dependencies, regenerates the fallback GeoJSON layers, type-checks,
# and starts the dev server. Re-runnable safely.

set -euo pipefail

# Resolve the directory this script lives in, regardless of where it's called from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR}/app"

cyan()  { printf "\033[1;36m%s\033[0m\n" "$*"; }
green() { printf "\033[1;32m%s\033[0m\n" "$*"; }
red()   { printf "\033[1;31m%s\033[0m\n" "$*" >&2; }
yellow(){ printf "\033[1;33m%s\033[0m\n" "$*"; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Missing required command: $1"
    red "Please install $1 and re-run."
    exit 1
  fi
}

usage() {
  cat <<EOF
AP GIS Permission System — local setup

Usage: ./setup.sh [command]

Commands:
  install     Install npm dependencies (default if no command given)
  geojson     Regenerate the fallback GeoJSON boundary files
  typecheck   Run TypeScript type-check
  build       Run the production build
  dev         Start the Vite dev server (http://localhost:5173)
  preview     Build and serve the production bundle
  clean       Remove node_modules, dist, and .vite cache
  all         install + geojson + typecheck + build + dev   (default fast-path)
  help        Show this message

Examples:
  ./setup.sh           # install deps and start dev server
  ./setup.sh dev       # only start dev server
  ./setup.sh build     # production build only
EOF
}

step_install() {
  cyan "→ Installing npm dependencies in ${APP_DIR}"
  cd "${APP_DIR}"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  green "✓ Dependencies installed"
}

step_geojson() {
  cyan "→ Regenerating fallback GeoJSON layers"
  cd "${APP_DIR}"
  node scripts/generateGeoJSON.mjs
  green "✓ GeoJSON layers written to public/data/geojson/"
}

step_typecheck() {
  cyan "→ Running TypeScript type-check"
  cd "${APP_DIR}"
  npx tsc -b --noEmit
  green "✓ TypeScript clean"
}

step_build() {
  cyan "→ Building production bundle"
  cd "${APP_DIR}"
  npm run build
  green "✓ Production bundle written to dist/"
}

step_dev() {
  cyan "→ Starting Vite dev server"
  cd "${APP_DIR}"
  yellow "Open http://localhost:5173 in your browser. Ctrl+C to stop."
  npm run dev
}

step_preview() {
  cyan "→ Serving production preview"
  cd "${APP_DIR}"
  yellow "Open http://localhost:4173 in your browser. Ctrl+C to stop."
  npm run preview
}

step_clean() {
  cyan "→ Cleaning build artefacts"
  rm -rf "${APP_DIR}/node_modules" "${APP_DIR}/dist" "${APP_DIR}/.vite"
  green "✓ Cleaned"
}

ensure_app_dir() {
  if [ ! -d "${APP_DIR}" ]; then
    red "App directory not found at ${APP_DIR}"
    exit 1
  fi
}

# ---------- Pre-flight ----------
require node
require npm

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "${NODE_MAJOR}" -lt 18 ]; then
  red "Node.js 18 or newer is required (found $(node -v))."
  red "Install Node 18+ from https://nodejs.org/ or via nvm."
  exit 1
fi

ensure_app_dir

# ---------- Dispatch ----------
CMD="${1:-default}"

case "${CMD}" in
  default)
    step_install
    if [ ! -f "${APP_DIR}/public/data/geojson/districts.geojson" ]; then
      step_geojson
    fi
    step_dev
    ;;
  install)    step_install ;;
  geojson)    step_geojson ;;
  typecheck)  step_typecheck ;;
  build)      step_build ;;
  dev)        step_dev ;;
  preview)    step_preview ;;
  clean)      step_clean ;;
  all)
    step_install
    step_geojson
    step_typecheck
    step_build
    step_dev
    ;;
  help|-h|--help) usage ;;
  *)
    red "Unknown command: ${CMD}"
    usage
    exit 1
    ;;
esac
