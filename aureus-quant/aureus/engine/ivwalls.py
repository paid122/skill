"""IV Walls Lab — the quantitative test of implied-volatility range zones.

For every historical period (week or day):
    M      = open × IV × √(days/252) / 100         (IV = GVZ close BEFORE the period)
    up_k   = (high − open) / M,  dn_k = (open − low) / M
Zones: Normal 0.67–1.00 M, Wall 1.65–1.96 M (the same numbers as the manual method).

Tests
1. Hit rates: share of period-sides reaching k·M vs theory 2·(1 − Φ(k)),
   with Wilson 95% CIs. Shows whether the zones are realistic for gold.
2. Fade rules (both sides, symmetric):
     NORMAL fade: sell at open + 1.00 M (buy at open − 1.00 M), stop 1.65 M, exit at period close
     WALL fade:   sell at open + 1.65 M (buy at open − 1.65 M), stop 2.30 M, exit at period close
   Fill = the zone price when it is touched. If the period touches BOTH the
   entry and the stop, intraday 1h bars are used to see which came first; if
   they are not available the STOP is assumed (worst case).
   Results in R after costs, IS (first 70%) vs OOS (last 30%), bootstrap CI,
   and a status (VALIDATED / PROMISING / FAILED OOS / NO EDGE / INSUFFICIENT).
"""
from __future__ import annotations

import io
import math

import numpy as np
import pandas as pd
from scipy import stats as sps

from ..core import MGC
from ..stats.engine import RNG_SEED, wilson_ci

DAYS = {"W": 5, "D": 1}
LEVELS = [0.67, 1.00, 1.65, 1.96]
RULES = {
    "normal_fade": {"name": "Normal-zone fade", "entry": 1.00, "stop": 1.65},
    "wall_fade": {"name": "Wall fade", "entry": 1.65, "stop": 2.30},
}
MIN_N = 30


def theory(k: float) -> float:
    return float(2 * (1 - sps.norm.cdf(k)))


def build_periods(daily: pd.DataFrame, iv: pd.Series, freq: str = "W") -> pd.DataFrame:
    """daily: MGC daily OHLC (UTC index). iv: GVZ-style annualised % series.
    Returns one row per period with open/high/low/close, IV before the period, M and excursions."""
    d = daily[["open", "high", "low", "close"]].copy()
    d.index = pd.DatetimeIndex(d.index).tz_convert("UTC").normalize()
    d = d[~d.index.duplicated(keep="last")].sort_index()
    ivs = iv.copy()
    ivs.index = pd.DatetimeIndex(ivs.index).tz_convert("UTC").normalize()
    ivs = ivs[~ivs.index.duplicated(keep="last")].sort_index().dropna()
    if freq == "W":
        key = d.index.to_period("W-FRI")
        g = d.groupby(key)
        p = pd.DataFrame({"start": g.apply(lambda x: x.index[0]), "end": g.apply(lambda x: x.index[-1]),
                          "open": g["open"].first(), "high": g["high"].max(), "low": g["low"].min(),
                          "close": g["close"].last(), "days": g.size()})
        p.index = p["start"]
    else:
        p = d.assign(start=d.index, end=d.index, days=1)
    # IV strictly before the period starts (no look-ahead)
    prior = ivs.reindex(ivs.index.union(p["start"])).ffill().shift(1)
    p["iv"] = prior.reindex(p["start"]).to_numpy()
    p["M"] = p["open"] * p["iv"] / 100 * math.sqrt(DAYS[freq] / 252)
    p["up_k"] = (p["high"] - p["open"]) / p["M"]
    p["dn_k"] = (p["open"] - p["low"]) / p["M"]
    p["close_k"] = (p["close"] - p["open"]) / p["M"]
    for k in LEVELS:
        p[f"z_up_{k}"] = p["open"] + k * p["M"]
        p[f"z_dn_{k}"] = p["open"] - k * p["M"]
    p = p.dropna(subset=["M"])
    p = p[p["M"] > 0]
    if freq == "W":
        p = p[p["days"] >= 3]   # skip holiday-shortened stubs
    return p


def hit_rates(p: pd.DataFrame) -> list[dict]:
    n = len(p)
    out = []
    for k in LEVELS:
        hits = int((p["up_k"] >= k).sum() + (p["dn_k"] >= k).sum())
        lo, hi = wilson_ci(hits, 2 * n)
        out.append({"k": k, "theory": theory(k), "actual": hits / (2 * n) if n else None,
                    "ci": [lo, hi], "n_sides": 2 * n, "hits": hits,
                    "up_actual": float((p["up_k"] >= k).mean()) if n else None,
                    "dn_actual": float((p["dn_k"] >= k).mean()) if n else None})
    return out


