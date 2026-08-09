"""
Loads the embedded seed data (seed_data.py) into the inbound/festive stores
at process startup, so Purchase Manager has real data immediately instead
of needing a manual re-upload every time this in-memory backend restarts.
An actual upload (or, later, a real sync) always overwrites this - it's
just the starting state.
"""
from __future__ import annotations

import io
import sys
import traceback

import pandas as pd

from . import seed_data
from .festive import load_festive_df
from .festive_store import festive_store
from .inbound_store import inbound_store
from .inbound_util import load_inbound_df

FESTIVE_PTYPES = {
    "Khoya": seed_data.FESTIVE_KHOYA_CSV,
    "Rasmalai": seed_data.FESTIVE_RASMALAI_CSV,
    "Sabudana Tikki": seed_data.FESTIVE_SABUDANA_CSV,
}

# Populated with "<ptype>: <error>" strings if seeding fails for any file, so
# the failure is visible via /api/festive/status (and Render's logs) instead
# of silently leaving the store empty.
seed_errors: list[str] = []


def load_seed_data() -> None:
    if not inbound_store.is_loaded:
        try:
            raw = pd.read_csv(io.StringIO(seed_data.INBOUND_UTIL_CSV))
            df = load_inbound_df(raw)
            inbound_store.load(df, "Seed: Inbound_Util - DOD_Tracker_1.csv")
        except Exception as e:  # noqa: BLE001 - seed data must never crash startup
            msg = f"inbound: {e!r}"
            seed_errors.append(msg)
            print(f"[seed] FAILED to load {msg}", file=sys.stderr)
            traceback.print_exc()

    if not festive_store.is_loaded:
        for ptype, csv_text in FESTIVE_PTYPES.items():
            try:
                raw = pd.read_csv(io.StringIO(csv_text))
                df = load_festive_df(raw, ptype)
                festive_store.load(ptype, df)
            except Exception as e:  # noqa: BLE001
                msg = f"{ptype}: {e!r}"
                seed_errors.append(msg)
                print(f"[seed] FAILED to load {msg}", file=sys.stderr)
                traceback.print_exc()
