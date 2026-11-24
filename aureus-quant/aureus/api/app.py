"""FastAPI backend. Run with:  uvicorn aureus.api.app:app --reload"""
from __future__ import annotations

import io
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .. import __version__
from ..assistant.router import HELP, answer
from ..backtest.costs import CostModel
from ..backtest.registry import list_runs, record_run
from ..core import InsufficientData, Provenance, _jsonable
from ..data.candles import resample
from ..events import analysis as ev
from ..live.feed import get_feed
from ..ml import research as ml
from ..regime.classifier import REGIMES, RegimeParams, regime_performance, transition_matrix
from ..risk import analytics as risk
from ..stats import engine as st
from ..tbs import research as tbs
from ..workspace import WS

from contextlib import asynccontextmanager


@asynccontextmanager
async def _lifespan(_app):
    try:
        WS.autoload()  # reload saved files + TradingView setups on start
    except Exception:  # noqa: BLE001 - never block startup on a bad file
        pass
    yield


app = FastAPI(title="AUREUS QUANT", version=__version__, lifespan=_lifespan)


@app.middleware("http")
async def tunnel_guard(request: Request, call_next):
    """When AUREUS is exposed through a Cloudflare tunnel (for TradingView
    webhooks), only the webhook endpoint is reachable from the internet; the
    dashboard and every other endpoint stay local-only."""
    via_tunnel = "cf-connecting-ip" in request.headers or "x-forwarded-for" in request.headers
    if via_tunnel and request.url.path != "/api/tradingview/webhook":
        return JSONResponse(status_code=403, content={"error": "forbidden", "detail": "Only the webhook is public."})
    return await call_next(request)

WEB = Path(__file__).resolve().parents[2] / "web"


@app.exception_handler(InsufficientData)
async def _insufficient(_: Request, exc: InsufficientData):
    return JSONResponse(status_code=422, content={"error": "insufficient_data", "detail": str(exc)})


@app.exception_handler(ValueError)
async def _value(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"error": "invalid_input", "detail": str(exc)})


