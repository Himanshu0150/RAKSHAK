#!/usr/bin/env python3
"""
SHERLOCK NCRB - Phase 2A: Raw Data Audit & Preparation

Place this script inside the SHERLOCK_DATA folder:

SHERLOCK_DATA/
├── ORIGINAL/
│   └── <6 NCRB CSV files>
├── PROCESSED/
├── SYNTHETIC/
└── GROUND TRUTH/

This script:
1. Never modifies files in ORIGINAL.
2. Finds all CSV files recursively under ORIGINAL.
3. Detects the NCRB table number from filenames when possible.
4. Reads CSVs using several common encodings.
5. Produces an audit report with rows, columns, missing values and sample headers.
6. Creates normalized column-name copies under PROCESSED/audited/.
7. Creates a JSON schema report.
"""

from pathlib import Path
import json
import re
import sys

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas is not installed.")
    print("Install it with: python -m pip install pandas")
    sys.exit(1)

BASE = Path(__file__).resolve().parent
ORIGINAL = BASE / "ORIGINAL"
PROCESSED = BASE / "PROCESSED"
AUDITED = PROCESSED / "audited"

PROCESSED.mkdir(parents=True, exist_ok=True)
AUDITED.mkdir(parents=True, exist_ok=True)
(BASE / "SYNTHETIC").mkdir(exist_ok=True)
(BASE / "GROUND TRUTH").mkdir(exist_ok=True)

if not ORIGINAL.exists():
    print(f"ERROR: ORIGINAL folder not found: {ORIGINAL}")
    sys.exit(1)

csv_files = sorted(ORIGINAL.rglob("*.csv"))

if not csv_files:
    print("No CSV files found under ORIGINAL.")
    print(f"Put your 6 NCRB CSV files inside: {ORIGINAL}")
    sys.exit(1)

def clean_column_name(value):
    value = str(value).replace("\n", " ").replace("\r", " ").strip()
    value = re.sub(r"\s+", " ", value)
    return value

def safe_filename(name):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name[:150]

def table_id(filename):
    match = re.search(r"(?:Table[_ -]?)?(\d+A\.\d+|\d+[A-Z]\.\d+)", filename, re.I)
    return match.group(1) if match else "UNKNOWN"

def read_csv_robust(path):
    attempts = [
        ("utf-8-sig", ","),
        ("utf-8", ","),
        ("cp1252", ","),
        ("latin1", ","),
        ("utf-8-sig", None),
        ("cp1252", None),
        ("latin1", None),
    ]
    last_error = None

    for encoding, sep in attempts:
        try:
            kwargs = {
                "encoding": encoding,
                "engine": "python",
                "on_bad_lines": "warn",
            }
            if sep is None:
                kwargs["sep"] = None
            else:
                kwargs["sep"] = sep
            df = pd.read_csv(path, **kwargs)
            if df.shape[1] >= 2:
                return df, encoding
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Could not read {path.name}: {last_error}")

audit_rows = []
schema = {}

for path in csv_files:
    print(f"\nProcessing: {path.name}")

    try:
        df, encoding = read_csv_robust(path)
    except Exception as exc:
        print(f"  FAILED: {exc}")
        audit_rows.append({
            "file": path.name,
            "table_id": table_id(path.name),
            "status": "FAILED",
            "error": str(exc),
        })
        continue

    original_columns = [clean_column_name(c) for c in df.columns]
    df.columns = original_columns

    # Remove completely empty rows/columns only in the processed copy.
    before_rows, before_cols = df.shape
    df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
    after_rows, after_cols = df.shape

    missing_total = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())

    tid = table_id(path.name)
    output_name = safe_filename(f"{tid}_{path.stem}_cleaned.csv")
    output_path = AUDITED / output_name

    df.to_csv(output_path, index=False, encoding="utf-8-sig")

    columns_info = []
    for col in df.columns:
        columns_info.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "missing": int(df[col].isna().sum()),
            "unique": int(df[col].nunique(dropna=True)),
        })

    schema[path.name] = {
        "table_id": tid,
        "source_file": str(path.relative_to(BASE)),
        "processed_file": str(output_path.relative_to(BASE)),
        "encoding_used": encoding,
        "rows_before_cleanup": int(before_rows),
        "columns_before_cleanup": int(before_cols),
        "rows_after_cleanup": int(after_rows),
        "columns_after_cleanup": int(after_cols),
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_total,
        "columns": columns_info,
    }

    audit_rows.append({
        "file": path.name,
        "table_id": tid,
        "status": "OK",
        "rows": int(after_rows),
        "columns": int(after_cols),
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_total,
        "encoding": encoding,
        "processed_file": str(output_path.relative_to(BASE)),
    })

audit_df = pd.DataFrame(audit_rows)
audit_csv = PROCESSED / "NCRB_AUDIT_REPORT.csv"
audit_df.to_csv(audit_csv, index=False, encoding="utf-8-sig")

schema_json = PROCESSED / "NCRB_SCHEMA_REPORT.json"
schema_json.write_text(json.dumps(schema, indent=2, ensure_ascii=False), encoding="utf-8")

print("\n" + "=" * 70)
print("SHERLOCK NCRB AUDIT COMPLETE")
print("=" * 70)
print(f"Files found:        {len(csv_files)}")
print(f"Audit report:       {audit_csv}")
print(f"Schema report:      {schema_json}")
print(f"Processed copies:   {AUDITED}")
print("\nIMPORTANT:")
print("- ORIGINAL files were NOT modified.")
print("- No synthetic data was generated.")
print("- No real-person relationships were created.")
print("- The next phase will use this audit to design the normalized schema.")
