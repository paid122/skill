"""Quant research assistant.

A deterministic intent router: each recognised question maps to a concrete
calculation on the imported data and returns the full explanation (method,
sample size, limitations). It never answers from opinion — if the data needed
is missing it says so.
"""
from __future__ import annotations

import re

import numpy as np

from ..core import MIN_SAMPLE, InsufficientData, Result
from ..regime.classifier import regime_performance
from ..stats import engine as st
from ..tbs import research as tbs
from ..workspace import Workspace

INTENTS: list[tuple[str, str]] = [
    (r"volatility percentile|vol percentile|current volatility|volatility (unusually|high|low)|is .*volatil", "vol_pct"),
    (r"range.*(new york|ny|london|asia|session)|(new york|ny|session).*range", "session_range"),
    (r"(highest|best|which conditions).*(ev|expect|perform)|conditions", "best_conditions"),
    (r"significan|real edge|edge .*(real|luck|chance)|statistically", "edge_sig"),
    (r"losing trades|losses distribution|distribution of los", "loss_dist"),
    (r"stab(le|ility)", "ev_stability"),
    (r"deteriorat|getting worse|decay|declin", "deterioration"),
    (r"\bamd\b", "amd_value"),
    (r"daily crt|crt (filter|alignment)", "crt_value"),
    (r"regime", "regimes"),
    (r"drawdown|ruin|risk", "risk"),
    (r"summary|overview|compare|a/b/c|datasets", "compare"),
]

HELP = [
    "What is the current MGC1! volatility percentile?",
    "Is current volatility unusually high?",
    "What is the average MGC1! range during New York?",
    "Which conditions have historically produced the highest TBS expected value?",
    "Is my TBS edge statistically significant?",
    "What is the distribution of losing trades?",
    "How stable is my expected value?",
    "Has my strategy performance deteriorated?",
    "Does AMD alignment provide additional predictive information?",
    "How does my strategy perform across different volatility regimes?",
]


def answer(q: str, ws: Workspace) -> dict:
    ql = q.lower()
    intent = next((name for pat, name in INTENTS if re.search(pat, ql)), None)
    if intent is None:
        return {"intent": None, "text": "I can only answer questions I can compute from your data. Try one of these:",
                "suggestions": HELP, "results": []}
    try:
        results = HANDLERS[intent](ws)
    except InsufficientData as e:
        return {"intent": intent, "text": f"Cannot answer yet — {e}", "results": []}
    if isinstance(results, Result):
        results = [results]
    sim = ws.simulated_inputs()
    if sim:
        for r in results:
            r.provenance = "SIMULATED"
            r.limitations.insert(0, f"Computed on SIMULATED input ({', '.join(sim)}) — not real market or trade data.")
    return {"intent": intent, "text": "\n\n".join(r.explain() for r in results),
            "results": [r.to_dict() for r in results]}


def _A(ws: Workspace):
    return tbs.partition(ws.journal)["A"]


def _vol(ws):
    return ws.volatility_percentile()


def _range(ws):
    return ws.session_ranges()


def _edge(ws):
    a = _A(ws)
    r = st.test_mean_greater_than_zero(a["r_net"], label="Overall TBS (net of costs)", data="Dataset A")
    wins = int((a["r_net"] > 0).sum())
    m = tbs.metrics(a, label="A · Overall TBS")
    b = st.bayesian_win_rate(wins, len(a), breakeven=m.value["breakeven_win_rate"], data="Dataset A")
    return [r, b]


def _loss(ws):
    a = _A(ws)
    losers = a.loc[a["r_net"] < 0, "r_net"]
    out = [st.describe(losers, label="losing trades (R, net)", data=f"{len(losers)} losing trades from dataset A")]
    if a["mae_r"].notna().sum() >= 5:
        out.append(st.describe(a.loc[a["r_net"] < 0, "mae_r"], label="MAE of losing trades (R)", data="journal MAE"))
    return out


