"""Current-state analytics: what the market is doing *now*, in measurable
terms, and the empirical distribution of what followed similar states."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sps

from ..core import MGC
from .evaluate import HORIZON_LABEL, HORIZONS, forward_ticks


def hurst_exponent(close: pd.Series, max_lag: int = 64) -> float | None:
    """Variance-of-lagged-differences estimator: Var(x_{t+τ} − x_t) ∝ τ^{2H}.
    H ≈ 0.5 random walk, > 0.5 persistent (trending), < 0.5 anti-persistent."""
    x = np.log(close.dropna().to_numpy())
    if len(x) < max_lag * 4:
        return None
    lags = np.unique(np.logspace(0.3, np.log10(max_lag), 12).astype(int))
    tau = [np.std(x[lag:] - x[:-lag]) for lag in lags]
    slope = np.polyfit(np.log(lags), np.log(tau), 1)[0]
    return float(slope)


def variance_ratio(close: pd.Series, q: int = 4) -> dict | None:
    """Lo–MacKinlay variance-ratio test with heteroskedasticity-robust z*.
    VR(q) = Var(q-period returns)/(q·Var(1-period returns)). VR>1 momentum, <1 mean reversion."""
    r = np.log(close).diff().dropna().to_numpy()
    n = len(r)
    if n < q * 30:
        return None
    mu = r.mean()
    var1 = np.sum((r - mu) ** 2) / (n - 1)
    rq = np.convolve(r, np.ones(q), "valid")
    m = q * (n - q + 1) * (1 - q / n)
    varq = np.sum((rq - q * mu) ** 2) / m
    vr = varq / var1
    dev2 = (r - mu) ** 2
    theta = 0.0
    for j in range(1, q):
        delta = np.sum(dev2[j:] * dev2[:-j]) / (np.sum(dev2) ** 2)
        theta += (2 * (q - j) / q) ** 2 * delta
    z = (vr - 1) / np.sqrt(theta) if theta > 0 else 0.0
    p = float(2 * sps.norm.sf(abs(z)))
    return {"q": q, "vr": float(vr), "z": float(z), "p": p,
            "reading": ("momentum (trend persistence)" if vr > 1 else "mean reversion") if p < 0.05 else "consistent with a random walk"}


def probability_cone(df: pd.DataFrame, atr_rank: pd.Series, interval: str) -> dict:
    """Empirical forward-move quantiles conditional on the current volatility
    tercile (ATR percentile ≤33 / 33–67 / >67), from all history."""
    tf = pd.Series(df.index).diff().mode().iloc[0]
    cur = atr_rank.iloc[-1]
    bucket = None if pd.isna(cur) else (0 if cur <= 33 else 1 if cur <= 67 else 2)
    names = ["low-vol", "mid-vol", "high-vol"]
    out = []
    for h, lab in zip(HORIZONS.get(interval, [1, 4, 12]), HORIZON_LABEL.get(interval, ["h1", "h2", "h3"])):
        fwd = forward_ticks(df, h, tf)
        b = pd.cut(atr_rank, [-1, 33, 67, 101], labels=[0, 1, 2])
        sel = fwd[(b == bucket)] if bucket is not None else fwd
        sel = sel.dropna()
        if len(sel) < 30:
            out.append({"horizon": lab, "n": int(len(sel)), "error": "too few observations"})
            continue
        qs = np.percentile(sel, [5, 25, 50, 75, 95])
        out.append({"horizon": lab, "n": int(len(sel)), "p5": qs[0], "p25": qs[1], "p50": qs[2], "p75": qs[3], "p95": qs[4],
                    "p_up": float((sel > 0).mean()), "mean": float(sel.mean()), "abs_mean": float(sel.abs().mean()),
                    "dollars_p5_p95": [float(qs[0] * MGC.tick_value), float(qs[4] * MGC.tick_value)]})
    return {"bucket": names[bucket] if bucket is not None else "unknown", "atr_rank": None if pd.isna(cur) else float(cur),
            "cones": out, "last_close": float(df["close"].iloc[-1]),
            "note": "Empirical distribution of past forward moves when volatility was in the same tercile. Not a forecast of direction."}


def now_state(df: pd.DataFrame, ctx, signals: dict, evaluation: dict, interval: str, lookback_bars: int = 3) -> dict:
    last = df.index[-1]
    age = (pd.Timestamp.now(tz="UTC") - last).total_seconds() / 60
    c = df["close"]
    rets = np.log(c).diff()
    window = c.iloc[-2000:]
    status = {}
    for r in evaluation["rows"]:
        status.setdefault(r["key"], {})[r["horizon"]] = {"status": r["status"], "mean": r["mean_ticks"], "n": r["n"],
                                                         "edge_direction": r["edge_direction"]}
    active = []
    for k, s in signals.items():
        recent = s.iloc[-lookback_bars:]
        nz = recent[recent != 0]
        if len(nz):
            meta = next(r for r in evaluation["rows"] if r["key"] == k)
            active.append({"key": k, "name": meta["name"], "kind": meta["kind"], "time": nz.index[-1].isoformat(),
                           "direction": int(nz.iloc[-1]), "by_horizon": status.get(k, {})})
    today = ctx.tday.iloc[-1]
    day = df[ctx.tday == today]
    daily_ranges = df.groupby(ctx.tday).apply(lambda g: g["high"].max() - g["low"].min()) if ctx.intraday else (df["high"] - df["low"])
    today_range = float(day["high"].max() - day["low"].min()) if ctx.intraday else float(df["high"].iloc[-1] - df["low"].iloc[-1])
    pct_range = float((daily_ranges.iloc[:-1] <= today_range).mean() * 100) if len(daily_ranges) > 5 else None
    return {
        "as_of": last.isoformat(), "as_of_et": last.tz_convert("America/New_York").strftime("%a %d %b %H:%M ET"),
        "data_age_min": round(age, 1),
        "close": float(c.iloc[-1]),
        "change_today_ticks": float((c.iloc[-1] - day["open"].iloc[0]) / MGC.tick_size) if ctx.intraday and len(day) else None,
        "atr": float(ctx.atr.iloc[-1]) if pd.notna(ctx.atr.iloc[-1]) else None,
        "atr_rank": float(ctx.atr_rank.iloc[-1]) if pd.notna(ctx.atr_rank.iloc[-1]) else None,
        "today_range": today_range, "today_range_pct": pct_range,
        "pdh": float(ctx.pdh.iloc[-1]) if pd.notna(ctx.pdh.iloc[-1]) else None,
        "pdl": float(ctx.pdl.iloc[-1]) if pd.notna(ctx.pdl.iloc[-1]) else None,
        "vwap": float(ctx.vwap.iloc[-1]) if ctx.vwap is not None and pd.notna(ctx.vwap.iloc[-1]) else None,
        "hurst": hurst_exponent(window),
        "variance_ratio": variance_ratio(window, 4),
        "autocorr_1": float(rets.iloc[-2000:].autocorr(1)) if len(rets) > 50 else None,
        "active": active,
        "cone": probability_cone(df, ctx.atr_rank, interval),
    }
