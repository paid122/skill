"""Persistent MGC1! bar store + market-data feeds.

Bars are upserted into SQLite so history keeps growing beyond what a free
source serves at once (Yahoo only returns ~7 days of 1-minute bars and ~60
days of 5-minute bars per request).

Feeds
-----
* ``yahoo``     — Yahoo Finance ``MGC=F`` (continuous front month). FREE but
                  DELAYED (~10 min for CME futures), unofficial, and not an
                  exchange-licensed feed. Good for research; not for execution.
* ``databento`` — CME Globex MDP 3.0 via Databento (licensed, paid). Set
                  AUREUS_FEED=databento and DATABENTO_API_KEY.
* ``none``      — no automatic updates; import CSVs instead.

Nothing is ever synthesised: if a fetch fails, the store keeps the last real
bars and the status endpoint reports the error and the data age.
"""
from __future__ import annotations

import io
import os
import sqlite3
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

DB = Path(os.getenv("AUREUS_MARKET_DB", Path(__file__).resolve().parents[2] / "data" / "market" / "mgc.sqlite"))
_lock = threading.Lock()

# Yahoo per-request history limits by interval
YAHOO_PERIOD = {"1m": "7d", "5m": "60d", "15m": "60d", "1h": "730d", "1d": "max"}


def _conn():
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB, timeout=30)
    c.execute("""CREATE TABLE IF NOT EXISTS bars(
        interval TEXT, ts INTEGER, open REAL, high REAL, low REAL, close REAL, volume REAL,
        source TEXT, PRIMARY KEY(interval, ts))""")
    c.execute("CREATE TABLE IF NOT EXISTS fetch_log(ts TEXT, interval TEXT, source TEXT, rows INTEGER, error TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS aux(symbol TEXT, ts INTEGER, close REAL, PRIMARY KEY(symbol, ts))")
    c.execute("CREATE TABLE IF NOT EXISTS snapshots(kind TEXT, ts TEXT, payload TEXT)")
    return c


# Daily auxiliary series: name -> Yahoo symbol
AUX = {"DXY": "DX-Y.NYB", "US10Y": "^TNX", "GVZ": "^GVZ", "GLD": "GLD"}


