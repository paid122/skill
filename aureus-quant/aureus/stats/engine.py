"""Advanced statistical engine: descriptive stats, probability, time series and
hypothesis testing. Every public function returns a :class:`Result` (or a dict
of them) so the calculation is always explained."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sps

from ..core import MIN_SAMPLE, InsufficientData, Provenance, Result

RNG_SEED = 20261124  # fixed seed → reproducible bootstrap/permutation results


def _arr(x) -> np.ndarray:
    a = np.asarray(pd.Series(x).dropna(), dtype=float)
    return a


def _small(n: int) -> list[str]:
    return [f"Small sample (n={n} < {MIN_SAMPLE}): estimates are unstable and CIs are wide."] if n < MIN_SAMPLE else []


# ------------------------------------------------------------ descriptive --

def describe(x, *, label: str, data: str, unit: str = "R", provenance=Provenance.HISTORICAL) -> Result:
    a = _arr(x)
    n = len(a)
    if n < 2:
        raise InsufficientData(f"{label}: need ≥2 observations, have {n}")
    q1, q3 = np.percentile(a, [25, 75])
    vals, counts = np.unique(np.round(a, 2), return_counts=True)
    mode = float(vals[counts.argmax()]) if counts.max() > 1 else None
    d = {
        "n": n,
        "mean": float(a.mean()),
        "median": float(np.median(a)),
        "mode": mode,
        "variance": float(a.var(ddof=1)),
        "std": float(a.std(ddof=1)),
        "skewness": float(sps.skew(a, bias=False)),
        "excess_kurtosis": float(sps.kurtosis(a, bias=False)),
        "min": float(a.min()),
        "p5": float(np.percentile(a, 5)),
        "p25": float(q1),
        "p75": float(q3),
        "p95": float(np.percentile(a, 95)),
        "max": float(a.max()),
        "iqr": float(q3 - q1),
    }
    sk = d["skewness"]
    shape = "right-skewed (a few large winners dominate)" if sk > 0.5 else "left-skewed (large losses in the tail)" if sk < -0.5 else "roughly symmetric"
    tails = "fat-tailed vs. normal" if d["excess_kurtosis"] > 1 else "close to normal tails"
    return Result(
        name=f"Descriptive statistics — {label}",
        measures=f"Central tendency, dispersion and shape of {label}",
        data=data,
        method=("mean = Σx/n; median = 50th pct; s² = Σ(x−x̄)²/(n−1); s = √s²; "
                "skew = adjusted Fisher–Pearson G1; kurtosis = adjusted excess G2; IQR = Q3 − Q1"),
        value=d,
        interpretation=f"Mean {d['mean']:.3f}{unit}, median {d['median']:.3f}{unit}, s = {d['std']:.3f}{unit}. Distribution is {shape} and {tails}.",
        n=n, provenance=provenance, limitations=_small(n),
    )


# ------------------------------------------------------------ probability --

def wilson_ci(k: int, n: int, conf: float = 0.95) -> tuple[float, float]:
    if n == 0:
        return (np.nan, np.nan)
    z = sps.norm.ppf(0.5 + conf / 2)
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (c - h, c + h)


def empirical_probability(events: pd.Series, *, label: str, data: str, conf: float = 0.95) -> Result:
    e = events.dropna().astype(bool)
    n, k = len(e), int(e.sum())
    lo, hi = wilson_ci(k, n, conf)
    return Result(
        name=f"Empirical probability — {label}",
        measures=f"P({label})",
        data=data,
        method=f"p̂ = k/n; {int(conf*100)}% Wilson score interval",
        value={"p": k / n if n else np.nan, "k": k, "n": n, "ci_low": lo, "ci_high": hi},
        interpretation=f"{k}/{n} = {k/n:.1%} (CI {lo:.1%}–{hi:.1%})." if n else "No observations.",
        n=n, limitations=_small(n),
    )


def conditional_probability(a: pd.Series, given: pd.Series, *, a_label: str, b_label: str, data: str) -> Result:
    df = pd.DataFrame({"a": a, "b": given}).dropna().astype(bool)
    n = len(df)
    p_b = df["b"].mean()
    p_ab = (df["a"] & df["b"]).mean()
    p_a_given_b = p_ab / p_b if p_b > 0 else np.nan
    p_a_given_notb = (df["a"] & ~df["b"]).mean() / (1 - p_b) if p_b < 1 else np.nan
    nb = int(df["b"].sum())
    lo, hi = wilson_ci(int((df["a"] & df["b"]).sum()), nb)
    lift = p_a_given_b / df["a"].mean() if df["a"].mean() > 0 else np.nan
    return Result(
        name=f"P({a_label} | {b_label})",
        measures=f"Conditional probability of {a_label} given {b_label}, plus joint probability and lift",
        data=data,
        method="P(A|B) = P(A∩B)/P(B); joint P(A∩B) = count(A∧B)/n; lift = P(A|B)/P(A); Wilson CI on P(A|B)",
        value={"p_a": float(df["a"].mean()), "p_b": float(p_b), "p_a_and_b": float(p_ab),
               "p_a_given_b": p_a_given_b, "p_a_given_not_b": p_a_given_notb, "lift": lift,
               "ci_low": lo, "ci_high": hi, "n_b": nb},
        interpretation=(f"P({a_label}|{b_label}) = {p_a_given_b:.1%} vs P({a_label}|¬{b_label}) = {p_a_given_notb:.1%}; "
                        f"lift {lift:.2f}. Based on {nb} conditioning observations."),
        n=n, limitations=_small(nb),
    )


def bayesian_win_rate(wins: int, n: int, *, prior_a: float = 1.0, prior_b: float = 1.0,
                      breakeven: float | None = None, label: str = "win rate", data: str = "") -> Result:
    """Beta-Binomial posterior. Default prior Beta(1,1) = uniform (stated explicitly)."""
    a, b = prior_a + wins, prior_b + (n - wins)
    post = sps.beta(a, b)
    lo, hi = post.ppf([0.025, 0.975])
    val = {"posterior_mean": a / (a + b), "cred_low": lo, "cred_high": hi, "alpha": a, "beta": b}
    interp = f"Posterior mean {a/(a+b):.1%}, 95% credible interval {lo:.1%}–{hi:.1%}."
    if breakeven is not None:
        p_above = 1 - post.cdf(breakeven)
        val["breakeven"] = breakeven
        val["p_above_breakeven"] = p_above
        interp += f" P(true win rate > break-even {breakeven:.1%}) = {p_above:.1%}."
    return Result(
        name=f"Bayesian {label}", measures=f"Posterior distribution of the true {label}",
        data=data, method=f"Beta({prior_a},{prior_b}) prior × Binomial likelihood → Beta({a:.0f},{b:.0f}) posterior",
        value=val, interpretation=interp, n=n,
        limitations=_small(n) + ["Assumes trades are independent and the win probability is constant over time."],
    )


def fit_distributions(x, *, label: str, data: str) -> Result:
    a = _arr(x)
    if len(a) < 20:
        raise InsufficientData("Need ≥20 observations to compare distributions")
    out = {}
    for name, dist in {"normal": sps.norm, "student_t": sps.t, "laplace": sps.laplace}.items():
        params = dist.fit(a)
        ll = np.sum(dist.logpdf(a, *params))
        out[name] = {"params": [float(p) for p in params], "aic": float(2 * len(params) - 2 * ll),
                     "ks_p": float(sps.kstest(a, dist.cdf, args=params).pvalue)}
    best = min(out, key=lambda k: out[k]["aic"])
    jb = sps.jarque_bera(a)
    return Result(
        name=f"Distribution fit — {label}", measures="Which parametric family best describes the data",
        data=data, method="MLE fit; AIC = 2k − 2lnL; KS goodness-of-fit; Jarque–Bera normality test",
        value={"fits": out, "best_by_aic": best, "jarque_bera_p": float(jb.pvalue)},
        interpretation=(f"Best fit by AIC: {best}. Jarque–Bera p = {jb.pvalue:.4f} "
                        f"({'normality rejected' if jb.pvalue < 0.05 else 'normality not rejected'} at 5%)."),
        n=len(a), limitations=["KS p-values are optimistic when parameters are estimated from the same data."],
    )


# -------------------------------------------------------------- inference --

def bootstrap_ci(x, stat=np.mean, *, n_boot: int = 10000, conf: float = 0.95, seed: int = RNG_SEED) -> tuple[float, float, np.ndarray]:
    a = _arr(x)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(a), size=(n_boot, len(a)))
    boots = np.apply_along_axis(stat, 1, a[idx]) if stat is not np.mean else a[idx].mean(axis=1)
    lo, hi = np.percentile(boots, [(1 - conf) / 2 * 100, (1 + conf) / 2 * 100])
    return float(lo), float(hi), boots


def test_mean_greater_than_zero(r, *, label: str, data: str, n_boot: int = 10000) -> Result:
    """H0: E[R] ≤ 0 (no edge). H1: E[R] > 0. Reports t-test, bootstrap and sign-flip permutation."""
    a = _arr(r)
    n = len(a)
    if n < 5:
        raise InsufficientData(f"Need ≥5 trades, have {n}")
    t = sps.ttest_1samp(a, 0.0, alternative="greater")
    lo, hi, boots = bootstrap_ci(a, n_boot=n_boot)
    # Bootstrap p: resample from the null-shifted distribution (mean = 0)
    rng = np.random.default_rng(RNG_SEED)
    centred = a - a.mean()
    null = centred[rng.integers(0, n, size=(n_boot, n))].mean(axis=1)
    p_boot = float((np.sum(null >= a.mean()) + 1) / (n_boot + 1))
    # Sign-flip permutation (assumes symmetry under H0)
    flips = rng.choice([-1.0, 1.0], size=(n_boot, n))
    perm = (flips * a).mean(axis=1)
    p_perm = float((np.sum(perm >= a.mean()) + 1) / (n_boot + 1))
    sig = max(t.pvalue, p_boot) < 0.05
    ci_t = sps.t.interval(0.95, n - 1, loc=a.mean(), scale=sps.sem(a))
    return Result(
        name=f"Edge significance — {label}",
        measures="Whether the mean R-multiple is reliably above zero",
        data=data,
        method=("H0: μ ≤ 0, H1: μ > 0. One-sided t = x̄/(s/√n); bootstrap p from null-centred resampling "
                f"({n_boot:,} draws, seed {RNG_SEED}); sign-flip permutation p; 95% CI by t and bootstrap percentile."),
        value={"mean_R": float(a.mean()), "t_stat": float(t.statistic), "p_t": float(t.pvalue),
               "p_bootstrap": p_boot, "p_permutation": p_perm,
               "ci95_t": [float(ci_t[0]), float(ci_t[1])], "ci95_boot": [lo, hi],
               "significant_5pct": sig},
        interpretation=(
            f"Mean {a.mean():.3f}R, 95% CI [{lo:.3f}, {hi:.3f}]R (bootstrap). "
            + ("The evidence rejects 'no edge' at the 5% level." if sig else
               "The data does NOT reject 'no edge' at 5% — the observed mean could plausibly be luck.")
        ),
        n=n,
        limitations=_small(n) + [
            "Assumes trades are independent; serial correlation or clustering inflates significance.",
            "Significance is not profitability after costs unless the R values already include costs.",
            "If many filters/variants were tried, apply a multiple-comparison correction (see filter tests).",
        ],
    )


def permutation_diff_test(a, b, *, label_a: str, label_b: str, data: str, n_perm: int = 10000,
                          alternative: str = "greater") -> Result:
    """H0: groups A and B have the same mean R (labels exchangeable)."""
    x, y = _arr(a), _arr(b)
    if len(x) < 2 or len(y) < 2:
        raise InsufficientData("Both groups need ≥2 observations")
    obs = x.mean() - y.mean()
    pooled = np.concatenate([x, y])
    rng = np.random.default_rng(RNG_SEED)
    diffs = np.empty(n_perm)
    for i in range(n_perm):
        rng.shuffle(pooled)
        diffs[i] = pooled[: len(x)].mean() - pooled[len(x):].mean()
    if alternative == "greater":
        p = (np.sum(diffs >= obs) + 1) / (n_perm + 1)
    else:
        p = (np.sum(np.abs(diffs) >= abs(obs)) + 1) / (n_perm + 1)
    w = sps.mannwhitneyu(x, y, alternative="greater" if alternative == "greater" else "two-sided")
    welch = sps.ttest_ind(x, y, equal_var=False, alternative="greater" if alternative == "greater" else "two-sided")
    # bootstrap CI of the difference
    bx = x[rng.integers(0, len(x), (5000, len(x)))].mean(1)
    by = y[rng.integers(0, len(y), (5000, len(y)))].mean(1)
    lo, hi = np.percentile(bx - by, [2.5, 97.5])
    return Result(
        name=f"Mean R: {label_a} vs {label_b}",
        measures=f"Whether {label_a} has a higher mean R than {label_b} beyond chance",
        data=data,
        method=(f"Permutation test on Δ = mean(A) − mean(B), {n_perm:,} label shuffles ({alternative}); "
                "Welch t-test and Mann–Whitney U as cross-checks; bootstrap 95% CI of Δ"),
        value={"mean_a": float(x.mean()), "mean_b": float(y.mean()), "diff": float(obs),
               "n_a": len(x), "n_b": len(y), "p_permutation": float(p), "p_welch": float(welch.pvalue),
               "p_mannwhitney": float(w.pvalue), "diff_ci95": [float(lo), float(hi)]},
        interpretation=(f"Δ = {obs:+.3f}R (95% CI {lo:+.3f} to {hi:+.3f}); permutation p = {p:.4f}. "
                        + ("Difference unlikely under chance alone (p<0.05)." if p < 0.05 else
                           "Difference is consistent with chance at the 5% level.")),
        n=len(x) + len(y), limitations=_small(min(len(x), len(y))),
    )


def holm_bonferroni(pvals: dict[str, float], alpha: float = 0.05) -> dict[str, dict]:
    items = sorted(pvals.items(), key=lambda kv: kv[1])
    m = len(items)
    out, running = {}, 0.0
    for i, (k, p) in enumerate(items):
        adj = min(1.0, max(running, (m - i) * p))
        running = adj
        out[k] = {"p": p, "p_holm": adj, "reject": adj < alpha}
    return out


# ------------------------------------------------------------ time series --

def autocorrelation(x, *, label: str, data: str, lags: int = 10) -> Result:
    from statsmodels.stats.diagnostic import acorr_ljungbox
    from statsmodels.tsa.stattools import acf

    a = _arr(x)
    if len(a) < lags + 5:
        raise InsufficientData(f"Need > {lags + 5} observations")
    ac = acf(a, nlags=lags, fft=True)
    lb = acorr_ljungbox(a, lags=[lags], return_df=True)
    band = 1.96 / np.sqrt(len(a))
    p = float(lb["lb_pvalue"].iloc[0])
    return Result(
        name=f"Autocorrelation — {label}", measures="Linear dependence of the series on its own past",
        data=data, method=f"ρ_k = Σ(x_t−x̄)(x_{{t−k}}−x̄)/Σ(x_t−x̄)²; Ljung–Box Q at lag {lags}; ±1.96/√n band",
        value={"acf": [float(v) for v in ac[1:]], "band": float(band), "ljung_box_p": p,
               "significant_lags": [i + 1 for i, v in enumerate(ac[1:]) if abs(v) > band]},
        interpretation=("Significant serial dependence detected (Ljung–Box p<0.05) — independence assumptions in other tests are questionable."
                        if p < 0.05 else "No significant serial dependence detected (Ljung–Box p≥0.05)."),
        n=len(a),
    )


def stationarity(x, *, label: str, data: str) -> Result:
    from statsmodels.tsa.stattools import adfuller, kpss
    import warnings

    a = _arr(x)
    if len(a) < 30:
        raise InsufficientData("Need ≥30 observations")
    adf = adfuller(a, autolag="AIC")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        kp = kpss(a, regression="c", nlags="auto")
    stationary = adf[1] < 0.05 and kp[1] > 0.05
    return Result(
        name=f"Stationarity — {label}", measures="Whether mean/variance are stable over time",
        data=data, method="ADF (H0: unit root) and KPSS (H0: stationary) — complementary nulls",
        value={"adf_stat": float(adf[0]), "adf_p": float(adf[1]), "kpss_stat": float(kp[0]), "kpss_p": float(kp[1]),
               "conclusion": "stationary" if stationary else ("non-stationary" if adf[1] >= 0.05 and kp[1] <= 0.05 else "inconclusive")},
        interpretation=("Both tests agree the series is stationary." if stationary else
                        "Tests do not jointly support stationarity — statistics estimated over the full sample may not describe the present."),
        n=len(a), limitations=["KPSS p-values are interpolated and truncated to [0.01, 0.10]."],
    )


def decompose(series: pd.Series, period: int) -> dict:
    from statsmodels.tsa.seasonal import STL

    s = series.dropna()
    if len(s) < 2 * period + 1:
        raise InsufficientData(f"Need ≥{2 * period + 1} observations for period {period}")
    res = STL(s.to_numpy(), period=period, robust=True).fit()
    return {"trend": res.trend.tolist(), "seasonal": res.seasonal.tolist(), "resid": res.resid.tolist(),
            "index": [str(i) for i in s.index]}


def rolling_stat(x: pd.Series, window: int, fn: str = "mean") -> pd.Series:
    return getattr(x.rolling(window, min_periods=window), fn)()
