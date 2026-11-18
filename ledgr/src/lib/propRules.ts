/**
 * Built-in rules for funded futures accounts (Apex, Lucid, Topstep, Take Profit Trader, Tradeify,
 * TradeDay, MyFundedFutures), so a new account fills itself in. Only numbers the sources agreed on
 * are included; plans or sizes they disagreed on are left out rather than guessed.
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
  /** One line under the plan's tab. */
  tagline: string;
  /** Has an optional daily loss limit the trader may or may not have bought (off by default). */
  optionalDailyLimit?: boolean;
  /** How the max loss trails. */
  trailing: "EOD trailing" | "Intraday trailing";
  consistency: string;
  /** Minimum trading days to pass the evaluation, when the firm has one. */
  minDays?: number;
  /** The max-loss floor stops rising at start + this (Apex, Lucid: $100; Topstep, Take Profit Trader: $0). */
  floorLock?: number;
  sizes: Record<number, { profitTarget: number; maxDrawdown: number; dailyLossLimit: number | null; maxContracts: string }>;
}

export const PROP_FIRM_RULES: Record<string, PropPlan[]> = {
  "Apex Trader Funding": [
    {
      name: "EOD drawdown",
      tagline: "Trails at end of day",
      trailing: "EOD trailing",
      consistency: "None to pass · 50% for payouts",
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
      tagline: "No daily loss limit",
      trailing: "Intraday trailing",
      consistency: "None to pass · 50% for payouts",
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
      name: "LucidFlex",
      tagline: "No daily loss limit",
      trailing: "EOD trailing",
      consistency: "40% (50% option)",
      note: "End-of-day trailing max loss; contracts scale up with profit. The daily loss limit is an optional add-on.",
      optionalDailyLimit: true,
      sizes: {
        25000: { profitTarget: 1250, maxDrawdown: 1000, dailyLossLimit: 600, maxContracts: "up to 2 minis / 20 micros" },
        50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1200, maxContracts: "up to 4 minis / 40 micros" },
        100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1800, maxContracts: "up to 6 minis / 60 micros" },
        150000: { profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit: 2700, maxContracts: "up to 10 minis / 100 micros" },
      },
    },
    {
      name: "LucidPro",
      tagline: "No consistency to pass",
      trailing: "EOD trailing",
      consistency: "None to pass",
      note: "End-of-day trailing max loss. The daily loss limit is an optional add-on.",
      optionalDailyLimit: true,
      sizes: {
        25000: { profitTarget: 1250, maxDrawdown: 1000, dailyLossLimit: 600, maxContracts: "2 minis / 20 micros" },
        50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1200, maxContracts: "4 minis / 40 micros" },
        100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1800, maxContracts: "6 minis / 60 micros" },
        150000: { profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit: 2700, maxContracts: "10 minis / 100 micros" },
      },
    },
  ],
};

// More firms. Contract limits are shown as minis / micros.
const sz = (rows: [number, number, number, number | null, string][]) =>
  Object.fromEntries(rows.map(([size, profitTarget, maxDrawdown, dailyLossLimit, maxContracts]) => [size, { profitTarget, maxDrawdown, dailyLossLimit, maxContracts }]));

