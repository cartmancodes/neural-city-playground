#!/usr/bin/env bash
# Local setup for the AP GIS Permission & Construction Monitoring prototype.
# Bootstraps both the React app and the Python verification engine for a
# self-contained local demo. Re-runnable safely.

set -euo pipefail

# Resolve the directory this script lives in, regardless of where it's called from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR}/app"
ENGINE_DIR="${SCRIPT_DIR}/verification_engine"
ENGINE_VENV="${ENGINE_DIR}/.venv"

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

React app commands (existing):
  app-install     Install npm dependencies
  app-geojson     Regenerate the fallback GeoJSON boundary files
  app-typecheck   Run TypeScript type-check
  app-build       Run the production build
  app-dev         Start the Vite dev server (http://localhost:5173)
  app-preview     Build and serve the production bundle

Verification engine commands:
  engine-install  Create Python venv at verification_engine/.venv and install
  engine-test     Run the engine's pytest suite (no live API calls)
  engine-test-live  Run pytest including the live API integration test
                    (requires ANTHROPIC_API_KEY in the environment)
  engine-ui       Launch the Streamlit UI (http://localhost:8501)
  engine-clean    Remove engine venv + output

Combined:
  demo            Full bootstrap: app + engine + tests, then print next steps
  all             Alias for demo
  clean           Remove all build artefacts (app + engine)
  help            Show this message

Back-compat aliases:
  install     -> app-install
  geojson     -> app-geojson
  typecheck   -> app-typecheck
  build       -> app-build
  dev         -> app-dev
  preview     -> app-preview

Examples:
  ./setup.sh demo            # one-shot setup for the demo
  ./setup.sh app-dev         # only start dev server (after demo)
  ./setup.sh engine-ui       # only start Streamlit UI
  ./setup.sh engine-test     # run engine tests
EOF
}

# -------------------- React app steps --------------------

step_app_install() {
  cyan "→ Installing npm dependencies in ${APP_DIR}"
  cd "${APP_DIR}"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  green "✓ Dependencies installed"
}

step_app_geojson() {
  cyan "→ Regenerating fallback GeoJSON layers"
  cd "${APP_DIR}"
  node scripts/generateGeoJSON.mjs
  green "✓ GeoJSON layers written to public/data/geojson/"
}

step_app_typecheck() {
  cyan "→ Running TypeScript type-check"
  cd "${APP_DIR}"
  npx tsc -b --noEmit
  green "✓ TypeScript clean"
}

step_app_build() {
  cyan "→ Building production bundle"
  cd "${APP_DIR}"
  npm run build
  green "✓ Production bundle written to dist/"
}

step_app_dev() {
  cyan "→ Starting Vite dev server"
  cd "${APP_DIR}"
  yellow "Open http://localhost:5173 in your browser. Ctrl+C to stop."
  npm run dev
}

step_app_preview() {
  cyan "→ Serving production preview"
  cd "${APP_DIR}"
  yellow "Open http://localhost:4173 in your browser. Ctrl+C to stop."
  npm run preview
}

# -------------------- Verification engine steps --------------------

pick_python() {
  # Prefer python3.11+, fall back to python3.
  for candidate in python3.13 python3.12 python3.11 python3; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      local v
      v=$("${candidate}" -c "import sys; print('%d.%d' % sys.version_info[:2])")
      local major minor
      major="${v%.*}"
      minor="${v#*.}"
      if [ "${major}" -ge 3 ] && [ "${minor}" -ge 11 ]; then
        echo "${candidate}"
        return 0
      fi
    fi
  done
  return 1
}

step_engine_install() {
  cyan "→ Setting up Python verification engine"
  if [ ! -d "${ENGINE_DIR}" ]; then
    red "Engine directory not found at ${ENGINE_DIR}"
    exit 1
  fi
  local PY
  if ! PY=$(pick_python); then
    red "Python 3.11+ is required for the verification engine."
    red "Install from https://www.python.org/downloads/ or via pyenv/uv."
    exit 1
  fi
  cyan "  using ${PY} ($(${PY} --version))"

  if [ ! -d "${ENGINE_VENV}" ]; then
    cyan "  creating venv at ${ENGINE_VENV}"
    "${PY}" -m venv "${ENGINE_VENV}"
  else
    yellow "  venv already exists at ${ENGINE_VENV} (skipping create)"
  fi

  cyan "  installing dependencies (this takes a minute on first run)"
  "${ENGINE_VENV}/bin/pip" install --upgrade pip --quiet
  cd "${ENGINE_DIR}"
  "${ENGINE_VENV}/bin/pip" install -e ".[dev]" --quiet
  green "✓ Verification engine installed"

  if [ ! -f "${ENGINE_DIR}/.env.local" ]; then
    yellow "  no .env.local yet — copying from .env.example"
    cp "${ENGINE_DIR}/.env.example" "${ENGINE_DIR}/.env.local"
    yellow "  edit ${ENGINE_DIR}/.env.local and add your ANTHROPIC_API_KEY"
  fi
}

step_engine_test() {
  cyan "→ Running engine pytest (excluding live tests)"
  if [ ! -x "${ENGINE_VENV}/bin/pytest" ]; then
    red "Engine venv missing. Run './setup.sh engine-install' first."
    exit 1
  fi
  cd "${ENGINE_DIR}"
  "${ENGINE_VENV}/bin/pytest" -q -m "not live"
  green "✓ Engine tests pass"
}

step_engine_test_live() {
  cyan "→ Running engine pytest (including live API test)"
  if [ ! -x "${ENGINE_VENV}/bin/pytest" ]; then
    red "Engine venv missing. Run './setup.sh engine-install' first."
    exit 1
  fi
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    if [ -f "${ENGINE_DIR}/.env.local" ]; then
      # shellcheck disable=SC1091
      set -a; source "${ENGINE_DIR}/.env.local"; set +a
    fi
  fi
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    red "ANTHROPIC_API_KEY not set. Add it to ${ENGINE_DIR}/.env.local or export it."
    exit 1
  fi
  cd "${ENGINE_DIR}"
  RUN_LIVE_TESTS=1 "${ENGINE_VENV}/bin/pytest" -q
  green "✓ Engine live tests pass"
}

step_engine_ui() {
  cyan "→ Starting Streamlit UI"
  if [ ! -x "${ENGINE_VENV}/bin/streamlit" ]; then
    red "Engine venv missing. Run './setup.sh engine-install' first."
    exit 1
  fi
  cd "${ENGINE_DIR}"
  yellow "Open http://localhost:8501 in your browser. Ctrl+C to stop."
  "${ENGINE_VENV}/bin/streamlit" run ui/app.py
}

step_engine_clean() {
  cyan "→ Cleaning engine artefacts"
  rm -rf "${ENGINE_VENV}" "${ENGINE_DIR}/output" "${ENGINE_DIR}/.pytest_cache" \
         "${ENGINE_DIR}"/*.egg-info "${ENGINE_DIR}/__pycache__"
  find "${ENGINE_DIR}" -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
  green "✓ Engine cleaned"
}

# -------------------- Combined steps --------------------

step_clean() {
  cyan "→ Cleaning all build artefacts"
  rm -rf "${APP_DIR}/node_modules" "${APP_DIR}/dist" "${APP_DIR}/.vite"
  rm -rf "${ENGINE_VENV}" "${ENGINE_DIR}/output" "${ENGINE_DIR}/.pytest_cache" \
         "${ENGINE_DIR}"/*.egg-info
  find "${ENGINE_DIR}" -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
  green "✓ Cleaned"
}

step_demo() {
  step_app_install
  if [ ! -f "${APP_DIR}/public/data/geojson/districts.geojson" ]; then
    step_app_geojson
  fi
  step_app_typecheck
  step_engine_install
  step_engine_test
  cat <<EOF

$(green "✓ Demo bootstrap complete.")

Next steps:

  React app (citizen / officer / state dashboards):
    ./setup.sh app-dev        →  http://localhost:5173

  Verification engine (rule extraction + verification + Streamlit UI):
    ./setup.sh engine-ui      →  http://localhost:8501
    (set ANTHROPIC_API_KEY in verification_engine/.env.local first)

  Run engine CLIs directly:
    cd verification_engine
    .venv/bin/python scripts/extract_rules.py path/to/rulebook.pdf
    .venv/bin/python scripts/verify.py output/rules.json sample_app.json
    .venv/bin/python scripts/export_to_react.py output/rules.json

  See SETUP.md for the full demo journey.
EOF
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
    step_app_install
    if [ ! -f "${APP_DIR}/public/data/geojson/districts.geojson" ]; then
      step_app_geojson
    fi
    step_app_dev
    ;;

  # React app commands
  app-install|install)        step_app_install ;;
  app-geojson|geojson)        step_app_geojson ;;
  app-typecheck|typecheck)    step_app_typecheck ;;
  app-build|build)            step_app_build ;;
  app-dev|dev)                step_app_dev ;;
  app-preview|preview)        step_app_preview ;;

  # Verification engine commands
  engine-install)             step_engine_install ;;
  engine-test)                step_engine_test ;;
  engine-test-live)           step_engine_test_live ;;
  engine-ui)                  step_engine_ui ;;
  engine-clean)               step_engine_clean ;;

  # Combined
  demo|all)                   step_demo ;;
  clean)                      step_clean ;;
  help|-h|--help)             usage ;;
  *)
    red "Unknown command: ${CMD}"
    usage
    exit 1
    ;;
esac
