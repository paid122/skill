"""PAPER trading engine for MGC1! — simulated money, real (delayed) prices.

Execution model (deliberately conservative, and identical for automatic and
manual orders):

* A decision taken on the close of bar t is filled at the OPEN of bar t+1,
  plus ``slippage_ticks_entry`` against you. Nothing is filled at a price that
  was not yet known when the decision was made.
* Exits are checked on every later bar:
    1. protective stop (high/low touches it → filled at the stop price, minus
       ``slippage_ticks_exit`` against you; a gap through the stop fills at the
       bar's open);
    2. optional target (filled at the target, no positive slippage);
    3. if stop and target are both touched in the same bar → the STOP is
       assumed (worst case);
    4. time exit at the close of the bar ``hold_bars`` after entry — the same
       holding period the detector was validated on.
* Commission + exchange fees from the workspace cost model are charged on both
  sides. 1 MGC point = $10, 1 tick (0.10) = $1.

Risk controls, all enforced before an order is created:
    one position at a time · max contracts · daily loss limit (halts new
    entries for the rest of the CME trading day) · max trades per day ·
    no new entries in the last 10 minutes before the 17:00 ET daily close or
    after Friday 16:00 ET · kill switch (flatten + disable).

Because the price feed is delayed (~10 min on Yahoo), paper results describe
what the rules would have done on those bars; they are NOT a record of fills
you could have obtained in real time.
"""
from __future__ import annotations

import json
import math
import os
import sqlite3
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from ..core import MGC

DB = Path(os.getenv("AUREUS_TRADING_DB", Path(__file__).resolve().parents[2] / "data" / "trading" / "paper.sqlite"))
ET = "America/New_York"
_lock = threading.RLock()


@dataclass
class TradeConfig:
    enabled: bool = False
    interval: str = "5m"
    horizon: str = "1h"                       # which validated horizon to trade (sets hold_bars)
    allowed_status: list[str] = field(default_factory=lambda: ["VALIDATED"])
    allowed_detectors: list[str] = field(default_factory=list)   # empty = all detectors
    stop_atr: float = 2.0                     # protective stop distance in ATR(14)
    target_r: float = 0.0                     # 0 = no target (time exit), else target at k × stop distance
    sizing: str = "fixed"                     # fixed | risk_pct
    contracts: int = 1
    risk_pct: float = 0.5                     # % of equity risked per trade when sizing = risk_pct
    max_contracts: int = 3
    daily_loss_limit: float = 200.0           # $; halts new entries for the trading day
    max_trades_per_day: int = 6
    starting_equity: float = 10000.0


def _conn():
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB, timeout=30)
    c.execute("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)")
    c.execute("""CREATE TABLE IF NOT EXISTS trades(id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, detector TEXT,
        status_at_entry TEXT, direction INTEGER, qty INTEGER, signal_ts TEXT, entry_ts TEXT, entry_px REAL, stop REAL,
        target REAL, hold_bars INTEGER, bars_held INTEGER DEFAULT 0, exit_ts TEXT, exit_px REAL, exit_reason TEXT,
        pnl REAL, r REAL, state TEXT, risk_usd REAL, mfe REAL DEFAULT 0, mae REAL DEFAULT 0)""")
    c.execute("CREATE TABLE IF NOT EXISTS log(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, bar_ts TEXT, kind TEXT, msg TEXT)")
    c.row_factory = sqlite3.Row
    return c


def _now():
    return datetime.now(timezone.utc).isoformat()


def get_config() -> TradeConfig:
    with _conn() as c:
        r = c.execute("SELECT v FROM kv WHERE k='config'").fetchone()
    if r is None:
        return TradeConfig()
    d = json.loads(r[0])
    return TradeConfig(**{k: v for k, v in d.items() if k in TradeConfig.__dataclass_fields__})


def set_config(cfg: TradeConfig) -> TradeConfig:
    if cfg.contracts < 1 or cfg.max_contracts < 1 or cfg.stop_atr <= 0 or cfg.daily_loss_limit <= 0:
        raise ValueError("contracts, max_contracts, stop_atr and daily_loss_limit must be positive")
    with _lock, _conn() as c:
        c.execute("INSERT OR REPLACE INTO kv VALUES ('config', ?)", (json.dumps(asdict(cfg)),))
    return cfg


def _kv(k, default=None):
    with _conn() as c:
        r = c.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return default if r is None else json.loads(r[0])


def _set_kv(k, v):
    with _lock, _conn() as c:
        c.execute("INSERT OR REPLACE INTO kv VALUES (?,?)", (k, json.dumps(v)))


def log(kind: str, msg: str, bar_ts=None):
    with _lock, _conn() as c:
        c.execute("INSERT INTO log(ts,bar_ts,kind,msg) VALUES (?,?,?,?)", (_now(), str(bar_ts) if bar_ts is not None else None, kind, msg))


