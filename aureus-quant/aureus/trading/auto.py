"""Automatic paper trader: on every newly closed bar, trade the detectors whose
CURRENT validation status is in the allowed set.

Look-ahead protection: a detector's status is computed from history up to
now, so it may only be applied to bars that are *new* now. If the app was off
and a backlog of bars accumulated, the backlog is used to manage open trades
but NO new entries are taken from it (they are logged as 'missed').
"""
from __future__ import annotations

import pandas as pd

from ..engine import store
from ..engine.detectors import REGISTRY, run_all
from ..engine.evaluate import HORIZON_LABEL, HORIZONS
from . import paper

MAX_FRESH_BARS = 2   # only signals on the last 2 closed bars count as 'live'


def status_lookup(interval: str, horizon: str) -> dict[str, dict]:
    from ..engine.runner import analyse
    res = analyse(interval)
    return {r["key"]: r for r in res["evaluation"]["rows"] if r["horizon"] == horizon}


def hold_bars_for(interval: str, horizon: str) -> int:
    labels = HORIZON_LABEL.get(interval, [])
    return HORIZONS[interval][labels.index(horizon)] if horizon in labels else HORIZONS.get(interval, [12])[1]


def step(df: pd.DataFrame | None = None, status_fn=None) -> dict:
    cfg = paper.get_config()
    if df is None:
        df = store.load(cfg.interval)
    if df is None or len(df) < 200:
        return {"processed": 0, "note": "not enough bars"}
    closed = df.iloc[:-1]                      # the newest bar may still be forming
    last = paper.last_processed()
    new = closed[closed.index > last] if last is not None else closed.iloc[-1:]
    if new.empty:
        return {"processed": 0}

    # 1) manage pending/open trades on every new bar, in order
    for ts, bar in new.iterrows():
        paper.manage_bar(ts, bar)

    out = {"processed": len(new), "orders": []}
    if cfg.enabled:
        fresh = new.iloc[-MAX_FRESH_BARS:]
        missed = len(new) - len(fresh)
        if missed > 0:
            paper.log("missed", f"{missed} bars arrived while AUREUS was off — no entries taken from them (prevents look-ahead)", new.index[-1])
        ctx, sig = run_all(closed)
        statuses = status_fn() if status_fn else status_lookup(cfg.interval, cfg.horizon)
        hold = hold_bars_for(cfg.interval, cfg.horizon)
        names = {d.key: d for d in REGISTRY}
        for ts in fresh.index:
            for key, s in sig.items():
                v = int(s.get(ts, 0))
                if v == 0 or names[key].kind != "directional":
                    continue
                if cfg.allowed_detectors and key not in cfg.allowed_detectors:
                    continue
                st = statuses.get(key, {})
                status = st.get("status", "UNKNOWN")
                if status not in cfg.allowed_status:
                    paper.log("skip", f"{names[key].name} fired ({'up' if v > 0 else 'down'}) — status {status} not allowed", ts)
                    continue
                direction = -v if "INVERSE" in (st.get("edge_direction") or "") else v
                why = paper.entry_blocked(ts, cfg)
                if why:
                    paper.log("skip", f"{names[key].name} [{status}] — blocked: {why}", ts)
                    continue
                tid = paper.create_order(source="auto", detector=key, status=status, direction=direction, signal_ts=ts,
                                         close=float(closed.loc[ts, "close"]), atr=float(ctx.atr.loc[ts]), hold_bars=hold, cfg=cfg)
                if tid:
                    out["orders"].append(tid)
    paper.set_last_processed(new.index[-1])
    return out


def manual_order(direction: int, cfg_override: dict | None = None) -> int | None:
    """Manual paper market order (fills at the next bar's open, same rules)."""
    cfg = paper.get_config()
    if cfg_override:
        cfg = paper.TradeConfig(**{**cfg.__dict__, **cfg_override})
    df = store.load(cfg.interval)
    if df.empty:
        raise RuntimeError("No price data")
    closed = df.iloc[:-1]
    ts = closed.index[-1]
    why = paper.entry_blocked(ts, cfg)
    if why:
        raise RuntimeError(f"Order blocked: {why}")
    ctx, _ = run_all(closed)
    return paper.create_order(source="manual", detector="manual", status="—", direction=direction, signal_ts=ts,
                              close=float(closed["close"].iloc[-1]), atr=float(ctx.atr.iloc[-1]),
                              hold_bars=hold_bars_for(cfg.interval, cfg.horizon), cfg=cfg)
