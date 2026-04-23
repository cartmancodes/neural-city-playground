"""ETL: raw Excels -> cleaned canonical Parquet tables.

Canonical outputs (data/processed):
- outlets.parquet           outlet master (one row per outlet)
- sales_daily.parquet       (outlet_code, date, cases, bottles, total_bottles, sale_value, depot_code)
- products.parquet          SKU/product master (brand, size, MRP, supplier, category)
- brands.parquet            brand-level rollup
- labels.parquet            label approvals (launches/renewals)
- distilleries.parquet      supplier/distillery footprint (from brand_supplier)

All outlet codes are extracted from composite "vendorId" / "Retailer Name" strings.
HTML entities (&amp;) are unescaped. Depot codes are normalized to 3-digit NNN tokens.
"""

from __future__ import annotations

import html
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
PROC.mkdir(parents=True, exist_ok=True)


def clean_name(s: str | float) -> str:
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return ""
    s = str(s)
    s = html.unescape(s)
    s = s.replace("&amp;", "&")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_code(composite: str | float) -> str | None:
    """Extract leading numeric code from strings like `'1713282-M/s. Foo Bar'`."""
    if composite is None or (isinstance(composite, float) and np.isnan(composite)):
        return None
    s = str(composite).strip()
    m = re.match(r"^\s*(\d{5,8})\b", s)
    return m.group(1) if m else None


def extract_depot(composite: str | float) -> str | None:
    """Extract leading 3-digit depot number from strings like `'098-Excise Depot Chittoor-III'`."""
    if composite is None or (isinstance(composite, float) and np.isnan(composite)):
        return None
    s = str(composite).strip()
    m = re.match(r"^\s*(\d{2,4})\b", s)
    if not m:
        return None
    return m.group(1).zfill(3)


def parse_indian_date(v) -> pd.Timestamp | None:
    if pd.isna(v):
        return None
    if isinstance(v, pd.Timestamp):
        return v
    if isinstance(v, str):
        for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return pd.to_datetime(v, format=fmt)
            except Exception:  # noqa: BLE001
                continue
        try:
            return pd.to_datetime(v, dayfirst=True)
        except Exception:  # noqa: BLE001
            return None
    try:
        return pd.to_datetime(v)
    except Exception:  # noqa: BLE001
        return None


def build_outlets() -> pd.DataFrame:
    df = pd.read_excel(ROOT / "Copy of Retailer Info.xlsx", engine="openpyxl")
    df = df.rename(
        columns={
            "Code": "outlet_code",
            "Name": "outlet_name_raw",
            "Address": "address",
            "DistrictName": "district",
            "CircleName": "circle",
            "DepotCode": "depot_raw",
            "Latitude": "lat",
            "Longitude": "lng",
            "Status": "status",
            "VendorType": "vendor_type",
        }
    )
    df["outlet_code"] = df["outlet_code"].astype(str).str.strip()
    df["outlet_name"] = df["outlet_name_raw"].apply(clean_name)
    df["depot_code"] = df["depot_raw"].apply(extract_depot)
    df["depot_name"] = df["depot_raw"].apply(
        lambda s: clean_name(re.sub(r"^\s*\d{2,4}-\s*", "", str(s))) if pd.notna(s) else ""
    )
    df["district"] = df["district"].apply(clean_name)
    df["circle"] = df["circle"].apply(clean_name)
    df["vendor_type"] = df["vendor_type"].apply(clean_name)
    return df[
        [
            "outlet_code",
            "outlet_name",
            "address",
            "district",
            "circle",
            "depot_code",
            "depot_name",
            "lat",
            "lng",
            "status",
            "vendor_type",
        ]
    ].copy()


