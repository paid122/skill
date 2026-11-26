"""Options positioning & implied volatility for gold, mapped to MGC1! prices.

Source: GLD (SPDR Gold Shares) listed options via Yahoo Finance — the most
liquid gold options market with free data. Gold-futures options (OG/MGC) have
no free feed. Levels are converted to MGC1! prices with the live ratio
MGC1!/GLD, so they carry basis/tracking error and a time mismatch between the
two delayed quotes. Open interest is updated once per day (previous close).

Definitions (all standard, all assumptions stated):
* Call wall / put wall — strike with the largest call / put open interest
  within the scanned expiries (above / below spot).
* Gamma exposure (GEX) per strike, $ per 1% move:
      Γ_BS · OI · 100 · S² · 0.01, calls +, puts −
  This uses the common *naive dealer* convention (customers buy calls and
  puts; dealers are short puts and long calls). Real dealer positioning is
  unobservable — treat GEX as a model output, not a fact.
* Gamma flip — spot level where total GEX changes sign (re-evaluated on a grid).
* Max pain — strike that minimises the total intrinsic value paid to option
  holders at expiry, nearest expiry only.
* ATM IV — mean of call and put IV at the strike nearest spot; IV re-derived
  from the bid/ask mid by Black–Scholes inversion where possible.
* 25-delta skew — IV(25Δ put) − IV(25Δ call).
* Expected move — S·σ_ATM·√(T); straddle-implied move = ATM call+put mid.
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.stats import norm

R = 0.04            # risk-free rate assumption (annual, continuous)
MAX_EXPIRIES = 6
MAX_DAYS = 70


def bs_price(S, K, T, sig, call=True, r=R):
    if T <= 0 or sig <= 0:
        return max(0.0, (S - K) if call else (K - S))
    d1 = (math.log(S / K) + (r + 0.5 * sig * sig) * T) / (sig * math.sqrt(T))
    d2 = d1 - sig * math.sqrt(T)
    if call:
        return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


def bs_gamma(S, K, T, sig, r=R):
    S, K, sig = np.asarray(S, float), np.asarray(K, float), np.asarray(sig, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        d1 = (np.log(S / K) + (r + 0.5 * sig ** 2) * T) / (sig * np.sqrt(T))
        g = norm.pdf(d1) / (S * sig * np.sqrt(T))
    return np.nan_to_num(g)


def bs_delta(S, K, T, sig, call=True, r=R):
    d1 = (np.log(S / K) + (r + 0.5 * sig ** 2) * T) / (sig * np.sqrt(T))
    return norm.cdf(d1) if call else norm.cdf(d1) - 1


def implied_vol(price, S, K, T, call=True):
    intrinsic = max(0.0, (S - K) if call else (K - S))
    if not (price > intrinsic + 1e-6) or T <= 0:
        return np.nan
    try:
        return brentq(lambda s: bs_price(S, K, T, s, call) - price, 1e-3, 5.0, maxiter=100)
    except ValueError:
        return np.nan


def clean_chain(calls: pd.DataFrame, puts: pd.DataFrame, S: float, T: float) -> pd.DataFrame:
    rows = []
    for df, is_call in ((calls, True), (puts, False)):
        for _, o in df.iterrows():
            bid, ask = float(o.get("bid") or 0), float(o.get("ask") or 0)
            mid = (bid + ask) / 2 if bid > 0 and ask > 0 else np.nan
            iv = implied_vol(mid, S, float(o["strike"]), T, is_call) if not np.isnan(mid) else np.nan
            if np.isnan(iv):
                y = float(o.get("impliedVolatility") or np.nan)
                iv = y if 0.03 < y < 2.0 else np.nan
            rows.append({"strike": float(o["strike"]), "type": "C" if is_call else "P",
                         "oi": float(o.get("openInterest") or 0) if pd.notna(o.get("openInterest")) else 0.0,
                         "volume": float(o.get("volume") or 0) if pd.notna(o.get("volume")) else 0.0,
                         "mid": mid, "iv": iv})
    return pd.DataFrame(rows)


def analyse_chain(chains: list[dict], S: float, mgc_ratio: float | None) -> dict:
    """chains: [{'expiry': 'YYYY-MM-DD', 'T': years, 'calls': df, 'puts': df}]"""
    to_mgc = (lambda k: None if mgc_ratio is None else float(k * mgc_ratio))
    allrows, term = [], []
    for ch in chains:
        T = ch["T"]
        c = clean_chain(ch["calls"], ch["puts"], S, T)
        if c.empty:
            continue
        c["expiry"], c["T"] = ch["expiry"], T
        allrows.append(c)
        # ATM IV & skew
        k_atm = c["strike"].iloc[(c["strike"] - S).abs().argsort().iloc[0]]
        atm = c[(c["strike"] == k_atm) & c["iv"].notna()]
        atm_iv = float(atm["iv"].mean()) if len(atm) else np.nan
        calls_, puts_ = c[(c["type"] == "C") & c["iv"].notna()], c[(c["type"] == "P") & c["iv"].notna()]
        skew = np.nan
        if len(calls_) > 2 and len(puts_) > 2:
            cd = bs_delta(S, calls_["strike"].to_numpy(), T, calls_["iv"].to_numpy(), True)
            pdl = bs_delta(S, puts_["strike"].to_numpy(), T, puts_["iv"].to_numpy(), False)
            iv_c25 = calls_["iv"].to_numpy()[np.argmin(np.abs(cd - 0.25))]
            iv_p25 = puts_["iv"].to_numpy()[np.argmin(np.abs(pdl + 0.25))]
            skew = float(iv_p25 - iv_c25)
        straddle = atm["mid"].sum() if len(atm) == 2 and atm["mid"].notna().all() else np.nan
        term.append({"expiry": ch["expiry"], "days": round(T * 365, 1), "atm_iv": atm_iv, "skew_25d": skew,
                     "atm_strike": float(k_atm), "straddle_move_pct": float(straddle / S) if straddle == straddle else None,
                     "expected_move_pct": float(atm_iv * math.sqrt(T)) if atm_iv == atm_iv else None})
    if not allrows:
        raise ValueError("Option chain empty after cleaning")
    a = pd.concat(allrows, ignore_index=True)
    a["gamma"] = bs_gamma(S, a["strike"], a["T"].to_numpy(), a["iv"].fillna(a["iv"].median()).to_numpy())
    a["gex"] = a["gamma"] * a["oi"] * 100 * S * S * 0.01 * np.where(a["type"] == "C", 1, -1)

    by = a.groupby("strike").apply(lambda g: pd.Series({
        "call_oi": g.loc[g.type == "C", "oi"].sum(), "put_oi": g.loc[g.type == "P", "oi"].sum(),
        "gex": g["gex"].sum(), "call_vol": g.loc[g.type == "C", "volume"].sum(), "put_vol": g.loc[g.type == "P", "volume"].sum()}),
        include_groups=False).reset_index()
    by = by[(by["strike"] > S * 0.8) & (by["strike"] < S * 1.2)]
    above, below = by[by["strike"] >= S], by[by["strike"] <= S]
    call_wall = float(above.loc[above["call_oi"].idxmax(), "strike"]) if len(above) and above["call_oi"].max() > 0 else None
    put_wall = float(below.loc[below["put_oi"].idxmax(), "strike"]) if len(below) and below["put_oi"].max() > 0 else None

    # gamma flip: total GEX on a spot grid
    grid = np.linspace(S * 0.9, S * 1.1, 81)
    iv_f = a["iv"].fillna(a["iv"].median()).to_numpy()
    sign = np.where(a["type"] == "C", 1, -1)
    tot = np.array([np.sum(bs_gamma(s, a["strike"].to_numpy(), a["T"].to_numpy(), iv_f) * a["oi"].to_numpy() * 100 * s * s * 0.01 * sign)
                    for s in grid])
    flip = None
    sc = np.flatnonzero(np.diff(np.sign(tot)) != 0)
    if len(sc):
        i = sc[np.argmin(np.abs(grid[sc] - S))]
        flip = float(grid[i] - tot[i] * (grid[i + 1] - grid[i]) / (tot[i + 1] - tot[i]))

    # max pain, nearest expiry
    near = a[a["expiry"] == chains[0]["expiry"]]
    ks = np.sort(near["strike"].unique())
    pain = [float(((np.maximum(k - near.loc[near.type == "C", "strike"], 0) * near.loc[near.type == "C", "oi"]).sum()
                   + (np.maximum(near.loc[near.type == "P", "strike"] - k, 0) * near.loc[near.type == "P", "oi"]).sum())) for k in ks]
    max_pain = float(ks[int(np.argmin(pain))]) if len(ks) else None

    # daily ceiling / floor: nearest expiry only — strike with the most call OI above spot
    # (ceiling) and the most put OI below spot (floor)
    nc = near[(near.type == "C") & (near.strike >= S)].groupby("strike")["oi"].sum()
    npt = near[(near.type == "P") & (near.strike <= S)].groupby("strike")["oi"].sum()
    ceiling = float(nc.idxmax()) if len(nc) and nc.max() > 0 else None
    floor_ = float(npt.idxmax()) if len(npt) and npt.max() > 0 else None

    total_gex = float(by["gex"].sum())
    pcr_oi = float(by["put_oi"].sum() / by["call_oi"].sum()) if by["call_oi"].sum() else None
    lv = {"call_wall": call_wall, "put_wall": put_wall, "gamma_flip": flip, "max_pain": max_pain,
          "ceiling": ceiling, "floor": floor_}
    return {
        "spot_gld": S, "mgc_ratio": mgc_ratio,
        "levels_gld": lv, "levels_mgc": {k: (to_mgc(v) if v is not None else None) for k, v in lv.items()},
        "total_gex_usd_per_1pct": total_gex,
        "gamma_regime": ("positive gamma (dealers dampen moves — mean-reverting tendency)" if total_gex > 0
                         else "negative gamma (dealers amplify moves — trending/volatile tendency)"),
        "put_call_oi_ratio": pcr_oi,
        "strikes": [{"strike": float(r.strike), "strike_mgc": to_mgc(r.strike), "call_oi": float(r.call_oi), "put_oi": float(r.put_oi),
                     "gex": float(r.gex), "call_vol": float(r.call_vol), "put_vol": float(r.put_vol)} for r in by.itertuples()],
        "gex_curve": {"spot_gld": grid.tolist(), "spot_mgc": [to_mgc(x) for x in grid], "total_gex": tot.tolist()},
        "term": term,
        "expiries": [c["expiry"] for c in chains],
        "assumptions": [
            "GLD options used as the proxy for gold options; levels mapped to MGC1! by the live MGC/GLD price ratio.",
            "GEX sign uses the naive dealer convention (long calls, short puts). Actual dealer positioning is unknown.",
            f"Black–Scholes with r = {R:.0%}, no dividends; IV from bid/ask mid where available.",
            "Open interest is from the previous session close; intraday changes are not visible.",
        ],
    }


def gld_spot(t) -> float:
    """Latest GLD price. yfinance's fast_info can fail with KeyError
    'currentTradingPeriod' when Yahoo throttles, so fall back to recent bars
    and finally to the stored daily close."""
    try:
        v = float(t.fast_info["last_price"])
        if v > 0:
            return v
    except Exception:  # noqa: BLE001
        pass
    try:
        h = t.history(period="5d", interval="5m", prepost=True)
        if h is not None and not h.empty:
            return float(h["Close"].dropna().iloc[-1])
    except Exception:  # noqa: BLE001
        pass
    from .store import load_aux
    s = load_aux("GLD")
    if s is not None and len(s):
        return float(s.iloc[-1])
    raise RuntimeError("Could not get a GLD price from Yahoo (rate-limited?) — will retry on the next update")


def iv30(term: list[dict]) -> float | None:
    """Constant-maturity 30-day ATM IV by linear interpolation in total variance."""
    pts = sorted((t["days"], t["atm_iv"]) for t in term if t.get("atm_iv") == t.get("atm_iv") and t.get("atm_iv"))
    if not pts:
        return None
    if len(pts) == 1 or pts[0][0] >= 30:
        return float(pts[0][1])
    for (d1, v1), (d2, v2) in zip(pts, pts[1:]):
        if d1 <= 30 <= d2:
            w1, w2 = v1 * v1 * d1, v2 * v2 * d2
            return float(math.sqrt((w1 + (w2 - w1) * (30 - d1) / (d2 - d1)) / 30))
    return float(pts[-1][1])


def fetch_gld_chains() -> tuple[list[dict], float]:
    import yfinance as yf

    t = yf.Ticker("GLD")
    spot = gld_spot(t)
    now = datetime.now(timezone.utc)
    chains = []
    for e in t.options:
        exp = datetime.strptime(e, "%Y-%m-%d").replace(hour=20, tzinfo=timezone.utc)   # ~16:00 ET
        days = (exp - now).total_seconds() / 86400
        if days <= 0.05:
            continue
        if days > MAX_DAYS or len(chains) >= MAX_EXPIRIES:
            break
        oc = t.option_chain(e)
        time.sleep(0.5)   # pace requests
        chains.append({"expiry": e, "T": days / 365, "calls": oc.calls, "puts": oc.puts})
    if not chains:
        raise RuntimeError("No GLD option expiries returned by Yahoo")
    return chains, spot
