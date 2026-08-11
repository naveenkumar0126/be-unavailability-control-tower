from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class TagsStore:
    weeks: dict = field(default_factory=dict)  # date -> DataFrame, one week's rows

    def upsert_week(self, week, df: pd.DataFrame) -> None:
        self.weeks[week] = df

    @property
    def df(self) -> pd.DataFrame:
        if not self.weeks:
            return pd.DataFrame()
        return pd.concat(self.weeks.values(), ignore_index=True)

    @property
    def is_loaded(self) -> bool:
        return len(self.weeks) > 0

    @property
    def week_list(self) -> list:
        return sorted(self.weeks.keys())


tags_store = TagsStore()