def _stability(ws):
    a = _A(ws).sort_values("entry_time")
    r = a["r_net"].to_numpy(float)
    n = len(r)
    if n < 40:
        raise InsufficientData(f"Need ≥40 trades to assess stability; have {n}")
    w = max(20, n // 5)
    roll = np.convolve(r, np.ones(w) / w, mode="valid")
    halves = np.array_split(r, 4)
    q = [float(h.mean()) for h in halves]
    res = Result(
        name="Expected-value stability",
        measures="How much the mean R changes over time",
        data=f"{n} chronologically ordered trades (dataset A, net)",
        method=f"Rolling {w}-trade mean R; mean R per chronological quartile; dispersion of rolling EV",
        value={"window": w, "rolling_ev_min": float(roll.min()), "rolling_ev_max": float(roll.max()),
               "rolling_ev_std": float(roll.std()), "quartile_means": q,
               "share_of_windows_positive": float((roll > 0).mean())},
        interpretation=(f"Rolling EV ranged {roll.min():+.2f}R to {roll.max():+.2f}R; {(roll>0).mean():.0%} of windows were positive. "
                        f"Quartile means: {', '.join(f'{x:+.2f}' for x in q)}R."),
        n=n, limitations=["Overlapping windows are highly correlated; treat rolling EV as descriptive, not as independent tests."],
    )
    out = [res]
    try:
        out.append(st.autocorrelation(r, label="trade R sequence", data="dataset A, net", lags=min(10, n // 5)))
    except InsufficientData:
        pass
    return out


def _deter(ws):
    a = _A(ws)
    return tbs.deterioration_test(a, recent=min(30, max(10, len(a) // 4)))


def _filter(ws, key):
    cmp = tbs.compare_datasets(ws.journal)
    ft = cmp["filter_tests"][key]
    if "error" in ft:
        raise InsufficientData(ft["error"])
    r = Result(**{k: ft[k] for k in ["name", "measures", "data", "method", "value", "interpretation", "n", "provenance", "limitations", "details"]})
    if "multiple_comparison" in cmp and key in cmp["multiple_comparison"]:
        h = cmp["multiple_comparison"][key]
        r.interpretation += f" Holm-adjusted p = {h['p_holm']:.4f}."
    return r


def _regimes(ws):
    j = ws.journal
    if "regime" not in j.columns:
        raise InsufficientData("Import candle data so trades can be tagged with the regime at entry")
    perf = regime_performance(j)
    return Result(
        name="TBS performance by volatility regime",
        measures="Win rate, mean R and dispersion of TBS trades in each measurable regime",
        data=f"{int(j['regime'].notna().sum())} trades tagged with the regime of the last completed bar before entry",
        method="Regime from ATR percentile, ER20 and ATR change (see regime parameters); per-regime mean ± SE",
        value=perf.to_dict(orient="records"),
        interpretation="; ".join(f"{r['name']}: n={r['n']}, {r['verdict']}" for r in perf.to_dict(orient="records") if r["n"]),
        n=int(perf["n"].sum()),
        limitations=[f"Regimes with n < {MIN_SAMPLE} are marked 'insufficient data' — no advantage is claimed.",
                     "Six regimes = six comparisons; expect ~1 in 20 spurious 'significant' results."],
    )


def _best(ws):
    j = ws.journal
    rows = []
    for col in ["session", "weekday", "daily_crt", "h4_crt", "amd_aligned", "regime_name", "news"]:
        if col in j.columns and j[col].notna().any():
            b = tbs.breakdown(j, col)
            for _, r in b.iterrows():
                rows.append({"factor": col, "level": r[col], "n": int(r["n"]), "avg_r": float(r["avg_r"]),
                             "sem": float(r["sem"]) if r["sem"] == r["sem"] else None, "reliable": bool(r["reliable"])})
    rel = sorted([r for r in rows if r["reliable"]], key=lambda r: -r["avg_r"])
    return Result(
        name="Conditions ranked by historical TBS expected value",
        measures="Mean net R of TBS trades within each level of each recorded condition",
        data=f"{len(j)} journal trades",
        method="Group-by mean R ± standard error; only groups with n ≥ 30 are ranked",
        value={"ranked_reliable": rel[:10], "all": rows},
        interpretation=("Top (n≥30): " + "; ".join(f"{r['factor']}={r['level']} {r['avg_r']:+.2f}R (n={r['n']})" for r in rel[:3])) if rel
                       else f"No condition has ≥{MIN_SAMPLE} trades yet — no ranking is statistically meaningful.",
        n=len(j),
        limitations=["Ranking many groups and picking the best is a multiple-comparisons problem: the top group's EV is biased upward.",
                     "Validate any chosen condition out-of-sample before trading it."],
    )


def _risk(ws):
    from ..risk.analytics import monte_carlo, observed
    a = _A(ws)
    out = [observed(a["r_net"], label="dataset A (net)")]
    try:
        out.append(monte_carlo(a["r_net"], n_sims=5000))
    except InsufficientData:
        pass
    return out


def _compare(ws):
    cmp = tbs.compare_datasets(ws.journal)
    out = []
    for k in "ABC":
        m = cmp["metrics"][k]
        if "error" not in m:
            out.append(Result(**{x: m[x] for x in ["name", "measures", "data", "method", "value", "interpretation", "n", "provenance", "limitations", "details"]}))
    if not out:
        raise InsufficientData("No closed TBS trades")
    return out


HANDLERS = {
    "vol_pct": _vol, "session_range": _range, "edge_sig": _edge, "loss_dist": _loss,
    "ev_stability": _stability, "deterioration": _deter,
    "amd_value": lambda ws: _filter(ws, "amd_filter"), "crt_value": lambda ws: _filter(ws, "daily_crt_filter"),
    "regimes": _regimes, "best_conditions": _best, "risk": _risk, "compare": _compare,
}
