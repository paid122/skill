"""Risk analytics. Two clearly separated families:

* OBSERVED — computed directly from the recorded trade sequence.
* THEORETICAL — model-based (Monte Carlo / analytic) under stated assumptions.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..core import InsufficientData, Result
from ..stats.engine import RNG_SEED
from ..tbs.research import longest_streak, max_drawdown_r


def observed(r, *, label: str = "trades") -> Result:
    a = np.asarray(pd.Series(r).dropna(), float)
    n = len(a)
    if n < 5:
        raise InsufficientData("Need ≥5 trades")
    mdd, pk, tr = max_drawdown_r(a)
    eq = np.concatenate([[0.0], np.cumsum(a)])
    dd = eq - np.maximum.accumulate(eq)
    # drawdown episodes
    episodes, cur = [], 0.0
    for v in dd:
        if v < 0:
            cur = min(cur, v)
        elif cur < 0:
            episodes.append(-cur)
            cur = 0.0
    if cur < 0:
        episodes.append(-cur)
    var95 = -np.percentile(a, 5)
    cvar95 = -a[a <= np.percentile(a, 5)].mean()
    losses = a[a < 0]
    val = {
        "expected_value_r": a.mean(),
        "expected_loss_r": losses.mean() if len(losses) else 0.0,
        "prob_loss": (a < 0).mean(),
        "max_drawdown_r": mdd, "max_dd_peak_trade": pk, "max_dd_trough_trade": tr,
        "longest_losing_streak": longest_streak(a),
        "longest_winning_streak": longest_streak(a, losing=False),
        "recovery_factor": a.sum() / mdd if mdd > 0 else np.inf,
        "equity_volatility_r": a.std(ddof=1),
        "var95_r": var95, "cvar95_r": cvar95,
        "worst_trade_r": a.min(), "best_trade_r": a.max(),
        "drawdown_episodes_r": episodes,
        "time_under_water_pct": float((dd < 0).mean() * 100),
    }
    return Result(
        name=f"Observed risk — {label}", measures="Realised loss, drawdown, streak and tail-risk metrics",
        data=f"{n} recorded trades in chronological order",
        method=("Equity = cumulative R; DD = equity − running peak; recovery factor = ΣR / MaxDD; "
                "VaR95 = −5th percentile of trade R; CVaR95 = −mean(R | R ≤ 5th pct) (historical)"),
        value=val,
        interpretation=(f"Worst observed peak-to-trough {mdd:.2f}R, longest losing streak {val['longest_losing_streak']}, "
                        f"historical CVaR95 {cvar95:.2f}R per trade."),
        n=n, provenance="HISTORICAL (observed)",
        limitations=["One historical path only; future drawdowns can exceed the observed maximum.",
                     "Per-trade VaR/CVaR with few tail observations is imprecise."],
    )


def monte_carlo(r, *, risk_pct: float = 1.0, ruin_dd_pct: float = 30.0, n_trades: int | None = None,
                n_sims: int = 10000, block: int = 1, seed: int = RNG_SEED) -> Result:
    """Bootstrap the R sequence to estimate the distribution of drawdowns and
    the probability of ruin.

    Assumptions (stated, not hidden):
      • future trades are drawn from the empirical R distribution (i.i.d. if
        block=1; stationary block bootstrap preserves short-range dependence);
      • fixed-fractional sizing: each trade risks ``risk_pct``% of current equity;
      • ruin = equity falling ``ruin_dd_pct``% below its running peak.
    """
    a = np.asarray(pd.Series(r).dropna(), float)
    if len(a) < 20:
        raise InsufficientData("Need ≥20 trades for a meaningful bootstrap")
    n_trades = n_trades or len(a)
    rng = np.random.default_rng(seed)
    if block <= 1:
        draws = a[rng.integers(0, len(a), (n_sims, n_trades))]
    else:
        draws = np.empty((n_sims, n_trades))
        for s in range(n_sims):
            out, i = [], 0
            while len(out) < n_trades:
                st = rng.integers(0, len(a))
                L = rng.geometric(1 / block)
                out.extend(a[(st + np.arange(L)) % len(a)])
            draws[s] = out[:n_trades]
    f = risk_pct / 100
    growth = np.clip(1 + f * draws, 1e-9, None)
    eq = np.cumprod(growth, axis=1)
    eq = np.concatenate([np.ones((n_sims, 1)), eq], axis=1)
    peak = np.maximum.accumulate(eq, axis=1)
    dd_pct = (1 - eq / peak) * 100
    max_dd = dd_pct.max(axis=1)
    ruined = (max_dd >= ruin_dd_pct).mean()
    final = (eq[:, -1] - 1) * 100
    r_dd = np.array([max_drawdown_r(row)[0] for row in draws[: min(n_sims, 5000)]])
    streaks = np.array([longest_streak(row) for row in draws[: min(n_sims, 5000)]])
    val = {
        "prob_ruin": float(ruined),
        "max_dd_pct_median": float(np.median(max_dd)), "max_dd_pct_p95": float(np.percentile(max_dd, 95)),
        "max_dd_pct_p99": float(np.percentile(max_dd, 99)),
        "max_dd_r_median": float(np.median(r_dd)), "max_dd_r_p95": float(np.percentile(r_dd, 95)),
        "losing_streak_median": float(np.median(streaks)), "losing_streak_p95": float(np.percentile(streaks, 95)),
        "final_return_pct_p5": float(np.percentile(final, 5)), "final_return_pct_median": float(np.median(final)),
        "final_return_pct_p95": float(np.percentile(final, 95)), "prob_loss_over_horizon": float((final < 0).mean()),
        "dd_r_distribution": r_dd.tolist(),
        "assumptions": {"risk_pct_per_trade": risk_pct, "ruin_definition": f"{ruin_dd_pct}% drawdown from peak",
                        "horizon_trades": n_trades, "simulations": n_sims, "block_length": block, "seed": seed},
    }
    return Result(
        name="Monte Carlo risk (THEORETICAL)",
        measures="Distribution of drawdowns, losing streaks, horizon returns and probability of ruin",
        data=f"Bootstrap of {len(a)} recorded trade R-multiples",
        method=(f"{n_sims:,} resampled paths of {n_trades} trades; equity_t = Π(1 + f·R_i), f = {risk_pct}%; "
                f"ruin if drawdown ≥ {ruin_dd_pct}%"),
        value=val,
        interpretation=(f"Under these assumptions: P(ruin) ≈ {ruined:.2%}; 95th-pct max drawdown "
                        f"{val['max_dd_pct_p95']:.1f}% ({val['max_dd_r_p95']:.1f}R); 95th-pct losing streak "
                        f"{val['losing_streak_p95']:.0f}."),
        n=len(a), provenance="SIMULATED (theoretical, from historical R)",
        limitations=["Assumes the past R distribution persists; a decaying edge makes these estimates optimistic.",
                     "i.i.d. resampling destroys serial dependence unless block > 1."],
    )


def analytic_risk_of_ruin(win_rate: float, payoff: float, risk_units: int) -> Result:
    """Classical gambler's-ruin approximation for fixed-size bets.
    RoR = ((1−edge)/(1+edge))^units, edge = p·b − q (in units of risk), valid
    only for a binary win/loss game with constant payoff."""
    p, q = win_rate, 1 - win_rate
    edge = p * payoff - q
    if edge <= 0:
        ror = 1.0
    else:
        ror = ((1 - edge) / (1 + edge)) ** risk_units if edge < 1 else 0.0
    return Result(
        name="Analytic risk of ruin (THEORETICAL)", measures="Probability of losing N risk units before recovering",
        data=f"win rate {p:.3f}, payoff {payoff:.2f}R, capital = {risk_units} units of risk",
        method="RoR ≈ ((1−E)/(1+E))^N, E = p·b − q",
        value={"risk_of_ruin": ror, "edge_per_unit": edge}, interpretation=f"RoR ≈ {ror:.2%}",
        provenance="SIMULATED (theoretical)",
        limitations=["Binary-outcome approximation; real R-distributions are not two-valued. Prefer the Monte Carlo estimate."],
    )
