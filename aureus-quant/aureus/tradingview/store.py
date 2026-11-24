"""TradingView webhook bridge.

TradingView offers no API for reading manual chart drawings. Instead, the
"AUREUS TBS Marker" Pine indicator (tradingview/aureus_tbs_marker.pine) lets
you mark a setup by clicking entry / stop / target on the chart and ticking
the Daily CRT / 4H CRT / AMD / TBS boxes. It then tracks fill, exit, MFE and
MAE on the chart's own bars and sends its full state as a webhook alert.

Every message is a full-state *upsert* keyed by the setup id, so repeated or
out-of-order deliveries are harmless. Each message must carry the shared
token; anything else is rejected.
"""
from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parents[2] / "data"
TOKEN_FILE = DATA / "runs" / "webhook_token.txt"
DB = DATA / "journal" / "tradingview.sqlite"
ET = "America/New_York"


def token() -> str:
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not TOKEN_FILE.exists():
        TOKEN_FILE.write_text(secrets.token_urlsafe(18))
    return TOKEN_FILE.read_text().strip()


def _conn():
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB)
    c.execute("CREATE TABLE IF NOT EXISTS tv_setups(id TEXT PRIMARY KEY, received TEXT, payload TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS tv_log(n INTEGER PRIMARY KEY AUTOINCREMENT, received TEXT, payload TEXT)")
    return c


REQUIRED = ["id", "state", "direction", "entry", "stop"]


def ingest(raw: str | bytes) -> dict:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Alert body is not valid JSON: {e}") from e
    if not secrets.compare_digest(str(msg.get("token", "")), token()):
        raise PermissionError("Invalid or missing token")
    missing = [k for k in REQUIRED if k not in msg]
    if missing:
        raise ValueError(f"Alert missing fields: {missing}")
    msg.pop("token")
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as c:
        c.execute("INSERT INTO tv_log(received,payload) VALUES (?,?)", (now, json.dumps(msg)))
        c.execute("INSERT INTO tv_setups(id,received,payload) VALUES (?,?,?) "
                  "ON CONFLICT(id) DO UPDATE SET received=excluded.received, payload=excluded.payload",
                  (str(msg["id"]), now, json.dumps(msg)))
    return {"stored": True, "id": msg["id"], "state": msg["state"]}


def setups() -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT id, received, payload FROM tv_setups ORDER BY id").fetchall()
    return [{"id": r[0], "received": r[1], **json.loads(r[2])} for r in rows]


def delete(setup_id: str) -> None:
    with _conn() as c:
        c.execute("DELETE FROM tv_setups WHERE id=?", (setup_id,))


def _num(v):
    try:
        f = float(v)
        return None if f != f else f
    except (TypeError, ValueError):
        return None


def as_journal_rows() -> pd.DataFrame:
    """Convert filled TradingView setups into journal-format rows
    (same columns as the CSV journal). Unfilled setups are not trades."""
    rows = []
    for s in setups():
        fill_ms = _num(s.get("fill_time"))
        if s.get("state") not in ("open", "closed") or not fill_ms:
            continue
        t = pd.Timestamp(int(fill_ms), unit="ms", tz="UTC").tz_convert(ET)
        closed = s.get("state") == "closed"
        rows.append({
            "date": t.strftime("%Y-%m-%d"), "time": t.strftime("%H:%M"), "timezone": ET,
            "direction": str(s["direction"]).lower(),
            "daily_crt": str(s.get("daily_crt", "none")).lower(),
            "h4_crt": str(s.get("h4_crt", "none")).lower(),
            "amd_aligned": bool(s.get("amd_aligned")), "tbs_confirmed": bool(s.get("tbs_confirmed", True)),
            "entry": _num(s["entry"]), "stop": _num(s["stop"]), "target": _num(s.get("target")),
            "contracts": _num(s.get("contracts")) or 1,
            "exit": _num(s.get("exit_price")) if closed else None,
            "mfe": _num(s.get("mfe")), "mae": _num(s.get("mae")),
            "news": s.get("news") or "none",
            "notes": (f"TradingView {s.get('symbol', '')} {s.get('timeframe', '')} id={s['id']} exit={s.get('exit_reason', '')} "
                      f"crt_source={s.get('crt_source', 'manual')} D[{s.get('daily_crt_low')}-{s.get('daily_crt_high')}] "
                      f"4H[{s.get('h4_crt_low')}-{s.get('h4_crt_high')}]"),
        })
    return pd.DataFrame(rows)
