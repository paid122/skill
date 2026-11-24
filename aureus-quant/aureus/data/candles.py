"""Historical candle import, integrity checks and futures rollover handling.

Expected CSV columns (case-insensitive):
    timestamp, open, high, low, close, volume
Optional:
    contract (e.g. MGCZ6), bid, ask, trades

Timestamps must either carry a UTC offset or be accompanied by an explicit
``source_tz`` — the loader refuses to guess a timezone.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..core import MGC, Provenance

REQUIRED = ["timestamp", "open", "high", "low", "close", "volume"]
ET = "America/New_York"


@dataclass
class CandleSet:
    df: pd.DataFrame                 # index = tz-aware UTC timestamps
    timeframe: pd.Timedelta
    provenance: Provenance
    source: str
    contract: str = "MGC1!"
    adjusted: str = "none"           # none | back-adjusted-difference | back-adjusted-ratio
    quality: dict = field(default_factory=dict)

    def header(self) -> dict:
        return {
            "contract": self.contract,
            "source": self.source,
            "provenance": self.provenance.value,
            "timeframe": _tf_label(self.timeframe),
            "first": self.df.index.min().isoformat() if len(self.df) else None,
            "last": self.df.index.max().isoformat() if len(self.df) else None,
            "timezone": "UTC (displayed in America/New_York where noted)",
            "bars": int(len(self.df)),
            "rollover_adjustment": self.adjusted,
        }


def _tf_label(tf: pd.Timedelta) -> str:
    m = int(tf.total_seconds() // 60)
    return f"{m // 1440}D" if m % 1440 == 0 else f"{m // 60}H" if m % 60 == 0 else f"{m}min"


def load_candles_csv(
    path_or_buf,
    *,
    source: str,
    source_tz: str | None = None,
    provenance: Provenance = Provenance.HISTORICAL,
    timeframe: str | None = None,
) -> CandleSet:
    raw = pd.read_csv(path_or_buf)
    raw.columns = [c.strip().lower() for c in raw.columns]
    if "time" in raw.columns and "timestamp" not in raw.columns:
        raw = raw.rename(columns={"time": "timestamp"})
    missing = [c for c in REQUIRED if c not in raw.columns]
    if missing:
        raise ValueError(f"Candle file is missing required columns: {missing}")

    # TradingView "Export chart data" writes `time` as Unix seconds (UTC) or ISO-8601 with offset.
    if pd.api.types.is_numeric_dtype(raw["timestamp"]):
        unit = "ms" if raw["timestamp"].abs().max() > 1e11 else "s"
        ts = pd.to_datetime(raw["timestamp"], unit=unit, utc=True)
    else:
        ts = pd.to_datetime(raw["timestamp"], utc=False, errors="coerce", format="mixed")
    if ts.isna().any():
        raise ValueError(f"{int(ts.isna().sum())} unparseable timestamps")
    if ts.dt.tz is None:
        if source_tz is None:
            raise ValueError(
                "Timestamps have no timezone. Pass source_tz explicitly "
                "(e.g. 'America/New_York' or 'UTC') — AUREUS will not guess."
            )
        ts = ts.dt.tz_localize(source_tz, ambiguous="infer", nonexistent="shift_forward")
    raw["timestamp"] = ts.dt.tz_convert("UTC")
    df = raw.set_index("timestamp").sort_index()

    for c in ["open", "high", "low", "close", "volume", "bid", "ask", "trades"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    tf = pd.Timedelta(timeframe) if timeframe else _infer_timeframe(df.index)
    cs = CandleSet(df=df, timeframe=tf, provenance=provenance, source=source)
    cs.quality = quality_report(cs)
    return cs


def _infer_timeframe(idx: pd.DatetimeIndex) -> pd.Timedelta:
    if len(idx) < 3:
        raise ValueError("Need at least 3 bars to infer the timeframe")
    d = pd.Series(idx.unique()).diff().dropna()
    return d.mode().iloc[0]


# ---------------------------------------------------------------- integrity --

def is_globex_open(ts_utc: pd.DatetimeIndex) -> np.ndarray:
    """CME Globex metals: Sun 18:00 ET → Fri 17:00 ET, daily halt 17:00–18:00 ET.

    Exchange holidays are NOT modelled; missing bars on holidays will be
    reported as gaps and must be reviewed manually.
    """
    et = ts_utc.tz_convert(ET)
    h, dow = et.hour, et.dayofweek  # Mon=0 … Sun=6
    halt = h == 17
    sat = dow == 5
    fri_close = (dow == 4) & (h >= 17)
    sun_pre = (dow == 6) & (h < 18)
    return ~(halt | sat | fri_close | sun_pre)


def quality_report(cs: CandleSet) -> dict:
    df = cs.df
    rep: dict = {}
    dup_mask = df.index.duplicated(keep=False)
    if "contract" in df.columns:
        dup_mask = df.reset_index().duplicated(subset=["timestamp", "contract"], keep=False).to_numpy()
    rep["duplicate_rows"] = int(dup_mask.sum())

    ohlc_bad = (
        (df["high"] < df[["open", "close"]].max(axis=1))
        | (df["low"] > df[["open", "close"]].min(axis=1))
        | (df["high"] < df["low"])
    )
    rep["ohlc_inconsistent_rows"] = int(ohlc_bad.sum())
    rep["non_positive_prices"] = int((df[["open", "high", "low", "close"]] <= 0).any(axis=1).sum())
    rep["null_values"] = int(df[["open", "high", "low", "close"]].isna().any(axis=1).sum())
    rep["negative_volume"] = int((df["volume"] < 0).sum())

    # Off-tick prices (MGC tick = 0.10)
    px = df[["open", "high", "low", "close"]].to_numpy()
    off = np.abs(px / MGC.tick_size - np.round(px / MGC.tick_size)) > 1e-6
    rep["off_tick_rows"] = int(off.any(axis=1).sum())

    # Missing bars inside Globex hours
    uniq = df.index.unique()
    if len(uniq) > 2 and cs.timeframe <= pd.Timedelta("1h"):
        full = pd.date_range(uniq.min(), uniq.max(), freq=cs.timeframe, tz="UTC")
        expected = full[is_globex_open(full)]
        missing = expected.difference(uniq)
        rep["expected_bars"] = int(len(expected))
        rep["missing_bars"] = int(len(missing))
        rep["completeness_pct"] = float(100 * (1 - len(missing) / max(len(expected), 1)))
        # Summarise contiguous gaps
        gaps = []
        if len(missing):
            s = pd.Series(missing)
            grp = (s.diff() != cs.timeframe).cumsum()
            for _, g in s.groupby(grp):
                gaps.append({"start": g.iloc[0].isoformat(), "end": g.iloc[-1].isoformat(), "bars": int(len(g))})
        gaps.sort(key=lambda x: -x["bars"])
        rep["largest_gaps"] = gaps[:10]
        rep["note"] = "Exchange holidays and early closes are not modelled; they appear as gaps."
    rep["ok"] = rep["duplicate_rows"] == 0 and rep["ohlc_inconsistent_rows"] == 0 and rep["null_values"] == 0
    return rep


def drop_duplicates(cs: CandleSet) -> CandleSet:
    keys = ["timestamp", "contract"] if "contract" in cs.df.columns else ["timestamp"]
    df = cs.df.reset_index().drop_duplicates(subset=keys, keep="last").set_index("timestamp").sort_index()
    out = CandleSet(df, cs.timeframe, cs.provenance, cs.source, cs.contract, cs.adjusted)
    out.quality = quality_report(out)
    return out


# ----------------------------------------------------------------- rollover --

def build_continuous(cs: CandleSet, method: str = "difference") -> tuple[CandleSet, pd.DataFrame]:
    """Build a back-adjusted continuous MGC1! series from per-contract bars.

    Requires a ``contract`` column. When contracts overlap in time the roll is
    taken at the first *session* where the next contract's volume exceeds the
    current one (volume-crossover roll), and the adjustment is the price
    difference (or ratio) between the two contracts **at the same timestamp** —
    so no real price movement leaks into the adjustment.

    If the data has no overlap (already a stitched front-month series with a
    contract label), the adjustment falls back to close-to-open gap at the roll
    and this is reported as a limitation.
    """
    if "contract" not in cs.df.columns:
        raise ValueError("No 'contract' column — cannot detect rolls. Supply per-contract data.")
    df = cs.df.copy()
    df["session"] = (df.index.tz_convert(ET) + pd.Timedelta(hours=6)).date  # 18:00 ET session start
    vol = df.groupby(["session", "contract"])["volume"].sum().unstack()
    order = _contract_order(vol.columns)
    front = []
    cur = None
    for sess, row in vol.iterrows():
        avail = [c for c in order if not np.isnan(row.get(c, np.nan))]
        if cur is None or cur not in avail:
            cur = avail[0] if cur is None else next((c for c in order if c in avail and order.index(c) >= order.index(cur)), avail[0])
        nxt_i = order.index(cur) + 1
        if nxt_i < len(order):
            nxt = order[nxt_i]
            if nxt in avail and row[nxt] > row[cur]:
                cur = nxt
        front.append((sess, cur))
    front = pd.Series(dict(front))

    pieces, rolls = [], []
    for sess, c in front.items():
        pieces.append(df[(df["session"] == sess) & (df["contract"] == c)])
    cont = pd.concat(pieces).sort_index()

    # adjustment factors, walking backward from the most recent contract
    seq = front.loc[front.shift() != front]
    adj = {}
    cum = 0.0 if method == "difference" else 1.0
    contracts = list(seq.values)
    for i in range(len(contracts) - 1, 0, -1):
        old, new = contracts[i - 1], contracts[i]
        roll_sess = seq.index[i]
        a = df[(df["session"] == roll_sess) & (df["contract"] == old)]["close"]
        b = df[(df["session"] == roll_sess) & (df["contract"] == new)]["close"]
        common = a.index.intersection(b.index)
        if len(common):
            t = common[0]
            gap = (b.loc[t] - a.loc[t]) if method == "difference" else (b.loc[t] / a.loc[t])
            how = "same-timestamp spread"
        else:
            prev = cont[cont["contract"] == old]["close"]
            nxt = cont[cont["contract"] == new]["open"]
            gap = (nxt.iloc[0] - prev.iloc[-1]) if method == "difference" else (nxt.iloc[0] / prev.iloc[-1])
            how = "close→open gap (NO OVERLAP: includes genuine price change)"
        cum = cum + gap if method == "difference" else cum * gap
        adj[old] = cum
        rolls.append({"session": str(roll_sess), "from": old, "to": new, "adjustment": float(gap), "basis": how})

    for c, a in adj.items():
        m = cont["contract"] == c
        for col in ["open", "high", "low", "close"] + [x for x in ("bid", "ask") if x in cont.columns]:
            cont.loc[m, col] = cont.loc[m, col] + a if method == "difference" else cont.loc[m, col] * a
    cont = cont.drop(columns=["session"])
    out = CandleSet(cont, cs.timeframe, cs.provenance, cs.source, "MGC1! (continuous)", f"back-adjusted-{method}")
    out.quality = quality_report(out)
    return out, pd.DataFrame(rolls)


_MONTH = {m: i for i, m in enumerate("FGHJKMNQUVXZ")}


def _contract_order(codes) -> list[str]:
    """Sort contract codes like MGCZ6 / MGCZ26 chronologically."""
    def key(code: str):
        m = re.match(r"^[A-Z]+?([FGHJKMNQUVXZ])(\d{1,2})$", code.strip().upper())
        if not m:
            raise ValueError(f"Unrecognised contract code {code!r} (expected e.g. MGCZ6 or MGCZ26)")
        mon, yr = m.group(1), int(m.group(2))
        year = 2000 + yr if len(m.group(2)) == 2 else 2020 + yr
        return (year, _MONTH[mon])

    return sorted(codes, key=key)


def resample(cs: CandleSet, rule: str, *, anchor_et_hour: int | None = None) -> pd.DataFrame:
    """Resample to a higher timeframe. Daily bars are anchored to the 18:00 ET
    session open (CME trading day), not midnight UTC."""
    df = cs.df
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    et = df.copy()
    et.index = et.index.tz_convert(ET)
    if rule.upper() in ("1D", "D"):
        # shift so that 18:00 ET becomes midnight, then label by trading date
        shifted = et.copy()
        shifted.index = shifted.index + pd.Timedelta(hours=6)
        out = shifted.resample("1D").agg(agg).dropna(subset=["open"])
        out.index.name = "trading_date"
        return out
    if rule.upper() in ("4H", "240MIN"):
        # CME-style 4H blocks aligned to 18:00 ET: 18,22,02,06,10,14
        shifted = et.copy()
        shifted.index = shifted.index - pd.Timedelta(hours=2)
        out = shifted.resample("4h").agg(agg).dropna(subset=["open"])
        out.index = out.index + pd.Timedelta(hours=2)
        return out
    return et.resample(rule).agg(agg).dropna(subset=["open"])
