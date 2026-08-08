"""
In-memory dataset store for the local/dev MVP. Holds exactly one "today's data"
snapshot at a time. This is deliberately not a database yet - history/persistence
(daily snapshots, auth, Tag & Reason comparisons) is a separate, later phase.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pandas as pd

from .formulas import DOI_DEFAULT_THRESHOLD, load_dataframe


@dataclass
class DataStore:
    df: Optional[pd.DataFrame] = None
    filename: Optional[str] = None
    uploaded_at: Optional[str] = None
    doi_threshold: float = DOI_DEFAULT_THRESHOLD

    def load(self, raw: pd.DataFrame, filename: str, doi_threshold: Optional[float] = None) -> None:
        if doi_threshold is not None:
            self.doi_threshold = doi_threshold
        self.df = load_dataframe(raw, doi_threshold=self.doi_threshold)
        self.filename = filename
        self.uploaded_at = datetime.utcnow().isoformat() + "Z"

    def set_doi_threshold(self, threshold: float, raw: pd.DataFrame) -> None:
        self.doi_threshold = threshold
        self.df = load_dataframe(raw, doi_threshold=threshold)

    @property
    def is_loaded(self) -> bool:
        return self.df is not None and not self.df.empty

    def facets(self) -> dict:
        if not self.is_loaded:
            return {"regions": [], "warehouses": [], "brands": [], "categories": []}
        d = self.df
        return {
            "regions": sorted(d["region"].dropna().unique().tolist()),
            "warehouses": sorted(d["wh"].dropna().unique().tolist()),
            "brands": sorted(d["brand"].dropna().unique().tolist()),
            "categories": sorted(d["category"].dropna().unique().tolist()),
        }


store = DataStore()
_raw_cache: Optional[pd.DataFrame] = None


def set_raw_cache(raw: pd.DataFrame) -> None:
    global _raw_cache
    _raw_cache = raw


def get_raw_cache() -> Optional[pd.DataFrame]:
    return _raw_cache
