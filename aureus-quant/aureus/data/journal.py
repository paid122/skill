"""TBS trade-journal import and validation.

The journal is the ground truth for all strategy research. AUREUS never
creates trades; it only reads the ones you record.

CSV columns (case-insensitive; * = required):
    *date            YYYY-MM-DD (trade date, exchange time)
    *time            HH:MM (entry time)
     timezone        IANA tz of date/time (default America/New_York)
    *direction       long | short
     session         asia | london | ny_am | ny_pm | other  (derived from time if blank)
     daily_crt       bullish | bearish | none
     h4_crt          bullish | bearish | none
     amd_aligned     true | false
     tbs_confirmed   true | false
    *entry           entry price
    *stop            stop-loss price
     target          take-profit price
     contracts       number of MGC contracts (default 1)
     exit            exit price
     r_multiple      final R (computed from prices if blank)
     mfe             max favourable excursion, in price (or mfe_r in R)
     mae             max adverse excursion, in price (or mae_r in R)
     atr             ATR(14) at entry, in price
     news            none | high | medium | low  or an event name
     commission      round-turn commission in $ (overrides the default)
     notes
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..core import MGC, Provenance

REQUIRED = ["date", "time", "direction", "entry", "stop"]
BOOL_COLS = ["amd_aligned", "tbs_confirmed"]
ET = "America/New_York"


def _to_bool(s: pd.Series) -> pd.Series:
    m = {"true": True, "t": True, "yes": True, "y": True, "1": True,
         "false": False, "f": False, "no": False, "n": False, "0": False}
    return s.astype(str).str.strip().str.lower().map(m)


def session_of(ts_et: pd.Timestamp) -> str:
    """Session buckets (ET). Boundaries are configurable conventions, not facts."""
    h = ts_et.hour + ts_et.minute / 60
    if 18 <= h or h < 2:
        return "asia"
    if 2 <= h < 7:
        return "london"
    if 7 <= h < 12:
        return "ny_am"
    if 12 <= h < 17:
        return "ny_pm"
    return "other"


def load_journal(path_or_buf, *, provenance: Provenance = Provenance.HISTORICAL) -> tuple[pd.DataFrame, list[str]]:
    df = pd.read_csv(path_or_buf)
    df.columns = [c.strip().lower() for c in df.columns]
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"Journal is missing required columns: {missing}")
    return normalise_journal(df, provenance=provenance)


def normalise_journal(df: pd.DataFrame, *, provenance: Provenance = Provenance.HISTORICAL) -> tuple[pd.DataFrame, list[str]]:
    warnings: list[str] = []
    df = df.copy()
    tzcol = df["timezone"] if "timezone" in df.columns else pd.Series(ET, index=df.index)
    stamps = []
    for d, t, tz in zip(df["date"], df["time"], tzcol.fillna(ET)):
        ts = pd.Timestamp(f"{d} {t}")
        ts = ts.tz_localize(tz) if ts.tzinfo is None else ts
        stamps.append(ts.tz_convert(ET))
    df["entry_time"] = stamps
    df["weekday"] = [s.day_name() for s in df["entry_time"]]

    df["direction"] = df["direction"].astype(str).str.strip().str.lower().replace({"buy": "long", "sell": "short"})
    bad_dir = ~df["direction"].isin(["long", "short"])
    if bad_dir.any():
        raise ValueError(f"Invalid direction on rows {list(df.index[bad_dir])}")

    for c in ["entry", "stop", "target", "exit", "r_multiple", "mfe", "mae", "mfe_r", "mae_r", "atr", "contracts", "commission"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    if "contracts" not in df.columns:
        df["contracts"] = 1.0
    df["contracts"] = df["contracts"].fillna(1.0)

    for c in BOOL_COLS:
        df[c] = _to_bool(df[c]) if c in df.columns else np.nan
    for c in ["daily_crt", "h4_crt"]:
        df[c] = df[c].astype(str).str.strip().str.lower().replace({"nan": None, "": None}) if c in df.columns else None

    if "session" not in df.columns:
        df["session"] = None
    df["session"] = [s if isinstance(s, str) and s.strip() else session_of(t) for s, t in zip(df["session"], df["entry_time"])]

    sign = np.where(df["direction"] == "long", 1.0, -1.0)
    df["risk_price"] = (df["entry"] - df["stop"]) * sign
    bad_risk = df["risk_price"] <= 0
    if bad_risk.any():
        raise ValueError(f"Stop is on the wrong side of entry (or equal) on rows {list(df.index[bad_risk])}")
    df["risk_ticks"] = df["risk_price"] / MGC.tick_size
    df["risk_dollars"] = df["risk_price"] * MGC.multiplier_oz * df["contracts"]

    # R-multiple: prefer price-derived, cross-check against recorded value
    if "exit" in df.columns:
        r_px = (df["exit"] - df["entry"]) * sign / df["risk_price"]
        if "r_multiple" in df.columns:
            both = r_px.notna() & df["r_multiple"].notna()
            diff = (r_px[both] - df.loc[both, "r_multiple"]).abs()
            n_bad = int((diff > 0.05).sum())
            if n_bad:
                warnings.append(f"{n_bad} trades have a recorded r_multiple that differs from the price-derived R by >0.05R; price-derived R is used.")
            df["r_gross"] = r_px.fillna(df["r_multiple"])
        else:
            df["r_gross"] = r_px
    elif "r_multiple" in df.columns:
        df["r_gross"] = df["r_multiple"]
    else:
        raise ValueError("Journal needs either 'exit' prices or 'r_multiple' values")

    if "mfe_r" not in df.columns:
        df["mfe_r"] = df["mfe"] / df["risk_price"] if "mfe" in df.columns else np.nan
    if "mae_r" not in df.columns:
        df["mae_r"] = df["mae"] / df["risk_price"] if "mae" in df.columns else np.nan

    open_trades = df["r_gross"].isna()
    if open_trades.any():
        warnings.append(f"{int(open_trades.sum())} trades have no exit/R and are excluded from statistics.")
    dups = df.duplicated(subset=["entry_time", "direction", "entry", "stop"], keep="first")
    if dups.any():
        warnings.append(f"{int(dups.sum())} duplicate trade rows removed.")
        df = df[~dups]

    df["news"] = df["news"].fillna("none").astype(str).str.lower() if "news" in df.columns else "none"
    df["provenance"] = provenance.value
    df = df.sort_values("entry_time").reset_index(drop=True)
    df["trade_id"] = np.arange(1, len(df) + 1)
    return df, warnings