def _first_touch(intraday: pd.DataFrame | None, start, end, entry: float, stop: float, side: int):
    """Return 'stop_first' | 'entry_first' | None using 1h bars within [start, end+1d)."""
    if intraday is None or intraday.empty:
        return None
    w = intraday[(intraday.index >= start) & (intraday.index < end + pd.Timedelta(days=1))]
    if w.empty:
        return None
    entered = False
    for _, b in w.iterrows():
        hit_e = (b["high"] >= entry) if side < 0 else (b["low"] <= entry)
        hit_s = (b["high"] >= stop) if side < 0 else (b["low"] <= stop)
        if not entered:
            if hit_e:
                entered = True
                if hit_s:
                    return "stop_first"   # same bar: worst case
        elif hit_s:
            return "stop_first"
    return "entry_first" if entered else None


def rule_trades(p: pd.DataFrame, rule: dict, cost_points: float, intraday: pd.DataFrame | None = None) -> pd.DataFrame:
    rows = []
    for t, r in p.iterrows():
        for side in (-1, +1):  # -1 = short at the upper zone, +1 = long at the lower zone
            ext = r["up_k"] if side < 0 else r["dn_k"]
            if ext < rule["entry"]:
                continue
            entry = r["open"] - side * rule["entry"] * r["M"]
            stop = r["open"] - side * rule["stop"] * r["M"]
            risk = abs(stop - entry)
            stop_touched = ext >= rule["stop"]
            if stop_touched:
                order = _first_touch(intraday, r["start"], r["end"], entry, stop, side)
                if order == "entry_first":   # intraday shows the stop was not reached after entry
                    exit_px, how = r["close"], "close"
                else:
                    exit_px, how = stop, "stop" if order == "stop_first" else "stop (assumed: no intraday data)"
            else:
                exit_px, how = r["close"], "close"
            pnl = (exit_px - entry) * side - cost_points
            rows.append({"period": t, "side": "short @ upper" if side < 0 else "long @ lower", "entry": entry, "stop": stop,
                         "exit": exit_px, "exit_reason": how, "pnl_points": pnl, "r": pnl / risk,
                         "pnl_usd": pnl * MGC.multiplier_oz})
    return pd.DataFrame(rows)


def _stats(a: np.ndarray) -> dict:
    n = len(a)
    if n < 3:
        return {"n": n, "mean": float(a.mean()) if n else None, "t": None, "p": None}
    sd = a.std(ddof=1)
    t = a.mean() / (sd / math.sqrt(n)) if sd > 0 else 0.0
    return {"n": n, "mean": float(a.mean()), "median": float(np.median(a)), "win_rate": float((a > 0).mean()),
            "t": float(t), "p": float(2 * sps.t.sf(abs(t), n - 1))}


def evaluate_rule(tr: pd.DataFrame, split) -> dict:
    if tr.empty:
        return {"status": "INSUFFICIENT", "verdict": "No touches in the data.", "all": {"n": 0}, "is": {"n": 0}, "oos": {"n": 0}}
    r = tr["r"].to_numpy(float)
    is_m = (tr["period"] <= split).to_numpy()
    A, IS, OOS = _stats(r), _stats(r[is_m]), _stats(r[~is_m])
    ci = None
    if len(r) >= 5:
        rng = np.random.default_rng(RNG_SEED)
        m = r[rng.integers(0, len(r), (5000, len(r)))].mean(1)
        ci = [float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5))]
    eq = np.cumsum(r)
    mdd = float(np.max(np.maximum.accumulate(np.concatenate([[0], eq]))[1:] - eq)) if len(eq) else 0.0
    if A["n"] < MIN_N:
        st, v = "INSUFFICIENT", f"Only {A['n']} trades (need ≥ {MIN_N}). Use daily periods or more history."
    elif IS["p"] is None or IS["mean"] <= 0 or IS["p"] / 2 >= 0.05:
        st, v = "NO EDGE", f"In-sample mean {IS['mean']:+.2f}R is not significantly above 0 (one-sided p = {(IS['p'] or 1) / 2:.3f})."
    elif OOS["n"] < 10:
        st, v = "PROMISING", f"In-sample positive and significant; only {OOS['n']} out-of-sample trades so far."
    elif OOS["mean"] <= 0:
        st, v = "FAILED OOS", f"Worked in-sample ({IS['mean']:+.2f}R) but not out-of-sample ({OOS['mean']:+.2f}R)."
    elif OOS["p"] is not None and OOS["p"] / 2 < 0.05:
        st, v = "VALIDATED", f"Positive in-sample and out-of-sample ({OOS['mean']:+.2f}R, one-sided p = {OOS['p'] / 2:.3f}) after costs."
    else:
        st, v = "PROMISING", f"Positive out-of-sample ({OOS['mean']:+.2f}R) but not yet significant (p = {OOS['p'] / 2:.2f})."
    return {"status": st, "verdict": v, "all": A, "is": IS, "oos": OOS, "ci95": ci, "max_drawdown_r": mdd,
            "total_r": float(r.sum()), "equity": eq.round(3).tolist(),
            "exit_reasons": tr["exit_reason"].value_counts().to_dict()}


