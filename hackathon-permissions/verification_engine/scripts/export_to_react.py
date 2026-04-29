"""CLI: convert extracted rules.json into the React RulePack shape."""
from __future__ import annotations

import argparse
from pathlib import Path

from integration.react_export import export_to_react


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("rules_json", type=Path)
    parser.add_argument("--target", type=Path,
                        default=Path("../app/src/data/rules/extracted.json"))
    parser.add_argument("--meta", type=Path,
                        default=Path("../app/src/data/rules/extracted.meta.json"))
    args = parser.parse_args(argv)
    export_to_react(args.rules_json, args.target, args.meta)
    print(f"wrote {args.target} and {args.meta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
