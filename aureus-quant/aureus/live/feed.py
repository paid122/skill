"""Live market-data interface.

AUREUS never fabricates live prices. Live mode is only active when a licensed
provider is configured; otherwise every live endpoint reports
``status = "unavailable"`` with the reason.

Supported adapter: Databento (CME Globex MDP 3.0, licensed redistribution of
CME data; requires a Databento account, API key and CME licence agreement).
Set:
    AUREUS_FEED=databento
    DATABENTO_API_KEY=...
Other providers (Rithmic, CQG, IBKR) can be added by implementing ``Feed``.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone

import pandas as pd


@dataclass
class FeedStatus:
    status: str            # live | delayed | unavailable
    provider: str | None
    reason: str
    contract: str = "MGC1!"
    checked_at: str = ""

    def to_dict(self):
        return self.__dict__


class Feed:
    name = "base"

    def status(self) -> FeedStatus:  # pragma: no cover - interface
        raise NotImplementedError

    def recent_bars(self, minutes: int = 600, schema: str = "ohlcv-1m") -> pd.DataFrame:  # pragma: no cover
        raise NotImplementedError


class NoFeed(Feed):
    name = "none"

    def __init__(self, reason: str):
        self.reason = reason

    def status(self) -> FeedStatus:
        return FeedStatus("unavailable", None, self.reason, checked_at=_now())

    def recent_bars(self, minutes: int = 600, schema: str = "ohlcv-1m") -> pd.DataFrame:
        raise RuntimeError(f"No live feed: {self.reason}")


class DatabentoFeed(Feed):
    """Historical-API pull of the most recent bars (near-live; Databento's
    historical endpoint lags real time slightly — reported as 'delayed')."""

    name = "databento"
    DATASET = "GLBX.MDP3"
    SYMBOL = "MGC.c.0"  # continuous front month by calendar roll (Databento symbology)

    def __init__(self, key: str):
        import databento as db  # optional dependency

        self.client = db.Historical(key)

    def status(self) -> FeedStatus:
        try:
            self.client.metadata.list_datasets()
            return FeedStatus("delayed", "Databento GLBX.MDP3", "Connected (historical API; small publication lag)",
                              contract=self.SYMBOL, checked_at=_now())
        except Exception as e:  # noqa: BLE001
            return FeedStatus("unavailable", "Databento", f"Connection failed: {e}", checked_at=_now())

    def recent_bars(self, minutes: int = 600, schema: str = "ohlcv-1m") -> pd.DataFrame:
        end = pd.Timestamp.now(tz="UTC").floor("min")
        start = end - pd.Timedelta(minutes=minutes)
        data = self.client.timeseries.get_range(dataset=self.DATASET, symbols=[self.SYMBOL], stype_in="continuous",
                                                schema=schema, start=start, end=end)
        df = data.to_df()
        df.index = pd.to_datetime(df.index, utc=True)
        df.index.name = "timestamp"
        return df[["open", "high", "low", "close", "volume"]]


def get_feed() -> Feed:
    which = os.getenv("AUREUS_FEED", "").lower()
    if which == "databento":
        key = os.getenv("DATABENTO_API_KEY")
        if not key:
            return NoFeed("AUREUS_FEED=databento but DATABENTO_API_KEY is not set")
        try:
            return DatabentoFeed(key)
        except ImportError:
            return NoFeed("databento package not installed (pip install databento)")
    return NoFeed("No licensed market-data provider configured (set AUREUS_FEED). "
                  "Analytics run on imported historical data only.")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