def build_sales_daily(outlets: pd.DataFrame) -> pd.DataFrame:
    # Monthly sales has datetime already; yearly has string dates but good depot codes.
    m = pd.read_excel(ROOT / "Copy of Retailer Wise Sales(in).xlsx", engine="openpyxl")
    m = m.rename(
        columns={
            "date": "date",
            "vendorId": "vendor_id",
            "districtName": "district_raw",
            "cases": "cases",
            "bottles": "bottles",
            "totalBottles": "total_bottles",
            "saleValue": "sale_value",
        }
    )
    m["outlet_code"] = m["vendor_id"].apply(extract_code)
    m["date"] = pd.to_datetime(m["date"], errors="coerce")
    m = m.dropna(subset=["outlet_code", "date"])

    y = pd.read_excel(ROOT / "Copy of Retailer Sales Year wise -1.xlsx", engine="openpyxl")
    y = y.rename(
        columns={
            "Retailer Name": "vendor_id",
            "Date": "date_raw",
            "Depot Code": "depot_raw",
            "cases": "cases",
            "bottles": "bottles",
            "Total Bottles": "total_bottles",
            "Sale Value": "sale_value",
        }
    )
    y["outlet_code"] = y["vendor_id"].apply(extract_code)
    y["date"] = y["date_raw"].apply(parse_indian_date)
    y["depot_code"] = y["depot_raw"].apply(extract_depot)
    y = y.dropna(subset=["outlet_code", "date"])
    y["cases"] = pd.to_numeric(y["cases"], errors="coerce").fillna(0).astype(int)
    y["bottles"] = pd.to_numeric(y["bottles"], errors="coerce").fillna(0).astype(int)

    # Combine; dedupe on (outlet, date) keeping the higher sale_value (yearly has depot info)
    keep_cols = ["outlet_code", "date", "cases", "bottles", "total_bottles", "sale_value"]
    combined = pd.concat(
        [m[keep_cols], y[keep_cols + ["depot_code"]]], ignore_index=True, sort=False
    )
    combined = combined.sort_values(["outlet_code", "date", "sale_value"], ascending=[True, True, False])
    combined = combined.drop_duplicates(subset=["outlet_code", "date"], keep="first")

    # Enrich with district / depot from outlet master.
    combined = combined.merge(
        outlets[["outlet_code", "district", "depot_code", "circle", "vendor_type"]],
        on="outlet_code",
        how="left",
        suffixes=("", "_outlet"),
    )
    combined["depot_code"] = combined["depot_code"].fillna(combined["depot_code_outlet"])
    combined = combined.drop(columns=[c for c in combined.columns if c.endswith("_outlet")])
    combined["date"] = pd.to_datetime(combined["date"])
    combined = combined[
        [
            "outlet_code",
            "date",
            "cases",
            "bottles",
            "total_bottles",
            "sale_value",
            "district",
            "depot_code",
            "circle",
            "vendor_type",
        ]
    ].copy()
    return combined


def build_products() -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_excel(
        ROOT / "Copy of Brand & Supplier Info.xlsx", engine="openpyxl", sheet_name="ActiveBrandProducts"
    )
    df = df.rename(
        columns={
            "Product Code": "product_code",
            "Brand Code": "brand_code",
            "Brand Name": "brand_name",
            "Size": "size_ml",
            "Units Per Case": "units_per_case",
            "Basic Price": "basic_price",
            "Supplier Code": "supplier_code",
            "Category": "category",
            "Brand Type": "brand_type",
            "Final MRP": "mrp",
            "Issue Price Rounded": "issue_price",
            "Main Distillery": "distillery",
            "Supplier Address": "supplier_address",
            "Supplier Type": "supplier_type",
            "Office Address": "office_address",
        }
    )
    df["brand_name"] = df["brand_name"].apply(clean_name)
    df["category"] = df["category"].fillna("UNSPECIFIED").apply(clean_name)
    df["distillery"] = df["distillery"].fillna("UNSPECIFIED").apply(clean_name)
    # Price band: quartiles on MRP per brand_type
    def price_band(row):
        mrp = row["mrp"]
        if pd.isna(mrp):
            return "UNKNOWN"
        if mrp < 200:
            return "Economy"
        if mrp < 600:
            return "Value"
        if mrp < 1500:
            return "Premium"
        return "Luxury"

    df["price_band"] = df.apply(price_band, axis=1)

    def pack_bucket(sz):
        if pd.isna(sz):
            return "UNKNOWN"
        sz = int(sz)
        if sz <= 90:
            return "Nip (<=90ml)"
        if sz <= 180:
            return "Quarter (<=180ml)"
        if sz <= 375:
            return "Half (<=375ml)"
        if sz <= 500:
            return "Pint (<=500ml)"
        if sz <= 750:
            return "Full (<=750ml)"
        return "Magnum (>750ml)"

    df["pack_bucket"] = df["size_ml"].apply(pack_bucket)

    # Brand-level rollup
    brand = (
        df.groupby(["brand_code", "brand_name", "brand_type"], dropna=False)
        .agg(
            sku_count=("product_code", "nunique"),
            mean_mrp=("mrp", "mean"),
            min_mrp=("mrp", "min"),
            max_mrp=("mrp", "max"),
            supplier_count=("supplier_code", "nunique"),
            distillery_count=("distillery", "nunique"),
            price_bands=("price_band", lambda s: sorted(set(s))),
            pack_buckets=("pack_bucket", lambda s: sorted(set(s))),
        )
        .reset_index()
    )
    brand["sku_spread_ratio"] = brand["sku_count"] / brand["sku_count"].max()
    return df, brand


