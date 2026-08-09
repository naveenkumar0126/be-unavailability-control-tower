import re

import numpy as np
import pandas as pd


def normalize_col_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def pick_column(columns, candidates: list[str]):
    """Fuzzy column-name matching shared by every ingestion module: exact
    match (case/punctuation-insensitive) first, then substring, in
    candidate-priority order."""
    cols_norm = {normalize_col_name(c): c for c in columns}
    cand_norm = [normalize_col_name(c) for c in candidates]
    for cn in cand_norm:
        if cn in cols_norm:
            return cols_norm[cn]
    for cn in cand_norm:
        if not cn:
            continue
        for col_norm, orig in cols_norm.items():
            if cn in col_norm:
                return orig
    return None


def parse_numeric(series: pd.Series) -> pd.Series:
    """Numbers that may have thousands-commas ("6,926.00") or came through
    as scientific notation ("2.78E+03") from a spreadsheet export."""
    cleaned = series.astype(str).str.replace(",", "", regex=False).str.strip()
    return pd.to_numeric(cleaned, errors="coerce").fillna(0.0)


def parse_percent(series: pd.Series) -> pd.Series:
    """Percent values given as "56%" strings, or already numeric as either
    0-1 fractions or 0-100 - normalized to a 0-100 scale."""
    def conv(v):
        if isinstance(v, str):
            v = v.strip().rstrip("%")
            try:
                v = float(v)
            except ValueError:
                return np.nan
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return np.nan
        v = float(v)
        return v * 100 if v <= 1.5 else v

    return series.map(conv)


def to_native(obj):
    """Recursively convert numpy/pandas scalar types (and NaN) into plain,
    JSON-serializable Python values."""
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_native(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        v = float(obj)
        return None if v != v else v
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, float) and obj != obj:
        return None
    return obj
