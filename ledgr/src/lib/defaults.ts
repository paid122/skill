import type { Appearance, LedgrState, Settings, Trade } from "./types";
import { nowISO, today, uid } from "./util";

export const STATE_VERSION = 1;

export const INSIGHT_KEYS = [
  "setupConsistency", "sessionPerformance", "dayOfWeek", "emotionPatterns", "tradeDuration", "rProgression",
  "losingStreaks", "winningStreaks", "riskConsistency", "tradeNumberOfDay", "setupSession", "confluenceFrequency",
  "exitBehaviour", "mistakeRecurrence",
] as const;

export const defaultAppearance: Appearance = {
  theme: "midnight",
  accent: "#C5A66D",
  font: "inter",
  numberFormat: "en-US",
  positiveColor: "#42B883",
  negativeColor: "#E36E73",
  density: "comfortable",
  backgroundImage: "",
  backgroundOpacity: 0.12,
  sidebar: "solid",
  savedThemes: [],
};

export function defaultSettings(): Settings {
  return {
    displayName: "",
    baseCurrency: "USD",
    breakevenThreshold: 0,
    translation: "KJV",
    checklist: [
      { id: "prep", label: "Complete preparation" },
      { id: "objectives", label: "Record learning objectives" },
      { id: "entries", label: "Complete journal entries" },
      { id: "review", label: "Review the session" },
      { id: "lessons", label: "Write down lessons" },
    ],
    mistakeCategories: ["Incomplete preparation", "Impulsive decision", "Unplanned entry", "Ignored written rules", "Incomplete reflection", "Other"],
    setups: [],
    confluenceLibrary: ["Higher-timeframe level", "Liquidity sweep", "Trend alignment", "Volume confirmation", "Session open", "Retest", "Divergence"],
    weekStartsOn: 1,
    sidebarCollapsed: false,
    insights: { enabled: Object.fromEntries(INSIGHT_KEYS.map((k) => [k, true])), minSample: 10 },
    onboarded: false,
    appearance: defaultAppearance,
  };
}

export function emptyState(): LedgrState {
  return {
    version: STATE_VERSION,
    settings: defaultSettings(),
    accounts: [],
    adjustments: [],
    trades: [],
    strategies: [],
    dailyJournals: [],
    weeklyJournals: [],
    studyFolders: ["Psychology", "Market Structure", "Risk Management", "Strategy Notes", "Trade Reviews", "General Learning"].map((name) => ({ id: uid("fld"), name, createdAt: nowISO() })),
    studyNotes: [],
    studyBoards: [],
    favouriteVerses: [],
    verseHistory: [],
    goals: [],
    checklistLog: {},
    savedFilters: [],
    conversations: [],
    reports: [],
    dismissedNotifications: [],
    sampleData: false,
  };
}

export function blankTrade(number: number, accountId: string | null): Trade {
  const t = nowISO();
  return {
    id: uid("trd"),
    number,
    accountId,
    symbol: "",
    market: null,
    direction: null,
    date: today(),
    session: null,
    executions: [],
    pointValue: 1,
    stopPrice: null,
    targetPrice: null,
    plannedRisk: null,
    manualNet: null,
    fees: 0,
    strategyId: null,
    setup: "",
    confluences: [],
    grade: null,
    entryNotes: "",
    exitNotes: "",
    emotions: [],
    emotionNote: "",
    mistakes: [],
    reflection: { wentWell: "", improve: "", followedPlan: null, learned: "" },
    attachments: [],
    tags: [],
    showcase: null,
    isDraft: true,
    activity: [{ at: t, message: "Trade created" }],
    createdAt: t,
    updatedAt: t,
  };
}

/** Fill in missing fields on records saved by earlier versions. */
export function migrate(raw: Partial<LedgrState>): LedgrState {
  const base = emptyState();
  const s = { ...base, ...raw } as LedgrState;
  s.settings = { ...base.settings, ...(raw.settings ?? {}) };
  s.settings.appearance = { ...defaultAppearance, ...(raw.settings?.appearance ?? {}) };
  s.settings.insights = { ...base.settings.insights, ...(raw.settings?.insights ?? {}), enabled: { ...base.settings.insights.enabled, ...(raw.settings?.insights?.enabled ?? {}) } };
  s.trades = (s.trades ?? []).map((t) => ({ ...blankTrade(t.number, t.accountId), ...t, reflection: { ...blankTrade(0, null).reflection, ...t.reflection } }));
  s.version = STATE_VERSION;
  return s;
}