def build_labels() -> pd.DataFrame:
    df = pd.read_excel(
        ROOT / "Copy of Label Approvals_2025_2026.xlsx", engine="openpyxl", sheet_name="Sheet1"
    )
    df = df.rename(
        columns={
            "Application No": "application_no",
            "Type": "type",
            "Label Type": "label_type",
            "Label Category": "label_category",
            "Approval Date": "approval_date",
            "Main Distillery": "distillery",
            "Unit Name & Sub Lease": "unit_name",
            "Brand Name": "brand_name",
            "Size": "size_ml_raw",
            "Pack Type": "pack_type",
            "Basic Price": "basic_price",
            "MRP": "mrp",
        }
    )
    df["brand_name"] = df["brand_name"].apply(clean_name)
    df["distillery"] = df["distillery"].fillna("UNSPECIFIED").apply(clean_name)
    df["approval_date"] = df["approval_date"].apply(parse_indian_date)
    df = df[df["approval_date"].notna()].copy()
    df["size_ml"] = pd.to_numeric(df["size_ml_raw"].astype(str).str.extract(r"(\d+)")[0], errors="coerce")
    df["mrp"] = pd.to_numeric(df["mrp"], errors="coerce")
    df["category"] = df["label_type"].fillna("UNSPECIFIED")
    return df[
        [
            "application_no",
            "type",
            "label_type",
            "label_category",
            "approval_date",
            "distillery",
            "unit_name",
            "brand_name",
            "size_ml",
            "pack_type",
            "basic_price",
            "mrp",
            "category",
        ]
    ].copy()


def main() -> None:
    print("Building outlets...")
    outlets = build_outlets()
    outlets.to_parquet(PROC / "outlets.parquet")
    print(f"  -> {len(outlets):,} outlets")

    print("Building sales_daily (combining monthly + yearly)...")
    sales = build_sales_daily(outlets)
    sales.to_parquet(PROC / "sales_daily.parquet")
    print(
        f"  -> {len(sales):,} rows  |  {sales['outlet_code'].nunique():,} outlets  |  "
        f"{sales['date'].min().date()} .. {sales['date'].max().date()}"
    )

    print("Building products + brands...")
    products, brands = build_products()
    products.to_parquet(PROC / "products.parquet")
    brands.to_parquet(PROC / "brands.parquet")
    print(f"  -> {len(products):,} products  |  {len(brands):,} brands")

    print("Building labels...")
    labels = build_labels()
    labels.to_parquet(PROC / "labels.parquet")
    print(f"  -> {len(labels):,} label approvals")

    print("\nETL complete. Processed tables written to data/processed/")


if __name__ == "__main__":
    main()
