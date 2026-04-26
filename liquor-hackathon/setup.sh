#!/usr/bin/env bash
# APSBCL Market & Product Intelligence POC — one-shot setup.
#
# Usage:
#   ./setup.sh              install + run pipeline + build web + start dev servers
#   ./setup.sh pipeline     only re-run the Python pipeline (audit → ETL → analytics)
#   ./setup.sh web          only (re)install frontend deps and start dev server
#   ./setup.sh api          only start the FastAPI backend
#   ./setup.sh build        install + pipeline + production build of the web app
#   ./setup.sh clean        remove venv, node_modules, build output, processed data
#
# Idempotent. Re-running is safe.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
PY_REQS="pandas openpyxl numpy scikit-learn pyarrow fastapi uvicorn[standard] python-multipart pydantic"
WEB_DIR="$ROOT/web"

# -------- pretty printing ----------
c_reset="\033[0m"; c_b="\033[1m"; c_dim="\033[2m"; c_y="\033[33m"; c_g="\033[32m"; c_r="\033[31m"
say()  { printf "${c_b}%s${c_reset}\n" "$*"; }
step() { printf "\n${c_y}▸ %s${c_reset}\n" "$*"; }
ok()   { printf "${c_g}✓${c_reset} %s\n" "$*"; }
die()  { printf "${c_r}✗ %s${c_reset}\n" "$*" >&2; exit 1; }

# -------- preflight ----------
preflight() {
  command -v python3 >/dev/null 2>&1 || die "python3 not found — install Python 3.9+"
  command -v node    >/dev/null 2>&1 || die "node not found — install Node 20+"
  command -v npm     >/dev/null 2>&1 || die "npm not found"
  say "python: $(python3 --version 2>&1)  |  node: $(node --version)  |  npm: $(npm --version)"
}

# -------- python env ----------
ensure_venv() {
  step "Python venv"
  if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    ok "created $VENV"
  else
    ok "reusing existing venv"
  fi
  "$VENV/bin/pip" install --quiet --upgrade pip
  # shellcheck disable=SC2086
  "$VENV/bin/pip" install --quiet $PY_REQS
  ok "python deps installed"
}

# -------- pipeline ----------
run_pipeline() {
  step "Phase 1: data audit"
  "$VENV/bin/python" pipeline/audit.py > /dev/null
  ok "artifacts/reports/audit.json"

  step "Phase 2: ETL (Excel → canonical parquet)"
  "$VENV/bin/python" pipeline/etl.py

  step "Phase 3: analytics (forecast · segment · opportunity · anomaly · actions)"
  "$VENV/bin/python" pipeline/analytics.py

  step "Mirror artifacts into web/public/data"
  mkdir -p "$WEB_DIR/public/data"
  rm -f "$WEB_DIR/public/data"/*.json
  cp artifacts/*.json "$WEB_DIR/public/data/"
  ok "$(ls "$WEB_DIR/public/data"/*.json | wc -l | tr -d ' ') artifacts mirrored"
}

# -------- frontend ----------
ensure_web_deps() {
  step "Frontend deps"
  ( cd "$WEB_DIR" && npm install --no-audit --no-fund --silent )
  ok "node_modules ready"
}

build_web() {
  step "Next.js production build"
  ( cd "$WEB_DIR" && npm run build )
  ok "web/.next built"
}

# -------- servers (background + wait) ----------
free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

start_api() {
  free_port 8000
  step "Starting FastAPI  →  http://127.0.0.1:8000"
  "$VENV/bin/uvicorn" server.main:app --host 127.0.0.1 --port 8000 --log-level warning &
  API_PID=$!
  for _ in $(seq 1 20); do
    sleep 0.3
    if curl -sS -o /dev/null http://127.0.0.1:8000/api/health; then
      ok "API ready (pid $API_PID)"
      return 0
    fi
  done
  die "API failed to start"
}

start_web() {
  free_port 3000
  step "Starting Next.js  →  http://localhost:3000"
  ( cd "$WEB_DIR" && npm run dev ) &
  WEB_PID=$!
  for _ in $(seq 1 40); do
    sleep 0.5
    if curl -sS -o /dev/null http://localhost:3000/ 2>/dev/null; then
      ok "Web ready (pid $WEB_PID)"
      return 0
    fi
  done
  die "Web failed to start"
}

on_exit() {
  echo
  say "shutting down dev servers..."
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
  free_port 8000 || true
  free_port 3000 || true
}

# -------- clean ----------
do_clean() {
  step "Cleaning generated outputs"
  rm -rf "$VENV"
  rm -rf "$WEB_DIR/node_modules" "$WEB_DIR/.next"
  rm -rf data/processed
  ok "removed .venv, node_modules, web/.next, data/processed"
  echo "artifacts/ preserved (they are the backend↔frontend contract)"
}

# -------- modes ----------
MODE="${1:-all}"
case "$MODE" in
  clean)     do_clean ;;
  pipeline)  preflight; ensure_venv; run_pipeline ;;
  api)       preflight; ensure_venv; trap on_exit EXIT INT TERM; start_api; wait ;;
  web)       preflight; ensure_web_deps; trap on_exit EXIT INT TERM; start_web; wait ;;
  build)     preflight; ensure_venv; run_pipeline; ensure_web_deps; build_web ;;
  all)
    preflight
    ensure_venv
    run_pipeline
    ensure_web_deps
    trap on_exit EXIT INT TERM
    start_api
    start_web
    echo
    say "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    say "  APSBCL Market Intelligence POC is live"
    say "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "    UI   : ${c_b}http://localhost:3000${c_reset}\n"
    printf "    API  : ${c_b}http://127.0.0.1:8000/api/health${c_reset}\n"
    printf "    docs : ${c_b}http://127.0.0.1:8000/docs${c_reset}\n"
    echo
    printf "    ${c_dim}ctrl-c to stop both servers${c_reset}\n"
    wait
    ;;
  *)
    echo "Usage: $0 [all|pipeline|api|web|build|clean]"
    exit 1
    ;;
esac