def upsert_aux(name: str, s: pd.Series) -> int:
    s = s.dropna()
    rows = [(name, int(t.value // 10**9), float(v)) for t, v in s.items()]
    with _lock, _conn() as c:
        c.executemany("INSERT OR REPLACE INTO aux VALUES (?,?,?)", rows)
    return len(rows)


def load_aux(name: str) -> pd.Series | None:
    with _conn() as c:
        rows = c.execute("SELECT ts, close FROM aux WHERE symbol=? ORDER BY ts", (name,)).fetchall()
    if not rows:
        return None
    return pd.Series([r[1] for r in rows], index=pd.to_datetime([r[0] for r in rows], unit="s", utc=True), name=name)


def save_snapshot(kind: str, payload: dict) -> None:
    import json
    from ..core import _jsonable
    with _lock, _conn() as c:
        c.execute("INSERT INTO snapshots VALUES (?,?,?)", (kind, datetime.now(timezone.utc).isoformat(), json.dumps(_jsonable(payload))))


def last_snapshot(kind: str) -> dict | None:
    import json
    with _conn() as c:
        r = c.execute("SELECT ts, payload FROM snapshots WHERE kind=? ORDER BY rowid DESC LIMIT 1", (kind,)).fetchone()
    return None if r is None else {"saved_at": r[0], **json.loads(r[1])}


def upsert(df: pd.DataFrame, interval: str, source: str) -> int:
    """df: UTC-indexed OHLCV. Returns rows written."""
    if df is None or df.empty:
        return 0
    d = df[["open", "high", "low", "close", "volume"]].dropna(subset=["open", "high", "low", "close"])
    rows = [(interval, int(t.value // 10**9), float(r.open), float(r.high), float(r.low), float(r.close),
             float(r.volume) if pd.notna(r.volume) else 0.0, source) for t, r in d.iterrows()]
    with _lock, _conn() as c:
        c.executemany("INSERT OR REPLACE INTO bars VALUES (?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def load(interval: str) -> pd.DataFrame:
    with _conn() as c:
        df = pd.read_sql_query("SELECT ts, open, high, low, close, volume, source FROM bars WHERE interval=? ORDER BY ts",
                               c, params=(interval,))
    if df.empty:
        return df
    df.index = pd.to_datetime(df.pop("ts"), unit="s", utc=True)
    df.index.name = "timestamp"
    return df


def coverage() -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT interval, COUNT(*), MIN(ts), MAX(ts), GROUP_CONCAT(DISTINCT source) FROM bars GROUP BY interval").fetchall()
    return [{"interval": r[0], "bars": r[1],
             "first": pd.Timestamp(r[2], unit="s", tz="UTC").isoformat(),
             "last": pd.Timestamp(r[3], unit="s", tz="UTC").isoformat(), "sources": r[4]} for r in rows]


def log_fetch(interval: str, source: str, rows: int, error: str | None):
    with _lock, _conn() as c:
        c.execute("INSERT INTO fetch_log VALUES (?,?,?,?,?)", (datetime.now(timezone.utc).isoformat(), interval, source, rows, error))


def last_fetches(n: int = 20) -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT ts, interval, source, rows, error FROM fetch_log ORDER BY rowid DESC LIMIT ?", (n,)).fetchall()
    return [dict(zip(["ts", "interval", "source", "rows", "error"], r)) for r in rows]


# ------------------------------------------------------------------ feeds --

@dataclass
class FeedInfo:
    name: str
    provenance: str
    description: str
    delay: str
    licensed: bool
    notes: list[str] = field(default_factory=list)


class YahooFeed:
    info = FeedInfo(
        name="yahoo", provenance="DELAYED",
        description="Yahoo Finance MGC=F (continuous front-month Micro Gold)",
        delay="≈10 minutes (CME delayed data)", licensed=False,
        notes=["Unofficial source: occasional missing or revised bars.",
               "Continuous contract is not back-adjusted at rolls (Feb/Apr/Jun/Aug/Oct/Dec).",
               "For research only — never for order execution."])

    def fetch(self, interval: str) -> pd.DataFrame:
        import yfinance as yf

        raw = yf.download("MGC=F", period=YAHOO_PERIOD[interval], interval=interval, progress=False,
                          auto_adjust=False, prepost=True, threads=False)
        if raw is None or raw.empty:
            raise RuntimeError("Yahoo returned no data (rate-limited, or market data unavailable)")
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        raw = raw.rename(columns=str.lower)
        idx = pd.DatetimeIndex(raw.index)
        raw.index = idx.tz_localize("UTC") if idx.tz is None else idx.tz_convert("UTC")
        return raw[["open", "high", "low", "close", "volume"]]


class DatabentoFeed:
    info = FeedInfo(name="databento", provenance="LIVE", description="Databento GLBX.MDP3 MGC.c.0",
                    delay="near real-time (historical API publication lag)", licensed=True)
    SCHEMA = {"1m": "ohlcv-1m", "1h": "ohlcv-1h", "1d": "ohlcv-1d"}

    def __init__(self):
        import databento as db
        self.client = db.Historical(os.environ["DATABENTO_API_KEY"])

    def fetch(self, interval: str) -> pd.DataFrame:
        if interval not in self.SCHEMA:
            raise ValueError(f"Databento adapter supports {list(self.SCHEMA)}")
        end = pd.Timestamp.now(tz="UTC").floor("min")
        start = end - {"1m": pd.Timedelta(days=5), "1h": pd.Timedelta(days=365), "1d": pd.Timedelta(days=3650)}[interval]
        df = self.client.timeseries.get_range(dataset="GLBX.MDP3", symbols=["MGC.c.0"], stype_in="continuous",
                                              schema=self.SCHEMA[interval], start=start, end=end).to_df()
        df.index = pd.to_datetime(df.index, utc=True)
        return df[["open", "high", "low", "close", "volume"]]


def get_feed():
    which = os.getenv("AUREUS_FEED", "yahoo").lower()
    if which == "none":
        return None
    if which == "databento":
        return DatabentoFeed()
    try:
        import yfinance  # noqa: F401
    except ImportError:
        return None
    return YahooFeed()


def with_retry(fn, tries: int = 3, base_sleep: float = 2.0):
    """Call fn(); on an exception or empty result wait 2s, 4s… and retry.
    Yahoo intermittently answers 'no data' when it is throttling."""
    import time
    last = None
    for i in range(tries):
        try:
            out = fn()
            if out is None or (hasattr(out, "empty") and out.empty):
                raise RuntimeError("no data")
            return out
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(base_sleep * (2 ** i))
    raise last


def update_aux() -> list[dict]:
    """Daily DXY, US 10y yield, CBOE gold volatility index (GVZ) and GLD from Yahoo."""
    import yfinance as yf
    out = []
    for name, sym in AUX.items():
        try:
            d = with_retry(lambda: yf.download(sym, period="5y", interval="1d", progress=False, auto_adjust=False, threads=False))
            if isinstance(d.columns, pd.MultiIndex):
                d.columns = d.columns.get_level_values(0)
            idx = pd.DatetimeIndex(d.index)
            close = pd.Series(d["Close"].to_numpy(), index=idx.tz_localize("UTC") if idx.tz is None else idx.tz_convert("UTC"))
            n = upsert_aux(name, close)
            log_fetch(f"aux:{name}", "yahoo", n, None)
            out.append({"series": name, "rows": n})
            import time
            time.sleep(1.0)   # be gentle with Yahoo
        except Exception as e:  # noqa: BLE001
            log_fetch(f"aux:{name}", "yahoo", 0, str(e)[:300])
            out.append({"series": name, "error": str(e)[:300]})
            if name == "GVZ":
                out.append(fetch_gvz_cboe())
    return out


CBOE_GVZ_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/GVZ_History.csv"


def fetch_gvz_cboe() -> dict:
    """Fallback: CBOE's own published GVZ daily history (the index publisher)."""
    try:
        import urllib.request
        from .ivwalls import load_iv_csv
        with urllib.request.urlopen(CBOE_GVZ_URL, timeout=30) as r:
            s = load_iv_csv(io.StringIO(r.read().decode()))
        n = upsert_aux("GVZ", s)
        log_fetch("aux:GVZ", "cboe", n, None)
        return {"series": "GVZ (CBOE)", "rows": n}
    except Exception as e:  # noqa: BLE001
        log_fetch("aux:GVZ", "cboe", 0, str(e)[:300])
        return {"series": "GVZ (CBOE)", "error": str(e)[:300]}


def update(intervals=("1m", "5m", "1h", "1d")) -> dict:
    feed = get_feed()
    if feed is None:
        return {"feed": None, "results": [], "note": "No automatic feed configured (AUREUS_FEED=none or yfinance missing)."}
    out = []
    for iv in intervals:
        try:
            df = with_retry(lambda: feed.fetch(iv)) if feed.info.name == "yahoo" else feed.fetch(iv)
            n = upsert(df, iv, feed.info.name)
            log_fetch(iv, feed.info.name, n, None)
            out.append({"interval": iv, "rows": n, "last": df.index.max().isoformat() if n else None})
        except Exception as e:  # noqa: BLE001 - report, never fabricate
            log_fetch(iv, feed.info.name, 0, str(e)[:300])
            out.append({"interval": iv, "error": str(e)[:300]})
    return {"feed": feed.info.__dict__, "results": out}
