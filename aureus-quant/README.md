# AUREUS QUANT

Quantitative research system for **COMEX Micro Gold futures (MGC1!)** and the **TBS strategy** (Daily CRT → 4H CRT → AMD → 5M TBS → LTF execution).

> Evidence over opinions. Mathematics over intuition. Validation over assumptions.

## Quick start

```bash
cd aureus-quant
pip install -r requirements.txt
uvicorn aureus.api.app:app --port 8000
# open http://localhost:8000
```

Then go to **Data Management** and import:

1. **Historical MGC candles** (CSV, any intraday timeframe, ideally 1–5 min from a CME-licensed vendor). The timestamp timezone must be stated; AUREUS will not guess it. Include a `contract` column (e.g. `MGCZ6`) to enable rollover detection and back-adjustment.
2. **Your TBS trade journal** (CSV). See `data/templates/journal_template.csv`.
3. **(Optional) economic-event calendar** from official sources (Fed, BLS).

Use **Load simulated demo data** only to explore the interface. While it is loaded a red banner stays on screen, and every result is stamped `SIMULATED`.

Run the tests:

```bash
python -m pytest -q
```

## TradingView link

TradingView has no API for reading manual drawings. Instead, the **AUREUS TBS Marker** indicator (`tradingview/aureus_tbs_marker.pine`) lets you click a setup's time, entry, stop and target, and tick Daily CRT, 4H CRT, AMD and TBS. It tracks the fill, exit, MFE and MAE on the chart and sends the full state to `POST /api/tradingview/webhook`. Filled setups join the journal automatically.

1. Run `cloudflared tunnel --url http://localhost:8000` (install with `winget install Cloudflare.cloudflared`). Through the tunnel only the webhook is reachable; the dashboard returns 403.
2. Add the indicator in the Pine Editor, mark a setup, and paste the token shown on the **TradingView Link** page.
3. Create an alert on *Any alert() function call* with webhook URL `https://<tunnel>.trycloudflare.com/api/tradingview/webhook`.

This needs a paid TradingView plan with 2FA for webhooks. Fills assume a limit order at entry, and stop-before-target when both are hit in one bar. TradingView "Export chart data" CSVs (Unix `time` column) import directly as candles.

## What is implemented

| Module | Path | Contents |
|---|---|---|
| Core | `aureus/core.py` | MGC contract spec ($0.10 tick = $1.00); `Result` (measures / data / method / value / meaning / n / limitations); LIVE·HISTORICAL·SIMULATED provenance |
| Data | `aureus/data/` | Candle import with explicit timezone; checks for duplicates, OHLC consistency, off-tick prices and missing bars within Globex hours; volume-crossover rollover with same-timestamp back-adjustment; CME-day (18:00 ET) and 4H resampling; journal validation (stop on the wrong side, R cross-check, duplicates) |
| Features | `aureus/features/` | Candle anatomy, Wilder ATR(14), realised vol, rolling std, trailing volatility percentile, efficiency ratio, ADX, confirmed swings (no look-ahead), trend, session high/low, PDH/PDL |
| Statistics | `aureus/stats/engine.py` | Descriptive stats, Wilson CI, conditional/joint probability and lift, Beta-Binomial Bayesian win rate, distribution fits (AIC, KS, Jarque–Bera), t-test + bootstrap + sign-flip permutation for edge, permutation difference test, Holm–Bonferroni, ACF/Ljung–Box, ADF+KPSS, STL decomposition |
| Costs | `aureus/backtest/costs.py` | Commission + exchange fees + slippage ticks converted to R; all statistics are net by default |
| TBS research | `aureus/tbs/research.py` | Datasets A/B/C (definitions below); full metric set; filter tests (subset vs complement); rolling EV/std; deterioration test with CUSUM; breakdowns |
| Regimes | `aureus/regime/classifier.py` | Six measurable regimes from ATR percentile, ER20 and ATR change; trades tagged with the regime of the last completed bar before entry; per-regime stats with an n ≥ 30 guard; transition matrix |
| Risk | `aureus/risk/analytics.py` | **Observed:** drawdown, streaks, recovery factor, VaR/CVaR. **Theoretical:** bootstrap / block-bootstrap Monte Carlo risk of ruin under stated assumptions, plus the analytic gambler's-ruin estimate |
| ML | `aureus/ml/research.py` | Logistic, random forest and gradient boosting with expanding walk-forward, embargo and train-only imputation; Brier skill vs base rate; calibration; permutation importance on a chronological holdout; PSI drift; k-means clusters; Markov-switching (HMM) volatility regimes using **filtered** probabilities only |
| Events | `aureus/events/analysis.py` | Pre / event / post window volatility vs normal; TBS on event days vs other days (association only) |
| Reproducibility | `aureus/backtest/registry.py` | SQLite run registry: parameters, parameter hash, data fingerprints, code version |
| Live feed | `aureus/live/feed.py` | Provider interface and a Databento (GLBX.MDP3) adapter. Reports `unavailable` unless a licensed feed is configured (`AUREUS_FEED=databento`, `DATABENTO_API_KEY`) |
| Assistant | `aureus/assistant/router.py` | Deterministic question router. Every answer is a computed `Result`; it declines questions it cannot compute |
| API / UI | `aureus/api/app.py`, `web/` | FastAPI backend plus a dark institutional dashboard (Plotly) with 10 sections and all 10 required charts |

### TBS dataset definitions (auditable, not strategy changes)

- **A · Overall TBS:** every closed trade with `tbs_confirmed ≠ false`.
- **B · TBS + Daily CRT:** A, plus Daily CRT bias agrees with trade direction (bullish↔long, bearish↔short).
- **C · TBS + Daily CRT + AMD:** B, plus `amd_aligned = true`.

Filter value is tested as **B vs A∖B** and **C vs B∖C** using a one-sided permutation test, with Welch and Mann–Whitney cross-checks, bootstrap CI of Δ and Holm correction. Comparing B against A directly would be invalid, because B is a subset of A.

## Integrity rules enforced in code

- No prices, statistics or trades are fabricated. Simulated data exists only in `aureus/simulate.py`, and it is force-stamped `SIMULATED` in every API response.
- Live endpoints refuse to serve data without a licensed feed.
- Features, swings and regime tags use only data available at the time (a regression test checks the regimes).
- Walk-forward folds are strictly chronological, with an embargo between train and test.
- Every statistic carries its sample size; results below n = 30 are flagged.
- Costs are applied before any performance statistic is reported.

## Known limitations / next steps

- **Exchange holidays and early closes are not modelled.** They show up as gaps in the quality report.
- **Session boundaries are conventions** (ET: Asia 18–02, London 02–07, NY AM 07–12, NY PM 12–17). Adjust them in `data/journal.py::session_of` if your definitions differ.
- **The default cost model is a placeholder.** Set your broker's commission and the current CME/NFA fees.
- **DXY and Treasury-yield co-movement:** import these as additional candle series. A cross-asset module is not yet built.
- **The workspace is held in memory**; the run registry uses SQLite. PostgreSQL/TimescaleDB persistence is the next step for multi-user or long-running use.
- **The frontend is vanilla JS**, not React, to keep the build dependency-free. The API is frontend-agnostic.
