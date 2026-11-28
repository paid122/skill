/**
 * The optional starter vault (created only after the user says yes, never overwriting a file):
 * a Home dashboard, PARA folders and a daily trading-note template. The Home note has a LEDGR section
 * between two markers that each sync refreshes; the rest of Home is the user's.
 */
import { link, paths, setupOf, type Ctx, type PublicTrade } from "./build";

export const REGION_START = "<!-- ledgr:start -->";
export const REGION_END = "<!-- ledgr:end -->";
export const PARA = ["Projects", "Areas", "Resources", "Archive"];

export const homePath = (root: string) => `${root}/Home.md`;
export const templatePath = (root: string) => `${root}/Templates/Daily trading note.md`;

/** Replaces the text between the markers; returns null when the note has no markers (then it's left alone). */
export function replaceRegion(text: string, content: string): string | null {
  const a = text.indexOf(REGION_START), b = text.indexOf(REGION_END);
  if (a < 0 || b < a) return null;
  return text.slice(0, a + REGION_START.length) + "\n" + content.trim() + "\n" + text.slice(b);
}

const money = (n: number, cur: string) => { try { return (n < 0 ? "-" : n > 0 ? "+" : "") + new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(Math.abs(n)); } catch { return n.toFixed(2); } };

/** The Home note's LEDGR section: this week, recent trades, best and worst setups. */
export function homeRegion(trades: PublicTrade[], notePath: Map<string, string>, c: Ctx, today: string): string {
  const P = paths(c.root);
  const closed = trades.filter((t) => t.status === "closed" && t.net !== null);
  const since = (days: number) => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); };
  const sum = (ts: PublicTrade[]) => ts.reduce((a, t) => a + (t.net ?? 0), 0);
  const week = closed.filter((t) => t.date >= since(6)), month = closed.filter((t) => t.date >= since(29));
  const recent = [...closed].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number).slice(0, 8);
  const bySetup = new Map<string, number>();
  closed.forEach((t) => { const s = setupOf(t); if (s) bySetup.set(s, (bySetup.get(s) ?? 0) + (t.net ?? 0)); });
  const ranked = [...bySetup].sort((a, b) => b[1] - a[1]);
  return [
    `**Last 7 days** ${money(sum(week), c.currency)} · ${week.length} trades  ·  **Last 30 days** ${money(sum(month), c.currency)} · ${month.length} trades`,
    "",
    "**Recent trades**",
    ...(recent.length ? recent.map((t) => `- ${link(notePath.get(t.id)!, `${t.date} ${t.symbol.toUpperCase()} ${t.direction ?? ""}`.trim())} · ${money(t.net ?? 0, c.currency)}`) : ["- No trades yet."]),
    "",
    ...(ranked.length ? [`**Best setup** ${link(P.setup(ranked[0][0]), ranked[0][0])} ${money(ranked[0][1], c.currency)}${ranked.length > 1 ? ` · **Worst setup** ${link(P.setup(ranked[ranked.length - 1][0]), ranked[ranked.length - 1][0])} ${money(ranked[ranked.length - 1][1], c.currency)}` : ""}`, ""] : []),
    `Today: ${link(P.day(today), today)} · Your trades are in the ${c.root}/Trades, Days and Setups folders.`,
    "",
    `_Updated by LEDGR on sync. Open the Command Center from the pulse icon in the ribbon._`,
  ].join("\n");
}

export function homeNote(region: string): string {
  return `---
tags:
  - ledgr/home
---
# Trading Home

${REGION_START}
${region}
${REGION_END}

## Focus this week
-

## Rules I trade by
1.

## Areas
- [[Projects]] · [[Areas]] · [[Resources]] · [[Archive]]
`;
}

export function dailyTemplate(root: string): string {
  return `---
date: {{date}}
tags:
  - ledgr/daily
---
# {{date}}

Day in LEDGR: [[${root}/Days/{{date}}|{{date}}]]

## Before the open
- Bias:
- Key levels:
- News to avoid:
- Max loss today:

## Checklist
- [ ] Higher-timeframe bias marked
- [ ] Key levels drawn
- [ ] Setup is in my playbook
- [ ] Stop and target set before entry
- [ ] Size from the calculator, not a guess
- [ ] Calm, not chasing or revenge trading

## After the close
- What went well:
- What went wrong:
- What to improve:
- Sleep · focus · energy (1–10):
`;
}
