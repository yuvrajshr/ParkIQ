"""Convert scored CSV datasets to Parquet for a smaller, faster Docker image.

Usage:
    python make_parquet.py                  # converts both real CSV and fixture
    python make_parquet.py --fixture-only   # converts only the fixture
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent / "data"

CONVERSIONS = [
    ("virs_final_scored_all.csv", "virs_final_scored_all.parquet", "real"),
    ("fixture_scored.csv",        "fixture_scored.parquet",        "fixture"),
]

DTYPES = {
    "cluster_id":       "int32",
    "latitude":         "float32",
    "longitude":        "float32",
    "is_peak":          "int8",
    "Final_VIRS_Score": "float32",
}


def convert(csv_path: Path, parquet_path: Path, label: str) -> None:
    if not csv_path.exists():
        print(f"  [skip] {csv_path.name} not found")
        return
    print(f"  reading {csv_path.name} ...", end=" ", flush=True)
    df = pd.read_csv(csv_path)
    for col, dtype in DTYPES.items():
        if col in df.columns:
            df[col] = df[col].astype(dtype)
    if "vehicle_type" in df.columns:
        df["vehicle_type"] = df["vehicle_type"].astype("category")
    before = csv_path.stat().st_size / 1024
    df.to_parquet(parquet_path, index=False, compression="snappy")
    after = parquet_path.stat().st_size / 1024
    print(f"{before:.0f} KB -> {after:.0f} KB  ({label})")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-only", action="store_true")
    args = parser.parse_args()

    print("Converting CSVs to Parquet (Snappy compression):")
    for csv_name, parquet_name, label in CONVERSIONS:
        if args.fixture_only and label == "real":
            continue
        convert(DATA_DIR / csv_name, DATA_DIR / parquet_name, label)
    print("Done.")


if __name__ == "__main__":
    main()
