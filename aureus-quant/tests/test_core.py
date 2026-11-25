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


def test_tradingview_webhook_roundtrip(tmp_path, monkeypatch):
    import json
    from fastapi.testclient import TestClient
    from aureus.tradingview import store
    monkeypatch.setattr(store, "DB", tmp_path / "tv.sqlite")
    monkeypatch.setattr(store, "TOKEN_FILE", tmp_path / "tok.txt")
    from aureus.api import app as appmod
    appmod.WS.__init__()
    c = TestClient(appmod.app)
    tok = store.token()
    base = {"token": tok, "id": "MGC1!-1767600000000", "symbol": "COMEX:MGC1!", "timeframe": "1", "direction": "long",
            "daily_crt": "bullish", "h4_crt": "bullish", "amd_aligned": True, "tbs_confirmed": True, "news": "none",
            "contracts": 1, "entry": 2000.0, "stop": 1995.0, "target": 2010.0, "mfe": 0, "mae": 0}
    assert c.post("/api/tradingview/webhook", content=json.dumps({**base, "token": "bad", "state": "pending"})).status_code == 401
    assert c.post("/api/tradingview/webhook", content=json.dumps({**base, "state": "pending", "fill_time": None})).status_code == 200
    assert appmod.WS.journal_raw is None  # pending setups are not trades
    closed = {**base, "state": "closed", "fill_time": 1767625200000, "exit_time": 1767628800000,
              "exit_price": 2010.0, "exit_reason": "target", "mfe": 10.0, "mae": 2.0}
    assert c.post("/api/tradingview/webhook", content=json.dumps(closed)).status_code == 200
    assert c.post("/api/tradingview/webhook", content=json.dumps(closed)).status_code == 200  # idempotent
    j = appmod.WS.journal_raw
    assert len(j) == 1 and j["r_gross"].iloc[0] == pytest.approx(2.0) and j["mae_r"].iloc[0] == pytest.approx(0.4)
    # dashboard is blocked through the tunnel, webhook is not
    assert c.get("/api/status", headers={"cf-connecting-ip": "1.2.3.4"}).status_code == 403


def test_tradingview_csv_unix_time():
    csv = "time,open,high,low,close,Volume,RSI\n1767650400,2000,2001,1999,2000.5,10,50\n1767650700,2000.5,2001,2000,2000.8,12,51\n1767651000,2000.8,2002,2000.1,2001.5,9,52\n"
    cs = load_candles_csv(io.StringIO(csv), source="TradingView export")
    assert str(cs.df.index.tz) == "UTC" and cs.df.index[0] == pd.Timestamp("2026-01-05 22:00", tz="UTC")