def run(daily: pd.DataFrame, iv: pd.Series, freq: str, cost_points: float, intraday: pd.DataFrame | None = None) -> dict:
    p = build_periods(daily, iv, freq)
    if len(p) < 20:
        raise ValueError(f"Only {len(p)} {('weeks' if freq == 'W' else 'days')} with both MGC prices and IV — need more history.")
    split = p.index[int(len(p) * 0.7)]
    out = {"freq": freq, "periods": len(p), "first": p.index[0].isoformat(), "last": p.index[-1].isoformat(),
           "split": split.isoformat(), "cost_points": cost_points, "hit_rates": hit_rates(p), "rules": {},
           "excursions": {"up": p["up_k"].round(3).tolist(), "dn": p["dn_k"].round(3).tolist()},
           "current": None}
    for key, rule in RULES.items():
        tr = rule_trades(p, rule, cost_points, intraday)
        res = evaluate_rule(tr, split)
        res.update({"name": rule["name"], "entry_k": rule["entry"], "stop_k": rule["stop"]})
        out["rules"][key] = res
    last = p.iloc[-1]
    out["current"] = {"start": last["start"].isoformat(), "open": last["open"], "iv": last["iv"], "M": last["M"],
                      "zones": {f"{s}_{k}": last[f"z_{s}_{k}"] for s in ("up", "dn") for k in LEVELS}}
    out["recent"] = p.tail(52).iloc[::-1].reset_index(drop=True)[["start", "open", "high", "low", "close", "iv", "M", "up_k", "dn_k"]] \
        .assign(start=lambda x: x["start"].dt.strftime("%Y-%m-%d")).round(3).to_dict(orient="records")
    out["assumptions"] = [
        "IV = GVZ close before the period starts; M = open × IV × √(days/252) ÷ 100.",
        "Fades fill exactly at the zone price when touched; if the stop is also touched, 1h bars decide the order, else the stop is assumed first.",
        f"Costs: {cost_points:.2f} points per round trip (commission + fees + slippage).",
        "Exit at the period close if the stop is not hit. No targets, no compounding.",
        "70% oldest periods = in-sample, 30% newest = out-of-sample.",
    ]
    return out


def periods_csv(daily: pd.DataFrame, iv: pd.Series, freq: str) -> str:
    p = build_periods(daily, iv, freq)
    cols = ["start", "end", "open", "high", "low", "close", "iv", "M", "up_k", "dn_k"] + \
           [f"z_up_{k}" for k in LEVELS] + [f"z_dn_{k}" for k in LEVELS]
    df = p[cols].copy()
    df["start"] = df["start"].dt.strftime("%Y-%m-%d")
    df["end"] = df["end"].dt.strftime("%Y-%m-%d")
    for k in LEVELS:
        df[f"reached_up_{k}"] = (p["up_k"] >= k).astype(int)
        df[f"reached_dn_{k}"] = (p["dn_k"] >= k).astype(int)
    buf = io.StringIO()
    df.round(3).to_csv(buf, index=False)
    return buf.getvalue()


def load_iv_csv(buf) -> pd.Series:
    """Accepts a TradingView export (time, close, …) or CBOE history (DATE, CLOSE / GVZ)."""
    df = pd.read_csv(buf)
    df.columns = [c.strip().lower() for c in df.columns]
    tcol = next((c for c in ("time", "date", "datetime", "timestamp") if c in df.columns), None)
    vcol = next((c for c in ("close", "gvz", "value", "adj close") if c in df.columns), None)
    if tcol is None or vcol is None:
        raise ValueError("IV CSV needs a date column (time/date) and a value column (close/GVZ)")
    t = df[tcol]
    idx = pd.to_datetime(t, unit="s", utc=True) if pd.api.types.is_numeric_dtype(t) else pd.to_datetime(t, utc=True, format="mixed")
    s = pd.Series(pd.to_numeric(df[vcol], errors="coerce").to_numpy(), index=idx).dropna()
    if s.empty or s.median() < 3 or s.median() > 200:
        raise ValueError("IV values look wrong (expected roughly 8–80, annualised %)")
    return s
