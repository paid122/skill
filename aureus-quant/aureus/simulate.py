"""SIMULATED data for unit tests and UI smoke tests ONLY.

Everything produced here is tagged Provenance.SIMULATED and the dashboard
shows a red banner while it is loaded. These series are random numbers with
no relationship to real MGC prices or to any real trade — they must never be
used to draw conclusions about the TBS strategy or the gold market.
"""
from __future__ import annotations

import io

import numpy as np
import pandas as pd

from .data.candles import is_globex_open


def simulated_candles_csv(days: int = 120, tf_min: int = 5, start: str = "2026-01-04 23:00", seed: int = 7,
                          start_price: float = 2000.0) -> io.StringIO:
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start, periods=days * 24 * 60 // tf_min, freq=f"{tf_min}min", tz="UTC")
    idx = idx[is_globex_open(idx)]
    n = len(idx)
    # GARCH-like volatility so regimes vary
    vol = np.empty(n)
    v = 0.0008
    for i in range(n):
        v = np.sqrt(1e-8 + 0.03 * (rng.standard_normal() * v) ** 2 + 0.96 * v ** 2)
        vol[i] = v
    r = rng.standard_normal(n) * vol
    close = start_price * np.exp(np.cumsum(r))
    open_ = np.concatenate([[start_price], close[:-1]])
    hi = np.maximum(open_, close) + np.abs(rng.standard_normal(n)) * vol * close * 0.5
    lo = np.minimum(open_, close) - np.abs(rng.standard_normal(n)) * vol * close * 0.5
    tick = 0.1
    q = lambda x: np.round(x / tick) * tick  # noqa: E731
    df = pd.DataFrame({"timestamp": idx.strftime("%Y-%m-%dT%H:%M:%SZ"), "open": q(open_), "high": q(hi),
                       "low": q(lo), "close": q(close), "volume": rng.integers(50, 2000, n)})
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"] = df[["open", "low", "close"]].min(axis=1)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return buf


def simulated_journal_csv(n: int = 150, seed: int = 11, start: str = "2026-02-01") -> io.StringIO:
    rng = np.random.default_rng(seed)
    days = pd.bdate_range(start, periods=n)
    rows = []
    for d in days:
        direction = rng.choice(["long", "short"])
        daily = rng.choice(["bullish", "bearish", "none"], p=[0.45, 0.45, 0.10])
        h4 = rng.choice(["bullish", "bearish", "none"], p=[0.45, 0.45, 0.10])
        amd = bool(rng.random() < 0.55)
        entry = round(2000 + rng.normal(0, 30), 1)
        risk = round(rng.uniform(2, 6), 1)
        sign = 1 if direction == "long" else -1
        stop = round(entry - sign * risk, 1)
        target = round(entry + sign * 2 * risk, 1)
        r = 2.0 if rng.random() < 0.36 else -1.0  # pure coin-flip-ish process
        exit_ = round(entry + sign * r * risk, 1)
        hh = rng.choice([3, 4, 8, 9, 10, 13, 14])
        rows.append({"date": d.date(), "time": f"{hh:02d}:{rng.integers(0,60):02d}", "direction": direction,
                     "daily_crt": daily, "h4_crt": h4, "amd_aligned": amd, "tbs_confirmed": True,
                     "entry": entry, "stop": stop, "target": target, "exit": exit_, "contracts": 1,
                     "mfe": round(abs(rng.normal(1.2, 0.8)) * risk, 1), "mae": round(abs(rng.normal(0.6, 0.3)) * risk, 1),
                     "news": rng.choice(["none", "none", "none", "CPI", "FOMC"])})
    buf = io.StringIO()
    pd.DataFrame(rows).to_csv(buf, index=False)
    buf.seek(0)
    return buf


def simulated_events_csv(start: str = "2026-01-05", months: int = 4) -> io.StringIO:
    """Placeholder event times on a fixed monthly pattern — NOT a real calendar."""
    rows = []
    for m in range(months):
        base = pd.Timestamp(start) + pd.DateOffset(months=m)
        rows += [{"datetime": f"{(base + pd.Timedelta(days=9)).date()} 08:30", "event": "CPI"},
                 {"datetime": f"{(base + pd.Timedelta(days=4)).date()} 08:30", "event": "NFP"},
                 {"datetime": f"{(base + pd.Timedelta(days=17)).date()} 14:00", "event": "FOMC"}]
    buf = io.StringIO()
    pd.DataFrame(rows).to_csv(buf, index=False)
    buf.seek(0)
    return buf


def load_simulated(ws) -> None:
    from .core import Provenance
    ws.load_candles(simulated_candles_csv(), source="SIMULATED random walk (not market data)", provenance=Provenance.SIMULATED)
    ws.load_journal(simulated_journal_csv(), provenance=Provenance.SIMULATED)
    ws.load_events(simulated_events_csv())


def simulated_option_chains(spot: float = 370.0, seed: int = 3):
    """SIMULATED GLD-like option chains (BS-priced with a skewed smile and
    random open interest) — for tests and UI previews only."""
    from .engine.options import bs_price
    rng = np.random.default_rng(seed)
    chains = []
    for i, days in enumerate([2, 9, 16, 30, 44, 58]):
        T = days / 365
        strikes = np.arange(round(spot * 0.85), round(spot * 1.15), 1.0)
        rows_c, rows_p = [], []
        for k in strikes:
            m = np.log(k / spot)
            iv = 0.17 + 0.6 * m * m - 0.15 * m + 0.01 * i
            for call, rows in ((True, rows_c), (False, rows_p)):
                px = bs_price(spot, k, T, iv, call)
                spread = max(0.02, px * 0.03)
                bump = 3 if (call and k % 10 == 0 and k > spot) or (not call and k % 10 == 0 and k < spot) else 1
                oi = int(rng.gamma(2, 400) * np.exp(-abs(m) * 12) * bump)
                rows.append({"strike": k, "bid": max(px - spread / 2, 0), "ask": px + spread / 2, "openInterest": oi,
                             "volume": int(oi * rng.uniform(0, 0.3)), "impliedVolatility": iv})
        exp = (pd.Timestamp("2026-04-03") + pd.Timedelta(days=days)).strftime("%Y-%m-%d")
        chains.append({"expiry": exp, "T": T, "calls": pd.DataFrame(rows_c), "puts": pd.DataFrame(rows_p)})
    return chains, spot
