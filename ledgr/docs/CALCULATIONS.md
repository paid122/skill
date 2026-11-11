# Ledgr calculation reference

All figures come from `src/lib/calc.ts` (with account balances in `src/lib/accounts.ts`). Unit tests live in `tests/calc.test.ts`.

## Which records count

A trade contributes to statistics only when it is **closed**:

- it is not a draft, and every required field is present (symbol, direction, account, date, and either an entry execution or a recorded net result), **and**
- all entered quantity has been exited — or, with no executions, a manual net result is recorded.

Drafts and open positions are counted separately and every page that shows statistics states how many were excluded.

## Per-trade figures

| Figure | Formula |
|---|---|
| Average entry | Σ(entry price × qty) ÷ Σ entry qty |
| Average exit | Σ(exit price × qty) ÷ Σ exit qty |
| Gross | (avg exit − avg entry) × min(exit qty, entry qty) × point value; sign reversed for shorts |
| Total fees | trade-level fees + Σ execution fees |
| Net | gross − total fees. With no executions: the recorded net result |
| Risk | planned risk if recorded, else \|avg entry − stop\| × entry qty × point value |
| R multiple | net ÷ risk (undefined when no risk is recorded) |
| Result | break-even when \|net\| ≤ break-even threshold (Settings); otherwise win if net > 0, loss if net < 0 |
| Duration | last execution time − first execution time |

## Aggregate figures

| Figure | Formula | When undefined |
|---|---|---|
| Net P&L | Σ net of closed trades | 0 with no trades |
| Win rate | wins ÷ (wins + losses); break-even excluded | no wins or losses |
| Profit factor | Σ net of wins ÷ \|Σ net of losses\| | no losses ("No losses" shown if there are wins) |
| Average winner / loser | gross profit ÷ wins; −gross loss ÷ losses | none of that kind |
| Average R | mean R over closed trades with risk (coverage is always shown) | no trade has risk |
| Expectancy | net ÷ closed trades | no closed trades |
| Equity curve | running Σ net, in date → first execution → trade number order | — |
| Maximum drawdown | largest (equity − prior peak); % is relative to peak when a starting balance exists | — |
| Account balance | starting balance + Σ adjustments + Σ closed trade nets | — |

## Discipline score (0–100) — process only, never P&L

| Component | Weight | Measure |
|---|---|---|
| Journal completion | 25% | complete, non-draft trades ÷ all trades |
| Plan adherence | 25% | mean of “Did I follow my written plan?” (yes 1, partly 0.5, no 0) over trades that answered |
| Reflection completion | 20% | trades with all four reflection prompts answered ÷ all trades |
| Documentation consistency | 15% | trading days with a post-session daily entry ÷ trading days |
| Emotional awareness | 15% | trades with ≥ 1 recorded emotion ÷ all trades |

Components without data are excluded and the remaining weights re-normalised.

## Performance score

`0.5 × discipline + 0.5 × statistical quality`, where statistical quality is the mean of:
`min(PF ÷ 2, 1) × 100`, `win rate × 100`, `clamp((avg R + 1) ÷ 2, 0, 1) × 100`, `100 − min(|max DD| ÷ gross profit, 1) × 100`.
Requires the configured minimum sample (default 10 closed trades).

## Pattern insights

Fourteen modules in `src/lib/insights.ts`. Each returns “Not enough journal data yet.” below the configured minimum sample, compares only groups with at least `max(3, minSample ÷ 3)` trades, reports its sample size, and uses descriptive (non-causal) wording.

## What-if analysis

Replays recorded closed trades under user-chosen filters (exclude mistakes/emotions, keep setups/sessions/plan-followed trades, max trades per day) and an optional loss cap of −X R (applied only to trades with recorded risk; others are left unchanged and counted). Always labelled hypothetical.
