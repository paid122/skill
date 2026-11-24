"""Transaction-cost model. Costs are converted to R so every statistic can be
reported net of commissions, fees and slippage.

Defaults are placeholders that MUST be set to your broker's actual schedule.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ..core import MGC


@dataclass
class CostModel:
    commission_per_side: float = 0.50     # $ per contract per side (broker)
    exchange_fees_per_side: float = 0.30  # $ per contract per side (CME + NFA), check current schedule
    slippage_ticks_entry: float = 0.0     # stop/limit entries often 0; market entries ≥1
    slippage_ticks_exit: float = 1.0      # stops typically slip
    label: str = "default (VERIFY against your broker)"

    def round_turn_dollars(self, contracts: float = 1.0) -> float:
        fixed = 2 * (self.commission_per_side + self.exchange_fees_per_side)
        slip = (self.slippage_ticks_entry + self.slippage_ticks_exit) * MGC.tick_value
        return (fixed + slip) * contracts

    def to_dict(self) -> dict:
        return asdict(self)


def apply_costs(journal: pd.DataFrame, model: CostModel) -> pd.DataFrame:
    """Adds ``cost_dollars``, ``cost_r`` and ``r_net`` (= r_gross − cost_r)."""
    j = journal.copy()
    rt = j["contracts"].apply(model.round_turn_dollars)
    if "commission" in j.columns:  # trade-level commission overrides the fixed part
        slip = (model.slippage_ticks_entry + model.slippage_ticks_exit) * MGC.tick_value * j["contracts"]
        rt = np.where(j["commission"].notna(), j["commission"] + slip, rt)
    j["cost_dollars"] = rt
    j["cost_r"] = j["cost_dollars"] / j["risk_dollars"]
    j["r_net"] = j["r_gross"] - j["cost_r"]
    return j
