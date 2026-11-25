"""Core primitives shared by every AUREUS QUANT module.

Two ideas run through the whole codebase:

1. Every number the system reports is wrapped in a :class:`Result` that records
   *what* was measured, *which data* was used, *how* it was calculated, the
   *value*, and *what it means* — plus the sample size and limitations.
2. Every dataset carries a :class:`Provenance` tag (LIVE / HISTORICAL /
   SIMULATED) so simulated numbers can never be passed off as real ones.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class Provenance(str, Enum):
    LIVE = "LIVE"
    DELAYED = "DELAYED"
    HISTORICAL = "HISTORICAL"
    SIMULATED = "SIMULATED"


@dataclass(frozen=True)
class ContractSpec:
    """COMEX Micro Gold (MGC). Source: CME Group contract specifications."""

    root: str = "MGC"
    exchange: str = "COMEX"
    multiplier_oz: float = 10.0          # 10 troy ounces
    tick_size: float = 0.10              # $0.10 per troy ounce
    tick_value: float = 1.00             # 0.10 * 10 oz = $1.00 per tick
    # Active delivery months traded as MGC1! (front month rolls between these).
    active_months: tuple[str, ...] = ("G", "J", "M", "Q", "V", "Z")  # Feb Apr Jun Aug Oct Dec
    exchange_tz: str = "America/New_York"

    def price_to_ticks(self, price_delta: float) -> float:
        return price_delta / self.tick_size

    def price_to_dollars(self, price_delta: float, contracts: float = 1.0) -> float:
        return price_delta * self.multiplier_oz * contracts


MGC = ContractSpec()


@dataclass
class Result:
    """A fully-explained statistic. Nothing leaves the engine without one."""

    name: str
    measures: str            # 1. what is being measured
    data: str                # 2. which data is being used
    method: str              # 3. the mathematical calculation
    value: Any               # 4. the result
    interpretation: str      # 5. what it means for MGC1!
    n: int | None = None
    provenance: Provenance | str = Provenance.HISTORICAL
    limitations: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["provenance"] = str(getattr(self.provenance, "value", self.provenance))
        return _jsonable(d)

    def explain(self) -> str:
        lines = [
            f"■ {self.name}  [{getattr(self.provenance, 'value', self.provenance)}]",
            f"  1. Measures : {self.measures}",
            f"  2. Data     : {self.data}" + (f"  (n = {self.n})" if self.n is not None else ""),
            f"  3. Method   : {self.method}",
            f"  4. Result   : {_fmt(self.value)}",
            f"  5. Meaning  : {self.interpretation}",
        ]
        for lim in self.limitations:
            lines.append(f"  ⚠ {lim}")
        return "\n".join(lines)


class InsufficientData(ValueError):
    """Raised when a calculation would be statistically meaningless."""


def _fmt(v: Any) -> str:
    if isinstance(v, float):
        return f"{v:.4f}"
    if isinstance(v, dict):
        return ", ".join(f"{k}={_fmt(x)}" for k, x in v.items())
    return str(v)


def _jsonable(o: Any) -> Any:
    import math

    import numpy as np
    import pandas as pd

    if isinstance(o, dict):
        return {str(k): _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    import datetime as _dt

    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if o is pd.NaT or o is pd.NA:
        return None
    if isinstance(o, (_dt.datetime, _dt.date)):
        return o.isoformat()
    if isinstance(o, pd.Timedelta):
        return str(o)
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(o, np.ndarray):
        return _jsonable(o.tolist())
    if isinstance(o, (pd.Timestamp,)):
        return o.isoformat()
    if isinstance(o, pd.Series):
        return _jsonable(o.to_dict())
    if isinstance(o, Enum):
        return o.value
    return o


def config_hash(params: dict[str, Any]) -> str:
    """Deterministic hash of research parameters (for reproducibility records)."""
    blob = json.dumps(_jsonable(params), sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


MIN_SAMPLE = 30  # below this, results are flagged as unreliable