def trades(state: str | None = None) -> list[dict]:
    with _conn() as c:
        q = "SELECT * FROM trades" + (" WHERE state=?" if state else "") + " ORDER BY id"
        return [dict(r) for r in c.execute(q, (state,) if state else ())]


def _update_trade(tid: int, **kw):
    cols = ", ".join(f"{k}=?" for k in kw)
    with _lock, _conn() as c:
        c.execute(f"UPDATE trades SET {cols} WHERE id=?", (*kw.values(), tid))


def trading_day(ts: pd.Timestamp):
    return (ts.tz_convert(ET) + pd.Timedelta(hours=6)).date()


def costs():
    from ..workspace import WS
    return WS.costs


def fee_per_side(qty: int) -> float:
    c = costs()
    return (c.commission_per_side + c.exchange_fees_per_side) * qty


# ------------------------------------------------------------- execution --

def _fill_pending(t: dict, bar_ts, bar) -> None:
    """Fill at this bar's open. Until filled, the row stores the signal-bar
    close in entry_px (reference), the reference stop, and the target DISTANCE;
    the stop/target are re-anchored to the actual fill price."""
    slip = max(costs().slippage_ticks_entry, 1.0) * MGC.tick_size   # market order: at least 1 tick
    px = float(bar["open"]) + t["direction"] * slip
    stop_dist = abs(t["entry_px"] - t["stop"])
    stop = px - t["direction"] * stop_dist
    target = px + t["direction"] * t["target"] if t["target"] else None
    _update_trade(t["id"], state="open", entry_ts=str(bar_ts), entry_px=px, stop=stop, target=target,
                  risk_usd=stop_dist * MGC.multiplier_oz * t["qty"])
    log("fill", f"#{t['id']} {'LONG' if t['direction'] > 0 else 'SHORT'} {t['qty']} @ {px:.1f} (stop {stop:.1f}"
        + (f", target {target:.1f}" if target else "") + f", exit after {t['hold_bars']} bars)", bar_ts)


def _close(t: dict, bar_ts, px: float, reason: str):
    pts = (px - t["entry_px"]) * t["direction"]
    gross = pts * MGC.multiplier_oz * t["qty"]
    net = gross - 2 * fee_per_side(t["qty"])
    r = net / t["risk_usd"] if t["risk_usd"] else None
    _update_trade(t["id"], state="closed", exit_ts=str(bar_ts), exit_px=px, exit_reason=reason, pnl=net, r=r)
    log("exit", f"#{t['id']} closed @ {px:.1f} ({reason}) net ${net:+.2f}" + (f" ({r:+.2f}R)" if r is not None else ""), bar_ts)


def manage_bar(bar_ts, bar) -> None:
    """Apply one closed bar to pending and open trades."""
    c = costs()
    slip_x = c.slippage_ticks_exit * MGC.tick_size
    for t in trades("pending"):
        if pd.Timestamp(t["signal_ts"]) < bar_ts:
            _fill_pending(t, bar_ts, bar)
    for t in trades("open"):
        if pd.Timestamp(t["entry_ts"]) > bar_ts:
            continue
        d, o, h, l, cl = t["direction"], float(bar["open"]), float(bar["high"]), float(bar["low"]), float(bar["close"])
        fav = (h - t["entry_px"]) if d > 0 else (t["entry_px"] - l)
        adv = (t["entry_px"] - l) if d > 0 else (h - t["entry_px"])
        held = t["bars_held"] + 1
        _update_trade(t["id"], bars_held=held, mfe=max(t["mfe"] or 0, fav), mae=max(t["mae"] or 0, adv))
        stop_hit = (l <= t["stop"]) if d > 0 else (h >= t["stop"])
        tgt_hit = t["target"] is not None and ((h >= t["target"]) if d > 0 else (l <= t["target"]))
        if stop_hit:
            gap = (o < t["stop"]) if d > 0 else (o > t["stop"])
            px = (o if gap else t["stop"]) - d * slip_x
            _close(t, bar_ts, px, "stop (gap)" if gap else "stop")
        elif tgt_hit:
            _close(t, bar_ts, t["target"], "target")
        elif held >= t["hold_bars"]:
            _close(t, bar_ts, cl - d * slip_x, "time exit")


def day_stats(day) -> dict:
    closed = [t for t in trades("closed") if trading_day(pd.Timestamp(t["exit_ts"])) == day]
    opened = [t for t in trades() if t["signal_ts"] and trading_day(pd.Timestamp(t["signal_ts"])) == day]
    return {"pnl": float(sum(t["pnl"] for t in closed)), "trades": len(opened)}


def entry_blocked(bar_ts: pd.Timestamp, cfg: TradeConfig) -> str | None:
    if trades("open") or trades("pending"):
        return "already in a position (one at a time)"
    et = bar_ts.tz_convert(ET)
    mins = et.hour * 60 + et.minute
    if 16 * 60 + 50 <= mins < 18 * 60:
        return "too close to the 17:00 ET daily close"
    if et.dayofweek == 4 and mins >= 16 * 60:
        return "Friday after 16:00 ET (no weekend risk)"
    ds = day_stats(trading_day(bar_ts))
    if ds["pnl"] <= -cfg.daily_loss_limit:
        return f"daily loss limit reached (${ds['pnl']:.2f})"
    if ds["trades"] >= cfg.max_trades_per_day:
        return f"max trades per day reached ({ds['trades']})"
    return None


