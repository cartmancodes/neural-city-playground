#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Procure Intelligence AP — full local setup script
#
# Bootstraps all three subsystems:
#   1. app/                       (React + TS + Tailwind frontend)
#   2. public_tender_collector/   (Python compliance-first scraper)
#   3. tender_embeddings/         (local sentence-transformers semantic search)
#
# Usage:
#   ./setup.sh                  # install everything + start frontend dev server
#   ./setup.sh --install        # install everything, do not start anything
#   ./setup.sh --frontend       # frontend only (install + dev server)
#   ./setup.sh --backend        # backend collector only (install)
#   ./setup.sh --embeddings     # embeddings package only (install)
#   ./setup.sh --build          # frontend production build
#   ./setup.sh --check          # full quality gate (typecheck + build + tests)
#   ./setup.sh --test           # run all backend test suites
#   ./setup.sh --clean          # remove venvs, node_modules, build artifacts
#   ./setup.sh --help           # show this usage
# ----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
COLLECTOR_DIR="$SCRIPT_DIR/public_tender_collector"
EMBED_DIR="$SCRIPT_DIR/tender_embeddings"

MIN_NODE_MAJOR=20
MIN_PY_MINOR=10            # require Python 3.10+
PY_BIN="${PY_BIN:-}"       # operator can override which python to use

# ---------- pretty output --------------------------------------------------

cyan()   { printf "\033[36m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*" >&2; }
hr()     { printf -- "----------------------------------------------------------------\n"; }

# ---------- prerequisite checks -------------------------------------------

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Missing required command: $1"
    red "Install it and rerun. macOS: 'brew install $1'. Linux: use your package manager."
    exit 1
  fi
}

check_node_version() {
  local v major
  v="$(node -v | sed 's/^v//')"
  major="${v%%.*}"
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    red "Node.js $v detected. This project needs Node $MIN_NODE_MAJOR+."
    red "Install via nvm:  nvm install $MIN_NODE_MAJOR && nvm use $MIN_NODE_MAJOR"
    exit 1
  fi
  green "Node $(node -v) OK"
  green "npm  $(npm -v) OK"
}

