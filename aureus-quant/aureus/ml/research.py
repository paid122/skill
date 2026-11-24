"""Optional machine-learning research module.

Design rules enforced in code:
  • Chronological ordering only — rows sorted by entry time, never shuffled.
  • Walk-forward (expanding window) validation with an embargo gap between the
    train and test folds.
  • Features are restricted to values known at entry time.
  • Every model is compared against a naive base-rate benchmark; a model that
    cannot beat the base rate out-of-sample has shown no predictive value.
  • Predicted probabilities are *never* reported as proof of an edge — only
    realised out-of-sample R of model-selected trades counts, and even that is
    subject to the same significance testing as the raw strategy.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.cluster import KMeans
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ..core import InsufficientData, Result, config_hash
from ..stats.engine import RNG_SEED

MODEL_VERSION = "ml-v1"

ALLOWED_FEATURES = [
    "atr14_at_entry", "atr_pct_rank_at_entry", "er20_at_entry", "risk_ticks",
    "daily_aligned", "h4_aligned", "amd_aligned", "is_long",
    "sess_asia", "sess_london", "sess_ny_am", "sess_ny_pm", "event_day",
    "prev_range", "volume_prev", "trend_strength",
]


def build_features(j: pd.DataFrame) -> pd.DataFrame:
    X = pd.DataFrame(index=j.index)
    d = j["direction"]

    def aligned(col):
        if col not in j.columns:
            return pd.Series(np.nan, index=j.index)
        b = j[col].fillna("none").astype(str)
        return (((b == "bullish") & (d == "long")) | ((b == "bearish") & (d == "short"))).astype(float)

    X["daily_aligned"] = aligned("daily_crt")
    X["h4_aligned"] = aligned("h4_crt")
    X["amd_aligned"] = j["amd_aligned"].astype(float) if "amd_aligned" in j else np.nan
    X["is_long"] = (d == "long").astype(float)
    for s in ["asia", "london", "ny_am", "ny_pm"]:
        X[f"sess_{s}"] = (j["session"] == s).astype(float)
    for c in ["atr14_at_entry", "atr_pct_rank_at_entry", "er20_at_entry", "risk_ticks",
              "event_day", "prev_range", "volume_prev", "trend_strength"]:
        if c in j.columns:
            X[c] = pd.to_numeric(j[c], errors="coerce").astype(float)
    if "atr" in j.columns and "atr14_at_entry" not in X:
        X["atr14_at_entry"] = j["atr"]
    X = X.loc[:, X.notna().any()]
    return X[[c for c in ALLOWED_FEATURES if c in X.columns]]


def _models() -> dict:
    return {
        "logistic": make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=1000)),
        "random_forest": RandomForestClassifier(n_estimators=300, max_depth=3, min_samples_leaf=10, random_state=RNG_SEED),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=150, max_depth=2, learning_rate=0.05,
                                                        subsample=0.8, random_state=RNG_SEED),
    }


def walk_forward(j: pd.DataFrame, *, r_col: str = "r_net", min_train: int = 60, test_size: int = 20,
                 embargo: int = 2) -> dict:
    j = j.sort_values("entry_time").dropna(subset=[r_col]).reset_index(drop=True)
    X = build_features(j)  # NaNs are filled per fold with TRAIN-only medians (no leakage)
    y = (j[r_col] > 0).astype(int).to_numpy()
    R = j[r_col].to_numpy(float)
    n = len(j)
    if n < min_train + test_size:
        raise InsufficientData(f"Walk-forward needs ≥{min_train + test_size} closed trades; have {n}. "
                               "ML on fewer trades would overfit — collect more data first.")
    params = {"min_train": min_train, "test_size": test_size, "embargo": embargo, "features": list(X.columns),
              "model_version": MODEL_VERSION, "seed": RNG_SEED}
    folds, preds = [], {m: np.full(n, np.nan) for m in _models()}
    base = np.full(n, np.nan)
    start = min_train
    while start < n:
        tr_end = start - embargo
        te = np.arange(start, min(start + test_size, n))
        Xtr, Xte = X.iloc[:tr_end], X.iloc[te]
        med = Xtr.median()
        Xtr, Xte = Xtr.fillna(med).fillna(0), Xte.fillna(med).fillna(0)
        ytr = y[:tr_end]
        base[te] = ytr.mean()
        folds.append({"train": [0, int(tr_end)], "test": [int(te[0]), int(te[-1])],
                      "train_end_date": str(j["entry_time"].iloc[tr_end - 1]),
                      "test_dates": [str(j["entry_time"].iloc[te[0]]), str(j["entry_time"].iloc[te[-1]])]})
        if len(np.unique(ytr)) < 2:
            start += test_size
            continue
        for name, mdl in _models().items():
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                mdl.fit(Xtr, ytr)
            preds[name][te] = mdl.predict_proba(Xte)[:, 1]
        start += test_size

    oos = ~np.isnan(base)
    res = {"params": params, "params_hash": config_hash(params), "folds": folds, "n_oos": int(oos.sum()), "models": {}}
    yb, Rb = y[oos], R[oos]
    base_brier = brier_score_loss(yb, base[oos])
    res["baseline"] = {"brier": base_brier, "oos_mean_r_all": float(Rb.mean()), "oos_win_rate": float(yb.mean())}
    for name, p in preds.items():
        m = oos & ~np.isnan(p)
        if m.sum() < 10 or len(np.unique(y[m])) < 2:
            res["models"][name] = {"error": "insufficient OOS predictions"}
            continue
        pm = p[m]
        sel = pm > np.median(pm)  # top half by predicted probability
        frac_pos, mean_pred = calibration_curve(y[m], pm, n_bins=5, strategy="quantile")
        res["models"][name] = {
            "auc": float(roc_auc_score(y[m], pm)),
            "brier": float(brier_score_loss(y[m], pm)),
            "brier_skill_vs_base": float(1 - brier_score_loss(y[m], pm) / brier_score_loss(y[m], base[m])),
            "log_loss": float(log_loss(y[m], np.clip(pm, 1e-6, 1 - 1e-6))),
            "oos_mean_r_selected": float(R[m][sel].mean()), "oos_n_selected": int(sel.sum()),
            "oos_mean_r_rejected": float(R[m][~sel].mean()),
            "calibration": {"mean_predicted": mean_pred.tolist(), "fraction_positive": frac_pos.tolist()},
            "predictions": [None if np.isnan(v) else float(v) for v in p],
        }
    res["warning"] = ("Predicted probabilities are model outputs, not evidence of an edge. "
                      "An AUC near 0.5 or negative Brier skill means no predictive value out-of-sample. "
                      "Any 'selected trades' improvement must be re-tested for significance and is subject "
                      "to selection bias across the models tried.")
    return res


def feature_importance(j: pd.DataFrame, *, r_col: str = "r_net", holdout_frac: float = 0.3) -> Result:
    """Permutation importance measured on a chronological holdout (last 30%)."""
    j = j.sort_values("entry_time").dropna(subset=[r_col]).reset_index(drop=True)
    X = build_features(j)
    y = (j[r_col] > 0).astype(int)
    cut = int(len(j) * (1 - holdout_frac))
    if cut < 40 or len(j) - cut < 15:
        raise InsufficientData("Need ≥~60 trades for a chronological importance estimate")
    med = X.iloc[:cut].median()
    Xtr, Xte = X.iloc[:cut].fillna(med).fillna(0), X.iloc[cut:].fillna(med).fillna(0)
    mdl = _models()["random_forest"].fit(Xtr, y.iloc[:cut])
    pi = permutation_importance(mdl, Xte, y.iloc[cut:], scoring="roc_auc", n_repeats=20, random_state=RNG_SEED, n_jobs=-1)
    imp = sorted(({"feature": c, "mean": float(m), "std": float(s)} for c, m, s in
                  zip(X.columns, pi.importances_mean, pi.importances_std)), key=lambda d: -d["mean"])
    return Result(
        name="Feature importance (permutation, OOS)", measures="Drop in holdout AUC when each feature is shuffled",
        data=f"Train first {cut} trades, evaluate last {len(j) - cut} (chronological)",
        method="Random forest (depth 3); permutation importance, 20 repeats, AUC scoring",
        value=imp,
        interpretation="Features whose importance ± std overlaps 0 carry no detectable out-of-sample information.",
        n=len(j), limitations=["Correlated features share importance; small holdouts give noisy estimates."],
    )


def psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """Population Stability Index: Σ (a−e)·ln(a/e). <0.1 stable, 0.1–0.25 moderate, >0.25 significant drift."""
    e, a = np.asarray(expected, float), np.asarray(actual, float)
    e, a = e[~np.isnan(e)], a[~np.isnan(a)]
    edges = np.unique(np.percentile(e, np.linspace(0, 100, bins + 1)))
    if len(edges) < 3:
        return 0.0
    ec = np.histogram(e, edges)[0] / len(e)
    ac = np.histogram(np.clip(a, edges[0], edges[-1]), edges)[0] / len(a)
    ec, ac = np.clip(ec, 1e-4, None), np.clip(ac, 1e-4, None)
    return float(np.sum((ac - ec) * np.log(ac / ec)))


def drift_report(j: pd.DataFrame, recent: int = 30) -> dict:
    X = build_features(j.sort_values("entry_time"))
    if len(X) < recent + 30:
        raise InsufficientData("Need ≥ recent+30 trades for drift monitoring")
    ref, cur = X.iloc[:-recent], X.iloc[-recent:]
    out = {}
    for c in X.columns:
        a, b = ref[c].dropna().to_numpy(), cur[c].dropna().to_numpy()
        if len(a) < 30 or len(b) < 10:
            out[c] = {"psi": None, "status": f"insufficient data (ref {len(a)}, recent {len(b)})"}
            continue
        v = psi(a, b)
        out[c] = {"psi": v, "status": "stable" if v < 0.1 else "moderate drift" if v < 0.25 else "significant drift"}
    return out


def cluster_setups(j: pd.DataFrame, k: int = 4, r_col: str = "r_net") -> dict:
    X = build_features(j)
    if len(X) < k * 10:
        raise InsufficientData(f"Need ≥{k * 10} trades for {k} clusters")
    Xs = StandardScaler().fit_transform(X.fillna(X.median()).fillna(0))
    lab = KMeans(n_clusters=k, n_init=20, random_state=RNG_SEED).fit_predict(Xs)
    out = []
    for c in range(k):
        r = j[r_col].to_numpy(float)[lab == c]
        r = r[~np.isnan(r)]
        out.append({"cluster": c, "n": int(len(r)), "mean_r": float(r.mean()) if len(r) else None,
                    "win_rate": float((r > 0).mean()) if len(r) else None,
                    "centroid": X[lab == c].mean().round(3).to_dict()})
    return {"clusters": out, "note": "Clusters are descriptive and fitted in-sample; they are hypotheses to test OOS, not findings."}


def hmm_regimes(close: pd.Series, k: int = 2) -> dict:
    """Markov-switching variance model on log returns (statsmodels), as a
    Hidden-Markov regime detector. Filtered (not smoothed) probabilities are
    returned for any use in backtests — smoothed ones use future data."""
    from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

    r = (np.log(close).diff().dropna() * 100)
    if len(r) < 200:
        raise InsufficientData("Need ≥200 returns for a Markov-switching model")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        res = MarkovRegression(r.to_numpy(), k_regimes=k, trend="c", switching_variance=True).fit(disp=False)
    filt = res.filtered_marginal_probabilities
    var = [float(res.params[f"sigma2[{i}]"]) for i in range(k)]
    hi = int(np.argmax(var))
    return {"regime_variances": var, "high_vol_regime": hi,
            "filtered_prob_high_vol": pd.Series(filt[:, hi], index=r.index).tolist(),
            "index": [str(i) for i in r.index],
            "transition_matrix": res.regime_transition.squeeze().tolist() if hasattr(res, "regime_transition") else None,
            "aic": float(res.aic),
            "note": "Filtered probabilities use only data up to t; smoothed probabilities would leak future data."}