def _stamp_simulated(o):
    if isinstance(o, dict):
        return {k: ("SIMULATED" if k == "provenance" else _stamp_simulated(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [_stamp_simulated(v) for v in o]
    return o


def J(o):
    """JSON response. If any loaded input is SIMULATED, every provenance field
    in the payload is forced to SIMULATED so no result can be mistaken for real."""
    out = _jsonable(o)
    if WS.simulated_inputs():
        out = _stamp_simulated(out)
    return JSONResponse(out)


# ------------------------------------------------------------------ status --

@app.get("/api/status")
def status():
    return J({
        "version": __version__,
        "simulated_inputs": WS.simulated_inputs(),
        "feed": get_feed().status().to_dict(),
        "candles": WS.candles.header() if WS.candles else None,
        "candle_quality": WS.candles.quality if WS.candles else None,
        "journal": {"trades": int(len(WS.journal_raw)), "warnings": WS.journal_warnings,
                    "provenance": WS.journal_raw["provenance"].iloc[0] if len(WS.journal_raw) else None}
                   if WS.journal_raw is not None else None,
        "events": {"n": int(len(WS.events))} if WS.events is not None else None,
        "costs": WS.costs.to_dict(),
        "regime_params": asdict(WS.regime_params) | {"hash": WS.regime_params.hash()},
    })


@app.post("/api/upload/{kind}")
async def upload(kind: str, file: UploadFile = File(...), source: str = Form("user upload"),
                 source_tz: str | None = Form(None), provenance: str = Form("HISTORICAL"),
                 timeframe: str | None = Form(None)):
    buf = io.BytesIO(await file.read())
    prov = Provenance(provenance.upper())
    if kind == "candles":
        return J(WS.load_candles(buf, source=f"{source} ({file.filename})", source_tz=source_tz or None,
                                 provenance=prov, timeframe=timeframe or None))
    if kind == "journal":
        return J(WS.load_journal(buf, provenance=prov))
    if kind == "events":
        return J(WS.load_events(buf))
    raise HTTPException(404, "kind must be candles | journal | events")


class CostIn(BaseModel):
    commission_per_side: float
    exchange_fees_per_side: float
    slippage_ticks_entry: float
    slippage_ticks_exit: float
    label: str = "user"


@app.put("/api/costs")
def set_costs(c: CostIn):
    WS.costs = CostModel(**c.model_dump())
    return J(WS.costs.to_dict())


@app.put("/api/regime/params")
def set_regime_params(p: dict):
    WS.regime_params = RegimeParams(**{**asdict(WS.regime_params), **p})
    WS._regimes = None
    return J(asdict(WS.regime_params) | {"hash": WS.regime_params.hash()})


# ------------------------------------------------------------------ market --

@app.get("/api/market/snapshot")
def snapshot():
    return J(WS.market_snapshot())


@app.get("/api/market/candles")
def candles(tf: str = "native", limit: int = 500):
    WS._need_candles()
    if tf == "native":
        df = WS.candles.df[["open", "high", "low", "close", "volume"]].tail(limit)
        f = WS.features.tail(limit)
        reg = WS.regimes["regime"].tail(limit)
        df = df.assign(atr14=f["atr14"], atr_pct=f["atr_pct_rank"], regime=reg)
    else:
        df = resample(WS.candles, tf).tail(limit)
    df.index = df.index.map(lambda t: pd.Timestamp(t).isoformat())
    return J({"tf": tf, "header": WS.candles.header(), "rows": df.reset_index(names="t").to_dict(orient="records")})


@app.get("/api/market/volatility")
def volatility():
    r = WS.volatility_percentile()
    f = WS.features[["atr14", "atr_pct_rank", "rv_1d", "rolling_std_20"]].dropna().tail(2000)
    return J({"result": r.to_dict(), "series": {"t": [t.isoformat() for t in f.index], **{c: f[c].tolist() for c in f.columns}}})


@app.get("/api/market/sessions")
def sessions():
    return J(WS.session_ranges().to_dict())


@app.get("/api/market/levels")
def levels():
    from ..features.indicators import confirmed_swings, session_levels
    WS._need_candles()
    df = WS.candles.df.tail(3000)
    sl = session_levels(df).iloc[-1]
    sw = confirmed_swings(df)
    return J({"session": sl["session"], "session_high": sl["session_high"], "session_low": sl["session_low"],
              "pdh": sl["pdh"], "pdl": sl["pdl"],
              "recent_swing_highs": sw["swing_high"].dropna().tail(5).tolist(),
              "recent_swing_lows": sw["swing_low"].dropna().tail(5).tolist(),
              "note": "Swings are stamped on their confirmation bar (k=3 bars later)."})


# ------------------------------------------------------------- statistics --

@app.get("/api/stats/returns")
def stats_returns():
    r = WS.returns_distribution()
    out = {"returns_pct": r.tolist(), "dates": [str(d) for d in r.index]}
    for key, fn in {
        "describe": lambda: st.describe(r, label="daily log returns (%)", data="CME trading-day closes", unit="%"),
        "fit": lambda: st.fit_distributions(r, label="daily log returns", data="CME trading-day closes"),
        "acf": lambda: st.autocorrelation(r, label="daily returns", data="CME trading-day closes"),
        "acf_abs": lambda: st.autocorrelation(r.abs(), label="|daily returns| (volatility clustering)", data="CME trading-day closes"),
        "stationarity": lambda: st.stationarity(r, label="daily returns", data="CME trading-day closes"),
    }.items():
        try:
            out[key] = fn().to_dict()
        except InsufficientData as e:
            out[key] = {"error": str(e)}
    return J(out)


@app.get("/api/stats/decompose")
def decompose(period: int = 5):
    d = resample(WS.candles, "1D")["close"]
    return J(st.decompose(d, period))


# -------------------------------------------------------------------- TBS --

@app.get("/api/tbs/compare")
def tbs_compare(net: bool = True):
    j = WS.journal
    res = tbs.compare_datasets(j, net=net)
    record_run("tbs_compare", {"net": net, "costs": WS.costs.to_dict()}, {"journal": WS.journal_raw}, {"n": len(j)})
    parts = tbs.partition(j)
    col = tbs.r_col(j, net)
    res["r_values"] = {k: parts[k][col].dropna().tolist() for k in "ABC"}
    return J(res)


@app.get("/api/tbs/trades")
def tbs_trades():
    j = WS.journal
    parts = tbs.partition(j)
    j["in_B"] = j.index.isin(parts["B"].index)
    j["in_C"] = j.index.isin(parts["C"].index)
    j["entry_time"] = j["entry_time"].astype(str)
    return J(j.replace({np.nan: None}).to_dict(orient="records"))


@app.get("/api/tbs/breakdown")
def tbs_breakdown(by: str = "session", dataset: str = "A"):
    j = WS.journal
    sub = tbs.partition(j)[dataset]
    if by not in sub.columns:
        raise HTTPException(400, f"Unknown field {by}")
    return J(tbs.breakdown(sub, by).to_dict(orient="records"))


@app.get("/api/tbs/rolling")
def tbs_rolling(window: int = 20, dataset: str = "A"):
    sub = tbs.partition(WS.journal)[dataset]
    df = tbs.rolling_ev(sub, window)
    eq = df["cum_r"]
    dd = eq - eq.cummax().clip(lower=0)
    return J({"t": [str(t) for t in df.index], "rolling_ev": df["rolling_ev"].tolist(),
              "rolling_std": df["rolling_std"].tolist(), "cum_r": eq.tolist(), "drawdown": dd.tolist()})


@app.get("/api/tbs/deterioration")
def tbs_deterioration(recent: int = 30):
    return J(tbs.deterioration_test(tbs.partition(WS.journal)["A"], recent=recent).to_dict())


# ----------------------------------------------------------------- regime --

@app.get("/api/regime/current")
def regime_current():
    r = WS.regimes
    last = r.dropna(subset=["atr_pct_rank"]).iloc[-1]
    counts = r["regime"].value_counts().to_dict()
    return J({"as_of": r.index[-1].isoformat(), "regime": last["regime_name"], "inputs": last.to_dict(),
              "params": asdict(WS.regime_params), "params_hash": WS.regime_params.hash(),
              "distribution": {REGIMES.get(k, "Warm-up"): int(v) for k, v in counts.items()},
              "transitions": transition_matrix(r["regime"]).round(3).to_dict()})


@app.get("/api/regime/performance")
def regime_perf():
    j = WS.journal
    if "regime" not in j.columns:
        raise InsufficientData("Import candles so trades can be tagged by regime")
    return J(regime_performance(j).to_dict(orient="records"))


# --------------------------------------------------------------------- ML --

@app.post("/api/ml/walkforward")
def ml_walkforward(min_train: int = 60, test_size: int = 20, embargo: int = 2):
    res = ml.walk_forward(WS.journal, min_train=min_train, test_size=test_size, embargo=embargo)
    run = record_run("ml_walkforward", res["params"], {"journal": WS.journal_raw},
                     {k: {kk: vv for kk, vv in v.items() if kk != "predictions"} for k, v in res["models"].items()})
    res["run_id"] = run["id"]
    return J(res)


@app.get("/api/ml/importance")
def ml_importance():
    return J(ml.feature_importance(WS.journal).to_dict())


@app.get("/api/ml/drift")
def ml_drift(recent: int = 30):
    return J(ml.drift_report(WS.journal, recent))


@app.get("/api/ml/clusters")
def ml_clusters(k: int = 4):
    return J(ml.cluster_setups(WS.journal, k))


@app.get("/api/ml/hmm")
def ml_hmm():
    WS._need_candles()
    return J(ml.hmm_regimes(resample(WS.candles, "1D")["close"]))


# ------------------------------------------------------------------- risk --

@app.get("/api/risk/observed")
def risk_observed(dataset: str = "A"):
    sub = tbs.partition(WS.journal)[dataset]
    return J(risk.observed(sub["r_net"], label=f"dataset {dataset} (net)").to_dict())


@app.get("/api/risk/montecarlo")
def risk_mc(dataset: str = "A", risk_pct: float = 1.0, ruin_dd_pct: float = 30.0, n_trades: int = 0,
            n_sims: int = 10000, block: int = 1):
    sub = tbs.partition(WS.journal)[dataset]
    res = risk.monte_carlo(sub["r_net"], risk_pct=risk_pct, ruin_dd_pct=ruin_dd_pct, n_trades=n_trades or None,
                           n_sims=n_sims, block=block)
    record_run("monte_carlo", res.value["assumptions"] | {"dataset": dataset}, {"journal": WS.journal_raw},
               {k: v for k, v in res.value.items() if k != "dd_r_distribution"})
    return J(res.to_dict())


# ----------------------------------------------------------------- events --

@app.get("/api/events/volatility")
def events_vol():
    WS._need_candles()
    if WS.events is None:
        raise InsufficientData("Import an economic-event calendar CSV (official source) first")
    ew = ev.event_window_vol(WS.candles.df, WS.events, WS.candles.timeframe)
    return J({"per_event": ew.replace({np.nan: None}).assign(datetime=ew["datetime"].astype(str)).to_dict(orient="records"),
              "summary": ev.summarise_event_vol(ew).to_dict(orient="records")})


@app.get("/api/events/tbs")
def events_tbs():
    if WS.events is None:
        raise InsufficientData("Import an economic-event calendar CSV first")
    return J(ev.event_vs_non_event(WS.journal).to_dict())


# -------------------------------------------------------------- assistant --

class Q(BaseModel):
    q: str


@app.post("/api/assistant")
def assistant(q: Q):
    return J(answer(q.q, WS))


@app.get("/api/assistant/help")
def assistant_help():
    return J(HELP)


@app.get("/api/runs")
def runs():
    return J(list_runs())


# ------------------------------------------------------------------- live --

@app.get("/api/live/status")
def live_status():
    return J(get_feed().status().to_dict())


@app.get("/api/live/bars")
def live_bars(minutes: int = 600):
    feed = get_feed()
    s = feed.status()
    if s.status == "unavailable":
        raise HTTPException(503, f"Live feed unavailable: {s.reason}")
    df = feed.recent_bars(minutes)
    return J({"status": s.to_dict(), "rows": df.reset_index().astype({"timestamp": str}).to_dict(orient="records")})


# ------------------------------------------------------------------ web UI --

@app.get("/vendor/plotly.min.js")
def plotly_js():
    """Serve Plotly from the installed python package (works offline)."""
    import plotly
    return FileResponse(Path(plotly.__file__).parent / "package_data" / "plotly.min.js", media_type="text/javascript")


if WEB.exists():
    app.mount("/static", StaticFiles(directory=WEB), name="static")

    @app.get("/")
    def index():
        return FileResponse(WEB / "index.html")


# ------------------------------------------------------------ TradingView --

@app.post("/api/tradingview/webhook")
async def tv_webhook(request: Request):
    from ..tradingview import store
    try:
        res = store.ingest(await request.body())
    except PermissionError as e:
        raise HTTPException(401, str(e)) from e
    if getattr(WS, "_csv_provenance", Provenance.HISTORICAL) != Provenance.SIMULATED:
        WS.rebuild_journal()
    return J(res)


@app.get("/api/tradingview/setups")
def tv_setups():
    from ..tradingview import store
    return J({"setups": store.setups(), "token": store.token()})


@app.delete("/api/tradingview/setups/{setup_id}")
def tv_delete(setup_id: str):
    from ..tradingview import store
    store.delete(setup_id)
    WS.rebuild_journal()
    return J({"deleted": setup_id})


@app.get("/api/tradingview/pine")
def tv_pine():
    return FileResponse(Path(__file__).resolve().parents[2] / "tradingview" / "aureus_tbs_marker.pine",
                        media_type="text/plain", filename="aureus_tbs_marker.pine")


# ------------------------------------------------------- probability models --

@app.get("/api/prob/models")
def prob_models():
    from scipy import stats as sps
    j = WS.journal
    parts = tbs.partition(j)
    out = {"posteriors": {}, "conditional": []}
    grid = np.linspace(0, 1, 201)
    for k in "ABC":
        r = parts[k]["r_net"].dropna()
        if len(r) < 2:
            continue
        m = tbs.metrics(parts[k], label=k)
        be = m.value["breakeven_win_rate"]
        res = st.bayesian_win_rate(int((r > 0).sum()), len(r), breakeven=be if be == be else None,
                                   label=f"win rate ({tbs.DATASETS[k]})", data=f"Dataset {k}")
        out["posteriors"][k] = res.to_dict() | {"grid": grid.tolist(),
                                                "pdf": sps.beta(res.value["alpha"], res.value["beta"]).pdf(grid).tolist()}
    a = parts["A"]
    win = a["r_net"] > 0
    conds = {
        "Daily CRT aligned": tbs._bias_matches(a["daily_crt"], a["direction"]),
        "4H CRT aligned": tbs._bias_matches(a["h4_crt"], a["direction"]),
        "AMD aligned": a["amd_aligned"].eq(True),
        "Long": a["direction"].eq("long"),
    }
    for s in sorted(a["session"].dropna().unique()):
        conds[f"Session = {s}"] = a["session"].eq(s)
    if "event_day" in a.columns:
        conds["Scheduled-event day"] = a["event_day"].eq(1)
    for name, c in conds.items():
        try:
            out["conditional"].append(st.conditional_probability(win, c, a_label="win", b_label=name,
                                                                 data="Dataset A, net R").to_dict())
        except Exception as e:  # noqa: BLE001
            out["conditional"].append({"name": name, "error": str(e)})
    out["note"] = ("Conditional probabilities are descriptive. Many conditions are screened at once, so "
                   "some apparent lifts will be noise; confirm with the permutation tests and out-of-sample data.")
    return J(out)


@app.post("/api/demo/simulated")
def demo_simulated():
    """Load clearly-labelled SIMULATED data so the interface can be explored
    before real data is imported. Never use for research conclusions."""
    from ..simulate import load_simulated
    load_simulated(WS)
    return J({"loaded": True, "provenance": "SIMULATED",
              "warning": "Random data for UI testing only — no relationship to real MGC prices or trades."})


@app.post("/api/reset")
def reset():
    WS.candles = WS.journal_raw = WS.events = None
    WS._csv_journal = None
    WS._csv_provenance = Provenance.HISTORICAL
    WS._features = WS._regimes = None
    WS.journal_warnings = []
    return J({"reset": True})
