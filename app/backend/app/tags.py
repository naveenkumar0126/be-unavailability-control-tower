"""
Weekly Tag & Root-Cause tracking, filled in by each Purchase Manager every
Monday. Grain is warehouse x brand (sometimes several SKUs behind one row,
noted in a free-text field) - one workbook holds one sheet per week, sheet
name carrying the week's date (e.g. "6th_july", "3rd aug"). Uploading always
processes every sheet in the file; a week already seen gets replaced, not
duplicated, so re-uploading the same workbook with a newly added week just
adds that one week.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd

from .regions import region_of
from .util import parse_numeric, parse_percent, pick_column

COLUMN_CANDIDATES = {
    "wh": ["facility_name", "warehouse_name", "warehouse", "facility"],
    "brand": ["brand_name", "brand"],
    "tag": ["tag"],
    "remark": ["root_cause_remark", "rootcauseremark", "remark"],
    "category_remark": ["category_remarks", "categoryremark"],
    "cpd": ["warehouse_cpd", "cpd"],
    "avail_wtd": ["weighted_availability", "weightedavailabilitypct", "weightedavailability"],
    "doi": ["backend_doi", "doi"],
    "active_skus": ["active_skus"],
    "skus_note": ["skus_name", "skuname"],
}

UNTAGGED = "Untagged"
GOOD_TAG = "No issues"

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12,
}

_WEEK_RE = re.compile(r"(\d{1,2})(?:st|nd|rd|th)?[\s_]+([a-zA-Z]+)")


def parse_week_from_sheet_name(sheet_name: str, today: Optional[date] = None) -> Optional[date]:
    """"Copy of 6th_july" / "20th_july" / "3rd aug" -> a real date, assuming
    the current year unless that would land more than ~60 days in the
    future (then it's last year's same date - handles a December sheet
    uploaded the following January)."""
    today = today or date.today()
    s = re.sub(r"^copy of\s+", "", sheet_name.strip(), flags=re.IGNORECASE)
    m = _WEEK_RE.search(s)
    if not m:
        return None
    day = int(m.group(1))
    month = MONTHS.get(m.group(2).strip().lower())
    if not month or not (1 <= day <= 31):
        return None
    try:
        d = date(today.year, month, day)
    except ValueError:
        return None
    if d > today + timedelta(days=60):
        d = date(today.year - 1, month, day)
    return d


def load_tags_sheet(raw: pd.DataFrame, week: date, sheet_name: str) -> pd.DataFrame:
    cols = list(raw.columns)

    def col_for(field: str, required: bool = True) -> Optional[str]:
        found = pick_column(cols, COLUMN_CANDIDATES[field])
        if found is None and required:
            raise KeyError(f"Could not find a column for '{field}' in tag sheet '{sheet_name}'.")
        return found

    out = pd.DataFrame()
    out["wh"] = raw[col_for("wh")].fillna("").astype(str).str.strip()
    out["brand"] = raw[col_for("brand")].fillna("").astype(str).str.strip()
    out["region"] = out["wh"].apply(region_of)

    tag_col = col_for("tag", required=False)
    if tag_col:
        raw_tag = raw[tag_col].fillna("").astype(str).str.strip()
        out["tag"] = raw_tag.replace({"": UNTAGGED, "nan": UNTAGGED, "None": UNTAGGED})
    else:
        out["tag"] = UNTAGGED

    remark_col = col_for("remark", required=False)
    out["remark"] = raw[remark_col].fillna("").astype(str).replace({"nan": ""}) if remark_col else ""

    cat_remark_col = col_for("category_remark", required=False)
    out["category_remark"] = raw[cat_remark_col].fillna("").astype(str).replace({"nan": ""}) if cat_remark_col else ""

    cpd_col = col_for("cpd", required=False)
    out["cpd"] = parse_numeric(raw[cpd_col]) if cpd_col else 0.0

    avail_col = col_for("avail_wtd", required=False)
    out["avail_wtd"] = parse_percent(raw[avail_col]).fillna(0.0) if avail_col else 0.0
    out["unavail_cpd"] = (out["cpd"] * (1 - out["avail_wtd"] / 100)).clip(lower=0)

    doi_col = col_for("doi", required=False)
    out["doi"] = parse_numeric(raw[doi_col]) if doi_col else 0.0

    active_col = col_for("active_skus", required=False)
    out["active_skus"] = parse_numeric(raw[active_col]) if active_col else 1.0

    skus_col = col_for("skus_note", required=False)
    out["skus_note"] = raw[skus_col].fillna("").astype(str).replace({"nan": ""}) if skus_col else ""

    out["week"] = pd.Timestamp(week)
    out["week_label"] = week.strftime("%d %b")
    out["sheet_name"] = sheet_name

    out = out[out["wh"].str.strip() != ""].reset_index(drop=True)
    return out


def load_tags_workbook(xl: pd.ExcelFile) -> tuple[pd.DataFrame, list[str]]:
    """Reads every sheet, parses its week from the sheet name, normalizes.
    Sheets that don't look like a dated week sheet (or are missing required
    columns) are skipped and returned separately so the caller can report
    what got skipped."""
    frames = []
    skipped = []
    for sheet_name in xl.sheet_names:
        week = parse_week_from_sheet_name(sheet_name)
        if week is None:
            skipped.append(sheet_name)
            continue
        raw = pd.read_excel(xl, sheet_name=sheet_name)
        try:
            frames.append(load_tags_sheet(raw, week, sheet_name))
        except KeyError:
            skipped.append(sheet_name)
    if not frames:
        raise ValueError("No valid week sheets found in this file.")
    return pd.concat(frames, ignore_index=True), skipped


def weekly_tag_trend(df: pd.DataFrame) -> list[dict]:
    """One row per (week, tag): row count and at-risk CPD."""
    g = df.groupby(["week", "week_label", "tag"], dropna=False).agg(
        count=("tag", "size"),
        at_risk_cpd=("unavail_cpd", "sum"),
    ).reset_index()
    g["week"] = g["week"].dt.strftime("%Y-%m-%d")
    return g.sort_values(["week", "count"], ascending=[True, False]).to_dict("records")


def coverage_by_week(df: pd.DataFrame) -> list[dict]:
    g = df.groupby(["week", "week_label"], dropna=False).agg(total=("tag", "size")).reset_index()
    tagged = df[df["tag"] != UNTAGGED].groupby("week", dropna=False).agg(tagged=("tag", "size")).reset_index()
    g = g.merge(tagged, on="week", how="left")
    g["tagged"] = g["tagged"].fillna(0)
    g["coverage_pct"] = np.where(g["total"] > 0, g["tagged"] / g["total"] * 100, 0.0)
    g["week"] = g["week"].dt.strftime("%Y-%m-%d")
    return g.sort_values("week").to_dict("records")


def tag_by_dimension(df: pd.DataFrame, dim: str, week: Optional[pd.Timestamp] = None) -> list[dict]:
    d = df if week is None else df[df["week"] == week]
    g = d.groupby([dim, "tag"], dropna=False).agg(
        count=("tag", "size"),
        at_risk_cpd=("unavail_cpd", "sum"),
    ).reset_index()
    return g.sort_values("at_risk_cpd", ascending=False).to_dict("records")


def chronic_issues(df: pd.DataFrame, min_weeks: int = 3) -> list[dict]:
    """wh x brand combos stuck on a non-good, non-untagged tag across the
    most recent min_weeks weeks - the persistent problems, not one-off
    blips, which is the sharper signal for what actually needs escalating."""
    weeks = sorted(df["week"].unique())
    recent = weeks[-min_weeks:] if len(weeks) >= min_weeks else weeks
    window = len(recent)
    d = df[df["week"].isin(recent) & ~df["tag"].isin([GOOD_TAG, UNTAGGED])]
    if d.empty:
        return []
    g = d.groupby(["wh", "brand"]).agg(
        weeks_affected=("week", "nunique"),
        tags=("tag", lambda s: sorted(set(s))),
        latest_tag=("tag", "last"),
        total_at_risk_cpd=("unavail_cpd", "sum"),
        latest_remark=("remark", "last"),
    ).reset_index()
    g = g[g["weeks_affected"] >= window]
    g["tags"] = g["tags"].apply(lambda t: ", ".join(t))
    g["region"] = g["wh"].apply(region_of)
    return g.sort_values("total_at_risk_cpd", ascending=False).to_dict("records")


def overview(df: pd.DataFrame) -> dict:
    weeks = sorted(df["week"].unique())
    latest = weeks[-1]
    prev = weeks[-2] if len(weeks) >= 2 else None
    latest_df = df[df["week"] == latest]
    prev_df = df[df["week"] == prev] if prev is not None else None

    top_counts = latest_df[latest_df["tag"] != UNTAGGED]["tag"].value_counts()
    non_good = top_counts.drop(index=GOOD_TAG, errors="ignore")
    top_tag = non_good.index[0] if len(non_good) else None
    top_tag_count = int(non_good.iloc[0]) if len(non_good) else 0
    top_tag_prev_count = int((prev_df["tag"] == top_tag).sum()) if (prev_df is not None and top_tag) else None

    n_latest = len(latest_df)
    coverage = (latest_df["tag"] != UNTAGGED).sum() / n_latest * 100 if n_latest else 0.0
    prev_coverage = (
        (prev_df["tag"] != UNTAGGED).sum() / len(prev_df) * 100 if (prev_df is not None and len(prev_df)) else None
    )

    good_count = int((latest_df["tag"] == GOOD_TAG).sum())
    good_pct = good_count / n_latest * 100 if n_latest else 0.0
    prev_good_pct = (
        (prev_df["tag"] == GOOD_TAG).sum() / len(prev_df) * 100 if (prev_df is not None and len(prev_df)) else None
    )

    return {
        "latest_week_label": latest_df["week_label"].iloc[0] if n_latest else None,
        "weeks_available": len(weeks),
        "total_rows": n_latest,
        "coverage_pct": coverage,
        "prev_coverage_pct": prev_coverage,
        "top_tag": top_tag,
        "top_tag_count": top_tag_count,
        "top_tag_prev_count": top_tag_prev_count,
        "good_pct": good_pct,
        "prev_good_pct": prev_good_pct,
        "at_risk_cpd": float(latest_df["unavail_cpd"].sum()),
    }
