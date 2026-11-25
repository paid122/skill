"""Volatility models: GARCH(1,1) forecast, realised-volatility cone, implied
vs realised (volatility risk premium) and cross-asset correlations."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize

ANN = 252


def garch11(returns: pd.Series) -> dict:
    """Gaussian GARCH(1,1) by maximum likelihood on daily log returns (%):
        σ²_t = ω + α·ε²_{t−1} + β·σ²_{t−1}
    Forecast h days ahead: σ²_{t+h} = V_L + (α+β)^{h−1}(σ²_{t+1} − V_L), V_L = ω/(1−α−β)."""
    r = returns.dropna().to_numpy() * 100
    r = r - r.mean()
    n = len(r)
    if n < 250:
        raise ValueError(f"GARCH needs ≥250 daily returns (have {n})")
    v0 = r.var()

    def nll(p):
        w, a, b = p
        if w <= 0 or a < 0 or b < 0 or a + b >= 0.999:
            return 1e10
        s2 = np.empty(n)
        s2[0] = v0
        for t in range(1, n):
            s2[t] = w + a * r[t - 1] ** 2 + b * s2[t - 1]
        return 0.5 * np.sum(np.log(2 * np.pi * s2) + r ** 2 / s2)

    res = minimize(nll, x0=[v0 * 0.05, 0.05, 0.9], method="Nelder-Mead", options={"maxiter": 4000, "xatol": 1e-8, "fatol": 1e-8})
    w, a, b = res.x
    s2 = np.empty(n)
    s2[0] = v0
    for t in range(1, n):
        s2[t] = w + a * r[t - 1] ** 2 + b * s2[t - 1]
    nxt = w + a * r[-1] ** 2 + b * s2[-1]
    vl = w / (1 - a - b)
    pers = a + b

    def ann_vol_over(h):  # average variance over next h days, annualised %
        var = [vl + pers ** (k - 1) * (nxt - vl) for k in range(1, h + 1)]
        return float(np.sqrt(np.mean(var) * ANN))

    return {"omega": float(w), "alpha": float(a), "beta": float(b), "persistence": float(pers),
            "half_life_days": float(np.log(0.5) / np.log(pers)) if 0 < pers < 1 else None,
            "long_run_vol_pct": float(np.sqrt(vl * ANN)),
            "forecast_vol_pct": {"1d": ann_vol_over(1), "5d": ann_vol_over(5), "21d": ann_vol_over(21)},
            "conditional_vol_pct": (np.sqrt(s2 * ANN)).tolist()[-500:], "n": n, "converged": bool(res.success),
            "method": "Gaussian GARCH(1,1), MLE (Nelder–Mead) on de-meaned daily log returns"}


def vol_cone(close: pd.Series, windows=(5, 10, 21, 63, 126)) -> dict:
    r = np.log(close).diff().dropna()
    out = []
    for w in windows:
        rv = r.rolling(w).std() * np.sqrt(ANN) * 100
        rv = rv.dropna()
        if len(rv) < 30:
            continue
        q = np.percentile(rv, [5, 25, 50, 75, 95])
        cur = float(rv.iloc[-1])
        out.append({"window": w, "p5": q[0], "p25": q[1], "p50": q[2], "p75": q[3], "p95": q[4], "current": cur,
                    "pct_rank": float((rv <= cur).mean() * 100)})
    return {"cone": out, "note": "Realised volatility (annualised %) over each window vs its own history."}


def iv_context(gvz: pd.Series | None, close: pd.Series) -> dict | None:
    """IV rank/percentile from CBOE ^GVZ (30-day gold IV, from GLD options) and
    the volatility risk premium VRP = IV − realised 21-day vol."""
    if gvz is None or len(gvz.dropna()) < 60:
        return None
    g = gvz.dropna()
    last1y = g[g.index >= g.index[-1] - pd.Timedelta(days=365)]
    cur = float(g.iloc[-1])
    rv21 = float(np.log(close).diff().dropna().iloc[-21:].std() * np.sqrt(ANN) * 100)
    return {"gvz": cur, "as_of": g.index[-1].isoformat(),
            "iv_rank_1y": float((cur - last1y.min()) / (last1y.max() - last1y.min()) * 100) if last1y.max() > last1y.min() else None,
            "iv_percentile_1y": float((last1y <= cur).mean() * 100),
            "rv21": rv21, "vrp": cur - rv21,
            "history": {"t": [t.isoformat() for t in last1y.index], "gvz": last1y.tolist()},
            "note": "IV rank = (IV − 1y low)/(1y high − 1y low). VRP > 0: options price more volatility than recently realised."}


def cross_asset(mgc_daily: pd.Series, others: dict[str, pd.Series], window: int = 60) -> dict:
    """Rolling correlation and beta of MGC daily returns to each series's daily
    change (DXY % change, 10y yield change in bp). Correlation ≠ causation."""
    m = np.log(mgc_daily).diff()
    out = {}
    for name, s in others.items():
        if s is None or len(s.dropna()) < window + 5:
            continue
        x = s.diff() if name == "US10Y" else np.log(s).diff()
        df = pd.concat([m, x], axis=1, keys=["m", "x"]).dropna()
        if len(df) < window + 5:
            continue
        corr = df["m"].rolling(window).corr(df["x"]).dropna()
        cov = df["m"].rolling(window).cov(df["x"])
        beta = (cov / df["x"].rolling(window).var()).dropna()
        full_r = float(df["m"].corr(df["x"]))
        n = len(df)
        t = full_r * np.sqrt((n - 2) / (1 - full_r ** 2)) if abs(full_r) < 1 else np.inf
        from scipy.stats import t as tdist
        out[name] = {"corr_now": float(corr.iloc[-1]), "beta_now": float(beta.iloc[-1]), "corr_full": full_r, "n": n,
                     "p_full": float(2 * tdist.sf(abs(t), n - 2)),
                     "unit": "per 1bp yield change" if name == "US10Y" else "per 1% change",
                     "series": {"t": [i.isoformat() for i in corr.index[-500:]], "corr": corr.iloc[-500:].tolist()}}
    return out