Object.assign(PROP_FIRM_RULES, {
  Topstep: [
    {
      name: "Trading Combine",
      tagline: "Optional daily loss limit",
      trailing: "EOD trailing",
      consistency: "Best day < 55%",
      optionalDailyLimit: true,
      floorLock: 0,
      note: "Maximum loss limit trails your end-of-day balance and stops at your starting balance. The daily loss limit is chosen at checkout and pauses trading for the day. If your best day is over 55% of your profit, the target rises instead of failing you.",
      sizes: sz([[50000, 3000, 2000, 1000, "5 minis / 50 micros"], [100000, 6000, 3000, 2000, "10 minis / 100 micros"], [150000, 9000, 4500, 3000, "15 minis / 150 micros"]]),
    },
  ],
  "Take Profit Trader": [
    {
      name: "Test",
      tagline: "No daily loss limit",
      trailing: "EOD trailing",
      consistency: "Best day < 50%",
      floorLock: 0,
      note: "End-of-day trailing drawdown (updates at 5 PM ET) that stops at your starting balance. No daily loss limit. Minimum trading days are 3 or 5 depending on when you bought, so check yours. If your best day is over 50% of your profit, the target rises instead of failing you.",
      sizes: sz([[25000, 1500, 1500, null, "3 minis / 30 micros"], [50000, 3000, 2000, null, "6 minis / 60 micros"], [75000, 4500, 2500, null, "9 minis / 90 micros"], [100000, 6000, 3000, null, "12 minis / 120 micros"], [150000, 9000, 4500, null, "15 minis / 150 micros"]]),
    },
  ],
  Tradeify: [
    {
      name: "Select",
      tagline: "No daily loss limit",
      trailing: "EOD trailing",
      consistency: "Check your dashboard",
      note: "End-of-day trailing max drawdown, but touching it during the day still fails the account. No daily loss limit in the evaluation.",
      sizes: sz([[50000, 3000, 2000, null, "4 minis / 40 micros"], [100000, 6000, 3000, null, "8 minis / 80 micros"], [150000, 9000, 4500, null, "12 minis / 120 micros"]]),
    },
    {
      name: "Growth",
      tagline: "Soft daily loss limit",
      trailing: "EOD trailing",
      consistency: "Check your dashboard",
      note: "End-of-day trailing max drawdown with a soft daily loss limit (pauses, doesn't fail). Only the 50K is listed: sources disagree on the bigger sizes.",
      sizes: sz([[50000, 3000, 2000, 1250, "4 minis / 40 micros"]]),
    },
  ],
  TradeDay: [
    {
      name: "Quick Pay",
      tagline: "30% consistency · 5 days",
      trailing: "EOD trailing",
      consistency: "30%",
      minDays: 5,
      note: "Trailing drawdown, set to end-of-day or intraday when you buy (edit the plan if yours is intraday). No daily loss limit.",
      sizes: sz([[50000, 3000, 2000, null, "5 minis / 50 micros"], [100000, 6000, 3000, null, "10 minis / 100 micros"], [150000, 9000, 4500, null, "15 minis / 150 micros"]]),
    },
    {
      name: "Fast Pass",
      tagline: "45% consistency · 3 days",
      trailing: "EOD trailing",
      consistency: "45%",
      minDays: 3,
      note: "Trailing drawdown, set to end-of-day or intraday when you buy. No daily loss limit.",
      sizes: sz([[50000, 3000, 2000, null, "5 minis / 50 micros"], [100000, 6000, 3000, null, "10 minis / 100 micros"], [150000, 9000, 4500, null, "15 minis / 150 micros"]]),
    },
  ],
  MyFundedFutures: [
    {
      name: "Rapid",
      tagline: "Daily payouts",
      trailing: "EOD trailing",
      consistency: "Check your dashboard",
      note: "End-of-day drawdown in the evaluation (sources say it can switch to intraday once funded). No daily loss limit. Only the 50K is listed: sources disagree on the bigger sizes.",
      sizes: sz([[50000, 3000, 2000, null, "5 minis / 50 micros"]]),
    },
    {
      name: "Pro",
      tagline: "No daily loss limit",
      trailing: "EOD trailing",
      consistency: "Check your dashboard",
      note: "End-of-day trailing max loss. No daily loss limit.",
      sizes: sz([[50000, 3000, 2000, null, "See your dashboard"], [100000, 6000, 3000, null, "See your dashboard"], [150000, 9000, 4500, null, "See your dashboard"]]),
    },
  ],
} satisfies Record<string, PropPlan[]>);

export type PropStage = "evaluation" | "funded";

/** Sizes a firm sells (falls back to the common futures sizes). */
export function firmSizes(firm: string | null | undefined, plan?: string | null): number[] {
  const plans = firm ? PROP_FIRM_RULES[firm] : undefined;
  if (!plans) return [25000, 50000, 100000, 150000];
  const p = plans.find((x) => x.name === plan);
  const list = p ? [p] : plans;
  return [...new Set(list.flatMap((x) => Object.keys(x.sizes).map(Number)))].sort((a, b) => a - b);
}

/** The rules for a firm/plan/size/stage, or null when LEDGR has no preset (e.g. "Other"). */
export function presetRules(firm: string | null | undefined, plan: string | null | undefined, size: number | null | undefined, stage: PropStage, dailyLimit = false):
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
      minTradingDays: stage === "evaluation" ? p.minDays ?? null : null,
    },
    maxContracts: s.maxContracts,
    note: p.note,
  };
}
