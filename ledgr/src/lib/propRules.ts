/**
 * Built-in rules for funded futures accounts, so a new Apex or Lucid account fills itself in.
 *
 * Source: public rule summaries checked November 2026 (third-party guides; the firms change their
 * rules often). They're presets only: every number stays editable, and the account editor tells the
 * trader to check them against the firm's own dashboard, which is the official record.
 */
import type { AccountRules } from "./types";

export const PROP_RULES_CHECKED = "November 2026";

export interface PropPlan {
  /** Shown in the plan picker. */
  name: string;
  note: string;
  /** Has an optional daily loss limit the trader may or may not have bought. */
  optionalDailyLimit?: boolean;
  sizes: Record<number, { profitTarget: number; maxDrawdown: number; dailyLossLimit: number | null; maxContracts: string }>;
}

export const PROP_FIRM_RULES: Record<string, PropPlan[]> = {
  "Apex Trader Funding": [
    {
      name: "EOD drawdown",
      note: "Drawdown trails your end-of-day balance; daily loss limit pauses trading until the next session.",
      sizes: {
        25000: { profitTarget: 1500, maxDrawdown: 1000, dailyLossLimit: 500, maxContracts: "4 minis / 40 micros" },
        50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1000, maxContracts: "6 minis / 60 micros" },
        100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1500, maxContracts: "8 minis / 80 micros" },
        150000: { profitTarget: 9000, maxDrawdown: 4000, dailyLossLimit: 2000, maxContracts: "12 minis / 120 micros" },
      },
    },
    {
      name: "Intraday trailing",
      note: "Drawdown trails your highest balance during the day; no daily loss limit.",
      sizes: {
        25000: { profitTarget: 1500, maxDrawdown: 1000, dailyLossLimit: null, maxContracts: "4 minis / 40 micros" },
        50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: null, maxContracts: "6 minis / 60 micros" },
        100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: null, maxContracts: "8 minis / 80 micros" },
        150000: { profitTarget: 9000, maxDrawdown: 4000, dailyLossLimit: null, maxContracts: "12 minis / 120 micros" },
      },
    },
  ],
  "Lucid Trading": [
    {
      name: "LucidPro",
      note: "End-of-day trailing max loss. The daily loss limit is an optional add-on.",
      optionalDailyLimit: true,
      sizes: {
        25000: { profitTarget: 1250, maxDrawdown: 1000, dailyLossLimit: 600, maxContracts: "2 minis / 20 micros" },
        50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1200, maxContracts: "4 minis / 40 micros" },
        100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1800, maxContracts: "6 minis / 60 micros" },
        150000: { profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit: 2700, maxContracts: "10 minis / 100 micros" },
      },
    },
    {
      name: "LucidFlex",
      note: "End-of-day trailing max loss; contracts scale up with profit. The daily loss limit is an optional add-on.",
      optionalDailyLimit: true,
      sizes: {
        25000: { profitTarget: 1250, maxDrawdown: 1000, dailyLossLimit: 600, maxContracts: "up to 2 minis / 20 micros" },
        50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1200, maxContracts: "up to 4 minis / 40 micros" },
        100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1800, maxContracts: "up to 6 minis / 60 micros" },
        150000: { profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit: 2700, maxContracts: "up to 10 minis / 100 micros" },
      },
    },
  ],
};

export type PropStage = "evaluation" | "funded";

/** Sizes a firm sells (falls back to the common futures sizes). */
export function firmSizes(firm: string | null | undefined): number[] {
  const plans = firm ? PROP_FIRM_RULES[firm] : undefined;
  return plans ? Object.keys(plans[0].sizes).map(Number) : [25000, 50000, 100000, 150000];
}

/** The rules for a firm/plan/size/stage, or null when LEDGR has no preset (e.g. "Other"). */
export function presetRules(firm: string | null | undefined, plan: string | null | undefined, size: number | null | undefined, stage: PropStage, dailyLimit = true):
  { rules: AccountRules; maxContracts: string; note: string } | null {
  const plans = firm ? PROP_FIRM_RULES[firm] : undefined;
  const p = plans?.find((x) => x.name === plan) ?? plans?.[0];
  const s = p && size ? p.sizes[size] : undefined;
  if (!p || !s) return null;
  return {
    rules: {
      // Funded (performance) accounts have no profit target; the evaluation does.
      profitTarget: stage === "evaluation" ? s.profitTarget : null,
      maxDrawdown: s.maxDrawdown,
      dailyLossLimit: p.optionalDailyLimit && !dailyLimit ? null : s.dailyLossLimit,
      minTradingDays: null,
    },
    maxContracts: s.maxContracts,
    note: p.note,
  };
}
