"""Orchestrates the autonomous MGC1! quant engine: pull bars, run detectors,
validate them, compute current state. Results are cached per (interval, last
bar) so the dashboard can poll cheaply."""
from __future__ import annotations

import asyncio
import os
import threading
import time

import numpy as np
import pandas as pd

from ..core import MGC, InsufficientData, _jsonable, config_hash
from ..regime.classifier import RegimeParams, classify
from . import store
from .detectors import run_all
from .evaluate import evaluate, seasonality
from .state import now_state

ENGINE_VERSION = "engine-v1"
_cache: dict = {}
_lock = threading.Lock()
STATUS = {"running": False, "last_update": None, "last_result": None, "interval_s": None}


def cost_ticks() -> float:
    from ..workspace import WS
    return WS.costs.round_turn_dollars() / MGC.tick_value


def bars(interval: str) -> pd.DataFrame:
    df = store.load(interval)
    if df.empty:
        raise InsufficientData(f"No {interval} bars stored yet. Press 'Update data' (or wait for the auto-update).")
    return df


def analyse(interval: str = "5m", force: bool = False) -> dict:
    df = bars(interval)
    if len(df) < 500:
        raise InsufficientData(f"Only {len(df)} {interval} bars — need ≥500 for meaningful statistics.")
    key = (interval, df.index[-1].value, len(df), round(cost_ticks(), 3))
    with _lock:
        if not force and _cache.get(interval, {}).get("key") == key:
            return _cache[interval]["result"]
    ctx, sig = run_all(df)
    ev = evaluate(df, sig, interval, cost_ticks())
    reg = classify(df, ctx.tf, RegimeParams())
    state = now_state(df, ctx, sig, ev, interval)
    sources = sorted(set(df["source"].dropna())) if "source" in df else []
    result = _jsonable({
        "interval": interval, "engine_version": ENGINE_VERSION,
        "params_hash": config_hash({"interval": interval, "cost_ticks": cost_ticks(), "engine": ENGINE_VERSION}),
        "sources": sources,
        "provenance": "SIMULATED" if "simulated" in sources else ("DELAYED" if "yahoo" in sources else "HISTORICAL"),
        "state": state, "evaluation": ev, "seasonality": seasonality(df) if ctx.intraday else None,
        "regime": {"current": reg["regime_name"].iloc[-1],
                   "timeline": {"t": [t.isoformat() for t in reg.index[-1500:]], "regime": reg["regime"].iloc[-1500:].tolist()}},
        "chart": {"t": [t.isoformat() for t in df.index[-600:]], **{k: df[k].iloc[-600:].tolist() for k in ["open", "high", "low", "close"]},
                  "signals": [{"t": t.isoformat(), "key": k, "dir": int(v)} for k, s in sig.items() for t, v in s.iloc[-600:][s.iloc[-600:] != 0].items()]},
    })
    with _lock:
        _cache[interval] = {"key": key, "result": result}
    return result


def latest_mgc() -> float | None:
    for iv in ("1m", "5m", "1h", "1d"):
        df = store.load(iv)
        if not df.empty:
            return float(df["close"].iloc[-1])
    return None


def update_options() -> dict:
    """Pull the GLD option chain, compute walls/GEX/IV, store a snapshot."""
    from .options import analyse_chain, fetch_gld_chains
    try:
        chains, spot = fetch_gld_chains()
        mgc = latest_mgc()
        res = analyse_chain(chains, spot, (mgc / spot) if mgc else None)
        res["mgc_last"] = mgc
        store.save_snapshot("options", res)
        store.log_fetch("options:GLD", "yahoo", len(res["strikes"]), None)
        return {"ok": True, "expiries": res["expiries"]}
    except Exception as e:  # noqa: BLE001
        store.log_fetch("options:GLD", "yahoo", 0, str(e)[:300])
        return {"ok": False, "error": str(e)[:300]}


def options_view() -> dict:
    snap = store.last_snapshot("options")
    if snap is None:
        raise InsufficientData("No options snapshot yet — press 'Update data now'.")
    return snap


