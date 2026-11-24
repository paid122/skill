"""Economic-event analysis.

AUREUS does not invent event dates. Supply an event calendar CSV with:
    datetime (with tz or ET), event (FOMC | CPI | PPI | NFP | UNEMPLOYMENT | ...), importance
from an official source (federalreserve.gov, bls.gov) or a licensed calendar.

Treasury yields and DXY should be imported as separate candle series; the
module measures co-movement, never causation.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..core import InsufficientData, Result
from ..stats import engine as st

ET = "America/New_York"


def load_events(path_or_buf, source_tz: str = ET) -> pd.DataFrame:
    e = pd.read_csv(path_or_buf)
    e.columns = [c.strip().lower() for c in e.columns]
    if not {"datetime", "event"}.issubset(e.columns):
        raise ValueError("Event calendar needs 'datetime' and 'event' columns")
    ts = pd.to_datetime(e["datetime"])
    if ts.dt.tz is None:
        ts = ts.dt.tz_localize(source_tz)
    e["datetime"] = ts.dt.tz_convert("UTC")
    e["event"] = e["event"].astype(str).str.upper().str.strip()
    return e.sort_values("datetime").reset_index(drop=True)


def event_window_vol(candles: pd.DataFrame, events: pd.DataFrame, tf: pd.Timedelta,
                     pre: str = "60min", post: str = "60min", during: str = "15min") -> pd.DataFrame:
    """Realised range (high−low) and abs-return per bar in pre / event / post
    windows around each event, normalised by the trailing 20-session median
    bar range at the same time of day is approximated by trailing 1000-bar median."""
    lr = np.log(candles["close"]).diff().abs()
    rng = candles["high"] - candles["low"]
    base = rng.rolling(1000, min_periods=100).median().shift(1)
    rows = []
    for _, ev in events.iterrows():
        t = ev["datetime"]
        win = {
            "pre": (t - pd.Timedelta(pre), t),
            "event": (t, t + pd.Timedelta(during)),
            "post": (t + pd.Timedelta(during), t + pd.Timedelta(during) + pd.Timedelta(post)),
        }
        rec = {"datetime": t, "event": ev["event"]}
        b = base.asof(t) if len(base.dropna()) else np.nan
        for k, (a, z) in win.items():
            m = (candles.index >= a) & (candles.index < z)
            rec[f"{k}_bars"] = int(m.sum())
            rec[f"{k}_mean_range"] = float(rng[m].mean()) if m.any() else np.nan
            rec[f"{k}_abs_ret_bp"] = float(lr[m].mean() * 1e4) if m.any() else np.nan
            rec[f"{k}_range_vs_normal"] = rec[f"{k}_mean_range"] / b if b and not np.isnan(b) else np.nan
        rows.append(rec)
    return pd.DataFrame(rows)


def summarise_event_vol(ew: pd.DataFrame) -> pd.DataFrame:
    g = ew.groupby("event")
    cols = [c for c in ew.columns if c.endswith("_range_vs_normal")]
    s = g[cols].agg(["mean", "median", "count"])
    s.columns = ["_".join(c) for c in s.columns]
    return s.reset_index()


def mark_event_days(journal: pd.DataFrame, events: pd.DataFrame, types: list[str] | None = None) -> pd.DataFrame:
    j = journal.copy()
    ev = events if types is None else events[events["event"].isin([t.upper() for t in types])]
    days = set(ev["datetime"].dt.tz_convert(ET).dt.date)
    j["event_day"] = j["entry_time"].apply(lambda t: t.tz_convert(ET).date() in days).astype(float)
    return j


def event_vs_non_event(journal: pd.DataFrame, r_col: str = "r_net") -> Result:
    if "event_day" not in journal.columns:
        raise InsufficientData("Run mark_event_days first")
    a = journal[journal["event_day"] == 1][r_col]
    b = journal[journal["event_day"] == 0][r_col]
    res = st.permutation_diff_test(a, b, label_a="event days", label_b="non-event days",
                                   data="TBS trades split by scheduled-event days", alternative="two-sided")
    res.limitations.append("Association only: an event day differing in R does not prove the event caused it.")
    return res
