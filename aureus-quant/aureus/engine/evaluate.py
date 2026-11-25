"""Statistical validation of detector signals.

For every detector × horizon:

1. **Forward return** from the signal bar's close to the close ``h`` bars
   later, in ticks. Returns that straddle a data gap (weekend, outage) are
   discarded.
2. **De-overlapping**: signals closer than ``h`` bars to the previous kept
   signal are dropped, so observations do not share the same future bars.
3. **Drift adjustment**: directional results are measured as *excess* over the
   unconditional drift (a long signal in a rising market is not credited for
   the market's rise). Volatility detectors compare |move| with the
   unconditional |move|.
4. **Discovery / validation split**: the first 70% of the timeline is
   in-sample (IS), the last 30% out-of-sample (OOS). p-values from IS are
   Benjamini–Hochberg corrected across ALL detector × horizon tests; a finding
   is VALIDATED only if it also holds OOS in the same direction, after costs.
5. **Stability**: mean signed return per calendar month.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sps

from ..core import MGC
from ..stats.engine import RNG_SEED
from .detectors import REGISTRY

HORIZONS = {  # bars ahead, by bar size
    "1m": [15, 60, 240], "5m": [3, 12, 48], "15m": [4, 16, 32], "1h": [1, 4, 24], "1d": [1, 5, 20],
}
HORIZON_LABEL = {
    "1m": ["15m", "1h", "4h"], "5m": ["15m", "1h", "4h"], "15m": ["1h", "4h", "8h"], "1h": ["1h", "4h", "1d"], "1d": ["1d", "1w", "1mo"],
}
MIN_N = 30
IS_FRAC = 0.70


def forward_ticks(df: pd.DataFrame, h: int, tf: pd.Timedelta) -> pd.Series:
    c = df["close"]
    fwd = (c.shift(-h) - c) / MGC.tick_size
    dt = pd.Series(df.index, index=df.index).shift(-h) - pd.Series(df.index, index=df.index)
    max_gap = h * tf + (pd.Timedelta("75min") if tf < pd.Timedelta("1D") else pd.Timedelta(days=4 + h // 5 * 3))
    return fwd.where(dt <= max_gap)


def deoverlap(sig: pd.Series, h: int) -> pd.Series:
    idx = np.flatnonzero(sig.to_numpy() != 0)
    keep, last = [], -10**9
    for i in idx:
        if i - last >= h:
            keep.append(i)
            last = i
    out = pd.Series(0, index=sig.index, dtype=int)
    out.iloc[keep] = sig.iloc[keep]
    return out


def _tstats(a: np.ndarray) -> dict:
    n = len(a)
    if n < 3:
        return {"n": n, "mean": float(a.mean()) if n else None, "t": None, "p": None}
    sd = a.std(ddof=1)
    t = a.mean() / (sd / np.sqrt(n)) if sd > 0 else 0.0
    return {"n": n, "mean": float(a.mean()), "median": float(np.median(a)), "std": float(sd), "t": float(t),
            "p": float(2 * sps.t.sf(abs(t), n - 1)), "hit": float((a > 0).mean())}


def _boot_ci(a: np.ndarray, n_boot=2000) -> list[float] | None:
    if len(a) < 5:
        return None
    rng = np.random.default_rng(RNG_SEED)
    m = a[rng.integers(0, len(a), (n_boot, len(a)))].mean(1)
    return [float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5))]


def bh(pvals: list[float | None]) -> list[float | None]:
    idx = [i for i, p in enumerate(pvals) if p is not None]
    if not idx:
        return [None] * len(pvals)
    ps = np.array([pvals[i] for i in idx])
    order = np.argsort(ps)
    m = len(ps)
    q = np.empty(m)
    run = 1.0
    for rank in range(m, 0, -1):
        i = order[rank - 1]
        run = min(run, ps[i] * m / rank)
        q[i] = run
    out = [None] * len(pvals)
    for k, i in enumerate(idx):
        out[i] = float(min(q[k], 1.0))
    return out


def evaluate(df: pd.DataFrame, signals: dict[str, pd.Series], interval: str, cost_ticks: float) -> dict:
    tf = pd.Series(df.index).diff().mode().iloc[0]
    hs, labels = HORIZONS.get(interval, [1, 4, 12]), HORIZON_LABEL.get(interval, ["h1", "h2", "h3"])
    split_t = df.index[int(len(df) * IS_FRAC)]
    rows = []
    for h, lab in zip(hs, labels):
        fwd = forward_ticks(df, h, tf)
        drift = fwd.loc[:split_t].mean()            # IS drift only (no peeking at OOS)
        base_abs = fwd.abs().loc[:split_t].mean()
        for d in REGISTRY:
            if d.key not in signals:
                continue
            s = deoverlap(signals[d.key], h)
            ev = s[s != 0]
            f = fwd.reindex(ev.index)
            ok = f.notna()
            ev, f = ev[ok], f[ok]
            if d.kind == "directional":
                raw = (ev * f).astype(float)
                stat = (raw - ev * drift).astype(float)            # excess over drift
            else:
                raw = f.abs().astype(float)
                stat = raw - base_abs                              # excess move size
            is_m, oos_m = stat.index <= split_t, stat.index > split_t
            IS, OOS, ALL = _tstats(stat[is_m].to_numpy()), _tstats(stat[oos_m].to_numpy()), _tstats(stat.to_numpy())
            monthly = stat.groupby(stat.index.tz_convert("America/New_York").strftime("%Y-%m")).agg(["mean", "count"])
            row = {
                "key": d.key, "name": d.name, "kind": d.kind, "hypothesis": d.hypothesis, "rule": d.rule,
                "horizon": lab, "h_bars": h,
                "n": ALL["n"], "n_long": int((ev > 0).sum()), "n_short": int((ev < 0).sum()),
                "mean_ticks": ALL.get("mean"), "median_ticks": ALL.get("median"), "hit_rate": ALL.get("hit"),
                "raw_mean_ticks": float(raw.mean()) if len(raw) else None,
                "ci95": _boot_ci(stat.to_numpy()),
                "is": IS, "oos": OOS,
                "net_mean_ticks": (float(raw.mean()) - cost_ticks) if (d.kind == "directional" and len(raw)) else None,
                "net_oos_ticks": (float(raw[oos_m].mean()) - cost_ticks) if (d.kind == "directional" and oos_m.sum()) else None,
                "monthly": [{"month": m, "mean": float(v["mean"]), "n": int(v["count"])} for m, v in monthly.iterrows()],
                "months_positive": float((monthly["mean"] > 0).mean()) if len(monthly) else None,
                "last_signal": ev.index.max().isoformat() if len(ev) else None,
                "distribution": stat.round(1).tolist()[-2000:],
            }
            rows.append(row)
    q = bh([r["is"]["p"] for r in rows])
    for r, qq in zip(rows, q):
        r["q_is"] = qq
        r["status"], r["edge_direction"], r["verdict"] = _status(r, cost_ticks)
    return {"rows": rows, "split": split_t.isoformat(), "cost_ticks": cost_ticks, "horizons": labels,
            "bars": len(df), "first": df.index[0].isoformat(), "last": df.index[-1].isoformat()}


def _status(r: dict, cost: float) -> tuple[str, str, str]:
    IS, OOS = r["is"], r["oos"]
    if (IS["n"] or 0) < MIN_N:
        return "INSUFFICIENT", "", f"Only {IS['n']} in-sample events (< {MIN_N})."
    sign = np.sign(IS["mean"] or 0)
    direction = "" if r["kind"] == "volatility" else ("as hypothesised" if sign > 0 else "INVERSE of hypothesis")
    if r["q_is"] is None or r["q_is"] >= 0.10:
        return "NO EDGE", direction, f"In-sample effect not significant after FDR correction (q = {r['q_is']:.2f})."
    if (OOS["n"] or 0) < 15:
        return "PROMISING", direction, f"Significant in-sample (q = {r['q_is']:.3f}); only {OOS['n']} OOS events so far."
    same = np.sign(OOS["mean"] or 0) == sign
    if not same:
        return "FAILED OOS", direction, "Significant in-sample but reversed out-of-sample — likely overfit or regime change."
    p_one = OOS["p"] / 2 if OOS["p"] is not None else 1
    net_ok = r["kind"] == "volatility" or (r["net_oos_ticks"] is not None and sign * (r["net_oos_ticks"] + cost) - cost > 0)
    if p_one < 0.05 and net_ok:
        return "VALIDATED", direction, (f"q_IS = {r['q_is']:.3f}; OOS mean {OOS['mean']:+.1f} ticks (one-sided p = {p_one:.3f}, n = {OOS['n']})"
                                        + ("" if r["kind"] == "volatility" else f"; positive after {cost:.1f}-tick costs."))
    return "PROMISING", direction, f"Same direction OOS but not yet significant (one-sided p = {p_one:.2f}, n = {OOS['n']})" + (
        "" if net_ok else "; does not cover costs.")


def seasonality(df: pd.DataFrame) -> dict:
    """Mean return and mean absolute return by ET hour and weekday (bar level),
    with per-hour t-tests and BH correction."""
    r = (df["close"].diff() / MGC.tick_size)
    tf = pd.Series(df.index).diff()
    r = r.where(tf.to_numpy() <= tf.mode().iloc[0] * 1.5)
    et = df.index.tz_convert("America/New_York")
    d = pd.DataFrame({"r": r.to_numpy(), "abs": r.abs().to_numpy(), "hour": et.hour, "dow": et.dayofweek}).dropna()
    hours = []
    for h, g in d.groupby("hour"):
        s = _tstats(g["r"].to_numpy())
        hours.append({"hour": int(h), "n": s["n"], "mean": s["mean"], "abs_mean": float(g["abs"].mean()), "p": s["p"]})
    for hrow, q in zip(hours, bh([h["p"] for h in hours])):
        hrow["q"] = q
    heat = d.pivot_table(index="dow", columns="hour", values="abs", aggfunc="mean")
    return {"hours": hours, "heat": {"dow": [int(i) for i in heat.index], "hour": [int(c) for c in heat.columns],
                                     "z": heat.round(2).where(heat.notna(), None).to_numpy().tolist()},
            "note": "Bar-level returns in ticks by New York hour. q = Benjamini–Hochberg adjusted p across 24 hours."}
