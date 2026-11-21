/** LEDGR+: creator and pro journaling tools, with MatrixX AI included. A one-time card payment (Ziina, through MatrixX) for 30 days of MatrixX Starter. */
export const PLUS = {
  name: "LEDGR+",
  priceUsd: 15,
  days: 30,
  matrixxTier: "starter",
  matrixxPlan: "MatrixX Starter",
  includes: [
    "Count-up video P&L cards and recaps, your own clips as backgrounds and wallpapers",
    "Trade reviews that fill themselves in, plus a suggested rating",
    "Copy trading accounts, videos and 10 photos in community posts, private crews",
    "MatrixX Starter included: stronger AI models, no daily message cap, $4 of AI credits",
    "MatrixX trade reviews on every trade",
    "MatrixX weekly reviews",
    "MatrixX AI chat about your own records",
    "Works in the MatrixX app and on your phone too",
  ],
} as const;

/** Free vs LEDGR+, row by row (true = included, false = not, text = the value). */
export const PLUS_COMPARE: { label: string; free: boolean | string; plus: boolean | string }[] = [
  { label: "Journal, dashboard, analytics, reports", free: true, plus: true },
  { label: "Daily & weekly journal, study room, verses", free: true, plus: true },
  { label: "Prop firm tracker, paper accounts, trade scores", free: true, plus: true },
  { label: "Community: posts, stories, crews, messages", free: "Up to 4 photos", plus: "Videos, 10 photos, private crews" },
  { label: "P&L and recap cards", free: "Pictures", plus: "Pictures + count-up videos" },
  { label: "My picks backgrounds", free: "Built-in clips", plus: "Your own videos & pictures" },
  { label: "Trade review autofill + suggested rating", free: false, plus: true },
  { label: "Copy trading accounts", free: false, plus: true },
  { label: "Custom video wallpapers", free: false, plus: true },
  { label: "MatrixX AI with your own MatrixX account", free: true, plus: true },
  { label: `${PLUS.matrixxPlan} included`, free: false, plus: true },
  { label: "Stronger AI models", free: false, plus: true },
  { label: "Daily AI message cap", free: "25 a day", plus: "None" },
  { label: "AI credits each 30 days", free: false, plus: "$4" },
];
