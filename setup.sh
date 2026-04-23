#!/usr/bin/env bash
# Stay-In School — one-shot setup.
#
#   ./setup.sh              # env + deps + pipeline + publish + web build
#   ./setup.sh --quick      # env + deps only (skip pipeline and web build)
#   ./setup.sh --no-web     # run pipeline but skip web install/build
#   ./setup.sh --no-pipeline # install deps + web build, reuse existing artifacts
#   ./setup.sh --dev        # env + deps + pipeline + start web dev server
#
# Safe to re-run: idempotent, uses existing venv / node_modules if present.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

QUICK=0
NO_WEB=0
NO_PIPELINE=0
DEV=0
for arg in "$@"; do
  case "$arg" in
    --quick)        QUICK=1 ;;
    --no-web)       NO_WEB=1 ;;
    --no-pipeline)  NO_PIPELINE=1 ;;
    --dev)          DEV=1 ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "unknown flag: $arg (try --help)" >&2
      exit 1 ;;
  esac
done

say() { printf "\n\033[1;34m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!! %s\033[0m\n" "$*" >&2; }
die()  { printf "\033[1;31mxx %s\033[0m\n" "$*" >&2; exit 1; }

# ---------- prerequisites ----------
say "Checking prerequisites"
PY="$(command -v python3 || true)"
[ -n "$PY" ] || die "python3 not found. Install Python >=3.9 before running setup.sh."
PY_VER=$("$PY" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
printf "  python3 → %s (%s)\n" "$PY" "$PY_VER"

NODE="$(command -v node || true)"
NPM="$(command -v npm || true)"
if [ -z "$NODE" ] || [ -z "$NPM" ]; then
  warn "Node.js / npm not found. The pipeline will still run, but the web dashboard cannot be built."
  NO_WEB=1
else
  printf "  node → %s (%s)\n" "$NODE" "$(node --version)"
fi

# ---------- Python venv + deps ----------
say "Setting up Python venv at .venv/"
if [ ! -d .venv ]; then
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip >/dev/null

say "Installing Python dependencies"
if [ -f requirements.txt ]; then
  pip install --quiet -r requirements.txt
else
  pip install --quiet pandas numpy scikit-learn openpyxl pyarrow
fi
printf "  ok (%s)\n" "$(pip --version | cut -d' ' -f1-2)"

if [ "$QUICK" -eq 1 ]; then
  say "Quick mode — skipping pipeline and web build. You can now run:"
  echo "    .venv/bin/python pipeline/run.py --publish"
  echo "    (cd web && npm install && npm run build)"
  exit 0
fi

# ---------- data check ----------
DATA_FILES=(
  "data/data_FIN_YEAR_2023-2024.csv"
  "data/data_FIN_YEAR_2024-2025.csv"
  "data/CHILDSNO_Dropped_2023_24.xlsx"
  "data/CHILDSNO_Dropped_2024_25.xlsx"
)
MISSING=0
for f in "${DATA_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    warn "missing data file: $f"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ] && [ "$NO_PIPELINE" -eq 0 ]; then
  warn "Not all source files are present under data/. Skipping pipeline run."
  warn "Drop the four source files into data/ then rerun: ./setup.sh --no-pipeline=0"
  NO_PIPELINE=1
fi

# ---------- pipeline ----------
if [ "$NO_PIPELINE" -eq 0 ]; then
  say "Running pipeline end-to-end (audit → features → train → intervene → hotspot)"
  echo "    this takes ~8-12 min on a laptop; progress below"
  .venv/bin/python pipeline/run.py --publish
else
  if [ -d artifacts ] && [ "$(ls -A artifacts/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
    say "Reusing existing artifacts/*.json"
    mkdir -p web/public/data
    cp -f artifacts/*.json web/public/data/ 2>/dev/null || true
  else
    warn "No existing artifacts found — the web dashboard will render empty tables."
  fi
fi

# ---------- web ----------
if [ "$NO_WEB" -eq 0 ]; then
  say "Installing web dependencies"
  (cd web && npm install --no-audit --no-fund --silent)

  if [ "$DEV" -eq 1 ]; then
    say "Starting Next.js dev server on http://localhost:3000"
    echo "    (ctrl-c to stop)"
    exec env -C "$ROOT/web" npm run dev
  else
    say "Building web dashboard (Next.js 14, static-export-friendly)"
    (cd web && npm run build)
    echo
    echo "    Start the dashboard with:"
    echo "      (cd web && npm start)        # production"
    echo "      (cd web && npm run dev)      # hot-reload"
  fi
fi

say "Setup complete."
echo
echo "  Next steps:"
echo "  - inspect generated JSONs         → ls artifacts/ web/public/data/"
echo "  - read the jury talk track        → docs/jury_talk_track.md"
echo "  - launch the dashboard            → ./setup.sh --dev"
echo "  - re-run just the intervention    → .venv/bin/python pipeline/intervene.py"
echo "  - rebuild features from scratch   → .venv/bin/python pipeline/run.py"
