"""Phase 1 data audit: inventory, schema, joins, quality.

Produces artifacts/reports/audit.json and prints a human summary.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "artifacts" / "reports"
ART.mkdir(parents=True, exist_ok=True)

FILES = {
    "retailer_info": "Copy of Retailer Info.xlsx",
    "retailer_sales_monthly": "Copy of Retailer Wise Sales(in).xlsx",
    "retailer_sales_yearly": "Copy of Retailer Sales Year wise -1.xlsx",
    "brand_supplier": "Copy of Brand & Supplier Info.xlsx",
    "label_approvals": "Copy of Label Approvals_2025_2026.xlsx",
    "distillery_statement": "Copy of Statement Pharma Molasses and Distillery March 26.xlsx",
    "month_wise_idl": "Copy of MONTH WISE DATA ID NDPL DPL GANJA FROM 2019 TO 09-02-2026.xlsx",
}


def sniff_sheet(xlsx_path: Path) -> list[str]:
    xl = pd.ExcelFile(xlsx_path, engine="openpyxl")
    return xl.sheet_names


def profile_df(df: pd.DataFrame) -> dict[str, Any]:
    out: dict[str, Any] = {
        "rows": int(len(df)),
        "cols": int(df.shape[1]),
        "columns": [],
    }
    for col in df.columns:
        s = df[col]
        non_null = int(s.notna().sum())
        n_unique = int(s.nunique(dropna=True))
        inferred = str(s.dtype)
        sample = s.dropna().astype(str).head(3).tolist()
        out["columns"].append(
            {
                "name": str(col),
                "dtype": inferred,
                "non_null": non_null,
                "null_pct": round(100 * (len(s) - non_null) / max(1, len(s)), 2),
                "n_unique": n_unique,
                "sample": sample,
            }
        )
    return out


def best_primary_key(df: pd.DataFrame) -> str | None:
    for col in df.columns:
        s = df[col]
        if s.notna().all() and s.nunique() == len(s):
            name = str(col).lower()
            if any(tok in name for tok in ("code", "id", "license", "no", "number")):
                return str(col)
    for col in df.columns:
        s = df[col]
        if s.notna().all() and s.nunique() == len(s):
            return str(col)
    return None


def main() -> None:
    audit: dict[str, Any] = {"files": {}}
    for key, fname in FILES.items():
        fpath = ROOT / fname
        if not fpath.exists():
            audit["files"][key] = {"error": f"missing {fname}"}
            continue
        print(f"\n=== {key} :: {fname} ===")
        sheets = sniff_sheet(fpath)
        audit["files"][key] = {
            "filename": fname,
            "size_mb": round(fpath.stat().st_size / 1_048_576, 2),
            "sheets": {},
        }
        for sh in sheets:
            try:
                df = pd.read_excel(fpath, sheet_name=sh, engine="openpyxl")
            except Exception as e:
                audit["files"][key]["sheets"][sh] = {"error": str(e)}
                continue
            prof = profile_df(df)
            pk = best_primary_key(df)
            prof["likely_primary_key"] = pk
            audit["files"][key]["sheets"][sh] = prof
            print(
                f"  sheet='{sh}'  rows={prof['rows']:>8}  cols={prof['cols']:>3}  pk={pk}"
            )
            for c in prof["columns"][:25]:
                print(
                    f"    - {c['name'][:40]:<40}  {c['dtype']:<12}  null%={c['null_pct']:>5}  nunique={c['n_unique']:>7}"
                )
            if len(prof["columns"]) > 25:
                print(f"    ... and {len(prof['columns']) - 25} more cols")

    out_path = ART / "audit.json"
    out_path.write_text(json.dumps(audit, indent=2, default=str))
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
