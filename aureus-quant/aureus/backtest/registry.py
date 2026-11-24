"""Research-run registry: every analysis run is recorded with its parameters,
parameter hash, input-data fingerprints, code/model versions and timestamp so
any reported number can be reproduced.

SQLite is used by default (zero setup). For production, point
``AUREUS_DB`` at PostgreSQL/TimescaleDB via SQLAlchemy — the schema is the same.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .. import __version__
from ..core import _jsonable, config_hash

DB_PATH = Path(os.getenv("AUREUS_DB", Path(__file__).resolve().parents[2] / "data" / "runs" / "registry.sqlite"))


def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.execute("""CREATE TABLE IF NOT EXISTS runs(
        id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, code_version TEXT,
        params_hash TEXT, params TEXT, data_fingerprints TEXT, summary TEXT)""")
    return c


def fingerprint(df: pd.DataFrame | None) -> str | None:
    if df is None or len(df) == 0:
        return None
    return hashlib.sha256(pd.util.hash_pandas_object(df.reset_index(drop=True).astype(str), index=False).values.tobytes()).hexdigest()[:16]


def record_run(kind: str, params: dict, data: dict[str, pd.DataFrame | None], summary: dict) -> dict:
    fp = {k: fingerprint(v) for k, v in data.items()}
    row = {"ts": datetime.now(timezone.utc).isoformat(), "kind": kind, "code_version": __version__,
           "params_hash": config_hash(params), "params": params, "data_fingerprints": fp}
    with _conn() as c:
        cur = c.execute("INSERT INTO runs(ts,kind,code_version,params_hash,params,data_fingerprints,summary) VALUES (?,?,?,?,?,?,?)",
                        (row["ts"], kind, __version__, row["params_hash"], json.dumps(_jsonable(params)),
                         json.dumps(fp), json.dumps(_jsonable(summary))[:20000]))
        row["id"] = cur.lastrowid
    return row


def list_runs(limit: int = 50) -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT id,ts,kind,code_version,params_hash,params,data_fingerprints FROM runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{"id": r[0], "ts": r[1], "kind": r[2], "code_version": r[3], "params_hash": r[4],
             "params": json.loads(r[5]), "data_fingerprints": json.loads(r[6])} for r in rows]
