"""Measurable market-regime classification for MGC1!.

Two independent axes are computed from price only, using trailing windows:

* **Volatility level** — trailing percentile rank of ATR(14):
      high if rank ≥ ``vol_hi`` (default 60), low if ≤ ``vol_lo`` (40), else mid.
* **Directionality** — Kaufman efficiency ratio over 20 bars (ER20):
      trending if ER20 ≥ ``er_trend`` (0.30), ranging if ≤ ``er_range`` (0.20).
* **Volatility change** — log(ATR_t / ATR_{t−m}):
      expansion if ≥ +``dvol`` (0.15 ≈ +16%), contraction if ≤ −``dvol``.

Primary label (exactly one per bar, priority order):
    5 Volatility expansion       (vol change ≥ +dvol)
    6 Volatility contraction     (vol change ≤ −dvol)
    1 High-vol trending          2 Low-vol trending
    3 High-vol ranging           4 Low-vol ranging
    0 Unclassified               (mid-vol or mid-ER — deliberately left out
                                  rather than forced into a bucket)

Thresholds are parameters, are recorded with every run, and should be chosen
*before* looking at TBS results in each regime to avoid overfitting.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ..core import MIN_SAMPLE, config_hash
from ..features.indicators import feature_frame

REGIMES = {
    1: "High-volatility trending",
    2: "Low-volatility trending",
    3: "High-volatility ranging",
    4: "Low-volatility ranging",
    5: "Volatility expansion",
    6: "Volatility contraction",
    0: "Unclassified",
}


@dataclass
class RegimeParams:
    vol_hi: float = 60.0
    vol_lo: float = 40.0
    er_trend: float = 0.30
    er_range: float = 0.20
    dvol: float = 0.15
    version: str = "regime-v1"

    def hash(self) -> str:
        return config_hash(asdict(self))


def classify(df: pd.DataFrame, tf: pd.Timedelta, p: RegimeParams | None = None) -> pd.DataFrame:
    p = p or RegimeParams()
    f = feature_frame(df, tf)
    vr, er, dv = f["atr_pct_rank"], f["er20"], f["vol_change"]
    hi, lo = vr >= p.vol_hi, vr <= p.vol_lo
    tr, rg = er >= p.er_trend, er <= p.er_range
    lab = np.select(
        [dv >= p.dvol, dv <= -p.dvol, hi & tr, lo & tr, hi & rg, lo & rg],
        [5, 6, 1, 2, 3, 4], default=0)
    lab = np.where(vr.isna() | er.isna() | dv.isna(), -1, lab)
    out = f[["atr14", "atr_pct_rank", "er20", "adx14", "vol_change", "rv_1d"]].copy()
    out["regime"] = lab
    out["regime_name"] = out["regime"].map({**REGIMES, -1: "Warm-up (insufficient history)"})
    return out


def tag_trades(journal: pd.DataFrame, regimes: pd.DataFrame, tolerance: str = "6h") -> pd.DataFrame:
    """Attach the regime known at entry: the last *completed* bar strictly
    before entry time (prevents using the entry bar's own close). Trades with no
    bar within ``tolerance`` before entry (outside the candle history) stay
    untagged rather than inheriting a stale regime."""
    reg = regimes.sort_index()
    j = journal.copy()
    et = pd.to_datetime(j["entry_time"]).dt.tz_convert("UTC")
    left = pd.DataFrame({"t": et, "i": j.index}).sort_values("t")
    right = reg[["regime", "regime_name", "atr14", "atr_pct_rank", "er20"]].reset_index()
    right = right.rename(columns={right.columns[0]: "t"}).sort_values("t")
    right["t"] = right["t"].astype(left["t"].dtype)
    m = pd.merge_asof(left, right, on="t", direction="backward", allow_exact_matches=False,
                      tolerance=pd.Timedelta(tolerance)).set_index("i")
    for c in ["regime", "regime_name", "atr14", "atr_pct_rank", "er20"]:
        j[f"{c}_at_entry" if c not in ("regime", "regime_name") else c] = m[c]
    return j


def regime_performance(j: pd.DataFrame, col: str = "r_net") -> pd.DataFrame:
    col = col if col in j.columns else "r_gross"
    rows = []
    for code, name in REGIMES.items():
        g = j[j["regime"] == code][col].dropna().to_numpy(float)
        n = len(g)
        rows.append({
            "regime": code, "name": name, "n": n,
            "win_rate": (g > 0).mean() if n else np.nan,
            "avg_r": g.mean() if n else np.nan,
            "expected_value_r": g.mean() if n else np.nan,
            "std_r": g.std(ddof=1) if n > 1 else np.nan,
            "sem": g.std(ddof=1) / np.sqrt(n) if n > 1 else np.nan,
            "verdict": ("insufficient data" if n < MIN_SAMPLE else
                        "EV > 0 (≈2 SE)" if g.mean() - 2 * g.std(ddof=1) / np.sqrt(n) > 0 else
                        "EV < 0 (≈2 SE)" if g.mean() + 2 * g.std(ddof=1) / np.sqrt(n) < 0 else
                        "not distinguishable from 0"),
        })
    return pd.DataFrame(rows)


def transition_matrix(regimes: pd.Series) -> pd.DataFrame:
    s = regimes[regimes >= 0]
    m = pd.crosstab(s.shift().dropna().astype(int), s.iloc[1:].astype(int), normalize="index")
    return m.rename(index=REGIMES, columns=REGIMES)
