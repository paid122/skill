/**
 * Simulated sample journal for exploring Ledgr. These records are generated,
 * clearly flagged in the interface, and can be removed in Settings → Data.
 */
import { blankTrade, emptyState } from "./defaults";
import type { Account, DailyJournal, Emotion, Grade, LedgrState, Market, Session, Strategy, Trade } from "./types";
import { addDays, dayOfWeek, toISODate, uid, weekStart } from "./util";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Instrument { symbol: string; market: Market; price: number; tick: number; pv: number; qty: number }
const INSTRUMENTS: Instrument[] = [
  { symbol: "ES", market: "Futures", price: 5900, tick: 0.25, pv: 50, qty: 1 },
  { symbol: "NQ", market: "Futures", price: 20800, tick: 0.25, pv: 20, qty: 1 },
  { symbol: "EURUSD", market: "Forex", price: 1.085, tick: 0.0001, pv: 100000, qty: 0.5 },
  { symbol: "GBPUSD", market: "Forex", price: 1.27, tick: 0.0001, pv: 100000, qty: 0.4 },
  { symbol: "AAPL", market: "Stocks", price: 228, tick: 0.01, pv: 1, qty: 200 },
  { symbol: "BTCUSD", market: "Crypto", price: 68000, tick: 10, pv: 1, qty: 0.15 },
];

