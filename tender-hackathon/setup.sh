#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Procure Intelligence AP — local setup script
#
# Verifies prerequisites, installs dependencies, and starts the dev server.
# Usage:
#   ./setup.sh              # install + start dev server
#   ./setup.sh --install    # install dependencies only
#   ./setup.sh --build      # production build
#   ./setup.sh --check      # type-check + production build
# ----------------------------------------------------------------------------

set -euo pipefail

# Resolve repo paths relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
MIN_NODE_MAJOR=20

cyan()   { printf "\033[36m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*" >&2; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Missing required command: $1"
    red "Install it and rerun. macOS: 'brew install $1'. Linux: use your package manager."
    exit 1
  fi
}

check_node_version() {
  local v
  v="$(node -v | sed 's/^v//')"
  local major="${v%%.*}"
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    red "Node.js $v detected. This project needs Node $MIN_NODE_MAJOR+."
    red "Install via nvm:  nvm install $MIN_NODE_MAJOR && nvm use $MIN_NODE_MAJOR"
    exit 1
  fi
  green "Node $(node -v) OK"
  green "npm  $(npm -v) OK"
}

ensure_app_dir() {
  if [ ! -d "$APP_DIR" ]; then
    red "App directory not found: $APP_DIR"
    exit 1
  fi
}

install_deps() {
  cyan ">>> Installing dependencies in $APP_DIR"
  cd "$APP_DIR"
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  green "Dependencies installed."
}

run_dev() {
  cyan ">>> Starting Vite dev server"
  cd "$APP_DIR"
  yellow "Open http://localhost:5173 in your browser. Ctrl+C to stop."
  exec npm run dev
}

run_build() {
  cyan ">>> Building production bundle"
  cd "$APP_DIR"
  npm run build
  green "Build artifacts in $APP_DIR/dist"
}

run_check() {
  cyan ">>> Type-checking and building"
  cd "$APP_DIR"
  npx tsc -b
  npm run build
  green "Type-check + build passed."
}

main() {
  cyan "Procure Intelligence AP — Local setup"
  cyan "Repo: $SCRIPT_DIR"
  echo

  require node
  require npm
  check_node_version
  ensure_app_dir

  case "${1:-}" in
    --install) install_deps ;;
    --build)   install_deps; run_build ;;
    --check)   install_deps; run_check ;;
    -h|--help)
      cat <<USAGE
Usage:
  ./setup.sh              install + start dev server (default)
  ./setup.sh --install    install dependencies only
  ./setup.sh --build      install + production build
  ./setup.sh --check      install + type-check + production build
USAGE
      ;;
    *) install_deps; run_dev ;;
  esac
}

main "$@"
