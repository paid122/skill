/**
 * LEDGR's plans. Free for journaling; two paid plans, each a one-time card payment (Ziina, through
 * MatrixX) for 30 days, which also puts the customer's MatrixX account on the matching AI plan.
 *   LEDGR+     $14.99  → MatrixX Starter   (funded traders, copy traders, many accounts)
 *   LEDGR Pro  $35.99  → MatrixX Plus      (the AI coach and less admin)
 */
export type PlanId = "free" | "plus" | "pro";

export const PLUS = {
  id: "plus" as const,
  name: "LEDGR+",
  priceUsd: 14.99,
  days: 30,
  matrixxTier: "starter",
  matrixxPlan: "MatrixX Starter",
  tagline: "For funded traders, copy traders and many accounts.",
  includes: [
    "Everything in Free",
    "Full analytics, psychology and your Performance Score",
    "Weekly review with a week score and streak",
    "The real price chart on every trade, with your entry and exit",
    "Unlimited prop accounts and strategies, copy trading accounts",
    "Up to 6 screenshots a trade",
    "Share your week as a card or video",
    "Your own backgrounds and wallpapers, pictures or video",
    "Community: up to 20 photos and videos in posts, a link on your profile",
    "MatrixX Starter included: stronger AI models, no daily cap, $4 of AI credits",
  ],
} as const;

export const PRO = {
  id: "pro" as const,
  name: "LEDGR Pro",
  priceUsd: 35.99,
  days: 30,
  matrixxTier: "plus",
  matrixxPlan: "MatrixX Plus",
  tagline: "For traders who want an AI coach and less admin.",
  includes: [
    "Everything in LEDGR+",
    "MatrixX Plus included: the AI coach that knows every trade, $16 of AI credits",
    "Trade reviews that fill themselves in, and a suggested rating",
    "AI trade reviews, weekly reviews and chat about your own records",
    "Start your own crews in the Community, public or private",
    "More saved backgrounds",
    "The LEDGR API: your own API keys to read your journal and send in trades",
  ],
} as const;

export const PAID_PLANS = [PLUS, PRO] as const;

/** A MatrixX plan as LEDGR sees it: Starter → LEDGR+, Plus or higher → LEDGR Pro, while it hasn't ended. */
export const planFromMatrixx = (p: { paid?: boolean; tier?: string; period_end?: string | null } | null | undefined): PlanId => {
  if (!p || !p.tier || p.tier === "free") return "free";
  if (p.period_end && new Date(p.period_end).getTime() <= Date.now()) return "free";
  return p.tier === "starter" ? "plus" : "pro";
};
export const planName = (p: PlanId) => (p === "pro" ? PRO.name : p === "plus" ? PLUS.name : "Free");

export const FREE_INCLUDES = [
  "Unlimited trades, every field",
  "Daily journal, dashboard, P&L calendar",
  "Prop firm tracker: 1 prop account, rules for 7 firms",
  "Trade score and 1–10 rating on every trade",
  "Paper trading, as its own journal",
  "Share any trade as a card or video",
  "Monthly recap card and video",
  "1 strategy, 1 screenshot a trade",
  "Showcase, study room, verse library",
  "Community: post, stories, reply, message, join crews, up to 10 photos",
  "CSV import from your broker",
  "Themes and your own colours",
] as const;

type Cell = boolean | string;
/** Free vs LEDGR+ vs LEDGR Pro, grouped like a pricing table. */
export const PLAN_COMPARE: { group: string; rows: { label: string; free: Cell; plus: Cell; pro: Cell }[] }[] = [
  { group: "Journal", rows: [
    { label: "Unlimited trades, every field", free: true, plus: true, pro: true },
    { label: "Daily journal, dashboard, P&L calendar", free: true, plus: true, pro: true },
    { label: "Trade score (0–100) and 1–10 rating", free: true, plus: true, pro: true },
    { label: "Paper trading, as its own journal", free: true, plus: true, pro: true },
    { label: "Screenshots a trade", free: "1", plus: "6", pro: "6" },
    { label: "Strategies", free: "1", plus: "Unlimited", pro: "Unlimited" },
    { label: "Weekly review with a week score and streak", free: false, plus: true, pro: true },
    { label: "Real price chart on every trade", free: false, plus: true, pro: true },
  ] },
  { group: "Analytics", rows: [
    { label: "Dashboard: P&L, win rate, equity curve", free: true, plus: true, pro: true },
    { label: "Full analytics, psychology and Performance Score", free: false, plus: true, pro: true },
    { label: "Export your journal as CSV", free: false, plus: true, pro: true },
  ] },
  { group: "Accounts", rows: [
    { label: "Prop accounts in the prop firm tracker", free: "1", plus: "Unlimited", pro: "Unlimited" },
    { label: "Prop firm rules and Compare table", free: true, plus: true, pro: true },
    { label: "Copy trading accounts", free: false, plus: true, pro: true },
    { label: "CSV import from your broker", free: true, plus: true, pro: true },
    { label: "LEDGR API: your own keys, read your journal, send in trades", free: false, plus: false, pro: true },
  ] },
  { group: "Sharing", rows: [
    { label: "Trade cards as pictures or count-up videos", free: true, plus: true, pro: true },
    { label: "Monthly recap card and video", free: true, plus: true, pro: true },
    { label: "Weekly recap card and video", free: false, plus: true, pro: true },
    { label: "Your own videos and pictures as card backgrounds", free: false, plus: true, pro: true },
  ] },
  { group: "AI (MatrixX)", rows: [
    { label: "MatrixX AI with your own MatrixX account", free: "Free plan: 25 a day", plus: true, pro: true },
    { label: "MatrixX plan included", free: false, plus: "Starter", pro: "Plus" },
    { label: "AI credits every 30 days", free: false, plus: "$4", pro: "$16" },
    { label: "Reviews that fill themselves in + suggested rating", free: false, plus: false, pro: true },
  ] },
  { group: "Community & look", rows: [
    { label: "Post, stories, reply, message, join crews", free: true, plus: true, pro: true },
    { label: "Photos in a post", free: "Up to 10", plus: "Up to 20", pro: "Up to 20" },
    { label: "Videos in posts and stories", free: false, plus: true, pro: true },
    { label: "A link on your profile", free: false, plus: true, pro: true },
    { label: "Start your own crew", free: false, plus: false, pro: true },
    { label: "Themes and your own colours", free: true, plus: true, pro: true },
    { label: "Your own wallpaper behind the app", free: false, plus: "6 saved", pro: "12 saved" },
  ] },
];

/** Kept for older imports: the simple two-column view (Free vs LEDGR+). */
export const PLUS_COMPARE = PLAN_COMPARE.flatMap((g) => g.rows.map((r) => ({ label: r.label, free: r.free, plus: r.plus })));