export function buildSampleState(base?: LedgrState): LedgrState {
  const r = rng(20261110);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const s = base ? { ...base } : emptyState();
  const now = new Date().toISOString();

  const accounts: Account[] = [
    { id: uid("acc"), name: "Main simulation", type: "Personal simulation", currency: "USD", startingBalance: 25000, status: "active", color: "#C5A66D", goals: "Journal every trade the same day. Keep average loss under 1R.", rules: { profitTarget: null, maxDrawdown: 2500, dailyLossLimit: 750, minTradingDays: null }, createdAt: now },
    { id: uid("acc"), name: "Evaluation practice", type: "Hypothetical evaluation", currency: "USD", startingBalance: 50000, status: "active", color: "#7FA7C9", goals: "Practise working within fixed rules.", rules: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1000, minTradingDays: 10 }, createdAt: now },
    { id: uid("acc"), name: "Backtest notebook", type: "Backtest", currency: "USD", startingBalance: 10000, status: "active", color: "#9C8FD1", goals: "Replay sessions to study the opening-range setup.", rules: { profitTarget: null, maxDrawdown: null, dailyLossLimit: null, minTradingDays: null }, createdAt: now },
  ];

  const strategies: Strategy[] = [
    { id: uid("str"), name: "Opening range break", description: "Trade the first decisive break of the 15-minute opening range in the direction of the higher-timeframe trend.", market: "Futures", timeframe: "5m", entryCriteria: "15m range defined\nBreak and close outside range\nHigher-timeframe trend agrees", exitCriteria: "Target 2R or prior day extreme\nTrail below last higher low after 1R", confluences: ["Trend alignment", "Session open", "Volume confirmation"], invalidation: "Price closes back inside the range.", notes: "Avoid on major news days.", screenshots: [], archived: false, createdAt: now, updatedAt: now },
    { id: uid("str"), name: "Liquidity sweep reversal", description: "Fade a sweep of an obvious high or low once price reclaims the level.", market: "Forex", timeframe: "15m", entryCriteria: "Clear liquidity pool above/below\nSweep then reclaim\nEntry on retest", exitCriteria: "Opposite side of range\nPartial at 1R", confluences: ["Liquidity sweep", "Higher-timeframe level", "Retest"], invalidation: "Acceptance beyond the swept level.", notes: "", screenshots: [], archived: false, createdAt: now, updatedAt: now },
    { id: uid("str"), name: "Trend pullback", description: "Join an established trend after a pullback to a rising moving average.", market: "Stocks", timeframe: "1h", entryCriteria: "Higher highs and higher lows\nPullback to 20 EMA\nBullish reaction candle", exitCriteria: "Prior high\nClose below 20 EMA", confluences: ["Trend alignment", "Retest"], invalidation: "Lower low forms.", notes: "", screenshots: [], archived: false, createdAt: now, updatedAt: now },
  ];

  const sessions: Session[] = ["London", "New York", "New York", "London/NY overlap", "Asia"];
  const mistakesAll = s.settings.mistakeCategories.filter((m) => m !== "Other");
  const trades: Trade[] = [];
  const journals: DailyJournal[] = [];
  let num = 0;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 84);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = toISODate(d);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    if (r() < 0.18) continue; // rest days
    const tradesToday = 1 + Math.floor(r() * 3);
    const dayEmotions: Emotion[] = [];
    for (let k = 0; k < tradesToday; k++) {
      const strat = pick(strategies);
      const inst = strat.market === "Futures" ? pick(INSTRUMENTS.slice(0, 2)) : strat.market === "Forex" ? pick(INSTRUMENTS.slice(2, 4)) : pick(INSTRUMENTS.slice(4));
      const acct = r() < 0.6 ? accounts[0] : r() < 0.7 ? accounts[1] : accounts[2];
      const t = blankTrade(++num, acct.id);
      const direction = r() < 0.55 ? "long" : "short";
      const sign = direction === "long" ? 1 : -1;
      const session = pick(sessions);
      const stressed = r() < 0.22;
      const emotions: Emotion[] = stressed ? [pick(["Frustrated", "Impatient", "Distracted", "Hesitant"] as Emotion[])] : [pick(["Calm", "Patient", "Confident"] as Emotion[])];
      if (r() < 0.2) emotions.push(pick(["Hesitant", "Confident", "Calm"] as Emotion[]));
      const followed = stressed ? (r() < 0.35 ? "yes" : r() < 0.6 ? "partial" : "no") : r() < 0.82 ? "yes" : "partial";
      // Process quality influences the simulated outcome distribution slightly.
      const edge = (followed === "yes" ? 0.12 : followed === "partial" ? -0.05 : -0.25) + (session === "Asia" ? -0.1 : 0);
      const u = r();
      const rMultiple = u < 0.44 + edge ? 1 + r() * 1.6 : u < 0.52 + edge ? (r() - 0.5) * 0.05 : -(0.6 + r() * 0.5);
      const riskTicks = Math.round((8 + r() * 24) * (inst.market === "Forex" ? 2 : 1));
      const variation = inst.price * (1 + (r() - 0.5) * 0.04);
      const entry = Math.round(variation / inst.tick) * inst.tick;
      const stop = entry - sign * riskTicks * inst.tick;
      const exit = entry + sign * riskTicks * inst.tick * rMultiple;
      const hour = session === "Asia" ? 1 : session === "London" ? 8 : session === "London/NY overlap" ? 13 : 15;
      const t0 = new Date(d);
      t0.setHours(hour + k, Math.floor(r() * 50), 0, 0);
      const t1 = new Date(t0.getTime() + (10 + r() * 140) * 60000);
      const qty = inst.qty;
      const scaled = r() < 0.25;
      t.executions = scaled
        ? [
            { id: uid("ex"), kind: "entry", price: entry, quantity: qty, time: t0.toISOString(), fees: inst.market === "Futures" ? 2.1 : 0.5 },
            { id: uid("ex"), kind: "exit", price: entry + sign * riskTicks * inst.tick * 1, quantity: qty / 2, time: new Date(t0.getTime() + (t1.getTime() - t0.getTime()) / 2).toISOString(), fees: inst.market === "Futures" ? 1.05 : 0.25 },
            { id: uid("ex"), kind: "exit", price: entry + sign * riskTicks * inst.tick * (2 * rMultiple - 1), quantity: qty / 2, time: t1.toISOString(), fees: inst.market === "Futures" ? 1.05 : 0.25 },
          ]
        : [
            { id: uid("ex"), kind: "entry", price: entry, quantity: qty, time: t0.toISOString(), fees: inst.market === "Futures" ? 2.1 : 0.5 },
            { id: uid("ex"), kind: "exit", price: exit, quantity: qty, time: t1.toISOString(), fees: inst.market === "Futures" ? 2.1 : 0.5 },
          ];
      t.executions = t.executions.map((e) => ({ ...e, price: Math.round(e.price / inst.tick) * inst.tick }));
      Object.assign(t, {
        symbol: inst.symbol, market: inst.market, direction, date: iso, session, pointValue: inst.pv,
        stopPrice: Math.round(stop / inst.tick) * inst.tick, targetPrice: Math.round((entry + sign * riskTicks * inst.tick * 2) / inst.tick) * inst.tick,
        strategyId: strat.id, setup: strat.name, confluences: strat.confluences.filter(() => r() < 0.7),
        grade: (followed === "yes" ? pick(["A+", "A", "A", "B"]) : followed === "partial" ? pick(["B", "C"]) : pick(["C", "D", "F"])) as Grade,
        emotions,
        mistakes: followed === "yes" ? [] : [pick(mistakesAll)],
        entryNotes: followed === "yes" ? "Waited for the confirmation close before entering." : "Entered before the full confirmation.",
        exitNotes: rMultiple > 0.5 ? "Exited at planned target." : rMultiple < -0.4 ? "Stopped out at the planned stop." : "Closed near entry as momentum faded.",
        reflection: r() < 0.8
          ? { wentWell: followed === "yes" ? "Followed the checklist step by step." : "Kept the position size to plan.", improve: followed === "yes" ? "Could have scaled out more patiently." : "Wait for the full criteria before acting.", followedPlan: followed, learned: stressed ? "Strong feelings show up before poor entries. Pause first." : "Patience at the entry made the trade easier to manage." }
          : { wentWell: "", improve: "", followedPlan: followed, learned: "" },
        isDraft: false,
        createdAt: t1.toISOString(),
        updatedAt: t1.toISOString(),
        activity: [{ at: t1.toISOString(), message: "Trade logged (sample data)" }],
      });
      dayEmotions.push(...emotions);
      trades.push(t);
    }
    if (r() < 0.75) {
      journals.push({
        id: uid("day"), date: iso,
        pre: { intentions: "Trade only A-grade setups and log each one straight after.", learning: dayOfWeek(iso) === "Monday" ? "Review last week's lessons before the open." : "Watch how price behaves around the opening range.", habits: "Breathe and re-read the plan before every entry.", avoid: "Re-entering immediately after a stop.", reflectionPlan: "Fifteen minutes after the session." },
        post: { happened: "Session reviewed against the plan.", learned: dayEmotions.some((e) => ["Frustrated", "Impatient"].includes(e)) ? "Noticed impatience early; stepping away helped." : "Sticking with the checklist kept decisions simple.", followedProcess: r() < 0.75 ? "yes" : "partial", difficult: "Waiting through slow periods.", improve: "Write the reflection before checking anything else." },
        mood: dayEmotions[0] ?? null, updatedAt: now,
      });
    }
  }
  // One incomplete draft to demonstrate Quick Log drafts.
  const draft = blankTrade(++num, accounts[0].id);
  Object.assign(draft, { symbol: "ES", market: "Futures", direction: "long", setup: "Opening range break", isDraft: true });
  trades.push(draft);

  const lastWeek = weekStart(addDays(toISODate(end), -7));
  return {
    ...s,
    accounts,
    strategies,
    trades,
    dailyJournals: journals,
    weeklyJournals: [{ id: uid("wk"), weekStart: lastWeek, reflection: "A steadier week. Most entries followed the written checklist.", progress: "Reflections completed for nearly every trade.", recurringMistakes: "Entering before confirmation when impatient.", lessons: "The pause before entry is where most of my discipline lives.", nextObjectives: ["Complete every post-session journal", "Study two opening-range replays"], updatedAt: now }],
    goals: [{ id: uid("goal"), title: "Complete reflections for 20 trades", target: 20, progress: 12, unit: "trades", due: null, createdAt: now }, { id: uid("goal"), title: "Finish risk management study notes", target: 5, progress: 2, unit: "notes", due: null, createdAt: now }],
    studyNotes: [
      { id: uid("note"), folderId: s.studyFolders.find((f) => f.name === "Risk Management")?.id ?? s.studyFolders[0].id, title: "Position sizing principles", blocks: [
        { id: uid("b"), type: "heading", level: 1, text: "Position sizing principles" },
        { id: uid("b"), type: "paragraph", text: "Size each position from the distance to the stop, not from how confident I feel." },
        { id: uid("b"), type: "bullet", text: "Define risk in currency before entry" },
        { id: uid("b"), type: "bullet", text: "Quantity = risk ÷ (stop distance × point value)" },
        { id: uid("b"), type: "check", text: "Add worked example for futures", checked: false },
        { id: uid("b"), type: "quote", text: "Plan the risk, then accept it." },
      ], videoUrl: "", pinned: true, createdAt: now, updatedAt: now },
    ],
    settings: { ...s.settings, setups: strategies.map((x) => x.name), displayName: s.settings.displayName || "", onboarded: true },
    sampleData: true,
  };
}

export function isSample(state: LedgrState) {
  return state.sampleData;
}