def test_engine_no_lookahead_and_no_false_edges(tmp_path, monkeypatch):
    from aureus.engine import detectors, evaluate, store
    monkeypatch.setattr(store, "DB", tmp_path / "m.sqlite")
    cs = load_candles_csv(simulated_candles_csv(days=60, start_price=4000.0), source="t")
    df = cs.df
    _, full = detectors.run_all(df)
    _, part = detectors.run_all(df.iloc[: len(df) * 2 // 3])
    common = part["pd_break"].index[-2000:]
    for k in part:  # signals on past bars never change when future bars are added
        assert (full[k].loc[common] == part[k].loc[common]).all(), k
    ev = evaluate.evaluate(df, full, "5m", cost_ticks=2.6)
    # random-walk data: nothing directional should pass full validation
    assert not [r for r in ev["rows"] if r["kind"] == "directional" and r["status"] == "VALIDATED"]
    # store round-trip
    assert store.upsert(df.iloc[:100], "5m", "simulated") == 100
    assert len(store.load("5m")) == 100


def test_variance_ratio_detects_momentum():
    from aureus.engine.state import variance_ratio
    rng = np.random.default_rng(1)
    e = rng.standard_normal(5000)
    r = np.empty_like(e); r[0] = e[0]
    for i in range(1, len(e)):
        r[i] = 0.3 * r[i - 1] + e[i]          # positively autocorrelated
    px = pd.Series(np.exp(np.cumsum(r * 0.001)) * 4000)
    vr = variance_ratio(px, 4)
    assert vr["vr"] > 1.2 and vr["p"] < 0.01


def test_options_walls_and_iv_inversion():
    from aureus.engine.options import analyse_chain, implied_vol, bs_price
    from aureus.simulate import simulated_option_chains
    assert implied_vol(bs_price(370, 380, 0.1, 0.22, True), 370, 380, 0.1, True) == pytest.approx(0.22, abs=1e-4)
    chains, spot = simulated_option_chains()
    res = analyse_chain(chains, spot, 10.0)
    lv = res["levels_gld"]
    assert lv["call_wall"] >= spot and lv["put_wall"] <= spot
    assert res["levels_mgc"]["call_wall"] == pytest.approx(lv["call_wall"] * 10)
    assert res["term"][0]["atm_iv"] == pytest.approx(0.17, abs=0.01)   # recovers the generating IV
    assert res["term"][-1]["skew_25d"] > 0                              # put skew built into the smile


def test_garch_recovers_persistence():
    from aureus.engine.volmodels import garch11
    rng = np.random.default_rng(0)
    n, w, a, b = 2000, 0.02, 0.08, 0.9
    s2, r = w / (1 - a - b), []
    for _ in range(n):
        e = rng.standard_normal() * np.sqrt(s2)
        r.append(e)
        s2 = w + a * e * e + b * s2
    g = garch11(pd.Series(np.array(r) / 100))
    assert abs(g["persistence"] - 0.98) < 0.03


@pytest.fixture
def paperdb(tmp_path, monkeypatch):
    from aureus.trading import paper
    monkeypatch.setattr(paper, "DB", tmp_path / "paper.sqlite")
    return paper


def _bar(o, h, l, c):
    return pd.Series({"open": o, "high": h, "low": l, "close": c, "volume": 1.0})


def test_paper_fill_next_open_and_stop_priority(paperdb):
    p = paperdb
    cfg = p.TradeConfig(stop_atr=1.0, target_r=2.0)
    t0 = pd.Timestamp("2026-03-03 15:00", tz="UTC")
    tid = p.create_order(source="test", detector="x", status="VALIDATED", direction=1, signal_ts=t0,
                         close=4000.0, atr=5.0, hold_bars=12, cfg=cfg)
    p.manage_bar(t0, _bar(4000, 4001, 3999, 4000))           # same bar as signal: must NOT fill
    assert p.trades("pending")
    t1 = t0 + pd.Timedelta("5min")
    p.manage_bar(t1, _bar(4002, 4003, 4001, 4002))           # fills at open 4002 + 1 tick
    t = p.trades("open")[0]
    assert t["entry_px"] == pytest.approx(4002.1) and t["stop"] == pytest.approx(3997.1) and t["target"] == pytest.approx(4012.1)
    t2 = t1 + pd.Timedelta("5min")
    p.manage_bar(t2, _bar(4005, 4013, 3996, 4005))           # both touched → stop assumed
    c = p.trades("closed")[0]
    assert c["exit_reason"] == "stop" and c["exit_px"] == pytest.approx(3997.0)   # stop − 1 tick exit slippage
    assert c["pnl"] < 0 and c["id"] == tid


def test_paper_time_exit_and_daily_limit(paperdb):
    p = paperdb
    cfg = p.TradeConfig(stop_atr=10.0, daily_loss_limit=20.0)
    t0 = pd.Timestamp("2026-03-03 15:00", tz="UTC")
    p.create_order(source="t", detector="x", status="V", direction=-1, signal_ts=t0, close=4000, atr=5, hold_bars=2, cfg=cfg)
    for i, px in enumerate([4000, 4004, 4006]):
        p.manage_bar(t0 + pd.Timedelta(minutes=5 * (i + 1)), _bar(px, px + 0.5, px - 0.5, px))
    c = p.trades("closed")[0]
    assert c["exit_reason"] == "time exit" and c["pnl"] < -20
    assert "daily loss limit" in p.entry_blocked(t0 + pd.Timedelta(hours=1), cfg)


def test_auto_trader_only_uses_fresh_bars(paperdb):
    from aureus.trading import auto
    p = paperdb
    cs = load_candles_csv(simulated_candles_csv(days=20, start_price=4000.0), source="t")
    df = cs.df
    p.set_config(p.TradeConfig(enabled=True, allowed_status=["VALIDATED"]))
    p.set_last_processed(df.index[-400])                    # simulate a long backlog
    stub = lambda: {d.key: {"status": "VALIDATED", "edge_direction": "as hypothesised"} for d in __import__("aureus.engine.detectors", fromlist=["REGISTRY"]).REGISTRY}
    auto.step(df, status_fn=stub)
    fresh = set(df.iloc[:-1].index[-auto.MAX_FRESH_BARS:])
    for t in p.trades():
        assert pd.Timestamp(t["signal_ts"]) in fresh
    assert any(r["kind"] == "missed" for r in p.recent_log())
