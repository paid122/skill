"""Mechanical, look-ahead-free event detectors for MGC1!.

Each detector turns OHLCV bars into a signal series: +1 (up-move hypothesis),
−1 (down-move hypothesis) or 0. For 'volatility' detectors the sign is ignored
and the hypothesis is about the SIZE of the next move. Every signal at bar t
uses only information available at the close of bar t.

These are generic market-structure / statistical conditions — not a trading
strategy. Whether any of them carries information is decided by
``evaluate.py`` (out-of-sample, after costs, multiple-testing corrected).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from ..features.indicators import atr, trailing_percentile

ET = "America/New_York"


@dataclass
class Detector:
    key: str
    name: str
    kind: str            # directional | volatility
    hypothesis: str
    rule: str
    intraday_only: bool
    fn: Callable[["Ctx"], pd.Series]


class Ctx:
    """Shared, cached features for one bar series."""

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.o, self.h, self.l, self.c, self.v = (df[k] for k in ["open", "high", "low", "close", "volume"])
        et = df.index.tz_convert(ET)
        self.hour = pd.Series(et.hour + et.minute / 60, index=df.index)
        self.tday = pd.Series((et + pd.Timedelta(hours=6)).date, index=df.index)  # CME day starts 18:00 ET
        self.atr = atr(df, 14)
        self.atr_prev = self.atr.shift(1)
        self.rng = self.h - self.l
        self.tf = pd.Series(df.index).diff().mode().iloc[0]
        self.intraday = self.tf < pd.Timedelta("1D")
        per_day = max(int(pd.Timedelta("23h") / self.tf), 1) if self.intraday else 1
        self.atr_rank = trailing_percentile(self.atr, min(max(per_day * 20, 100), max(len(df) - 1, 30)))
        if self.intraday:
            daily = df.groupby(self.tday).agg(high=("high", "max"), low=("low", "min"), close=("close", "last"))
            prev = daily.shift(1)
            self.pdh = self.tday.map(prev["high"])
            self.pdl = self.tday.map(prev["low"])
            tp = (self.h + self.l + self.c) / 3
            vol = self.v.replace(0, np.nan).fillna(1.0)
            self.vwap = (tp * vol).groupby(self.tday).cumsum() / vol.groupby(self.tday).cumsum()
        else:
            self.pdh, self.pdl = self.h.shift(1), self.l.shift(1)
            self.vwap = None

    def first_in_day(self, cond: pd.Series) -> pd.Series:
        """True only on the first bar of each trading day where cond is True."""
        cond = cond.fillna(False).astype(bool)
        if not self.intraday:
            return cond & ~cond.shift(1, fill_value=False)
        return cond & (cond.astype(int).groupby(self.tday).cumsum() == 1)

    def cross_up(self, x: pd.Series, level) -> pd.Series:
        return (x > level) & (x.shift(1) <= (level.shift(1) if isinstance(level, pd.Series) else level))


def _sig(up: pd.Series, down: pd.Series, index) -> pd.Series:
    s = pd.Series(0, index=index, dtype=int)
    s[up.fillna(False).astype(bool)] = 1
    s[down.fillna(False).astype(bool)] = -1
    return s


# ---------------------------------------------------------------- rules ----

def pdh_pdl_sweep_reject(x: Ctx):
    up = x.first_in_day((x.l < x.pdl) & (x.c > x.pdl))
    dn = x.first_in_day((x.h > x.pdh) & (x.c < x.pdh))
    return _sig(up, dn, x.df.index)


def pdh_pdl_close_break(x: Ctx):
    return _sig(x.first_in_day(x.c > x.pdh), x.first_in_day(x.c < x.pdl), x.df.index)


def squeeze_breakout(x: Ctx):
    compressed = x.atr_rank.rolling(12, min_periods=6).min() < 15
    burst = compressed.shift(1, fill_value=False) & (x.rng > 1.8 * x.atr_prev)
    return _sig(burst & (x.c > x.o), burst & (x.c < x.o), x.df.index)


def zscore_extreme(x: Ctx):
    m, s = x.c.rolling(50).mean(), x.c.rolling(50).std()
    z = (x.c - m) / s
    return _sig((z < -2.5) & (z.shift(1) >= -2.5), (z > 2.5) & (z.shift(1) <= 2.5), x.df.index)


def vwap_stretch(x: Ctx):
    d = (x.c - x.vwap) / x.atr
    return _sig((d < -3) & (d.shift(1) >= -3), (d > 3) & (d.shift(1) <= 3), x.df.index)


def _range_break(x: Ctx, rng_start, rng_end, win_end):
    """Range = high/low of bars with ET hour in [rng_start, rng_end); signal =
    first close outside it during [rng_end, win_end). Ranges spanning midnight
    are handled through the CME trading day."""
    h = x.hour
    in_rng = (h >= rng_start) & (h < rng_end) if rng_start < rng_end else ((h >= rng_start) | (h < rng_end))
    hi = x.h.where(in_rng).groupby(x.tday).transform("max")
    lo = x.l.where(in_rng).groupby(x.tday).transform("min")
    in_win = (h >= rng_end) & (h < win_end)
    up = x.first_in_day(in_win & (x.c > hi))
    dn = x.first_in_day(in_win & (x.c < lo))
    both = up & dn
    return _sig(up & ~both, dn & ~both, x.df.index)


def ny_open_range_break(x: Ctx):
    return _range_break(x, 8 + 20 / 60, 8 + 50 / 60, 12)   # COMEX gold open 08:20 ET; 30-min range


def london_breaks_asia(x: Ctx):
    return _range_break(x, 18, 2, 7)                       # Asia 18:00–02:00 ET, London 02:00–07:00


def momentum_bar(x: Ctx):
    big = (x.rng > 3 * x.atr_prev) & ((x.c - x.o).abs() > 0.7 * x.rng)
    return _sig(big & (x.c > x.o), big & (x.c < x.o), x.df.index)


def volume_shock(x: Ctx):
    lv = np.log(x.v.replace(0, np.nan))
    z = (lv - lv.rolling(288, min_periods=100).mean()) / lv.rolling(288, min_periods=100).std()
    shock = (z > 3) & (z.shift(1) <= 3)
    return _sig(shock & (x.c > x.o), shock & (x.c < x.o), x.df.index)


def round_level_reject(x: Ctx, step: float = 25.0):
    lvl_up = np.ceil(x.o / step) * step      # nearest round level above the open
    lvl_dn = np.floor(x.o / step) * step
    dn = (x.h >= lvl_up) & (x.c < lvl_up) & (lvl_up - x.o < x.atr_prev)
    up = (x.l <= lvl_dn) & (x.c > lvl_dn) & (x.o - lvl_dn < x.atr_prev)
    return _sig(up, dn, x.df.index)


def three_bar_exhaustion(x: Ctx):
    d = np.sign(x.c - x.o)
    big = x.rng > 1.2 * x.atr_prev
    up_run = (d == 1) & big
    dn_run = (d == -1) & big
    up3 = up_run & up_run.shift(1, fill_value=False) & up_run.shift(2, fill_value=False)
    dn3 = dn_run & dn_run.shift(1, fill_value=False) & dn_run.shift(2, fill_value=False)
    return _sig(dn3, up3, x.df.index)       # hypothesis: exhaustion → reversal


def session_open_gap(x: Ctx):
    first = x.tday != x.tday.shift(1)
    gap = (x.o - x.c.shift(1)) / x.atr_prev
    return _sig(first & (gap < -1.5), first & (gap > 1.5), x.df.index)   # fade the gap


def vol_compression(x: Ctx):
    comp = (x.atr_rank < 10) & (x.atr_rank.shift(1) >= 10)
    return comp.astype(int)


def vol_extreme(x: Ctx):
    ext = (x.atr_rank > 95) & (x.atr_rank.shift(1) <= 95)
    return ext.astype(int)


REGISTRY: list[Detector] = [
    Detector("sweep_reject", "Prior-day high/low sweep & reject", "directional",
             "A wick through yesterday's high (low) that closes back inside is followed by a move down (up).",
             "high > PDH and close < PDH → short; low < PDL and close > PDL → long (first per day)", True, pdh_pdl_sweep_reject),
    Detector("pd_break", "Prior-day high/low close break", "directional",
             "A close beyond yesterday's high (low) continues in that direction.",
             "first close > PDH → long; first close < PDL → short", False, pdh_pdl_close_break),
    Detector("squeeze", "Volatility squeeze breakout", "directional",
             "After ATR compression, the first large bar continues in its direction.",
             "ATR pct-rank < 15 within last 12 bars, then range > 1.8×ATR → bar direction", False, squeeze_breakout),
    Detector("zscore", "Z-score extreme (50-bar)", "directional",
             "Price > 2.5σ from its 50-bar mean mean-reverts.",
             "z crosses above +2.5 → short; below −2.5 → long", False, zscore_extreme),
    Detector("vwap", "Session-VWAP stretch", "directional",
             "Price > 3 ATR from session VWAP reverts toward VWAP.",
             "(close − VWAP)/ATR crosses ±3 → fade", True, vwap_stretch),
    Detector("ny_orb", "NY opening-range breakout", "directional",
             "The first close outside the 08:20–08:50 ET range continues.",
             "range 08:20–08:50 ET; first close outside before 12:00 → direction", True, ny_open_range_break),
    Detector("london_asia", "London breaks Asia range", "directional",
             "London's first close outside the Asia range continues.",
             "Asia 18:00–02:00 ET range; first close outside 02:00–07:00 → direction", True, london_breaks_asia),
    Detector("momentum", "Momentum bar (>3 ATR)", "directional",
             "An outsized full-bodied bar continues.",
             "range > 3×ATR and body > 70% of range → bar direction", False, momentum_bar),
    Detector("volshock", "Volume shock", "directional",
             "A volume spike (log-volume z > 3) continues in the bar's direction.",
             "z(log volume, 288 bars) crosses 3 → bar direction", True, volume_shock),
    Detector("round25", "$25 round-level rejection", "directional",
             "Touches of $25 round numbers that close back are rejected.",
             "trade through a $25 level within 1 ATR of the open and close back → fade", False, round_level_reject),
    Detector("exhaustion", "3-bar exhaustion", "directional",
             "Three large same-direction bars are followed by a reversal.",
             "3 consecutive bars, range > 1.2×ATR, same direction → fade", False, three_bar_exhaustion),
    Detector("gap", "Session-open gap fade", "directional",
             "A gap > 1.5 ATR at the CME session open fills.",
             "first bar of trading day: |open − prior close| > 1.5 ATR → fade", True, session_open_gap),
    Detector("compression", "Volatility compression (ATR < 10th pct)", "volatility",
             "Very low volatility is followed by larger-than-usual moves.",
             "ATR pct-rank crosses below 10 → next move size vs normal", False, vol_compression),
    Detector("vol_extreme", "Volatility extreme (ATR > 95th pct)", "volatility",
             "Extreme volatility persists (moves stay larger than usual).",
             "ATR pct-rank crosses above 95 → next move size vs normal", False, vol_extreme),
]


def run_all(df: pd.DataFrame) -> tuple[Ctx, dict[str, pd.Series]]:
    x = Ctx(df)
    out = {}
    for d in REGISTRY:
        if d.intraday_only and not x.intraday:
            continue
        out[d.key] = d.fn(x).reindex(df.index).fillna(0).astype(int)
    return x, out
