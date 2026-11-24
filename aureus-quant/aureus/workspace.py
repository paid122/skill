"""In-process research workspace: holds the imported datasets, applies the cost
model and exposes high-level analyses used by the API and the assistant."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .backtest.costs import CostModel, apply_costs
from .core import MIN_SAMPLE, InsufficientData, Provenance, Result
from .data.candles import CandleSet, load_candles_csv, resample
from .data.journal import load_journal, session_of
from .events.analysis import load_events, mark_event_days
from .features.indicators import feature_frame
from .regime.classifier import RegimeParams, classify, tag_trades

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
ET = "America/New_York"


@dataclass
class Workspace:
    candles: CandleSet | None = None
    journal_raw: pd.DataFrame | None = None
    journal_warnings: list[str] = field(default_factory=list)
    events: pd.DataFrame | None = None
    costs: CostModel = field(default_factory=CostModel)
    regime_params: RegimeParams = field(default_factory=RegimeParams)
    _features: pd.DataFrame | None = None
    _regimes: pd.DataFrame | None = None

    # ------------------------------------------------------------- loading --
    def load_candles(self, src, *, source: str, source_tz: str | None = None,
                     provenance: Provenance = Provenance.HISTORICAL, timeframe: str | None = None) -> dict:
        self.candles = load_candles_csv(src, source=source, source_tz=source_tz, provenance=provenance, timeframe=timeframe)
        self._features = self._regimes = None
        return {"header": self.candles.header(), "quality": self.candles.quality}

    def load_journal(self, src, provenance: Provenance = Provenance.HISTORICAL) -> dict:
        df = pd.read_csv(src)
        df.columns = [c.strip().lower() for c in df.columns]
        self._csv_journal, self._csv_provenance = df, provenance
        return self.rebuild_journal()

    def rebuild_journal(self) -> dict:
        """Journal = uploaded CSV trades + filled setups recorded from TradingView."""
        from .data.journal import REQUIRED, normalise_journal
        from .tradingview.store import as_journal_rows

        parts, prov = [], getattr(self, "_csv_provenance", Provenance.HISTORICAL)
        csv = getattr(self, "_csv_journal", None)
        if csv is not None and len(csv):
            missing = [c for c in REQUIRED if c not in csv.columns]
            if missing:
                raise ValueError(f"Journal is missing required columns: {missing}")
            parts.append(csv.assign(source="csv"))
        tv = as_journal_rows() if prov != Provenance.SIMULATED else pd.DataFrame()
        if len(tv):
            parts.append(tv.assign(source="tradingview"))
        if not parts:
            self.journal_raw, self.journal_warnings = None, []
            return {"trades": 0, "warnings": [], "provenance": None}
        self.journal_raw, self.journal_warnings = normalise_journal(pd.concat(parts, ignore_index=True), provenance=prov)
        return {"trades": int(len(self.journal_raw)), "warnings": self.journal_warnings, "provenance": prov.value,
                "from_tradingview": int(len(tv))}

    def load_events(self, src) -> dict:
        self.events = load_events(src)
        return {"events": int(len(self.events)), "types": sorted(self.events["event"].unique().tolist())}

    def autoload(self) -> dict:
        """Load the first CSV found in data/candles, data/journal, data/events,
        plus any setups already received from TradingView."""
        out = self._autoload_files()
        if self.journal_raw is None:
            out["tradingview"] = self.rebuild_journal()
        return out

    def _autoload_files(self) -> dict:
        """Load the first CSV found in data/candles, data/journal, data/events."""
        out = {}
        for kind, fn in [("candles", None), ("journal", self.load_journal), ("events", self.load_events)]:
            files = sorted((DATA_DIR / kind).glob("*.csv"))
            if not files:
                continue
            if kind == "candles":
                out[kind] = self.load_candles(files[0], source=f"file:{files[0].name}", source_tz="UTC")
            else:
                out[kind] = fn(files[0])
        return out

    def simulated_inputs(self) -> list[str]:
        out = []
        if self.candles is not None and self.candles.provenance == Provenance.SIMULATED:
            out.append("candles")
        if self.journal_raw is not None and len(self.journal_raw) and self.journal_raw["provenance"].iloc[0] == "SIMULATED":
            out.append("journal")
        return out

    # ------------------------------------------------------------- derived --
    @property
    def features(self) -> pd.DataFrame:
        self._need_candles()
        if self._features is None:
            self._features = feature_frame(self.candles.df, self.candles.timeframe)
        return self._features

    @property
    def regimes(self) -> pd.DataFrame:
        self._need_candles()
        if self._regimes is None:
            self._regimes = classify(self.candles.df, self.candles.timeframe, self.regime_params)
        return self._regimes

    @property
    def journal(self) -> pd.DataFrame:
        if self.journal_raw is None:
            raise InsufficientData("No trade journal imported. Upload a TBS journal CSV in Data Management.")
        j = apply_costs(self.journal_raw, self.costs)
        if self.candles is not None:
            j = tag_trades(j, self.regimes)
        if self.events is not None:
            j = mark_event_days(j, self.events)
        return j

    def _need_candles(self):
        if self.candles is None:
            raise InsufficientData("No candle data imported. Upload MGC candles in Data Management.")

    # ------------------------------------------------------ market metrics --
    def market_snapshot(self) -> dict:
        self._need_candles()
        df, f = self.candles.df, self.features
        last = df.index[-1]
        row, frow = df.iloc[-1], f.iloc[-1]
        daily = resample(self.candles, "1D")
        return {
            "header": self.candles.header(),
            "as_of_utc": last.isoformat(),
            "as_of_et": last.tz_convert(ET).isoformat(),
            "ohlcv": {k: float(row[k]) for k in ["open", "high", "low", "close", "volume"]},
            "anatomy": {k: _f(frow.get(k)) for k in ["range", "body", "upper_wick", "lower_wick", "change", "change_ticks", "change_dollars", "spread"]},
            "atr14": _f(frow["atr14"]), "atr14_dollars": _f(frow["atr14"] * 10),
            "atr_pct_rank": _f(frow["atr_pct_rank"]), "rv_annualised": _f(frow["rv_1d"]),
            "rolling_std_20": _f(frow["rolling_std_20"]), "er20": _f(frow["er20"]), "adx14": _f(frow["adx14"]),
            "trend": int(frow["trend"]) if not pd.isna(frow["trend"]) else None,
            "regime": self.regimes["regime_name"].iloc[-1],
            "prev_day": {"high": _f(daily["high"].iloc[-2]), "low": _f(daily["low"].iloc[-2])} if len(daily) > 1 else None,
            "daily_atr14": _f(_daily_atr(daily)),
            "notice": ("Values are computed from the last imported bar — NOT live." if self.candles.provenance != Provenance.LIVE
                       else "Live feed."),
        }

    def volatility_percentile(self) -> Result:
        f = self.features.dropna(subset=["atr_pct_rank"])
        if f.empty:
            raise InsufficientData("Not enough history for a volatility percentile")
        cur = f.iloc[-1]
        lb = min(len(f), int(round(23 * 3600 / self.candles.timeframe.total_seconds())) * 252)
        unusual = cur["atr_pct_rank"] >= 90 or cur["atr_pct_rank"] <= 10
        return Result(
            name="Current MGC1! volatility percentile",
            measures="Where current ATR(14) sits within its own trailing history",
            data=f"{self.candles.contract} {self.candles.timeframe} bars, {self.candles.source}; last bar {f.index[-1].isoformat()}",
            method=f"percentile rank = 100·(#{{ATR_i ≤ ATR_t}} − 1)/(L − 1) over trailing L ≤ {lb} bars (no future data)",
            value={"atr14": float(cur["atr14"]), "atr_pct_rank": float(cur["atr_pct_rank"]),
                   "rv_pct_rank": _f(cur["rv_pct_rank"]), "is_extreme": bool(unusual)},
            interpretation=(f"ATR(14) = {cur['atr14']:.2f} (${cur['atr14']*10:.2f}/contract), at the {cur['atr_pct_rank']:.0f}th percentile. "
                            + ("This is unusual (top/bottom decile)." if unusual else "This is within the normal 10th–90th percentile band.")),
            n=int(len(f)), provenance=self.candles.provenance,
            limitations=["Percentile depends on the lookback window and the bar timeframe."]
                        + (["Data is not live — this describes the last imported bar."] if self.candles.provenance != Provenance.LIVE else []),
        )

    def session_ranges(self) -> Result:
        df = self.candles.df.copy() if self.candles else None
        self._need_candles()
        et = df.index.tz_convert(ET)
        df["session"] = [session_of(t) for t in et]
        df["tday"] = (et + pd.Timedelta(hours=6)).date
        g = df.groupby(["tday", "session"]).agg(high=("high", "max"), low=("low", "min"), bars=("close", "size"))
        g["range"] = g["high"] - g["low"]
        out = {}
        for s, x in g.groupby(level="session"):
            r = x["range"].to_numpy()
            out[s] = {"n_sessions": len(r), "mean": float(r.mean()), "median": float(np.median(r)),
                      "std": float(r.std(ddof=1)) if len(r) > 1 else None,
                      "p25": float(np.percentile(r, 25)), "p75": float(np.percentile(r, 75)),
                      "mean_dollars": float(r.mean() * 10), "mean_ticks": float(r.mean() / 0.1)}
        ny = {k: v for k, v in out.items() if k.startswith("ny")}
        return Result(
            name="Average range by session", measures="High − low per trading session (ET clock buckets)",
            data=f"{self.candles.contract}, {g.index.get_level_values(0).nunique()} trading days",
            method="range = max(high) − min(low) within each session of each CME trading day; mean/median/std across days",
            value=out,
            interpretation="; ".join(f"{k}: mean {v['mean']:.2f} (${v['mean_dollars']:.0f}/contract), median {v['median']:.2f}, n={v['n_sessions']}" for k, v in ny.items()) or "No NY-session bars.",
            n=int(len(g)), provenance=self.candles.provenance,
            limitations=["Session boundaries are conventions: Asia 18–02, London 02–07, NY AM 07–12, NY PM 12–17 ET.",
                         "Partial sessions at the data edges are included."],
        )

    def returns_distribution(self) -> pd.Series:
        self._need_candles()
        d = resample(self.candles, "1D")
        return np.log(d["close"]).diff().dropna() * 100


def _daily_atr(daily: pd.DataFrame) -> float | None:
    from .features.indicators import atr
    if len(daily) < 15:
        return None
    return float(atr(daily, 14).iloc[-1])


def _f(x):
    try:
        return None if x is None or pd.isna(x) else float(x)
    except (TypeError, ValueError):
        return None


WS = Workspace()
