"""End-to-end orchestrator for the Stay-In School pipeline.

Usage:
    python pipeline/run.py                 # run everything end-to-end
    python pipeline/run.py --skip-features # reuse existing features.parquet
    python pipeline/run.py --skip-train    # reuse existing student_scores.parquet
    python pipeline/run.py --publish       # copy artifacts/*.json to web/public/data

Individual stages can also be invoked via their own modules (see `pipeline/audit.py` etc).
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

from utils import ARTIFACTS, ROOT


def _stage(name: str, fn):
    t0 = time.time()
    print(f"\n═══ {name} ═══")
    fn()
    print(f"   ✓ {name} in {time.time() - t0:.1f}s")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-audit", action="store_true")
    ap.add_argument("--skip-features", action="store_true")
    ap.add_argument("--skip-train", action="store_true")
    ap.add_argument("--skip-intervene", action="store_true")
    ap.add_argument("--skip-hotspot", action="store_true")
    ap.add_argument("--publish", action="store_true",
                    help="Copy artifacts/*.json into web/public/data for the dashboard.")
    args = ap.parse_args()

    if not args.skip_audit:
        import audit
        _stage("1/5 Data Audit", audit.main)
    if not args.skip_features:
        import features
        _stage("2/5 Feature Engineering", features.main)
    if not args.skip_train:
        import train
        _stage("3/5 Modeling", train.main)
    if not args.skip_intervene:
        import intervene
        _stage("4/5 Intervention Engine + Explainability", intervene.main)
    if not args.skip_hotspot:
        import hotspot
        _stage("5/5 Hotspot Analytics + Insights", hotspot.main)

    if args.publish:
        dest = ROOT / "web" / "public" / "data"
        dest.mkdir(parents=True, exist_ok=True)
        copied = 0
        for p in sorted(ARTIFACTS.glob("*.json")):
            shutil.copy2(p, dest / p.name)
            copied += 1
        print(f"\n   published {copied} JSON artifacts → {dest}")

    print("\n✓ pipeline complete.")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