# Pick a Python interpreter that satisfies MIN_PY_MINOR.
pick_python() {
  if [ -n "$PY_BIN" ] && command -v "$PY_BIN" >/dev/null 2>&1; then
    echo "$PY_BIN"
    return 0
  fi
  for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      local minor
      minor="$("$candidate" -c 'import sys;print(sys.version_info.minor)' 2>/dev/null || echo 0)"
      local major
      major="$("$candidate" -c 'import sys;print(sys.version_info.major)' 2>/dev/null || echo 0)"
      if [ "$major" -eq 3 ] && [ "$minor" -ge "$MIN_PY_MINOR" ]; then
        echo "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

check_python() {
  local py
  if ! py="$(pick_python)"; then
    red "Missing Python 3.${MIN_PY_MINOR}+. Install via:"
    red "  macOS:  brew install python@3.13"
    red "  Linux:  use your package manager (apt/dnf/pacman)"
    red "Or set PY_BIN=/path/to/python3.x and rerun."
    exit 1
  fi
  echo "$py"
}

# ---------- frontend -------------------------------------------------------

install_frontend() {
  hr; cyan ">>> [1/3] Installing frontend dependencies in app/"
  if [ ! -d "$APP_DIR" ]; then
    red "App directory not found: $APP_DIR"; exit 1
  fi
  cd "$APP_DIR"
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  green "Frontend dependencies installed."
}

run_frontend_dev() {
  hr; cyan ">>> Starting Vite dev server"
  cd "$APP_DIR"
  yellow "Open http://localhost:5173 in your browser. Ctrl+C to stop."
  exec npm run dev
}

run_frontend_build() {
  hr; cyan ">>> Building frontend production bundle"
  cd "$APP_DIR"
  npm run build
  green "Build artifacts in $APP_DIR/dist"
}

run_frontend_check() {
  hr; cyan ">>> Frontend: type-check + build"
  cd "$APP_DIR"
  npx tsc -b
  npm run build
  green "Frontend type-check + build passed."
}

# ---------- backend (collector) -------------------------------------------

install_collector() {
  hr; cyan ">>> [2/3] Installing collector backend in public_tender_collector/"
  if [ ! -d "$COLLECTOR_DIR" ]; then
    red "Collector directory not found: $COLLECTOR_DIR"; exit 1
  fi
  local py
  py="$(check_python)"
  green "Using $py for collector venv"
  cd "$COLLECTOR_DIR"
  if [ ! -d ".venv" ]; then
    "$py" -m venv .venv
  fi
  ./.venv/bin/pip install --upgrade pip >/dev/null
  ./.venv/bin/pip install -e ".[dev]"
  green "Collector dependencies installed."
}

test_collector() {
  hr; cyan ">>> Collector: ruff + mypy + pytest"
  cd "$COLLECTOR_DIR"
  ./.venv/bin/ruff check .
  ./.venv/bin/ruff format --check .
  ./.venv/bin/mypy collector/
  ./.venv/bin/python -m pytest -q
  green "Collector quality gate passed."
}

check_collector_cli() {
  hr; cyan ">>> Collector: CLI smoke (check-source on the unapproved example)"
  cd "$COLLECTOR_DIR"
  set +e
  ./.venv/bin/python main.py check-source --source cppp_eprocure_example >/dev/null 2>&1
  local rc=$?
  set -e
  if [ "$rc" -eq 3 ]; then
    green "check-source correctly refused unapproved source (exit 3)."
  else
    red "Expected exit 3 from check-source on unapproved source, got $rc."
    exit 1
  fi
}

# ---------- embeddings ----------------------------------------------------

install_embeddings() {
  hr; cyan ">>> [3/3] Installing tender_embeddings/ (local semantic search, no external APIs)"
  if [ ! -d "$EMBED_DIR" ]; then
    red "Embeddings directory not found: $EMBED_DIR"; exit 1
  fi
  local py
  py="$(check_python)"
  green "Using $py for embeddings venv"
  cd "$EMBED_DIR"
  if [ ! -d ".venv" ]; then
    "$py" -m venv .venv
  fi
  ./.venv/bin/pip install --upgrade pip >/dev/null
  yellow "Note: this installs PyTorch via sentence-transformers (~500 MB). First run only."
  ./.venv/bin/pip install -e ".[dev]"
  green "Embeddings dependencies installed."
}

test_embeddings() {
  hr; cyan ">>> Embeddings: ruff + mypy + pytest (offline, no model download required)"
  cd "$EMBED_DIR"
  ./.venv/bin/ruff check .
  ./.venv/bin/ruff format --check .
  ./.venv/bin/mypy tender_embeddings/
  ./.venv/bin/python -m pytest -q
  green "Embeddings quality gate passed."
}

# ---------- clean ---------------------------------------------------------

clean_all() {
  hr; yellow "Cleaning venvs, node_modules and build artifacts (data/ and logs/ preserved)..."
  rm -rf "$APP_DIR/node_modules" "$APP_DIR/dist" "$APP_DIR/.vite" 2>/dev/null || true
  rm -rf "$COLLECTOR_DIR/.venv" "$COLLECTOR_DIR/.pytest_cache" 2>/dev/null || true
  rm -rf "$EMBED_DIR/.venv" "$EMBED_DIR/.pytest_cache" 2>/dev/null || true
  find "$APP_DIR" "$COLLECTOR_DIR" "$EMBED_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
  green "Clean done."
}

# ---------- aggregates ----------------------------------------------------

install_all() {
  install_frontend
  install_collector
  install_embeddings
  hr; green "All three subsystems installed."
  yellow "Next steps:"
  yellow "  Frontend dev server:  cd app && npm run dev"
  yellow "  Collector demo:       cd public_tender_collector && .venv/bin/python main.py demo --seed-file sample_seed_urls.csv"
  yellow "  Embedding index:      cd tender_embeddings && .venv/bin/python main.py build"
}

check_all() {
  install_all
  run_frontend_check
  test_collector
  check_collector_cli
  test_embeddings
  hr; green "Full quality gate passed for all three subsystems."
}

test_all() {
  test_collector
  check_collector_cli
  test_embeddings
}

# ---------- main ----------------------------------------------------------

print_help() {
  cat <<USAGE
Procure Intelligence AP — local setup

Usage:
  ./setup.sh                  install everything + start frontend dev server (default)
  ./setup.sh --install        install everything, do not start anything
  ./setup.sh --frontend       frontend only (install + dev server)
  ./setup.sh --backend        backend collector only (install)
  ./setup.sh --embeddings     embeddings package only (install)
  ./setup.sh --build          frontend production build
  ./setup.sh --check          full quality gate (frontend typecheck + collector tests + embeddings tests)
  ./setup.sh --test           run backend collector tests + embeddings tests
  ./setup.sh --clean          remove venvs, node_modules, build artifacts (preserves data/ and logs/)
  ./setup.sh --help           show this usage

Subsystems:
  app/                        React + TS + Tailwind frontend (Vite, port 5173)
  public_tender_collector/    Python compliance-first scraper (SQLite + SQLAlchemy)
  tender_embeddings/          Local sentence-transformers semantic search (no external APIs)

Environment overrides:
  PY_BIN=/path/to/python3.x   pick a specific Python interpreter (default: python3.13/12/11/10/3 in that order)
USAGE
}

main() {
  cyan "Procure Intelligence AP — local setup"
  cyan "Repo: $SCRIPT_DIR"
  echo

  case "${1:-}" in
    -h|--help)     print_help ;;
    --clean)       clean_all ;;
    --frontend)    require_cmd node; require_cmd npm; check_node_version
                   install_frontend; run_frontend_dev ;;
    --backend)     require_cmd python3 || require_cmd python
                   install_collector ;;
    --embeddings)  require_cmd python3 || require_cmd python
                   install_embeddings ;;
    --install)     require_cmd node; require_cmd npm; check_node_version
                   install_all ;;
    --build)       require_cmd node; require_cmd npm; check_node_version
                   install_frontend; run_frontend_build ;;
    --check)       require_cmd node; require_cmd npm; check_node_version
                   check_all ;;
    --test)        test_all ;;
    "" )           require_cmd node; require_cmd npm; check_node_version
                   install_all
                   run_frontend_dev ;;
    *)             red "Unknown option: $1"
                   echo
                   print_help
                   exit 64 ;;
  esac
}

main "$@"
