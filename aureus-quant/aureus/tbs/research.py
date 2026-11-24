"""TBS quantitative research module.

The strategy rules (Daily CRT → 4H CRT → AMD → 5M TBS confirmation → LTF
execution) are *recorded* in the journal by the trader. This module does not
re-define or alter them; it only partitions recorded trades into the three
research datasets and evaluates them.

Dataset definitions (explicit, so they can be audited):
    A  Overall TBS            : every closed trade with tbs_confirmed ≠ False
    B  TBS + Daily CRT        : A ∧ Daily CRT bias agrees with trade direction
                                (bullish ↔ long, bearish ↔ short)
    C  TBS + Daily CRT + AMD  : B ∧ amd_aligned = True

Filter-value tests compare each subset against its *complement* inside the
parent set (B vs A∖B, C vs B∖C). Comparing B against A directly would be
invalid because B ⊂ A (the samples overlap).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..core import MIN_SAMPLE, InsufficientData, Result
from ..stats import engine as st

DATASETS = {
    "A": "Overall TBS",
    "B": "TBS + Daily CRT",
    "C": "TBS + Daily CRT + AMD",
}


def _bias_matches(bias: pd.Series, direction: pd.Series) -> pd.Series:
    b = bias.fillna("none").astype(str).str.lower()
    return ((b == "bullish") & (direction == "long")) | ((b == "bearish") & (direction == "short"))


def partition(j: pd.DataFrame) -> dict[str, pd.DataFrame]:
    closed = j[j["r_net"].notna()] if "r_net" in j.columns else j[j["r_gross"].notna()]
    a = closed[closed["tbs_confirmed"].ne(False)]
    daily_ok = _bias_matches(a["daily_crt"], a["direction"])
    b = a[daily_ok]
    c = b[b["amd_aligned"].eq(True)]
    return {"A": a, "B": b, "C": c, "A_not_B": a[~daily_ok], "B_not_C": b[~b["amd_aligned"].eq(True)]}


def r_col(j: pd.DataFrame, net: bool = True) -> str:
    return "r_net" if net and "r_net" in j.columns else "r_gross"


def max_drawdown_r(r: np.ndarray) -> tuple[float, int, int]:
    """Peak-to-trough drop of the cumulative-R equity curve (starting at 0)."""
    eq = np.concatenate([[0.0], np.cumsum(r)])
    peak = np.maximum.accumulate(eq)
    dd = eq - peak
    trough = int(dd.argmin())
    pk = int(eq[: trough + 1].argmax())
    return float(-dd.min()), pk, trough


def longest_streak(r: np.ndarray, losing: bool = True) -> int:
    best = cur = 0
    for x in r:
        if (x < 0) if losing else (x > 0):
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


def metrics(df: pd.DataFrame, *, label: str, net: bool = True) -> Result:
    col = r_col(df, net)
    r = df[col].dropna().to_numpy(float)
    n = len(r)
    if n == 0:
        raise InsufficientData(f"{label}: no closed trades")
    wins, losses = r[r > 0], r[r < 0]
    gp, gl = wins.sum(), -losses.sum()
    k = len(wins)
    wlo, whi = st.wilson_ci(k, n)
    mean = r.mean()
    std = r.std(ddof=1) if n > 1 else np.nan
    if n >= 5:
        blo, bhi, _ = st.bootstrap_ci(r)
    else:
        blo = bhi = np.nan
    mdd, _, _ = max_drawdown_r(r)
    avg_win = wins.mean() if k else 0.0
    avg_loss = -losses.mean() if len(losses) else 0.0
    breakeven_wr = avg_loss / (avg_win + avg_loss) if (avg_win + avg_loss) > 0 else np.nan
    dollars = (df[col] * df["risk_dollars"]).dropna() if "risk_dollars" in df.columns else pd.Series(dtype=float)
    val = {
        "n": n, "wins": k, "losses": int(len(losses)), "breakeven_trades": int((r == 0).sum()),
        "win_rate": k / n, "win_rate_ci95": [wlo, whi],
        "avg_r": mean, "median_r": float(np.median(r)),
        "expected_value_r": mean, "ev_ci95": [blo, bhi],
        "expected_value_usd": float(dollars.mean()) if len(dollars) else None,
        "std_r": std, "variance_r": std ** 2 if n > 1 else np.nan,
        "profit_factor": gp / gl if gl > 0 else (np.inf if gp > 0 else np.nan),
        "avg_win_r": avg_win, "avg_loss_r": avg_loss,
        "payoff_ratio": avg_win / avg_loss if avg_loss > 0 else np.nan,
        "breakeven_win_rate": breakeven_wr,
        "max_drawdown_r": mdd, "longest_losing_streak": longest_streak(r),
        "total_r": float(r.sum()), "sqn": float(np.sqrt(n) * mean / std) if n > 1 and std > 0 else np.nan,
        "r_basis": "net of costs" if col == "r_net" else "gross (before costs)",
    }
    lims = []
    if n < MIN_SAMPLE:
        lims.append(f"n={n} < {MIN_SAMPLE}: win rate and EV estimates are highly uncertain.")
    if col == "r_gross":
        lims.append("R is gross of commissions/slippage — apply a cost model before drawing conclusions.")
    lims.append("Max drawdown is path-dependent: it is one realisation, not a forecast. See Monte Carlo in Risk Analytics.")
    prov = df["provenance"].iloc[0] if "provenance" in df.columns and len(df) else "HISTORICAL"
    return Result(
        name=f"TBS performance — {label}", provenance=prov,
        measures="Win rate, R distribution, expectancy, dispersion, profit factor and drawdown",
        data=f"{label}: {n} closed trades from the trade journal ({val['r_basis']})",
        method=("win rate = wins/n (Wilson 95% CI); EV = mean R (bootstrap 95% CI, 10k resamples); "
                "PF = Σwins/|Σlosses|; s = sample std (n−1); MaxDD = max(peak − cumR); "
                "break-even WR = avg loss/(avg win + avg loss); SQN = √n·x̄/s"),
        value=val,
        interpretation=(f"EV {mean:+.3f}R per trade (95% CI {blo:+.3f} to {bhi:+.3f}), win rate {k/n:.1%} "
                        f"vs break-even {breakeven_wr:.1%}, PF {val['profit_factor']:.2f}, MaxDD {mdd:.2f}R."
                        + (" CI includes zero — edge not established." if not (blo > 0) else " CI excludes zero.")),
        n=n, limitations=lims,
    )


def compare_datasets(j: pd.DataFrame, *, net: bool = True) -> dict:
    """Full A/B/C comparison: metrics per set, filter-value tests with Holm
    correction, and edge-significance per set."""
    parts = partition(j)
    col = r_col(j, net)
    out: dict = {"definitions": DATASETS, "metrics": {}, "edge_tests": {}, "filter_tests": {}, "notes": []}
    for key in ("A", "B", "C"):
        try:
            out["metrics"][key] = metrics(parts[key], label=f"{key} · {DATASETS[key]}", net=net).to_dict()
        except InsufficientData as e:
            out["metrics"][key] = {"error": str(e)}
        try:
            out["edge_tests"][key] = st.test_mean_greater_than_zero(
                parts[key][col], label=DATASETS[key], data=f"Dataset {key}").to_dict()
        except InsufficientData as e:
            out["edge_tests"][key] = {"error": str(e)}

    pvals = {}
    for name, (sub, comp, desc) in {
        "daily_crt_filter": ("B", "A_not_B", "Daily CRT alignment (B vs A∖B)"),
        "amd_filter": ("C", "B_not_C", "AMD alignment given Daily CRT (C vs B∖C)"),
    }.items():
        try:
            res = st.permutation_diff_test(parts[sub][col], parts[comp][col],
                                           label_a=sub, label_b=comp.replace("_not_", "∖"),
                                           data=desc)
            out["filter_tests"][name] = res.to_dict()
            pvals[name] = res.value["p_permutation"]
        except InsufficientData as e:
            out["filter_tests"][name] = {"error": f"{desc}: {e}"}
    if pvals:
        out["multiple_comparison"] = st.holm_bonferroni(pvals)
        out["notes"].append("p-values are Holm–Bonferroni adjusted across the filter tests performed.")
    out["notes"].append(
        "A filter that raises win rate but reduces n can still lower total R and widen CIs. "
        "Judge filters on EV with CI, and on out-of-sample stability (see rolling EV & walk-forward).")
    return out


def rolling_ev(j: pd.DataFrame, window: int = 30, net: bool = True) -> pd.DataFrame:
    col = r_col(j, net)
    s = j.set_index("entry_time")[col].dropna()
    return pd.DataFrame({
        "rolling_ev": s.rolling(window, min_periods=window).mean(),
        "rolling_std": s.rolling(window, min_periods=window).std(),
        "cum_r": s.cumsum(),
    })


def deterioration_test(j: pd.DataFrame, recent: int = 30, net: bool = True) -> Result:
    """Has performance deteriorated? Compare the most recent ``recent`` trades
    against all earlier trades (one-sided permutation: recent < earlier) and run
    a CUSUM on R to locate a possible change point."""
    col = r_col(j, net)
    r = j[col].dropna().to_numpy(float)
    if len(r) < recent + 10:
        raise InsufficientData(f"Need ≥{recent + 10} trades to compare the last {recent} with history")
    early, late = r[:-recent], r[-recent:]
    res = st.permutation_diff_test(early, late, label_a="earlier", label_b=f"last {recent}", data="chronological split")
    cusum = np.cumsum(r - r.mean())
    cp = int(np.argmax(np.abs(cusum)))
    res.name = "Performance deterioration test"
    res.measures = f"Whether the last {recent} trades have a lower mean R than the earlier record"
    res.details = {"cusum": cusum.tolist(), "max_cusum_index": cp,
                   "max_cusum_trade_date": str(j["entry_time"].iloc[cp]) if cp < len(j) else None}
    res.interpretation = (f"Earlier mean {early.mean():+.3f}R vs recent {late.mean():+.3f}R. "
                          + ("Recent performance is significantly worse (p<0.05)." if res.value["p_permutation"] < 0.05
                             else "No statistically significant deterioration detected."))
    res.limitations.append("The window length is a research choice; test several and avoid cherry-picking.")
    return res


def breakdown(j: pd.DataFrame, by: str, net: bool = True) -> pd.DataFrame:
    col = r_col(j, net)
    rows = []
    for k, g in j.dropna(subset=[col]).groupby(by, dropna=False):
        r = g[col].to_numpy(float)
        n = len(r)
        lo, hi = st.wilson_ci(int((r > 0).sum()), n)
        rows.append({by: str(k), "n": n, "win_rate": (r > 0).mean(), "wr_ci_low": lo, "wr_ci_high": hi,
                     "avg_r": r.mean(), "median_r": float(np.median(r)),
                     "std_r": r.std(ddof=1) if n > 1 else np.nan,
                     "sem": r.std(ddof=1) / np.sqrt(n) if n > 1 else np.nan,
                     "reliable": n >= MIN_SAMPLE})
    return pd.DataFrame(rows)
