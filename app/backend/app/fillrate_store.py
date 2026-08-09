"""
In-memory store for the loaded Fill Rate dataset, shared between the
fillrate router (upload/sync/its own views) and the main views router
(which joins fill % into PAN India and Warehouse x Item). Same one-snapshot,
lost-on-restart model as store.py - no persistence layer yet.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


@dataclass
class FillRateStore:
    df: Optional[pd.DataFrame] = None
    windows: Optional[dict] = None
    filename: Optional[str] = None
    rows: int = 0

    def load(self, df: pd.DataFrame, windows: dict, filename: str) -> None:
        self.df = df
        self.windows = windows
        self.filename = filename
        self.rows = len(df)

    @property
    def is_loaded(self) -> bool:
        return self.df is not None and not self.df.empty


fill_store = FillRateStore()
