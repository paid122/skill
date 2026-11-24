"""Price, volatility and market-structure features.

All features at bar *t* use only information available at the close of bar *t*
(no centred windows, no forward fills from the future). Swing points are
*confirmed* only ``k`` bars after they occur, and are stamped on the
confirmation bar to avoid look-ahead.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..core import MGC

ET = "America/New_York"


def candle_anatomy(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    out["range"] = df["high"] - df["low"]
    out["body"] = (df["close"] - df["open"]).abs()
    out["upper_wick"] = df["high"] - df[["open", "close"]].max(axis=1)
    out["lower_wick"] = df[["open", "close"]].min(axis=1) - df["low"]
    out["change"] = df["close"].diff()
    out["change_ticks"] = out["change"] / MGC.tick_size
    out["change_dollars"] = out["change"] * MGC.multiplier_oz
    if {"bid", "ask"}.issubset(df.columns):
        out["spread"] = df["ask"] - df["bid"]
        out["spread_ticks"] = out["spread"] / MGC.tick_size
    return out


def true_range(df: pd.DataFrame) -> pd.Series:
    pc = df["close"].shift()
    return pd.concat([df["high"] - df["low"], (df["high"] - pc).abs(), (df["low"] - pc).abs()], axis=1).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """Wilder ATR: ATR_t = ATR_{t-1} + (TR_t − ATR_{t-1}) / n."""
    return true_range(df).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def log_returns(close: pd.Series) -> pd.Series:
    return np.log(close).diff()


def realized_vol(close: pd.Series, window: int, bars_per_year: float) -> pd.Series:
    """Annualised realised vol = sqrt(Σ r² / window) · sqrt(bars_per_year)."""
    r = log_returns(close)
    return np.sqrt((r ** 2).rolling(window).mean() * bars_per_year)


def rolling_std(close: pd.Series, window: int) -> pd.Series:
    return log_returns(close).rolling(window).std(ddof=1)


def trailing_percentile(x: pd.Series, lookback: int) -> pd.Series:
    """Percentile rank of x_t within the trailing ``lookback`` values (inclusive).
    Uses only past data — never the full-sample distribution."""
    def pct(w):
        return 100.0 * (np.sum(w <= w[-1]) - 1) / (len(w) - 1) if len(w) > 1 else np.nan
    return x.rolling(lookback, min_periods=max(20, lookback // 4)).apply(pct, raw=True)


def efficiency_ratio(close: pd.Series, n: int = 20) -> pd.Series:
    """Kaufman ER = |C_t − C_{t−n}| / Σ|ΔC|. 1 = perfectly directional, 0 = noise."""
    net = (close - close.shift(n)).abs()
    path = close.diff().abs().rolling(n).sum()
    return net / path


def adx(df: pd.DataFrame, n: int = 14) -> pd.Series:
    up = df["high"].diff()
    dn = -df["low"].diff()
    plus_dm = np.where((up > dn) & (up > 0), up, 0.0)
    minus_dm = np.where((dn > up) & (dn > 0), dn, 0.0)
    tr = true_range(df)
    a = 1 / n
    atr_ = tr.ewm(alpha=a, adjust=False).mean()
    pdi = 100 * pd.Series(plus_dm, index=df.index).ewm(alpha=a, adjust=False).mean() / atr_
    mdi = 100 * pd.Series(minus_dm, index=df.index).ewm(alpha=a, adjust=False).mean() / atr_
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi)
    return dx.ewm(alpha=a, adjust=False, min_periods=2 * n).mean()


def confirmed_swings(df: pd.DataFrame, k: int = 3) -> pd.DataFrame:
    """Fractal swing highs/lows with k bars each side.

    Column ``swing_high`` holds the swing price on the bar where it becomes
    *known* (k bars after the pivot), NaN elsewhere — safe for backtests.
    """
    h, l = df["high"], df["low"]
    win = 2 * k + 1
    pivot_h = h.rolling(win).apply(lambda w: float(w[k] == w.max()), raw=True).astype(bool)
    pivot_l = l.rolling(win).apply(lambda w: float(w[k] == w.min()), raw=True).astype(bool)
    out = pd.DataFrame(index=df.index)
    out["swing_high"] = np.where(pivot_h, h.shift(k), np.nan)
    out["swing_low"] = np.where(pivot_l, l.shift(k), np.nan)
    out["last_swing_high"] = out["swing_high"].ffill()
    out["last_swing_low"] = out["swing_low"].ffill()
    return out


def trend_direction(df: pd.DataFrame, k: int = 3) -> pd.Series:
    """+1 if last two confirmed swing highs AND lows are rising, −1 if both falling, else 0."""
    sw = confirmed_swings(df, k)
    sh = sw["swing_high"].dropna()
    sl = sw["swing_low"].dropna()
    hh = (sh > sh.shift()).reindex(df.index).ffill()
    hl = (sl > sl.shift()).reindex(df.index).ffill()
    lh = (sh < sh.shift()).reindex(df.index).ffill()
    ll = (sl < sl.shift()).reindex(df.index).ffill()
    t = np.where(hh.fillna(False) & hl.fillna(False), 1, np.where(lh.fillna(False) & ll.fillna(False), -1, 0))
    return pd.Series(t, index=df.index, name="trend")


def session_levels(df: pd.DataFrame) -> pd.DataFrame:
    """Running session high/low (Asia/London/NY by ET clock) and previous
    trading-day high/low (CME day starting 18:00 ET). PDH/PDL only become
    available after the prior day has closed."""
    from ..data.journal import session_of

    et = df.index.tz_convert(ET)
    sess = pd.Series([session_of(t) for t in et], index=df.index)
    tday = pd.Series((et + pd.Timedelta(hours=6)).date, index=df.index)
    key = tday.astype(str) + "_" + sess
    out = pd.DataFrame(index=df.index)
    out["session"] = sess
    out["trading_date"] = tday
    out["session_high"] = df["high"].groupby(key).cummax()
    out["session_low"] = df["low"].groupby(key).cummin()
    daily = df.groupby(tday).agg(high=("high", "max"), low=("low", "min"))
    prev = daily.shift()
    out["pdh"] = tday.map(prev["high"])
    out["pdl"] = tday.map(prev["low"])
    return out


def bars_per_year(tf: pd.Timedelta) -> float:
    # ~23 trading hours × ~252 days
    return 23 * 60 * 252 / (tf.total_seconds() / 60)


def feature_frame(df: pd.DataFrame, tf: pd.Timedelta, vol_lookback: int | None = None) -> pd.DataFrame:
    bpy = bars_per_year(tf)
    per_day = max(int(round(23 * 3600 / tf.total_seconds())), 1)
    vol_lookback = vol_lookback or min(per_day * 252, max(len(df) - 1, 21))
    f = candle_anatomy(df)
    f["atr14"] = atr(df, 14)
    f["rv_1d"] = realized_vol(df["close"], max(per_day, 5), bpy)
    f["rolling_std_20"] = rolling_std(df["close"], 20)
    f["atr_pct_rank"] = trailing_percentile(f["atr14"], vol_lookback)
    f["rv_pct_rank"] = trailing_percentile(f["rv_1d"], vol_lookback)
    f["er20"] = efficiency_ratio(df["close"], 20)
    f["adx14"] = adx(df, 14)
    f["trend"] = trend_direction(df)
    f["vol_change"] = np.log(f["atr14"] / f["atr14"].shift(max(per_day // 4, 5)))
    return f