def volatility_view() -> dict:
    from .volmodels import cross_asset, garch11, iv_context, vol_cone
    d = store.load("1d")
    if d.empty or len(d) < 60:
        raise InsufficientData("Need daily MGC1! bars — press 'Update data now'.")
    close = d["close"]
    out = {"cone": vol_cone(close), "as_of": d.index[-1].isoformat(), "n_days": len(d)}
    try:
        out["garch"] = garch11(np.log(close).diff())
    except ValueError as e:
        out["garch"] = {"error": str(e)}
    out["iv"] = iv_context(store.load_aux("GVZ"), close)
    daily = close.copy()
    daily.index = daily.index.normalize()
    others = {}
    for k in ("DXY", "US10Y"):
        s = store.load_aux(k)
        if s is not None:
            s.index = s.index.normalize()
            others[k] = s
    out["cross_asset"] = cross_asset(daily, others)
    return _jsonable(out)


def update_now(intervals=("1m", "5m", "1h", "1d"), slow: bool = True) -> dict:
    res = store.update(intervals)
    if slow and store.get_feed() is not None and isinstance(store.get_feed(), store.YahooFeed):
        res["aux"] = store.update_aux()
        res["options"] = update_options()
    STATUS["last_update"] = pd.Timestamp.now(tz="UTC").isoformat()
    STATUS["last_result"] = res
    return res


async def background_loop():
    """Refresh fast bars every minute and slow bars every 30 minutes."""
    every = int(os.getenv("AUREUS_UPDATE_SECONDS", "60"))
    if store.get_feed() is None or every <= 0:
        return
    STATUS.update(running=True, interval_s=every)
    tick = 0
    while True:
        slow = tick % 15 == 0
        intervals = ("1m", "5m", "1h", "1d") if slow else ("1m", "5m")
        try:
            await asyncio.to_thread(update_now, intervals, slow)
            await asyncio.to_thread(_warm)
            await asyncio.to_thread(_trade_step)
        except Exception as e:  # noqa: BLE001
            STATUS["last_result"] = {"error": str(e)}
        tick += 1
        await asyncio.sleep(every)


def _trade_step():
    from ..trading import auto, paper
    try:
        auto.step()
    except Exception as e:  # noqa: BLE001 - never let trading errors stop data updates
        paper.log("error", f"auto-trader step failed: {e}")


def _warm():
    for iv in ("5m", "1h"):
        try:
            analyse(iv)
        except InsufficientData:
            pass


def load_simulated_market(days: int = 90) -> int:
    """SIMULATED bars for UI testing only — stored with source='simulated'."""
    from ..data.candles import load_candles_csv
    from ..simulate import simulated_candles_csv
    cs = load_candles_csv(simulated_candles_csv(days=days, start_price=4000.0), source="sim")
    n = store.upsert(cs.df, "5m", "simulated")
    h = cs.df.resample("1h").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}).dropna()
    store.upsert(h, "1h", "simulated")
    # SIMULATED daily history, aux series and option snapshot (UI preview only)
    import numpy as np
    from ..simulate import simulated_option_chains
    from .options import analyse_chain
    rng = np.random.default_rng(5)
    idx = pd.bdate_range(end=cs.df.index[-1].normalize().tz_localize(None), periods=900, tz="UTC")
    vol = 0.011 * np.exp(np.cumsum(rng.normal(0, 0.05, len(idx))) * 0.3)
    px = 2400 * np.exp(np.cumsum(rng.standard_normal(len(idx)) * vol))
    px = px * (float(cs.df["close"].iloc[-1]) / px[-1])
    d = pd.DataFrame({"open": px, "high": px * 1.006, "low": px * 0.994, "close": px, "volume": 1000.0}, index=idx)
    store.upsert(d, "1d", "simulated")
    store.upsert_aux("GVZ", pd.Series(16 + 4 * np.sin(np.arange(len(idx)) / 40) + rng.normal(0, 1, len(idx)), index=idx))
    store.upsert_aux("DXY", pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.004, len(idx)))), index=idx))
    store.upsert_aux("US10Y", pd.Series(4 + np.cumsum(rng.normal(0, 0.04, len(idx))), index=idx))
    chains, spot = simulated_option_chains()
    res = analyse_chain(chains, spot, float(cs.df["close"].iloc[-1]) / spot)
    res["provenance"] = "SIMULATED"
    res["mgc_last"] = float(cs.df["close"].iloc[-1])
    store.save_snapshot("options", res)
    _cache.clear()
    return n


def clear_market() -> None:
    import sqlite3
    with sqlite3.connect(store.DB) as c:
        c.execute("DELETE FROM bars")
        c.execute("DELETE FROM aux")
        c.execute("DELETE FROM snapshots")
    _cache.clear()
    time.sleep(0)
