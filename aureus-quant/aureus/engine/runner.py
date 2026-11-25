"""Orchestrates the autonomous MGC1! quant engine: pull bars, run detectors,
validate them, compute current state. Results are cached per (interval, last
bar) so the dashboard can poll cheaply."""
from __future__ import annotations

import asyncio
import os
import threading
import time

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


def update_now(intervals=("1m", "5m", "1h", "1d")) -> dict:
    res = store.update(intervals)
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
        intervals = ("1m", "5m", "1h", "1d") if tick % 30 == 0 else ("1m", "5m")
        try:
            await asyncio.to_thread(update_now, intervals)
            await asyncio.to_thread(_warm)
        except Exception as e:  # noqa: BLE001
            STATUS["last_result"] = {"error": str(e)}
        tick += 1
        await asyncio.sleep(every)


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
    _cache.clear()
    return n


def clear_market() -> None:
    import sqlite3
    with sqlite3.connect(store.DB) as c:
        c.execute("DELETE FROM bars")
    _cache.clear()
    time.sleep(0)
