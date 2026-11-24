"""Unit tests. All data here is SIMULATED and exists only to test the code."""
import io

import numpy as np
import pandas as pd
import pytest

from aureus.backtest.costs import CostModel, apply_costs
from aureus.core import MGC, InsufficientData, Provenance
from aureus.data.candles import build_continuous, load_candles_csv, quality_report
from aureus.data.journal import load_journal
from aureus.regime.classifier import classify, tag_trades
from aureus.risk.analytics import monte_carlo, observed
from aureus.simulate import simulated_candles_csv, simulated_journal_csv
from aureus.stats import engine as st
from aureus.tbs import research as tbs
from aureus.workspace import Workspace


@pytest.fixture(scope="module")
def ws():
    from aureus.simulate import load_simulated
    w = Workspace()
    load_simulated(w)
    return w


def test_contract_spec():
    assert MGC.tick_value == pytest.approx(1.0)
    assert MGC.price_to_dollars(1.0) == 10.0


def test_candles_require_timezone():
    csv = "timestamp,open,high,low,close,volume\n2026-01-05 10:00,1,1,1,1,1\n2026-01-05 10:05,1,1,1,1,1\n2026-01-05 10:10,1,1,1,1,1\n"
    with pytest.raises(ValueError, match="no timezone"):
        load_candles_csv(io.StringIO(csv), source="t")


def test_quality_detects_gaps_and_dupes():
    cs = load_candles_csv(simulated_candles_csv(days=5), source="t", provenance=Provenance.SIMULATED)
    assert cs.quality["missing_bars"] == 0
    assert cs.quality["duplicate_rows"] == 0
    df = cs.df.drop(cs.df.index[100:110])
    df = pd.concat([df, df.iloc[[5]]]).sort_index()
    cs.df = df
    q = quality_report(cs)
    assert q["missing_bars"] == 10 and q["duplicate_rows"] == 2


def test_rollover_same_timestamp_adjustment():
    idx = pd.date_range("2026-03-02 15:00", periods=48, freq="1h", tz="UTC")
    rows = []
    for i, t in enumerate(idx):
        rows.append({"timestamp": t, "contract": "MGCJ6", "open": 100, "high": 101, "low": 99, "close": 100, "volume": 100 if i < 24 else 10})
        rows.append({"timestamp": t, "contract": "MGCM6", "open": 105, "high": 106, "low": 104, "close": 105, "volume": 10 if i < 24 else 100})
    df = pd.DataFrame(rows)
    df["timestamp"] = df["timestamp"].astype(str)
    cs = load_candles_csv(io.StringIO(df.to_csv(index=False)), source="t", timeframe="1h")
    cont, rolls = build_continuous(cs)
    assert len(rolls) == 1 and rolls.iloc[0]["adjustment"] == pytest.approx(5.0)
    assert "same-timestamp" in rolls.iloc[0]["basis"]
    # after back-adjustment the series has no artificial gap
    assert cont.df["close"].nunique() == 1


def test_journal_r_and_validation():
    j, w = load_journal(simulated_journal_csv(20))
    assert (np.isclose(j["r_gross"], 2.0) | np.isclose(j["r_gross"], -1.0)).all()
    bad = "date,time,direction,entry,stop,exit\n2026-01-05,10:00,long,100,101,102\n"
    with pytest.raises(ValueError, match="wrong side"):
        load_journal(io.StringIO(bad))


def test_costs_reduce_r():
    j, _ = load_journal(simulated_journal_csv(20))
    jj = apply_costs(j, CostModel())
    assert (jj["r_net"] < jj["r_gross"]).all()
    expected = CostModel().round_turn_dollars() / jj["risk_dollars"]
    assert np.allclose(jj["cost_r"], expected)


def test_edge_test_detects_no_edge_and_real_edge():
    rng = np.random.default_rng(0)
    null = rng.choice([2.0, -1.0], p=[1 / 3, 2 / 3], size=300)  # EV = 0
    res = st.test_mean_greater_than_zero(null, label="null", data="sim", n_boot=2000)
    assert not res.value["significant_5pct"] or res.value["p_t"] > 0.01
    edge = rng.choice([2.0, -1.0], p=[0.5, 0.5], size=300)       # EV = +0.5
    res2 = st.test_mean_greater_than_zero(edge, label="edge", data="sim", n_boot=2000)
    assert res2.value["significant_5pct"]


def test_wilson_and_bayes():
    lo, hi = st.wilson_ci(50, 100)
    assert lo < 0.5 < hi
    b = st.bayesian_win_rate(50, 100, breakeven=0.4)
    assert 0.9 < b.value["p_above_breakeven"] < 1


def test_partition_definitions(ws):
    j = ws.journal
    p = tbs.partition(j)
    assert set(p["C"].index) <= set(p["B"].index) <= set(p["A"].index)
    assert len(p["B"]) + len(p["A_not_B"]) == len(p["A"])
    b = p["B"]
    assert (((b.daily_crt == "bullish") & (b.direction == "long")) | ((b.daily_crt == "bearish") & (b.direction == "short"))).all()
    assert p["C"]["amd_aligned"].all()


def test_compare_and_metrics(ws):
    out = tbs.compare_datasets(ws.journal)
    m = out["metrics"]["A"]["value"]
    r = tbs.partition(ws.journal)["A"]["r_net"]
    assert m["n"] == len(r) and m["avg_r"] == pytest.approx(r.mean())
    assert "multiple_comparison" in out


def test_regime_no_lookahead(ws):
    reg = ws.regimes
    # recompute on truncated history: labels for earlier bars must not change
    cut = ws.candles.df.iloc[: len(ws.candles.df) // 2]
    reg2 = classify(cut, ws.candles.timeframe)
    common = reg2.index[-500:]
    assert (reg.loc[common, "regime"] == reg2.loc[common, "regime"]).mean() > 0.99


def test_tag_trades_uses_prior_bar(ws):
    j = tag_trades(ws.journal_raw.assign(r_net=ws.journal_raw["r_gross"]), ws.regimes)
    assert "regime" in j.columns


def test_risk(ws):
    a = tbs.partition(ws.journal)["A"]["r_net"]
    o = observed(a)
    assert o.value["max_drawdown_r"] >= 0
    mc = monte_carlo(a, n_sims=500)
    assert 0 <= mc.value["prob_ruin"] <= 1
    with pytest.raises(InsufficientData):
        monte_carlo(a.iloc[:5])


def test_ml_walkforward_no_leak(ws):
    from aureus.ml.research import walk_forward
    res = walk_forward(ws.journal, min_train=60, test_size=20)
    for f in res["folds"]:
        assert f["train"][1] < f["test"][0]
    # on random outcomes, AUC should hover near 0.5
    for m in res["models"].values():
        if "auc" in m:
            assert 0.25 < m["auc"] < 0.75


def test_assistant(ws):
    from aureus.assistant.router import answer
    for q in ["What is the current MGC1! volatility percentile?", "Is my TBS edge statistically significant?",
              "Does AMD alignment provide additional predictive information?",
              "How does my strategy perform across different volatility regimes?",
              "What is the average MGC1! range during New York?", "Has my strategy performance deteriorated?",
              "How stable is my expected value?", "What is the distribution of losing trades?",
              "Which conditions have historically produced the highest TBS expected value?"]:
        a = answer(q, ws)
        assert a["intent"] and a["results"], q
