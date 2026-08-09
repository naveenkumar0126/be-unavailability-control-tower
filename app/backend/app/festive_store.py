from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class FestiveStore:
    sets: dict[str, pd.DataFrame] = field(default_factory=dict)

    def load(self, ptype: str, df: pd.DataFrame) -> None:
        self.sets[ptype] = df

    def all(self) -> pd.DataFrame:
        if not self.sets:
            return pd.DataFrame()
        return pd.concat(self.sets.values(), ignore_index=True)

    @property
    def is_loaded(self) -> bool:
        return len(self.sets) > 0


festive_store = FestiveStore()
