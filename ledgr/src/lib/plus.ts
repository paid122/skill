/** LEDGR+: MatrixX AI included. A one-time card payment (Ziina, through MatrixX) for 30 days of MatrixX Starter. */
export const PLUS = {
  name: "LEDGR+",
  priceUsd: 15,
  days: 30,
  matrixxTier: "starter",
  matrixxPlan: "MatrixX Starter",
  includes: [
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
  { label: "P&L cards with real price charts", free: true, plus: true },
  { label: "Cloud backup and sync", free: true, plus: true },
  { label: "MatrixX AI with your own MatrixX account", free: true, plus: true },
  { label: `${PLUS.matrixxPlan} included`, free: false, plus: true },
  { label: "Stronger AI models", free: false, plus: true },
  { label: "Daily AI message cap", free: "25 a day", plus: "None" },
  { label: "AI credits each 30 days", free: false, plus: "$4" },
];