def create_order(*, source: str, detector: str, status: str, direction: int, signal_ts, close: float, atr: float,
                 hold_bars: int, cfg: TradeConfig) -> int | None:
    if not (atr and atr > 0 and math.isfinite(atr)):
        log("skip", f"{detector}: ATR unavailable", signal_ts)
        return None
    stop_dist = cfg.stop_atr * atr
    if cfg.sizing == "risk_pct":
        qty = int(equity()["equity"] * cfg.risk_pct / 100 // (stop_dist * MGC.multiplier_oz))
    else:
        qty = cfg.contracts
    qty = min(qty, cfg.max_contracts)
    if qty < 1:
        log("skip", f"{detector}: position size < 1 contract for a {stop_dist:.1f}-point stop at {cfg.risk_pct}% risk", signal_ts)
        return None
    with _lock, _conn() as c:
        cur = c.execute("""INSERT INTO trades(source,detector,status_at_entry,direction,qty,signal_ts,entry_px,stop,target,hold_bars,state)
                           VALUES (?,?,?,?,?,?,?,?,?,?, 'pending')""",
                        (source, detector, status, direction, qty, str(signal_ts), close, close - direction * stop_dist,
                         (cfg.target_r * stop_dist) if cfg.target_r > 0 else None, hold_bars))
        tid = cur.lastrowid
    log("order", f"#{tid} {source}: {detector} [{status}] → {'BUY' if direction > 0 else 'SELL'} {qty} MGC at next bar open "
        f"(stop {cfg.stop_atr}×ATR = {stop_dist:.1f} pts)", signal_ts)
    return tid


def flatten(reason: str = "manual flatten") -> int:
    """Close everything at the last known close (paper)."""
    from ..engine import store
    cfg = get_config()
    df = store.load(cfg.interval)
    n = 0
    for t in trades("pending"):
        _update_trade(t["id"], state="cancelled", exit_reason=reason)
        log("cancel", f"#{t['id']} cancelled ({reason})")
        n += 1
    if trades("open"):
        if df.empty:
            raise RuntimeError("No price data to flatten against")
        ts, px = df.index[-1], float(df["close"].iloc[-1])
        slip = costs().slippage_ticks_exit * MGC.tick_size
        for t in trades("open"):
            _close(t, ts, px - t["direction"] * slip, reason)
            n += 1
    return n


def equity(last_close: float | None = None) -> dict:
    cfg = get_config()
    closed = trades("closed")
    realised = float(sum(t["pnl"] for t in closed))
    unreal = 0.0
    if last_close is not None:
        for t in trades("open"):
            unreal += (last_close - t["entry_px"]) * t["direction"] * MGC.multiplier_oz * t["qty"] - fee_per_side(t["qty"])
    return {"starting": cfg.starting_equity, "realised": realised, "unrealised": unreal,
            "equity": cfg.starting_equity + realised + unreal}


def reset_account() -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM trades")
        c.execute("DELETE FROM log")
        c.execute("DELETE FROM kv WHERE k='last_bar'")
    log("reset", "Paper account reset")


def last_processed():
    v = _kv("last_bar")
    return pd.Timestamp(v) if v else None


def set_last_processed(ts):
    _set_kv("last_bar", str(ts))


def recent_log(n: int = 60) -> list[dict]:
    with _conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM log ORDER BY id DESC LIMIT ?", (n,))]


def performance() -> dict:
    cl = trades("closed")
    if not cl:
        return {"n": 0}
    pnl = np.array([t["pnl"] for t in cl])
    r = np.array([t["r"] for t in cl if t["r"] is not None])
    eq = np.cumsum(pnl)
    dd = eq - np.maximum.accumulate(np.concatenate([[0], eq]))[1:]
    gl = -pnl[pnl < 0].sum()
    return {"n": len(cl), "wins": int((pnl > 0).sum()), "win_rate": float((pnl > 0).mean()),
            "net_pnl": float(pnl.sum()), "avg_pnl": float(pnl.mean()), "avg_r": float(r.mean()) if len(r) else None,
            "profit_factor": float(pnl[pnl > 0].sum() / gl) if gl > 0 else None,
            "max_drawdown": float(-dd.min()) if len(dd) else 0.0,
            "equity_curve": {"t": [t["exit_ts"] for t in cl], "equity": (get_config().starting_equity + eq).tolist()},
            "by_detector": pd.DataFrame(cl).groupby("detector").agg(n=("pnl", "size"), pnl=("pnl", "sum"), avg_r=("r", "mean")).reset_index().to_dict(orient="records"),
            "note": "PAPER results on delayed bars. Small samples are not evidence of an edge."}
