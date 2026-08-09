from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


@dataclass
class InboundStore:
    df: Optional[pd.DataFrame] = None
    filename: Optional[str] = None

    def load(self, df: pd.DataFrame, filename: str) -> None:
        self.df = df
        self.filename = filename

    @property
    def is_loaded(self) -> bool:
        return self.df is not None and not self.df.empty


inbound_store = InboundStore()
