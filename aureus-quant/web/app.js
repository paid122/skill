// AUREUS QUANT dashboard — vanilla JS + Plotly. All numbers come from the API;
// the UI never computes or invents statistics of its own.
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const C = { A: "#3987e5", B: "#d95926", C: "#199e70", gold: "#c9a54c", grid: "#2a2d32", text: "#f0efec",
            text2: "#b9b8b2", muted: "#85847f", good: "#0ca30c", bad: "#e66767", surface: "#17181b" };
const DS = { A: "A · Overall TBS", B: "B · TBS + Daily CRT", C: "C · TBS + Daily CRT + AMD" };

async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail || body.error || r.statusText);
  return body;
}
const fmt = (v, ...a) => { const d = a.length ? a[0] : 3; if (v == null || Number.isNaN(v)) return "—"; if (typeof v !== "number") return String(v);
  if (!a.length && Number.isInteger(v)) return String(v); return Math.abs(v) >= 1e4 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(d); };
const pct = (v, d = 1) => v == null ? "—" : (100 * v).toFixed(d) + "%";
const sgn = (v, d = 3) => v == null ? "—" : `<span class="${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v.toFixed(d)}</span>`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function layout(extra = {}) {
  return Object.assign({
    paper_bgcolor: C.surface, plot_bgcolor: C.surface, font: { family: "IBM Plex Mono", size: 11, color: C.text2 },
    margin: { l: 48, r: 12, t: 28, b: 36 }, showlegend: true,
    legend: { orientation: "h", y: 1.12, x: 0, font: { size: 11 } },
    xaxis: { gridcolor: C.grid, zerolinecolor: C.grid, linecolor: C.grid },
    yaxis: { gridcolor: C.grid, zerolinecolor: "#45484f", linecolor: C.grid },
    hoverlabel: { bgcolor: "#1e2024", bordercolor: C.gold, font: { family: "IBM Plex Mono", color: C.text } },
    bargap: 0.08,
  }, extra);
}
const cfg = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d"] };
const plot = (id, data, lay = {}) => Plotly.newPlot(id, data, layout(lay), cfg);

function card(title, inner, cls = "") { return `<div class="card ${cls}"><h2>${title}</h2>${inner}</div>`; }
function kpi(l, v, s = "") { return `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; }
function empty(msg) { return `<div class="empty">${esc(msg)}</div>`; }
function provChip(p) { p = String(p || ""); return `<span class="chip ${p.startsWith("SIM") ? "sim" : p.startsWith("LIVE") ? "ok" : "hist"}">${esc(p)}</span>`; }

function explain(r) {
  if (!r || r.error) return empty(r?.error || "Not available");
  return `<dl class="explain">
    <dt>RESULT ${provChip(r.provenance)} ${r.n != null ? `<span class="chip">n = ${r.n}</span>` : ""}</dt><dd>${esc(r.interpretation)}</dd>
    <dt>WHAT IS MEASURED</dt><dd>${esc(r.measures)}</dd>
    <dt>DATA</dt><dd>${esc(r.data)}</dd>
    <dt>METHOD</dt><dd>${esc(r.method)}</dd>
    ${(r.limitations || []).map((l) => `<div class="lim">⚠ ${esc(l)}</div>`).join("")}
  </dl>`;
}
function table(rows, cols) {
  if (!rows?.length) return empty("No rows");
  cols = cols || Object.keys(rows[0]).map((k) => [k, k]);
  return `<div class="scroll"><table><thead><tr>${cols.map(([, h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${cols.map(([k, , f]) => `<td>${f ? f(r[k]) : typeof r[k] === "number" ? fmt(r[k]) : esc(r[k])}</td>`).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}
async function guard(fn) {
  try { await fn(); } catch (e) { view.innerHTML = empty(e.message) + `<p class="dim" style="text-align:center">Import data in <a href="#data" style="color:var(--gold)">Data Management</a>.</p>`; }
}
async function section(el, fn) { try { await fn(); } catch (e) { $(el).innerHTML = empty(e.message); } }

// ---------------------------------------------------------------- status --
let STATUS = null;
async function refreshStatus() {
  STATUS = await api("/api/status");
  const c = STATUS.candles, f = STATUS.feed;
  const b = $("#banner");
  if (STATUS.simulated_inputs?.length) {
    b.hidden = false;
    b.textContent = `SIMULATED DATA LOADED (${STATUS.simulated_inputs.join(", ")}) — random numbers for interface testing only. No result shown is real market or trading evidence.`;
  } else b.hidden = true;
  $("#dataheader").innerHTML = c
    ? `<b>${esc(c.contract)}</b> · ${esc(c.source)} · ${provChip(c.provenance)}<br>${esc(c.timeframe)} bars · ${esc(c.first)} → <b>${esc(c.last)}</b> UTC · roll: ${esc(c.rollover_adjustment)}`
    : "No candle data imported";
  $("#navfoot").innerHTML = `FEED: <span class="${f.status === "unavailable" ? "neg" : "pos"}">${esc(f.status.toUpperCase())}</span><br>${
    STATUS.journal ? `${STATUS.journal.trades} trades` : "no journal"} · v${STATUS.version}`;
}

// --------------------------------------------------------------- views ----
const views = {};

views.overview = async () => {
  const s = await api("/api/market/snapshot");
  const lv = await api("/api/market/levels").catch(() => null);
  view.innerHTML = `
    <div class="row">${provChip(s.header.provenance)} <span class="dim">${esc(s.notice)} As of ${esc(s.as_of_et)} (ET)</span></div>
    <div class="kpis">
      ${kpi("Last close", fmt(s.ohlcv.close, 1), `Δ ${fmt(s.anatomy.change, 1)} · ${fmt(s.anatomy.change_ticks, 0)} ticks · $${fmt(s.anatomy.change_dollars, 0)}`)}
      ${kpi("ATR(14) · bar", fmt(s.atr14, 2), `$${fmt(s.atr14_dollars, 2)} / contract`)}
      ${kpi("ATR percentile", fmt(s.atr_pct_rank, 0), "trailing window")}
      ${kpi("Realised vol (ann.)", pct(s.rv_annualised), "log-return RMS")}
      ${kpi("Daily ATR(14)", fmt(s.daily_atr14, 2), "CME trading days")}
      ${kpi("ER20 / ADX14", `${fmt(s.er20, 2)} / ${fmt(s.adx14, 0)}`, "directionality")}
      ${kpi("Swing trend", s.trend === 1 ? "Up" : s.trend === -1 ? "Down" : "Neutral", "confirmed swings")}
      ${kpi("Regime", `<span style="font-size:13px">${esc(s.regime)}</span>`, "measurable rules")}
      ${kpi("PDH / PDL", s.prev_day ? `${fmt(s.prev_day.high, 1)} / ${fmt(s.prev_day.low, 1)}` : "—", "previous CME day")}
      ${lv ? kpi(`Session (${esc(lv.session)}) H/L`, `${fmt(lv.session_high, 1)} / ${fmt(lv.session_low, 1)}`, "running") : ""}
    </div>
    <div class="grid" style="margin-top:12px">
      ${card("Price · native timeframe (last 400 bars)", `<div id="pc" class="plot tall"></div>`)}
      <div class="grid g2">${card("Bar anatomy (last bar)", table([s.anatomy].map((a) => ({ range: a.range, body: a.body, upper_wick: a.upper_wick, lower_wick: a.lower_wick, spread: a.spread }))))}
      ${card("Data quality", qualityTable(STATUS.candle_quality))}</div>
    </div>`;
  const c = await api("/api/market/candles?limit=400");
  const r = c.rows;
  plot("pc", [
    { type: "candlestick", x: r.map((d) => d.t), open: r.map((d) => d.open), high: r.map((d) => d.high), low: r.map((d) => d.low), close: r.map((d) => d.close),
      increasing: { line: { color: C.text2, width: 1 }, fillcolor: C.text2 }, decreasing: { line: { color: C.gold, width: 1 }, fillcolor: C.gold }, name: "MGC1!", showlegend: false },
  ], { margin: { l: 12, r: 64, t: 12, b: 60 }, xaxis: { rangeslider: { visible: false }, gridcolor: C.grid, type: "category", nticks: 8 }, yaxis: { gridcolor: C.grid, side: "right", tickformat: ".1f" } });
};

function qualityTable(q) {
  if (!q) return empty("No candles");
  const rows = [["Duplicate rows", q.duplicate_rows], ["OHLC inconsistencies", q.ohlc_inconsistent_rows], ["Null prices", q.null_values],
    ["Off-tick prices (0.10)", q.off_tick_rows], ["Expected bars (Globex hrs)", q.expected_bars], ["Missing bars", q.missing_bars],
    ["Completeness", q.completeness_pct != null ? q.completeness_pct.toFixed(2) + "%" : "—"]];
  return `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v ?? "—"}</td></tr>`).join("")}</table>
    ${q.largest_gaps?.length ? `<div class="explain"><dt>LARGEST GAPS</dt>${q.largest_gaps.slice(0, 4).map((g) => `<dd>${esc(g.start)} · ${g.bars} bars</dd>`).join("")}</div>` : ""}
    <div class="explain lim">⚠ ${esc(q.note || "")}</div>`;
}

views.live = async () => {
  const live = await api("/api/live/status");
  view.innerHTML = `
    <div class="card" style="margin-bottom:12px"><h2>Live feed</h2>
      <div class="row"><span class="chip ${live.status === "unavailable" ? "sim" : "ok"}">${esc(live.status.toUpperCase())}</span>
      <span>${esc(live.provider || "No provider")}</span><span class="dim">${esc(live.reason)}</span></div>
      ${live.status === "unavailable" ? `<p class="dim">AUREUS does not display live prices without a licensed feed. Analytics below use the last imported historical bar.</p>` : ""}
    </div>
    <div class="grid g2">
      ${card("Volatility percentile", `<div id="vp"></div>`)}
      ${card("ATR(14) and trailing percentile", `<div id="vc" class="plot"></div>`)}
      ${card("Average range by session", `<div id="sr"></div>`, "spanall")}
    </div>`;
  await section("#vp", async () => {
    const v = await api("/api/market/volatility");
    $("#vp").innerHTML = explain(v.result);
    const s = v.series;
    plot("vc", [
      { x: s.t, y: s.atr14, name: "ATR(14)", line: { color: C.gold, width: 2 }, hovertemplate: "%{x}<br>ATR %{y:.2f}<extra></extra>" },
    ], { showlegend: false, yaxis: { gridcolor: C.grid, title: "ATR (price)" } });
  });
  await section("#sr", async () => {
    const r = await api("/api/market/sessions");
    const rows = Object.entries(r.value).map(([k, v]) => ({ session: k, ...v }));
    $("#sr").innerHTML = `<div class="grid g2"><div>${table(rows, [["session", "Session"], ["n_sessions", "n"], ["mean", "Mean"], ["median", "Median"], ["std", "Std"], ["p25", "P25"], ["p75", "P75"], ["mean_dollars", "Mean $/ct"], ["mean_ticks", "Ticks"]])}</div><div>${explain(r)}</div></div>`;
  });
};

views.stats = async () => {
  const s = await api("/api/stats/returns");
  view.innerHTML = `<div class="grid g2">
    ${card("4 · Daily returns distribution (%)", `<div id="rh" class="plot"></div>`)}
    ${card("Descriptive statistics", explain(s.describe) + (s.describe.value ? table(Object.entries(s.describe.value).map(([k, v]) => ({ stat: k, value: v })), [["stat", "Statistic"], ["value", "Value"]]) : ""))}
    ${card("Autocorrelation of returns", `<div id="acf" class="plot"></div>${explain(s.acf)}`)}
    ${card("Autocorrelation of |returns| (vol clustering)", `<div id="acf2" class="plot"></div>${explain(s.acf_abs)}`)}
    ${card("Stationarity", explain(s.stationarity))}
    ${card("Distribution fit", explain(s.fit) + (s.fit.value ? table(Object.entries(s.fit.value.fits).map(([k, v]) => ({ family: k, aic: v.aic, ks_p: v.ks_p })), [["family", "Family"], ["aic", "AIC"], ["ks_p", "KS p"]]) : ""))}
  </div>`;
  const d = s.describe.value;
  if (d) {
    plot("rh", [{ type: "histogram", x: s.returns_pct, marker: { color: C.A, line: { color: C.surface, width: 1 } }, name: "returns", hovertemplate: "%{x}<br>count %{y}<extra></extra>" }],
      { showlegend: false, shapes: vline(d.mean, C.gold).concat(vline(d.median, C.text2, "dot")),
        annotations: [statNote(d)] });
  }
  for (const [id, r] of [["acf", s.acf], ["acf2", s.acf_abs]]) {
    if (!r.value) continue;
    const a = r.value.acf, b = r.value.band;
    plot(id, [{ type: "bar", x: a.map((_, i) => i + 1), y: a, marker: { color: a.map((v) => Math.abs(v) > b ? C.gold : "#5b5e66") }, hovertemplate: "lag %{x}: ρ=%{y:.3f}<extra></extra>" }],
      { showlegend: false, shapes: [hline(b), hline(-b)], xaxis: { title: "lag", gridcolor: C.grid } });
  }
};
const vline = (x, color, dash = "solid") => x == null ? [] : [{ type: "line", x0: x, x1: x, yref: "paper", y0: 0, y1: 1, line: { color, width: 2, dash } }];
const hline = (y) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: C.muted, width: 1, dash: "dot" } });
const statNote = (d, color = C.text2) => ({ xref: "paper", yref: "paper", x: 1, y: 1, xanchor: "right", yanchor: "top", align: "right", showarrow: false,
  font: { size: 11, color }, text: `n=${d.n}<br>mean ${fmt(d.mean)}<br>median ${fmt(d.median)}<br>sd ${fmt(d.std)}` });

views.tbs = async () => {
  const cmp = await api("/api/tbs/compare");
  const m = cmp.metrics;
  const rows = [["n", "Sample size", (v) => v], ["win_rate", "Win rate", pct], ["win_rate_ci95", "Win rate 95% CI", (v) => v ? `${pct(v[0])}–${pct(v[1])}` : "—"],
    ["avg_r", "Average R", (v) => sgn(v)], ["median_r", "Median R", (v) => sgn(v)], ["expected_value_r", "Expected value (R)", (v) => sgn(v)],
    ["ev_ci95", "EV 95% CI (bootstrap)", (v) => v ? `${sgn(v[0])} … ${sgn(v[1])}` : "—"], ["expected_value_usd", "EV ($/trade)", (v) => v == null ? "—" : "$" + v.toFixed(2)],
    ["std_r", "Std dev (R)", fmt], ["variance_r", "Variance (R²)", fmt], ["profit_factor", "Profit factor", (v) => fmt(v, 2)],
    ["breakeven_win_rate", "Break-even win rate", pct], ["max_drawdown_r", "Max drawdown (R)", (v) => fmt(v, 2)],
    ["longest_losing_streak", "Longest losing streak", (v) => v], ["sqn", "SQN", (v) => fmt(v, 2)], ["r_basis", "R basis", (v) => v]];
  const et = cmp.edge_tests;
  view.innerHTML = `
    <div class="card" style="margin-bottom:12px"><h2>Dataset comparison</h2>
      <div><table><thead><tr><th>Metric</th>${["A", "B", "C"].map((k) => `<th><i style="display:inline-block;width:8px;height:8px;background:${C[k]};border-radius:2px"></i> ${DS[k]}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(([k, h, f]) => `<tr><td>${h}</td>${["A", "B", "C"].map((d) => `<td>${m[d].value ? f(m[d].value[k]) : "—"}</td>`).join("")}</tr>`).join("")}
      <tr><td>Edge test p (t / bootstrap)</td>${["A", "B", "C"].map((d) => `<td>${et[d].value ? `${fmt(et[d].value.p_t, 4)} / ${fmt(et[d].value.p_bootstrap, 4)}` : "—"}</td>`).join("")}</tr>
      </tbody></table></div>
      <p class="dim">${cmp.notes.map(esc).join(" ")}</p>
    </div>
    <div class="grid g2">
      ${card("Does Daily CRT alignment add value? (B vs A∖B)", explain(cmp.filter_tests.daily_crt_filter))}
      ${card("Does AMD add value beyond Daily CRT? (C vs B∖C)", explain(cmp.filter_tests.amd_filter))}
      ${card("1–3 · R-multiple histograms (overlay)", `<div class="row"><select id="hsel"><option value="ABC">A + B + C</option><option value="A">A only</option><option value="B">B only</option><option value="C">C only</option></select></div><div id="hist" class="plot tall"></div>`, "spanall")}
      ${card("5 · Rolling expected value", `<div class="row"><select id="rds">${["A", "B", "C"].map((k) => `<option>${k}</option>`)}</select><label class="f">window<input id="rw" type="number" value="20" min="5" style="width:70px"></label></div><div id="rev" class="plot"></div>`)}
      ${card("6 · Rolling standard deviation", `<div id="rsd" class="plot"></div>`)}
      ${card("Equity curve & drawdown (R)", `<div id="eq" class="plot"></div>`)}
      ${card("10 · MFE vs MAE (R)", `<div id="mfe" class="plot"></div>`)}
      ${card("8 · Performance by session", `<div id="bs" class="plot"></div><div id="bst"></div>`)}
      ${card("9 · Performance by weekday", `<div id="bw" class="plot"></div><div id="bwt"></div>`)}
      ${card("Deterioration test", `<div id="det"></div>`, "spanall")}
      ${card("Trade log", `<div id="tl"></div>`, "spanall")}
    </div>`;
  const drawHist = () => {
    const sel = $("#hsel").value.split("");
    plot("hist", sel.map((k) => { const v = m[k].value || {}; return { type: "histogram", x: cmp.r_values[k],
      name: `${DS[k]} — n=${v.n ?? 0} · mean ${fmt(v.avg_r, 2)} · median ${fmt(v.median_r, 2)} · sd ${fmt(v.std_r, 2)}`,
      opacity: sel.length > 1 ? 0.55 : 0.9, xbins: { size: 0.25 }, marker: { color: C[k], line: { color: C.surface, width: 1 } },
      hovertemplate: `${k}: %{x}R<br>count %{y}<extra></extra>` }; }),
      { barmode: "overlay", xaxis: { title: "R-multiple (net) · solid lines = means", gridcolor: C.grid }, margin: { l: 48, r: 12, t: 70, b: 40 },
        legend: { orientation: "v", y: 1.3, x: 0, font: { size: 11 } }, shapes: sel.flatMap((k) => vline(m[k].value?.avg_r, C[k])) });
  };
  drawHist(); $("#hsel").onchange = drawHist;
  const drawRolling = async () => {
    const ds = $("#rds").value, w = $("#rw").value;
    try {
      const r = await api(`/api/tbs/rolling?dataset=${ds}&window=${w}`);
      plot("rev", [{ x: r.t, y: r.rolling_ev, name: `${ds} rolling EV`, line: { color: C[ds], width: 2 }, hovertemplate: "%{x}<br>EV %{y:.3f}R<extra></extra>" }],
        { showlegend: false, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: C.muted, width: 1 } }], yaxis: { title: "mean R", gridcolor: C.grid } });
      plot("rsd", [{ x: r.t, y: r.rolling_std, name: "rolling sd", line: { color: C[ds], width: 2 }, hovertemplate: "%{x}<br>sd %{y:.3f}R<extra></extra>" }], { showlegend: false, yaxis: { title: "sd of R", gridcolor: C.grid } });
      plot("eq", [{ x: r.t, y: r.cum_r, name: "Cumulative R", line: { color: C[ds], width: 2 } },
        { x: r.t, y: r.drawdown, name: "Drawdown", fill: "tozeroy", line: { color: C.bad, width: 1 }, fillcolor: "rgba(230,103,103,.15)" }], { yaxis: { title: "R", gridcolor: C.grid } });
    } catch (e) { $("#rev").innerHTML = empty(e.message); }
  };
  await drawRolling(); $("#rds").onchange = drawRolling; $("#rw").onchange = drawRolling;

  const trades = await api("/api/tbs/trades");
  const t2 = trades.filter((t) => t.mfe_r != null && t.mae_r != null);
  if (t2.length) {
    plot("mfe", [{ type: "scatter", mode: "markers", x: t2.map((t) => t.mae_r), y: t2.map((t) => t.mfe_r), text: t2.map((t) => `#${t.trade_id} ${t.entry_time}<br>R ${fmt(t.r_net, 2)}`),
      marker: { size: 8, color: t2.map((t) => t.r_net > 0 ? C.good : C.bad), line: { color: C.surface, width: 2 } }, hovertemplate: "%{text}<br>MAE %{x:.2f}R · MFE %{y:.2f}R<extra></extra>", showlegend: false }],
      { xaxis: { title: "MAE (R)", gridcolor: C.grid }, yaxis: { title: "MFE (R)", gridcolor: C.grid }, showlegend: false,
        annotations: [{ xref: "paper", yref: "paper", x: 1, y: 1.08, xanchor: "right", showarrow: false, text: `<span style="color:${C.good}">●</span> win  <span style="color:${C.bad}">●</span> loss · n=${t2.length}` }] });
  } else $("#mfe").innerHTML = empty("Journal has no MFE/MAE columns");
  for (const [by, pid, tid] of [["session", "bs", "bst"], ["weekday", "bw", "bwt"]]) {
    const b = await api(`/api/tbs/breakdown?by=${by}`);
    const order = by === "weekday" ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Sunday"] : ["asia", "london", "ny_am", "ny_pm", "other"];
    b.sort((x, y) => order.indexOf(x[by]) - order.indexOf(y[by]));
    plot(pid, [{ type: "bar", x: b.map((r) => r[by]), y: b.map((r) => r.avg_r), error_y: { type: "data", array: b.map((r) => 1.96 * (r.sem || 0)), color: C.muted, thickness: 1 },
      marker: { color: b.map((r) => r.reliable ? C.A : "#4a5568") }, text: b.map((r) => `n=${r.n}`), textposition: "outside", hovertemplate: "%{x}<br>mean %{y:.3f}R ±1.96·SE<extra></extra>" }],
      { showlegend: false, yaxis: { title: "mean R (net)", gridcolor: C.grid } });
    $("#" + tid).innerHTML = table(b, [[by, by], ["n", "n"], ["win_rate", "Win%", pct], ["avg_r", "Avg R", (v) => sgn(v)], ["median_r", "Med R", (v) => sgn(v)], ["std_r", "Std", fmt], ["reliable", "n≥30", (v) => v ? "yes" : `<span class="dim">no</span>`]]) + `<div class="explain lim">⚠ Grey bars have n &lt; 30. Error bars = ±1.96 SE.</div>`;
  }
  await section("#det", async () => { $("#det").innerHTML = explain(await api("/api/tbs/deterioration")); });
  $("#tl").innerHTML = table(trades.slice().reverse(), [["trade_id", "#"], ["entry_time", "Entry (ET)", (v) => esc(String(v).slice(0, 16))], ["session", "Session"], ["direction", "Dir"],
    ["daily_crt", "D CRT"], ["h4_crt", "4H CRT"], ["amd_aligned", "AMD", (v) => v == null ? "—" : v ? "✓" : "✗"], ["entry", "Entry", (v) => fmt(v, 1)], ["stop", "Stop", (v) => fmt(v, 1)],
    ["exit", "Exit", (v) => fmt(v, 1)], ["risk_dollars", "Risk $", (v) => fmt(v, 0)], ["r_gross", "R gross", (v) => sgn(v, 2)], ["r_net", "R net", (v) => sgn(v, 2)],
    ["mfe_r", "MFE R", (v) => fmt(v, 2)], ["mae_r", "MAE R", (v) => fmt(v, 2)], ["regime_name", "Regime"], ["news", "News"], ["in_B", "B", (v) => v ? "●" : ""], ["in_C", "C", (v) => v ? "●" : ""]]);
};

views.prob = async () => {
  const p = await api("/api/prob/models");
  view.innerHTML = `<div class="grid g2">
    ${card("Bayesian posterior of the true win rate", `<div id="post" class="plot tall"></div><p class="dim">Prior Beta(1,1) (uniform). Dashed lines = break-even win rate for each dataset's payoff.</p>`)}
    ${card("Posterior summaries", Object.entries(p.posteriors).map(([k, r]) => `<h2 style="color:${C[k]}">${DS[k]}</h2>${explain(r)}`).join(""))}
    ${card("Conditional probability of a winning trade", `<div id="cp" class="plot tall"></div>`, "spanall")}
    ${card("Conditional table", table(p.conditional.filter((r) => r.value).map((r) => ({ cond: r.name.replace("P(win | ", "").replace(")", ""), ...r.value })),
      [["cond", "Condition B"], ["n_b", "n(B)"], ["p_a_given_b", "P(win|B)", pct], ["ci_low", "CI low", pct], ["ci_high", "CI high", pct], ["p_a_given_not_b", "P(win|¬B)", pct], ["lift", "Lift", (v) => fmt(v, 2)]]) + `<p class="dim">${esc(p.note)}</p>`, "spanall")}
  </div>`;
  plot("post", Object.entries(p.posteriors).map(([k, r]) => ({ x: r.grid, y: r.pdf, name: DS[k], line: { color: C[k], width: 2 }, hovertemplate: `${k}: p=%{x:.2f}<extra></extra>` })),
    { xaxis: { title: "win probability", gridcolor: C.grid, tickformat: ".0%" }, yaxis: { title: "density", gridcolor: C.grid },
      shapes: Object.entries(p.posteriors).flatMap(([k, r]) => vline(r.value.breakeven, C[k], "dash")) });
  const cc = p.conditional.filter((r) => r.value);
  plot("cp", [{ type: "scatter", mode: "markers", y: cc.map((r) => r.name.replace("P(win | ", "").replace(")", "")), x: cc.map((r) => r.value.p_a_given_b),
    error_x: { type: "data", symmetric: false, array: cc.map((r) => r.value.ci_high - r.value.p_a_given_b), arrayminus: cc.map((r) => r.value.p_a_given_b - r.value.ci_low), color: C.muted, thickness: 1 },
    marker: { size: 9, color: C.gold }, text: cc.map((r) => `n=${r.value.n_b}`), hovertemplate: "%{y}<br>P(win)=%{x:.1%} %{text}<extra></extra>" }],
    { showlegend: false, margin: { l: 170, r: 12, t: 20, b: 36 }, xaxis: { tickformat: ".0%", gridcolor: C.grid, title: "P(win | condition) with 95% Wilson CI" },
      shapes: cc.length ? vline(cc[0].value.p_a, C.muted, "dot") : [] });
};

views.ml = async () => {
  view.innerHTML = `
    <div class="card" style="margin-bottom:12px"><h2>Walk-forward validation</h2>
      <div class="row"><label class="f">min train<input id="mt" type="number" value="60" style="width:70px"></label><label class="f">test fold<input id="ts" type="number" value="20" style="width:70px"></label>
      <label class="f">embargo<input id="em" type="number" value="2" style="width:60px"></label><button class="primary" id="runwf">Run walk-forward</button></div>
      <div id="wf"></div></div>
    <div class="grid g2">
      ${card("Calibration (OOS)", `<div id="cal" class="plot"></div>`)}
      ${card("Feature importance (permutation, chronological holdout)", `<div id="imp"></div>`)}
      ${card("Feature drift (PSI, last 30 vs history)", `<div id="drift"></div>`)}
      ${card("Setup clusters (k-means, descriptive)", `<div id="cl"></div>`)}
      ${card("Hidden-Markov volatility regimes (daily, filtered)", `<div id="hmm" class="plot"></div><div id="hmmt"></div>`, "spanall")}
    </div>`;
  $("#runwf").onclick = async () => {
    $("#wf").innerHTML = `<span class="dim">Running…</span>`;
    try {
      const r = await api(`/api/ml/walkforward?min_train=${$("#mt").value}&test_size=${$("#ts").value}&embargo=${$("#em").value}`, { method: "POST" });
      const rows = Object.entries(r.models).map(([k, v]) => ({ model: k, ...v }));
      $("#wf").innerHTML = `<p class="dim">Run #${r.run_id} · params ${esc(r.params_hash)} · ${r.folds.length} folds · ${r.n_oos} OOS trades · features: ${esc(r.params.features.join(", "))}</p>` +
        table(rows, [["model", "Model"], ["auc", "AUC", fmt], ["brier", "Brier", fmt], ["brier_skill_vs_base", "Brier skill vs base", (v) => sgn(v)], ["log_loss", "Log loss", fmt],
          ["oos_mean_r_selected", "OOS mean R (top half)", (v) => sgn(v)], ["oos_n_selected", "n sel"], ["oos_mean_r_rejected", "OOS mean R (rest)", (v) => sgn(v)]]) +
        `<p class="dim">Baseline (training base rate): Brier ${fmt(r.baseline.brier)} · OOS mean R all trades ${sgn(r.baseline.oos_mean_r_all)}</p><div class="explain lim">⚠ ${esc(r.warning)}</div>`;
      plot("cal", [{ x: [0, 1], y: [0, 1], name: "perfect", line: { color: C.muted, dash: "dot", width: 1 } },
        ...rows.filter((m) => m.calibration).map((m, i) => ({ x: m.calibration.mean_predicted, y: m.calibration.fraction_positive, name: m.model, mode: "lines+markers", line: { color: [C.A, C.B, C.C][i], width: 2 }, marker: { size: 8 } }))],
        { xaxis: { title: "mean predicted P(win)", gridcolor: C.grid }, yaxis: { title: "observed win fraction", gridcolor: C.grid } });
    } catch (e) { $("#wf").innerHTML = empty(e.message); }
  };
  await section("#imp", async () => { const r = await api("/api/ml/importance"); $("#imp").innerHTML = table(r.value, [["feature", "Feature"], ["mean", "ΔAUC", (v) => sgn(v, 4)], ["std", "± sd", (v) => fmt(v, 4)]]) + explain(r); });
  await section("#drift", async () => { const r = await api("/api/ml/drift"); $("#drift").innerHTML = table(Object.entries(r).map(([k, v]) => ({ feature: k, ...v })), [["feature", "Feature"], ["psi", "PSI", fmt], ["status", "Status"]]); });
  await section("#cl", async () => { const r = await api("/api/ml/clusters"); $("#cl").innerHTML = table(r.clusters, [["cluster", "Cluster"], ["n", "n"], ["mean_r", "Mean R", (v) => sgn(v)], ["win_rate", "Win%", pct]]) + `<p class="dim">${esc(r.note)}</p>`; });
  await section("#hmm", async () => {
    const r = await api("/api/ml/hmm");
    plot("hmm", [{ x: r.index, y: r.filtered_prob_high_vol, name: "P(high-vol regime)", line: { color: C.gold, width: 2 } }], { showlegend: false, yaxis: { range: [0, 1], title: "filtered probability", gridcolor: C.grid } });
    $("#hmmt").innerHTML = `<p class="dim">Regime variances: ${r.regime_variances.map((v) => fmt(v, 3)).join(" / ")} (%²) · AIC ${fmt(r.aic, 1)}. ${esc(r.note)}</p>`;
  });
};

views.risk = async () => {
  view.innerHTML = `<div class="grid g2">
    ${card("Observed (historical) risk", `<div class="row"><select id="rds2">${["A", "B", "C"].map((k) => `<option>${k}</option>`)}</select></div><div id="obs"></div>`)}
    ${card("Monte Carlo (theoretical)", `<div class="row">
      <label class="f">risk %/trade<input id="rp" type="number" value="1" step="0.25" style="width:70px"></label>
      <label class="f">ruin = DD %<input id="rd" type="number" value="30" style="width:70px"></label>
      <label class="f">horizon trades<input id="rh" type="number" value="0" style="width:80px"></label>
      <label class="f">block len<input id="rb" type="number" value="1" style="width:60px"></label>
      <button class="primary" id="runmc">Simulate</button></div><div id="mc"></div>`)}
    ${card("7 · Drawdown distribution (R)", `<div id="ddh" class="plot"></div>`, "spanall")}
  </div>`;
  let obsEpisodes = [];
  const loadObs = async () => section("#obs", async () => {
    const r = await api(`/api/risk/observed?dataset=${$("#rds2").value}`);
    obsEpisodes = r.value.drawdown_episodes_r;
    const v = r.value;
    $("#obs").innerHTML = `<div class="kpis">${kpi("Expected value", sgn(v.expected_value_r), "R/trade")}${kpi("Expected loss", fmt(v.expected_loss_r, 2), "R | loss")}
      ${kpi("Max drawdown", fmt(v.max_drawdown_r, 2), "R")}${kpi("Losing streak", v.longest_losing_streak, "max consecutive")}${kpi("Recovery factor", fmt(v.recovery_factor, 2), "ΣR / MaxDD")}
      ${kpi("Equity vol", fmt(v.equity_volatility_r, 2), "sd of R")}${kpi("VaR95", fmt(v.var95_r, 2), "R / trade")}${kpi("CVaR95", fmt(v.cvar95_r, 2), "R / trade")}
      ${kpi("Time under water", fmt(v.time_under_water_pct, 0) + "%", "of trades")}</div>${explain(r)}`;
  });
  await loadObs(); $("#rds2").onchange = async () => { await loadObs(); await runMC(); };
  const runMC = async () => section("#mc", async () => {
    const r = await api(`/api/risk/montecarlo?dataset=${$("#rds2").value}&risk_pct=${$("#rp").value}&ruin_dd_pct=${$("#rd").value}&n_trades=${$("#rh").value}&block=${$("#rb").value}`);
    const v = r.value;
    $("#mc").innerHTML = `<div class="kpis">${kpi("P(ruin)", pct(v.prob_ruin, 2), `DD ≥ ${v.assumptions.ruin_definition}`)}${kpi("Max DD p50 / p95", `${fmt(v.max_dd_pct_median, 1)}% / ${fmt(v.max_dd_pct_p95, 1)}%`, `${fmt(v.max_dd_r_median, 1)}R / ${fmt(v.max_dd_r_p95, 1)}R`)}
      ${kpi("Losing streak p95", fmt(v.losing_streak_p95, 0), `median ${fmt(v.losing_streak_median, 0)}`)}${kpi("Horizon return p5/p50/p95", `${fmt(v.final_return_pct_p5, 0)} / ${fmt(v.final_return_pct_median, 0)} / ${fmt(v.final_return_pct_p95, 0)}%`, `${v.assumptions.horizon_trades} trades`)}
      ${kpi("P(loss over horizon)", pct(v.prob_loss_over_horizon), "")}</div>${explain(r)}`;
    plot("ddh", [{ type: "histogram", x: v.dd_r_distribution, name: "Simulated max DD (theoretical)", histnorm: "probability", xbins: { size: 1 }, marker: { color: C.A, line: { color: C.surface, width: 1 } }, opacity: 0.8 },
      { type: "histogram", x: obsEpisodes, name: "Observed DD episodes (historical)", histnorm: "probability", xbins: { size: 1 }, marker: { color: C.gold, line: { color: C.surface, width: 1 } }, opacity: 0.7 }],
      { barmode: "overlay", xaxis: { title: "drawdown depth (R)", gridcolor: C.grid }, yaxis: { title: "probability", gridcolor: C.grid } });
  });
  $("#runmc").onclick = runMC; await runMC();
};

views.backtest = async () => {
  const c = STATUS.costs, rp = STATUS.regime_params;
  view.innerHTML = `<div class="grid g2">
    ${card("Cost model (applied to every R statistic)", `<div class="row">
      <label class="f">commission $/side<input id="c1" type="number" step="0.01" value="${c.commission_per_side}" style="width:90px"></label>
      <label class="f">exch+NFA $/side<input id="c2" type="number" step="0.01" value="${c.exchange_fees_per_side}" style="width:90px"></label>
      <label class="f">slip ticks entry<input id="c3" type="number" step="0.5" value="${c.slippage_ticks_entry}" style="width:80px"></label>
      <label class="f">slip ticks exit<input id="c4" type="number" step="0.5" value="${c.slippage_ticks_exit}" style="width:80px"></label>
      <button class="primary" id="savec">Apply</button></div><p class="dim">Current: ${esc(c.label)}. MGC tick = $0.10 = $1.00/contract. Verify fees against your broker and the current CME schedule.</p><div id="gn"></div>`)}
    ${card("Regime classifier parameters", `<div class="row">${Object.entries(rp).filter(([k]) => !["version", "hash"].includes(k)).map(([k, v]) => `<label class="f">${k}<input data-rp="${k}" type="number" step="0.01" value="${v}" style="width:80px"></label>`).join("")}
      <button class="primary" id="saverp">Apply</button></div><p class="dim">Version ${esc(rp.version)} · hash ${esc(rp.hash)}. Fix thresholds <b>before</b> examining per-regime TBS results to avoid fitting them to the outcome.</p><div id="rg"></div>`)}
    ${card("Research run registry (reproducibility)", `<div id="runs"></div>`, "spanall")}
  </div>`;
  $("#savec").onclick = async () => {
    await api("/api/costs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commission_per_side: +$("#c1").value, exchange_fees_per_side: +$("#c2").value, slippage_ticks_entry: +$("#c3").value, slippage_ticks_exit: +$("#c4").value, label: "user-defined" }) });
    await refreshStatus(); views.backtest();
  };
  $("#saverp").onclick = async () => {
    const body = {}; document.querySelectorAll("[data-rp]").forEach((i) => body[i.dataset.rp] = +i.value);
    await api("/api/regime/params", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await refreshStatus(); views.backtest();
  };
  await section("#gn", async () => {
    const [g, n] = await Promise.all([api("/api/tbs/compare?net=false"), api("/api/tbs/compare?net=true")]);
    $("#gn").innerHTML = table(["A", "B", "C"].filter((k) => g.metrics[k].value).map((k) => ({ ds: DS[k], g: g.metrics[k].value.avg_r, n: n.metrics[k].value.avg_r, pf: g.metrics[k].value.profit_factor, pfn: n.metrics[k].value.profit_factor })),
      [["ds", "Dataset"], ["g", "EV gross R", (v) => sgn(v)], ["n", "EV net R", (v) => sgn(v)], ["pf", "PF gross", (v) => fmt(v, 2)], ["pfn", "PF net", (v) => fmt(v, 2)]]);
  });
  await section("#rg", async () => {
    const r = await api("/api/regime/performance");
    $("#rg").innerHTML = table(r, [["name", "Regime"], ["n", "n"], ["win_rate", "Win%", pct], ["expected_value_r", "EV R", (v) => sgn(v)], ["std_r", "Std", fmt], ["verdict", "Verdict"]]) +
      `<div class="explain lim">⚠ No regime advantage is claimed with n &lt; 30. Trades are tagged with the regime of the last completed bar before entry.</div>`;
  });
  await section("#runs", async () => {
    const r = await api("/api/runs");
    $("#runs").innerHTML = table(r.map((x) => ({ ...x, data: Object.entries(x.data_fingerprints).map(([k, v]) => `${k}:${v}`).join(" "), p: JSON.stringify(x.params).slice(0, 90) })),
      [["id", "Run"], ["ts", "Timestamp (UTC)", (v) => esc(v.slice(0, 19))], ["kind", "Kind"], ["code_version", "Code"], ["params_hash", "Params hash"], ["data", "Data fingerprints"], ["p", "Params"]]);
  });
};

views.data = async () => {
  view.innerHTML = `<div class="grid g3">
    ${card("Historical candles", `<form id="fc"><div class="row"><input type="file" name="file" accept=".csv" required></div>
      <div class="row"><label class="f">source / vendor<input name="source" placeholder="e.g. Databento GLBX.MDP3" required></label>
      <label class="f">timezone of timestamps<input name="source_tz" placeholder="UTC or America/New_York"></label></div>
      <div class="row"><label class="f">provenance<select name="provenance"><option>HISTORICAL</option><option>LIVE</option><option>SIMULATED</option></select></label>
      <label class="f">timeframe<input name="timeframe" placeholder="auto (e.g. 5min)" style="width:110px"></label><button class="primary">Import</button></div></form>
      <p class="dim">Columns: timestamp, open, high, low, close, volume [, contract, bid, ask, trades]. Include <code>contract</code> to enable rollover detection.</p><div id="rc"></div>`)}
    ${card("TBS trade journal", `<form id="fj"><div class="row"><input type="file" name="file" accept=".csv" required></div>
      <div class="row"><label class="f">provenance<select name="provenance"><option>HISTORICAL</option><option>SIMULATED</option></select></label><button class="primary">Import</button></div></form>
      <p class="dim">Required: date, time, direction, entry, stop, and exit or r_multiple. Optional: timezone, session, daily_crt, h4_crt, amd_aligned, tbs_confirmed, target, contracts, mfe, mae, atr, news, commission, notes. See <code>data/templates/journal_template.csv</code>.</p><div id="rj"></div>`)}
    ${card("Economic-event calendar", `<form id="fe"><div class="row"><input type="file" name="file" accept=".csv" required><button class="primary">Import</button></div></form>
      <p class="dim">Columns: datetime, event (FOMC, CPI, PPI, NFP, UNEMPLOYMENT…). Use official release schedules (federalreserve.gov, bls.gov). AUREUS will not invent event dates.</p><div id="re"></div>`)}
    ${card("Current datasets", `<div id="cur"></div>`, "span2")}
    ${card("Demo / reset", `<p class="dim">Load SIMULATED random data to explore the interface. A red banner stays visible while it is loaded, and every result is tagged SIMULATED.</p>
      <div class="row"><button id="demo">Load simulated demo data</button><button id="reset">Clear all data</button></div>`)}
  </div>`;
  const bind = (id, kind, out) => $(id).onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api(`/api/upload/${kind}`, { method: "POST", body: new FormData(e.target) });
      $(out).innerHTML = `<pre class="msg">${esc(JSON.stringify(r, null, 2))}</pre>`;
      await refreshStatus(); showCur();
    } catch (err) { $(out).innerHTML = empty(err.message); }
  };
  bind("#fc", "candles", "#rc"); bind("#fj", "journal", "#rj"); bind("#fe", "events", "#re");
  $("#demo").onclick = async () => { await api("/api/demo/simulated", { method: "POST" }); await refreshStatus(); showCur(); };
  $("#reset").onclick = async () => { await api("/api/reset", { method: "POST" }); await refreshStatus(); showCur(); };
  const showCur = () => {
    const s = STATUS;
    $("#cur").innerHTML = `<div class="grid g2"><div>${s.candles ? table(Object.entries(s.candles).map(([k, v]) => ({ k, v })), [["k", "Candles"], ["v", "", (v) => esc(v)]]) : empty("No candles")}</div>
      <div>${s.candles ? qualityTable(s.candle_quality) : ""}${s.journal ? `<p>Journal: <b>${s.journal.trades}</b> trades ${provChip(s.journal.provenance)}</p>${s.journal.warnings.map((w) => `<div class="explain lim">⚠ ${esc(w)}</div>`).join("")}` : empty("No journal")}
      ${s.events ? `<p>Events: ${s.events.n}</p>` : ""}</div></div>`;
  };
  showCur();
};

views.assistant = async () => {
  const help = await api("/api/assistant/help");
  view.innerHTML = `<div class="grid g3"><div class="card span2"><h2>Research assistant</h2>
      <p class="dim">Answers are computed from your imported data. Every answer states the method, sample size and limitations. Questions that cannot be computed are declined.</p>
      <div class="chat" id="chat"></div>
      <form id="qf" class="row" style="margin-top:10px"><input id="qi" style="flex:1" placeholder="Ask a quantitative question about MGC1! or your TBS record…"><button class="primary">Ask</button></form></div>
    ${card("Suggested questions", help.map((h) => `<div><a class="sug" style="cursor:pointer;color:var(--text-2)">› ${esc(h)}</a></div>`).join(""))}</div>`;
  const ask = async (q) => {
    const chat = $("#chat");
    chat.insertAdjacentHTML("beforeend", `<div class="msg q">${esc(q)}</div>`);
    try { const a = await api("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
      chat.insertAdjacentHTML("beforeend", `<div class="msg">${esc(a.text)}${a.suggestions ? "\n\n" + a.suggestions.map((s) => "• " + s).join("\n") : ""}</div>`);
    } catch (e) { chat.insertAdjacentHTML("beforeend", `<div class="msg neg">${esc(e.message)}</div>`); }
    chat.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  $("#qf").onsubmit = (e) => { e.preventDefault(); const q = $("#qi").value.trim(); if (q) { $("#qi").value = ""; ask(q); } };
  document.querySelectorAll(".sug").forEach((a) => a.onclick = () => ask(a.textContent.slice(2)));
};

views.tradingview = async () => {
  const r = await api("/api/tradingview/setups");
  const s = r.setups;
  const nClosed = s.filter((x) => x.state === "closed").length, nOpen = s.filter((x) => x.state === "open").length;
  view.innerHTML = `
    <div class="kpis" style="margin-bottom:12px">${kpi("Setups received", s.length, "from TradingView")}${kpi("Closed", nClosed, "in statistics")}${kpi("Open", nOpen, "awaiting exit")}${kpi("Pending", s.length - nClosed - nOpen, "entry not filled")}</div>
    <div class="grid g2">
      ${card("Connect TradingView — one-time setup", `<ol class="explain" style="padding-left:18px;margin:0">
        <li><b>Expose only the webhook.</b> In a second PowerShell window run:<br><code>cloudflared tunnel --url http://localhost:8000</code><br>
          (install once with <code>winget install Cloudflare.cloudflared</code>). Copy the <code>https://….trycloudflare.com</code> address it prints. Through the tunnel only the webhook answers; the dashboard stays private.</li>
        <li><b>Add the indicator.</b> <a href="/api/tradingview/pine" style="color:var(--gold)">Download the Pine script</a> → TradingView → Pine Editor → paste → <i>Add to chart</i>.</li>
        <li><b>Mark a setup.</b> TradingView asks you to click <i>setup time → entry → stop → target</i>. Then in the indicator's Settings set direction, Daily CRT, 4H CRT, AMD, TBS and paste your token:<br>
          <code id="tok">${esc(r.token)}</code> <button id="cp">Copy</button></li>
        <li><b>Create the alert.</b> Alert → Condition: <i>AUREUS TBS Marker</i> → <i>Any alert() function call</i> → Notifications → Webhook URL:<br><code>&lt;your trycloudflare address&gt;/api/tradingview/webhook</code></li>
        <li>Repeat 3–4 for each setup (one indicator copy per setup). Fills, exits, MFE and MAE are tracked on the chart and sent automatically.</li></ol>
        <div class="explain lim">⚠ Webhooks need a paid TradingView plan with 2-factor authentication enabled. The quick tunnel address changes every time you restart cloudflared — update the alert's webhook URL when it does.</div>
        <div class="explain lim">⚠ The indicator assumes a limit fill at your entry and, if stop and target are hit in the same bar, the stop (conservative). Use a 1-minute chart for the most accurate fills and MFE/MAE.</div>`, "spanall")}
      ${card("Received setups", s.length ? table(s.slice().reverse(), [["id", "Setup id"], ["state", "State"], ["direction", "Dir"], ["daily_crt", "D CRT"], ["h4_crt", "4H CRT"],
        ["amd_aligned", "AMD", (v) => v ? "✓" : "✗"], ["tbs_confirmed", "TBS", (v) => v ? "✓" : "✗"], ["entry", "Entry"], ["stop", "Stop"], ["target", "Target"],
        ["exit_price", "Exit"], ["exit_reason", "Why"], ["timeframe", "TF"], ["received", "Last update (UTC)", (v) => esc(String(v).slice(0, 19))],
        ["id", "", (v) => `<button data-del="${esc(v)}">Remove</button>`]]) : empty("Nothing received yet. Follow the steps above, then mark a setup in TradingView."), "spanall")}
    </div>`;
  $("#cp").onclick = () => navigator.clipboard.writeText(r.token);
  document.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirm(`Remove setup ${b.dataset.del} from the journal?`)) return;
    await api(`/api/tradingview/setups/${encodeURIComponent(b.dataset.del)}`, { method: "DELETE" }); views.tradingview();
  });
};

// ------------------------------------------------------------ Quant Engine --
let ENG = { interval: "5m", horizon: null, sel: null, timer: null };
const stChip = (s) => `<span class="st ${String(s).split(" ")[0]}">${esc(s)}</span>`;
const ST_RANK = { VALIDATED: 0, PROMISING: 1, "FAILED OOS": 2, "NO EDGE": 3, INSUFFICIENT: 4 };
const tk = (v, d = 1) => v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`;

views.engine = async () => {
  clearInterval(ENG.timer);
  const st = await api("/api/engine/status");
  const feed = st.feed;
  view.innerHTML = `
    <div class="statusbar">
      <span>FEED ${feed ? `<span class="chip ${feed.provenance === "LIVE" ? "ok" : "hist"}">${esc(feed.provenance)}</span> ${esc(feed.description)} · delay ${esc(feed.delay)}` : `<span class="chip sim">NONE</span> no automatic feed`}</span>
      <span>auto-update: ${st.loop.running ? `every ${st.loop.interval_s}s` : "off"}</span>
      <span class="grow"></span>
      <label class="f" style="flex-direction:row;align-items:center;gap:6px">bars<select id="eiv">${["5m", "1h", "1d", "1m"].map((i) => `<option ${i === ENG.interval ? "selected" : ""}>${i}</option>`).join("")}</select></label>
      <button class="primary" id="eupd">Update data now</button>
    </div>
    ${feed && !feed.licensed ? `<div class="explain lim" style="margin:-4px 0 10px">⚠ ${esc(feed.notes.join(" "))}</div>` : ""}
    <div id="ebody"><div class="dim">Analysing…</div></div>`;
  $("#eiv").onchange = () => { ENG.interval = $("#eiv").value; ENG.horizon = null; renderEngine(); };
  $("#eupd").onclick = async () => {
    $("#eupd").textContent = "Updating…";
    try { const r = await api("/api/engine/update", { method: "POST" });
      if (r.busy) { alert(r.note); }
      const errs = [...(r.results || []), ...(r.aux || []).map((a) => ({ interval: a.series, error: a.error })), ...(r.options && !r.options.ok ? [{ interval: "GLD options", error: r.options.error }] : [])].filter((x) => x.error);
      if (errs.length) alert("Some downloads failed:\n" + errs.map((e) => `${e.interval}: ${e.error}`).join("\n"));
    } catch (e) { alert(e.message); }
    $("#eupd").textContent = "Update data now"; renderEngine(true);
  };
  await renderEngine();
  ENG.timer = setInterval(() => { if ((location.hash.slice(1) === "engine" || !location.hash) && !document.querySelector("#tset[open]")) renderEngine(); }, 60000);
};

async function renderEngine(force = false) {
  const body = $("#ebody");
  if (!body) return;
  let r;
  try { r = await api(`/api/engine/analysis?interval=${ENG.interval}${force ? "&force=true" : ""}`); }
  catch (e) {
    const st = await api("/api/engine/status");
    body.innerHTML = empty(e.message) + `<div class="card" style="margin-top:12px"><h2>Data store</h2>${table(st.coverage, [["interval", "Bars"], ["bars", "Count"], ["first", "First (UTC)"], ["last", "Last (UTC)"], ["sources", "Source"]])}
      <h2 style="margin-top:12px">Recent downloads</h2>${table(st.fetches, [["ts", "Time (UTC)", (v) => esc(v.slice(0, 19))], ["interval", "Bars"], ["source", "Source"], ["rows", "Rows"], ["error", "Error"]])}
      <div class="row" style="margin-top:10px"><button id="edemo">Load SIMULATED test bars</button><span class="dim">only to preview the interface</span></div></div>`;
    $("#edemo").onclick = async () => { await api("/api/engine/demo", { method: "POST" }); renderEngine(true); };
    return;
  }
  const s = r.state, ev = r.evaluation;
  const [opt, vol, trd] = await Promise.all([api("/api/engine/options").catch((e) => ({ error: e.message })), api("/api/engine/volatility").catch((e) => ({ error: e.message })),
    api("/api/trade/state").catch((e) => ({ error: e.message }))]);
  ENG.opt = opt;
  ENG.horizon = ENG.horizon || ev.horizons[1] || ev.horizons[0];
  const sim = r.provenance === "SIMULATED";
  const ban = $("#banner");
  if (sim) { ban.hidden = false; ban.textContent = "SIMULATED MARKET BARS LOADED — random data for interface testing. Nothing on this page describes the real MGC1! market."; }
  const vr = s.variance_ratio;
  body.innerHTML = `
    <div class="row">${provChip(r.provenance)} <span class="dim">MGC1! · ${esc(r.interval)} bars · last bar <b>${esc(s.as_of_et)}</b> · data age ${fmt(s.data_age_min, 0)} min · ${ev.bars} bars ${esc(ev.first.slice(0, 10))} → ${esc(ev.last.slice(0, 10))} · costs ${fmt(ev.cost_ticks, 1)} ticks/round-turn · ${esc(r.engine_version)} #${esc(r.params_hash)}</span></div>
    <div class="kpis">
      ${kpi("Last", fmt(s.close, 1), s.change_today_ticks != null ? `${tk(s.change_today_ticks, 0)} ticks today` : "")}
      ${kpi("ATR(14)", fmt(s.atr, 2), `${fmt(s.atr_rank, 0)}th percentile`)}
      ${kpi("Today's range", fmt(s.today_range, 1), s.today_range_pct != null ? `${fmt(s.today_range_pct, 0)}th pct of days` : "")}
      ${kpi("Regime", `<span style="font-size:13px">${esc(r.regime.current)}</span>`, "ATR pct · ER · ΔATR")}
      ${kpi("Hurst exponent", fmt(s.hurst, 2), s.hurst == null ? "" : s.hurst > 0.55 ? "persistent / trending" : s.hurst < 0.45 ? "anti-persistent" : "≈ random walk")}
      ${kpi("Variance ratio (q=4)", vr ? fmt(vr.vr, 3) : "—", vr ? `${esc(vr.reading)} · p ${fmt(vr.p, 3)}` : "")}
      ${kpi("Lag-1 autocorr", fmt(s.autocorr_1, 3), "bar returns, last 2000")}
      ${kpi("PDH / PDL", s.pdh ? `${fmt(s.pdh, 1)} / ${fmt(s.pdl, 1)}` : "—", s.vwap ? `VWAP ${fmt(s.vwap, 1)}` : "")}
    </div>
    <div class="grid g3" style="margin-top:12px">
      ${tradeCard(trd)}
      ${card("Price & detector signals (last 600 bars)", `<div id="echart" class="plot tall"></div>`, "span2")}
      ${card("Active now (last 3 bars)", activeList(s.active))}
      ${optionsCards(opt)}
      ${volCards(vol)}
      ${card("Edge scanner", `<div class="row">horizon ${ev.horizons.map((h) => `<button class="${h === ENG.horizon ? "primary" : ""}" data-h="${h}">${h}</button>`).join("")}
        <span class="dim">IS = first 70% of history (discovery, FDR-corrected) · OOS = last 30% (validation) · values are ticks of excess return per event</span></div><div id="escan"></div>`, "spanall")}
      ${card("Detector detail", `<div id="edetail">${empty("Click a row in the edge scanner")}</div>`, "spanall")}
      ${card(`Probability cone · ${esc(s.cone.bucket)} (ATR pct ${fmt(s.cone.atr_rank, 0)})`, `<div id="econe" class="plot"></div><div id="econet"></div><p class="dim">${esc(s.cone.note)}</p>`)}
      ${card("Regime timeline", `<div id="ereg" class="plot"></div>`)}
      ${r.seasonality ? card("Volatility heatmap (weekday × NY hour)", `<div id="eheat" class="plot"></div>`) : ""}
      ${r.seasonality ? card("Intraday seasonality — mean |move| per bar by NY hour (gold = FDR-significant mean return)", `<div id="eseas" class="plot"></div>`, "spanall") : ""}
    </div>`;
  drawEngineChart(r);
  bindTrade(trd);
  drawOptions(opt);
  drawVol(vol);
  drawCone(s.cone);
  drawScanner(ev);
  drawRegime(r.regime.timeline);
  if (r.seasonality) drawSeason(r.seasonality);
  body.querySelectorAll("[data-h]").forEach((b) => b.onclick = () => { ENG.horizon = b.dataset.h; renderEngine(); });
}

const WALLS = [["call_wall", "Call wall", C.good, "dash"], ["put_wall", "Put wall", C.bad, "dash"], ["gamma_flip", "Gamma flip", C.gold, "dot"], ["max_pain", "Max pain", C.muted, "dashdot"]];
function wallShapes(lo, hi) {
  const o = ENG.opt; if (!o || o.error || !o.levels_mgc) return [];
  return WALLS.filter(([k]) => o.levels_mgc[k] != null && o.levels_mgc[k] >= lo && o.levels_mgc[k] <= hi).map(([k, , col, dash]) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: o.levels_mgc[k], y1: o.levels_mgc[k], line: { color: col, width: 1.5, dash } }));
}
function wallLabels(lo, hi) {
  const o = ENG.opt; if (!o || o.error || !o.levels_mgc) return [];
  const ws = WALLS.filter(([k]) => o.levels_mgc[k] != null);
  const inside = ws.filter(([k]) => o.levels_mgc[k] >= lo && o.levels_mgc[k] <= hi).map(([k, lab, col]) => ({ xref: "paper", x: 0.01, y: o.levels_mgc[k], xanchor: "left", yanchor: "bottom", showarrow: false, text: `${lab} ${o.levels_mgc[k].toFixed(1)}`, font: { size: 10, color: col } }));
  const above = ws.filter(([k]) => o.levels_mgc[k] > hi), below = ws.filter(([k]) => o.levels_mgc[k] < lo);
  const edge = (arr, y, arrow) => arr.length ? [{ xref: "paper", yref: "paper", x: 0.01, y, xanchor: "left", yanchor: y > 0.5 ? "top" : "bottom", showarrow: false,
    text: arr.map(([k, lab]) => `${arrow} ${lab} ${o.levels_mgc[k].toFixed(1)}`).join("   "), font: { size: 10, color: C.text2 } }] : [];
  return [...inside, ...edge(above, 0.99, "↑"), ...edge(below, 0.01, "↓")];
}

function optionsCards(o) {
  if (o.error) return card("Options walls · GLD options mapped to MGC1!", empty(o.error), "spanall");
  const L = o.levels_mgc, near = o.term[0] || {};
  return card(`Options walls · GLD options mapped to MGC1! ${o.provenance ? provChip(o.provenance) : provChip("DELAYED")}`, `
    <div class="kpis">
      ${kpi("Call wall", fmt(L.call_wall, 1), `GLD ${fmt(o.levels_gld.call_wall, 0)} · max call OI above`)}
      ${kpi("Put wall", fmt(L.put_wall, 1), `GLD ${fmt(o.levels_gld.put_wall, 0)} · max put OI below`)}
      ${kpi("Gamma flip", fmt(L.gamma_flip, 1), "net GEX changes sign")}
      ${kpi("Max pain", fmt(L.max_pain, 1), `expiry ${esc(o.expiries[0])}`)}
      ${kpi("Net GEX", `${fmt(o.total_gex_usd_per_1pct / 1e6, 1)}M`, "$ per 1% move")}
      ${kpi("Gamma regime", `<span style="font-size:12px">${o.total_gex_usd_per_1pct > 0 ? "Positive" : "Negative"}</span>`, o.total_gex_usd_per_1pct > 0 ? "dampening / mean-reverting" : "amplifying / trending")}
      ${kpi("Put/Call OI", fmt(o.put_call_oi_ratio, 2), "scanned expiries")}
      ${kpi("Implied move", near.expected_move_pct != null ? `±${(near.expected_move_pct * 100).toFixed(2)}%` : "—", o.mgc_last ? `±${fmt(near.expected_move_pct * o.mgc_last, 1)} on MGC1! by ${esc(near.expiry || "")}` : `by ${esc(near.expiry || "")}`)}
    </div>
    <div class="grid g3" style="margin-top:10px">
      <div><h2>Gamma exposure & open interest by strike</h2><div id="ogex" class="plot tall"></div></div>
      <div><h2>Net GEX vs spot (where dealers flip)</h2><div id="ocurve" class="plot tall"></div></div>
      <div><h2>IV term structure & 25Δ skew</h2><div id="oterm" class="plot tall"></div></div>
    </div>
    ${table(o.term, [["expiry", "Expiry"], ["days", "Days"], ["atm_iv", "ATM IV", pct], ["skew_25d", "25Δ skew (put−call)", (v) => v == null ? "—" : (v * 100).toFixed(2) + " vol pts"], ["expected_move_pct", "Expected move", (v) => v == null ? "—" : "±" + (v * 100).toFixed(2) + "%"], ["straddle_move_pct", "Straddle", (v) => v == null ? "—" : "±" + (v * 100).toFixed(2) + "%"]])}
    <div class="row" style="margin-top:8px"><span class="dim">TradingView:</span> <code id="tvlv" style="font:12px var(--mono)">${esc(o.tradingview_levels || "")}</code>
      <button id="tvcopy" class="primary">Copy for TradingView</button> <a href="/api/tradingview/iv-walls-pine" style="color:var(--gold)">Download the IV Walls indicator</a></div>
    <p class="dim">Snapshot ${esc((o.saved_at || "").slice(0, 16))} UTC · GLD ${fmt(o.spot_gld, 2)} · MGC/GLD ratio ${fmt(o.mgc_ratio, 3)}</p>
    ${o.assumptions.map((a) => `<div class="explain lim">⚠ ${esc(a)}</div>`).join("")}`, "spanall");
}

function drawOptions(o) {
  if (o.error || !document.getElementById("ogex")) return;
  const cp = document.getElementById("tvcopy");
  if (cp) cp.onclick = async () => {
    try { await navigator.clipboard.writeText(o.tradingview_levels); cp.textContent = "Copied ✓"; }
    catch { const r = document.createRange(); r.selectNode($("#tvlv")); getSelection().removeAllRanges(); getSelection().addRange(r); cp.textContent = "Press Ctrl/Cmd+C"; }
  };
  const st = o.strikes, y = st.map((x) => x.strike_mgc ?? x.strike);
  const spotY = o.mgc_last || (o.mgc_ratio ? o.spot_gld * o.mgc_ratio : o.spot_gld);
  plot("ogex", [
    { type: "bar", orientation: "h", y, x: st.map((x) => x.gex / 1e6), name: "Net GEX ($M/1%)", marker: { color: st.map((x) => x.gex >= 0 ? C.A : C.B) }, hovertemplate: "%{y:.1f}: GEX %{x:.2f}M<extra></extra>" },
    { type: "scatter", mode: "lines", y, x: st.map((x) => x.call_oi / 1000), name: "Call OI (k)", xaxis: "x2", line: { color: C.good, width: 1.5 }, hovertemplate: "%{y:.1f}: call OI %{x:.1f}k<extra></extra>" },
    { type: "scatter", mode: "lines", y, x: st.map((x) => x.put_oi / 1000), name: "Put OI (k)", xaxis: "x2", line: { color: C.bad, width: 1.5 }, hovertemplate: "%{y:.1f}: put OI %{x:.1f}k<extra></extra>" }],
    { margin: { l: 56, r: 10, t: 40, b: 36 }, legend: { orientation: "h", y: 1.14, font: { size: 10 } }, yaxis: { gridcolor: C.grid, title: "MGC1! price" },
      xaxis: { gridcolor: C.grid, title: "GEX $M per 1%" }, xaxis2: { overlaying: "x", side: "top", showgrid: false, title: { text: "OI (thousands)", font: { size: 10 } } },
      shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: spotY, y1: spotY, line: { color: C.gold, width: 1.5 } }] });
  const g = o.gex_curve;
  plot("ocurve", [{ x: g.spot_mgc[0] != null ? g.spot_mgc : g.spot_gld, y: g.total_gex.map((v) => v / 1e6), mode: "lines", line: { color: C.A, width: 2 }, name: "net GEX", hovertemplate: "spot %{x:.1f}: %{y:.2f}M<extra></extra>" }],
    { showlegend: false, xaxis: { title: "hypothetical MGC1! price", gridcolor: C.grid }, yaxis: { title: "$M per 1%", gridcolor: C.grid },
      shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: C.muted, width: 1 } }, ...vline(spotY, C.gold), ...vline(o.levels_mgc.gamma_flip, C.gold, "dot")] });
  const t = o.term;
  plot("oterm", [{ x: t.map((x) => x.days), y: t.map((x) => x.atm_iv * 100), mode: "lines+markers", name: "ATM IV %", line: { color: C.A, width: 2 }, marker: { size: 8 } },
    { x: t.map((x) => x.days), y: t.map((x) => x.skew_25d == null ? null : x.skew_25d * 100), mode: "lines+markers", name: "25Δ skew (vol pts)", line: { color: C.B, width: 2 }, marker: { size: 8 } }],
    { legend: { orientation: "h", y: 1.14, font: { size: 10 } }, margin: { l: 40, r: 10, t: 40, b: 36 }, xaxis: { title: "days to expiry", gridcolor: C.grid }, yaxis: { gridcolor: C.grid } });
}

function volCards(v) {
  if (v.error) return card("Volatility models", empty(v.error), "spanall");
  const g = v.garch, iv = v.iv, ca = v.cross_asset || {};
  return card("Volatility models · GARCH · IV vs realised · cross-asset", `
    <div class="kpis">
      ${g.error ? kpi("GARCH(1,1)", "—", esc(g.error)) : kpi("GARCH forecast", `${fmt(g.forecast_vol_pct["1d"], 1)}%`, `5d ${fmt(g.forecast_vol_pct["5d"], 1)}% · 21d ${fmt(g.forecast_vol_pct["21d"], 1)}% (ann.)`)}
      ${g.error ? "" : kpi("Long-run vol", `${fmt(g.long_run_vol_pct, 1)}%`, `persistence ${fmt(g.persistence, 3)} · half-life ${fmt(g.half_life_days, 0)}d`)}
      ${iv ? kpi("Gold IV (30d)", fmt(iv.gvz, 1), `IV rank ${fmt(iv.iv_rank_1y, 0)} · pct ${fmt(iv.iv_percentile_1y, 0)} · ${esc(iv.source || "")}`) : kpi("Gold IV (30d)", "—", "no data yet")}
      ${iv ? kpi("Vol risk premium", `${tk(iv.vrp, 1)} pts`, `IV ${fmt(iv.gvz, 1)} − RV21 ${fmt(iv.rv21, 1)}`) : ""}
      ${Object.entries(ca).map(([k, x]) => kpi(`Corr to ${k} (60d)`, fmt(x.corr_now, 2), `β ${fmt(x.beta_now, 2)} ${esc(x.unit)} · full-sample r ${fmt(x.corr_full, 2)} (p ${fmt(x.p_full, 3)})`)).join("")}
    </div>
    <div class="grid g3" style="margin-top:10px">
      <div><h2>Realised-vol cone (annualised %)</h2><div id="vcone" class="plot"></div></div>
      <div><h2>GARCH conditional vol vs GVZ implied</h2><div id="vgarch" class="plot"></div></div>
      <div><h2>Rolling 60-day correlation</h2><div id="vcorr" class="plot"></div></div>
    </div>
    <div class="explain lim">⚠ GARCH assumes Gaussian shocks and stable parameters; IV (GVZ) is GLD-option based; correlations are associations, not causes.</div>`, "spanall");
}

function drawVol(v) {
  if (v.error || !document.getElementById("vcone")) return;
  const c = v.cone.cone, x = c.map((r) => r.window + "d");
  plot("vcone", [
    { x, y: c.map((r) => r.p95), mode: "lines", line: { color: C.muted, dash: "dot", width: 1 }, name: "p95" },
    { x, y: c.map((r) => r.p75), mode: "lines", line: { color: C.A, width: 1 }, name: "p75" },
    { x, y: c.map((r) => r.p50), mode: "lines", line: { color: C.text2, width: 1.5 }, name: "median" },
    { x, y: c.map((r) => r.p25), mode: "lines", line: { color: C.A, width: 1 }, name: "p25" },
    { x, y: c.map((r) => r.p5), mode: "lines", line: { color: C.muted, dash: "dot", width: 1 }, name: "p5" },
    { x, y: c.map((r) => r.current), mode: "lines+markers", line: { color: C.gold, width: 2 }, marker: { size: 8 }, name: "now" }],
    { legend: { orientation: "h", y: 1.16, font: { size: 10 } }, margin: { l: 40, r: 10, t: 40, b: 30 }, yaxis: { gridcolor: C.grid } });
  const tr = [];
  if (!v.garch.error) { const n = v.garch.conditional_vol_pct.length; tr.push({ y: v.garch.conditional_vol_pct, x: [...Array(n).keys()].map((i) => i - n + 1), mode: "lines", name: "GARCH σ", line: { color: C.A, width: 2 } }); }
  if (v.iv) { const n = v.iv.history.gvz.length; tr.push({ y: v.iv.history.gvz, x: [...Array(n).keys()].map((i) => i - n + 1), mode: "lines", name: "GVZ (IV)", line: { color: C.gold, width: 1.5 } }); }
  plot("vgarch", tr, { legend: { orientation: "h", y: 1.16, font: { size: 10 } }, margin: { l: 40, r: 10, t: 40, b: 30 }, xaxis: { title: "trading days ago", gridcolor: C.grid }, yaxis: { title: "% annualised", gridcolor: C.grid } });
  const ca = v.cross_asset || {};
  plot("vcorr", Object.entries(ca).map(([k, x], i) => ({ x: x.series.t, y: x.series.corr, mode: "lines", name: k, line: { color: [C.A, C.B, C.C][i], width: 2 } })),
    { legend: { orientation: "h", y: 1.16, font: { size: 10 } }, margin: { l: 40, r: 10, t: 40, b: 30 }, yaxis: { range: [-1, 1], gridcolor: C.grid },
      shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: C.muted, width: 1 } }] });
}

function activeList(a) {
  if (!a.length) return empty("No detector fired in the last 3 bars.");
  return a.map((x) => `<div class="msg" style="margin-bottom:6px;font-family:var(--sans)"><b>${esc(x.name)}</b> ${x.kind === "directional" ? (x.direction > 0 ? '<span class="pos">▲ up-hypothesis</span>' : '<span class="neg">▼ down-hypothesis</span>') : '<span class="dim">volatility</span>'}
    <div class="dim" style="font-size:11px">${esc(x.time.slice(0, 16))} UTC</div>
    <div style="margin-top:4px">${Object.entries(x.by_horizon).map(([h, v]) => `${h}: ${stChip(v.status)} <span class="dim">${tk(v.mean)}t n=${v.n}</span>`).join("<br>")}</div>
    ${Object.values(x.by_horizon).every((v) => v.status !== "VALIDATED") ? '<div class="explain lim">⚠ Not validated at any horizon — treat as information, not an edge.</div>' : ""}</div>`).join("");
}

function drawEngineChart(r) {
  const c = r.chart;
  const mn = Math.min(...c.low), mx = Math.max(...c.high), pad = (mx - mn) * 0.12;
  const lo = mn - pad, hi = mx + pad;
  const keys = [...new Set(c.signals.map((s) => s.key))];
  const marks = keys.map((k) => {
    const ss = c.signals.filter((s) => s.key === k);
    return { type: "scatter", mode: "markers", name: k, x: ss.map((s) => s.t), y: ss.map((s) => { const i = c.t.indexOf(s.t); return s.dir >= 0 ? c.low[i] : c.high[i]; }),
      marker: { size: 9, symbol: ss.map((s) => s.dir > 0 ? "triangle-up" : s.dir < 0 ? "triangle-down" : "diamond"), color: ss.map((s) => s.dir > 0 ? C.good : s.dir < 0 ? C.bad : C.gold), line: { color: C.surface, width: 1 } },
      hovertemplate: `${k}<br>%{x}<extra></extra>` };
  });
  plot("echart", [{ type: "candlestick", x: c.t, open: c.open, high: c.high, low: c.low, close: c.close, name: "MGC1!", showlegend: false,
    increasing: { line: { color: C.text2, width: 1 }, fillcolor: C.text2 }, decreasing: { line: { color: C.gold, width: 1 }, fillcolor: C.gold } }, ...marks],
    { margin: { l: 12, r: 64, t: 70, b: 40 }, legend: { orientation: "h", y: 1.22, font: { size: 10 } }, xaxis: { rangeslider: { visible: false }, gridcolor: C.grid },
      yaxis: { side: "right", gridcolor: C.grid, tickformat: ".1f", range: [lo, hi] }, shapes: wallShapes(lo, hi), annotations: wallLabels(lo, hi) });
}

function drawCone(cone) {
  const ok = cone.cones.filter((x) => !x.error);
  if (!ok.length) { $("#econe").innerHTML = empty("Not enough history for a cone"); return; }
  const x = ["now", ...ok.map((o) => o.horizon)], P = (k) => [cone.last_close, ...ok.map((o) => cone.last_close + o[k] * 0.1)];
  plot("econe", [
    { mode: "lines", x, y: P("p95"), line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { mode: "lines", x, y: P("p5"), fill: "tonexty", fillcolor: "rgba(57,135,229,.15)", line: { width: 0 }, name: "5–95%", hovertemplate: "p5 %{y:.1f}<extra></extra>" },
    { mode: "lines", x, y: P("p75"), line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { mode: "lines", x, y: P("p25"), fill: "tonexty", fillcolor: "rgba(57,135,229,.35)", line: { width: 0 }, name: "25–75%", hovertemplate: "p25 %{y:.1f}<extra></extra>" },
    { mode: "lines", x, y: P("p50"), line: { color: C.gold, width: 2 }, name: "median", hovertemplate: "median %{y:.1f}<extra></extra>" }],
    { yaxis: { gridcolor: C.grid, tickformat: ".1f" }, xaxis: { gridcolor: C.grid } });
  $("#econet").innerHTML = table(ok, [["horizon", "Horizon"], ["n", "n"], ["p5", "p5 ticks", (v) => tk(v, 0)], ["p50", "median", (v) => tk(v, 0)], ["p95", "p95", (v) => tk(v, 0)], ["p_up", "P(up)", pct]]);
}

let LAST_EV = null;
function drawScanner(ev) {
  LAST_EV = ev;
  const rows = ev.rows.filter((r) => r.horizon === ENG.horizon).sort((a, b) => (ST_RANK[a.status] - ST_RANK[b.status]) || ((a.q_is ?? 1) - (b.q_is ?? 1)));
  $("#escan").innerHTML = `<div class="scroll"><table><thead><tr><th>Detector</th><th>Status</th><th>Edge dir.</th><th>n</th><th>Mean</th><th>95% CI</th><th>Hit</th><th>IS t</th><th>q (FDR)</th><th>OOS mean (n)</th><th>OOS net ticks</th><th>Months +</th></tr></thead><tbody>${
    rows.map((r) => `<tr class="click ${ENG.sel === r.key ? "sel" : ""}" data-k="${r.key}"><td>${esc(r.name)}</td><td>${stChip(r.status)}</td><td class="dim">${esc(r.edge_direction || "")}</td><td>${r.n}</td>
      <td>${sgn(r.mean_ticks, 1)}</td><td>${r.ci95 ? `${tk(r.ci95[0])} … ${tk(r.ci95[1])}` : "—"}</td><td>${r.kind === "directional" ? pct(r.hit_rate, 0) : "—"}</td>
      <td>${fmt(r.is.t, 2)}</td><td>${fmt(r.q_is, 3)}</td><td>${r.oos.n ? `${tk(r.oos.mean)} (${r.oos.n})` : "—"}</td><td>${r.net_oos_ticks == null ? "—" : sgn(r.net_oos_ticks, 1)}</td><td>${pct(r.months_positive, 0)}</td></tr>`).join("")
  }</tbody></table></div><p class="dim">Mean = ticks per event in excess of the market's drift (directional) or of the normal move size (volatility). 1 tick = $0.10 = $1 per MGC contract. Statuses: VALIDATED = FDR-significant in-sample, same sign and significant out-of-sample, and positive after costs.</p>`;
  document.querySelectorAll("#escan tr[data-k]").forEach((tr) => tr.onclick = () => { ENG.sel = tr.dataset.k; drawScanner(LAST_EV); drawDetail(); });
  if (ENG.sel) drawDetail();
}

function drawDetail() {
  const r = LAST_EV.rows.find((x) => x.key === ENG.sel && x.horizon === ENG.horizon);
  if (!r) return;
  $("#edetail").innerHTML = `<div class="grid g3">
    <div><h2>${esc(r.name)} · ${esc(r.horizon)}</h2><dl class="explain"><dt>STATUS</dt><dd>${stChip(r.status)} ${esc(r.verdict)}</dd>
      <dt>HYPOTHESIS</dt><dd>${esc(r.hypothesis)}</dd><dt>RULE (no look-ahead)</dt><dd>${esc(r.rule)}</dd>
      <dt>SAMPLE</dt><dd>n = ${r.n}${r.kind === "directional" ? ` (${r.n_long} up / ${r.n_short} down)` : ""} · IS ${r.is.n} · OOS ${r.oos.n}</dd>
      <dt>IN-SAMPLE</dt><dd>mean ${tk(r.is.mean)} ticks · t ${fmt(r.is.t, 2)} · p ${fmt(r.is.p, 4)} · q ${fmt(r.q_is, 4)}</dd>
      <dt>OUT-OF-SAMPLE</dt><dd>mean ${tk(r.oos.mean)} ticks · t ${fmt(r.oos.t, 2)} · p ${fmt(r.oos.p, 4)}</dd>
      <dt>AFTER COSTS</dt><dd>${r.kind === "directional" ? `raw ${tk(r.raw_mean_ticks)} → net ${tk(r.net_mean_ticks)} ticks/event (all) · OOS net ${tk(r.net_oos_ticks)}` : "n/a (volatility detector)"}</dd>
      <dt>LAST SIGNAL</dt><dd>${esc(r.last_signal || "—")}</dd></dl>
      <div class="explain lim">⚠ Entry is assumed at the signal bar's close; real fills, spreads and delays will differ. Historical association is not causation.</div></div>
    <div><div id="emon" class="plot"></div></div><div><div id="edist" class="plot"></div></div></div>`;
  plot("emon", [{ type: "bar", x: r.monthly.map((m) => m.month), y: r.monthly.map((m) => m.mean), text: r.monthly.map((m) => `n=${m.n}`), textposition: "outside", marker: { color: r.monthly.map((m) => m.mean >= 0 ? C.A : "#5b5e66") }, hovertemplate: "%{x}: %{y:.1f} ticks %{text}<extra></extra>" }],
    { showlegend: false, title: { text: "Stability: mean per month", font: { size: 11 } }, yaxis: { title: "ticks", gridcolor: C.grid } });
  plot("edist", [{ type: "histogram", x: r.distribution, marker: { color: C.A, line: { color: C.surface, width: 1 } }, hovertemplate: "%{x} ticks: %{y}<extra></extra>" }],
    { showlegend: false, title: { text: `Distribution per event · n=${r.n} · mean ${tk(r.mean_ticks)} · median ${tk(r.median_ticks)}`, font: { size: 11 } }, shapes: vline(0, C.muted, "dot").concat(vline(r.mean_ticks, C.gold)) });
}

function drawRegime(tl) {
  const names = { 1: "Hi-vol trend", 2: "Lo-vol trend", 3: "Hi-vol range", 4: "Lo-vol range", 5: "Vol expansion", 6: "Vol contraction", 0: "Unclassified", "-1": "Warm-up" };
  plot("ereg", [{ type: "scatter", mode: "markers", x: tl.t, y: tl.regime.map((r) => names[r]), marker: { size: 4, color: C.A }, hovertemplate: "%{x}<br>%{y}<extra></extra>" }],
    { showlegend: false, margin: { l: 96, r: 10, t: 10, b: 36 }, yaxis: { categoryorder: "array", categoryarray: Object.values(names).reverse(), gridcolor: C.grid } });
}

function drawSeason(se) {
  const h = se.hours;
  plot("eseas", [{ type: "bar", x: h.map((x) => x.hour), y: h.map((x) => x.abs_mean), marker: { color: h.map((x) => x.q != null && x.q < 0.05 ? C.gold : C.A) },
    customdata: h.map((x) => `mean ${tk(x.mean, 2)}t · q ${fmt(x.q, 3)} · n ${x.n}`), hovertemplate: "%{x}:00 ET<br>|move| %{y:.2f} ticks<br>%{customdata}<extra></extra>" }],
    { showlegend: false, xaxis: { title: "hour (New York)", dtick: 2, gridcolor: C.grid }, yaxis: { title: "mean |move| per bar (ticks)", gridcolor: C.grid } });
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  plot("eheat", [{ type: "heatmap", x: se.heat.hour, y: se.heat.dow.map((d) => days[d]), z: se.heat.z, colorscale: [[0, "#17181b"], [0.5, "#256abf"], [1, "#cde2fb"]], hovertemplate: "%{y} %{x}:00 ET<br>|move| %{z} ticks<extra></extra>", colorbar: { thickness: 8 } }],
    { showlegend: false, margin: { l: 40, r: 10, t: 10, b: 36 }, xaxis: { title: "hour (NY)", dtick: 3 } });
}

// ------------------------------------------------------------ Paper trading --
function tradeCard(t) {
  if (!t || t.error) return card("Auto-trading (PAPER)", empty(t?.error || "unavailable"), "spanall");
  const c = t.config, e = t.equity, pf = t.performance, td = t.today || { pnl: 0, trades: 0 };
  const pos = t.open[0], pend = t.pending[0];
  const posTxt = pos ? `${pos.direction > 0 ? '<span class="pos">LONG</span>' : '<span class="neg">SHORT</span>'} ${pos.qty} @ ${fmt(pos.entry_px, 1)} · stop ${fmt(pos.stop, 1)}${pos.target ? ` · tgt ${fmt(pos.target, 1)}` : ""} · ${pos.bars_held}/${pos.hold_bars} bars · ${sgn(pos.unrealised ?? 0, 2)}$`
    : pend ? `order pending: ${pend.direction > 0 ? "BUY" : "SELL"} ${pend.qty} at next bar open` : "flat";
  return card(`Auto-trading <span class="chip sim">PAPER · simulated money</span>`, `
    <div class="row">
      <button id="ttoggle" class="${c.enabled ? "" : "primary"}" style="${c.enabled ? "border-color:var(--good);color:var(--good)" : ""}">${c.enabled ? "● AUTO ON — click to pause" : "○ AUTO OFF — click to start"}</button>
      <button id="tkill" style="border-color:var(--bad);color:var(--bad)">■ KILL SWITCH (flatten + off)</button>
      <span class="grow"></span>
      <button id="tbuy">Buy 1 (manual)</button><button id="tsell">Sell 1 (manual)</button><button id="tflat">Flatten</button>
    </div>
    <div class="kpis">
      ${kpi("Equity", "$" + fmt(e.equity, 2), `start $${fmt(e.starting, 0)}`)}
      ${kpi("Realised P&L", sgn(e.realised, 2), `unrealised ${sgn(e.unrealised, 2)}`)}
      ${kpi("Today", sgn(td.pnl, 2), `limit −$${fmt(c.daily_loss_limit, 0)} · ${td.trades}/${c.max_trades_per_day} trades`)}
      ${kpi("Position", `<span style="font-size:12px">${posTxt}</span>`, `last price ${fmt(t.last_price, 1)}`)}
      ${kpi("Closed trades", pf.n || 0, pf.n ? `win ${pct(pf.win_rate, 0)} · PF ${fmt(pf.profit_factor, 2)}` : "")}
      ${kpi("Avg R / Max DD", pf.n ? `${tk(pf.avg_r, 2)}R` : "—", pf.n ? `max DD $${fmt(pf.max_drawdown, 2)}` : "")}
      ${kpi("Trades from", `<span style="font-size:12px">${c.allowed_status.join(" + ")}</span>`, `${esc(c.interval)} bars · hold ${esc(c.horizon)} · stop ${c.stop_atr}×ATR${c.target_r ? ` · tgt ${c.target_r}R` : ""}`)}
    </div>
    <details id="tset" style="margin-top:10px"><summary class="dim" style="cursor:pointer">⚙ Settings & risk limits</summary>
      <div class="row" style="margin-top:8px">
        <label class="f">Trade detectors with status
          <span><label><input type="checkbox" data-st="VALIDATED" ${c.allowed_status.includes("VALIDATED") ? "checked" : ""}> VALIDATED</label>
          <label><input type="checkbox" data-st="PROMISING" ${c.allowed_status.includes("PROMISING") ? "checked" : ""}> PROMISING (forward-test)</label></span></label>
        <label class="f">bars<select id="t_interval">${["5m", "1h"].map((i) => `<option ${i === c.interval ? "selected" : ""}>${i}</option>`).join("")}</select></label>
        <label class="f">hold (= tested horizon)<select id="t_horizon">${(c.interval === "1h" ? ["1h", "4h", "1d"] : ["15m", "1h", "4h"]).map((h) => `<option ${h === c.horizon ? "selected" : ""}>${h}</option>`).join("")}</select></label>
        <label class="f">stop (× ATR)<input id="t_stop" type="number" step="0.25" value="${c.stop_atr}" style="width:70px"></label>
        <label class="f">target (R, 0 = none)<input id="t_tgt" type="number" step="0.5" value="${c.target_r}" style="width:70px"></label>
      </div>
      <div class="row">
        <label class="f">sizing<select id="t_sizing"><option value="fixed" ${c.sizing === "fixed" ? "selected" : ""}>fixed contracts</option><option value="risk_pct" ${c.sizing === "risk_pct" ? "selected" : ""}>% of equity at risk</option></select></label>
        <label class="f">contracts<input id="t_qty" type="number" min="1" value="${c.contracts}" style="width:60px"></label>
        <label class="f">risk %<input id="t_risk" type="number" step="0.1" value="${c.risk_pct}" style="width:60px"></label>
        <label class="f">max contracts<input id="t_max" type="number" min="1" value="${c.max_contracts}" style="width:60px"></label>
        <label class="f">daily loss limit $<input id="t_dll" type="number" value="${c.daily_loss_limit}" style="width:80px"></label>
        <label class="f">max trades/day<input id="t_mtd" type="number" value="${c.max_trades_per_day}" style="width:60px"></label>
        <label class="f">starting equity $<input id="t_eq" type="number" value="${c.starting_equity}" style="width:90px"></label>
        <button class="primary" id="tsave">Save settings</button><button id="treset">Reset paper account</button>
      </div>
      <div class="explain lim">⚠ Entries fill at the NEXT bar's open + 1 tick; exits at stop (−slippage), target, or after the tested holding time; stop wins if both are touched in one bar. Commission/fees from the cost model. No entries 16:50–18:00 ET or after Fri 16:00 ET.</div>
    </details>
    <div class="grid g3" style="margin-top:10px">
      <div><h2>Paper equity</h2><div id="teq" class="plot"></div></div>
      <div><h2>Recent trades</h2>${table(t.closed.slice(0, 12), [["id", "#"], ["detector", "Detector"], ["direction", "Dir", (v) => v > 0 ? "L" : "S"], ["entry_px", "Entry", (v) => fmt(v, 1)], ["exit_px", "Exit", (v) => fmt(v, 1)], ["exit_reason", "Exit"], ["pnl", "Net $", (v) => sgn(v, 2)], ["r", "R", (v) => sgn(v, 2)]])}</div>
      <div><h2>Decision log</h2><div class="scroll" style="max-height:260px">${t.log.map((l) => `<div style="font:11px var(--mono);padding:3px 0;border-bottom:1px solid var(--grid)"><span class="dim">${esc((l.bar_ts || l.ts).slice(5, 16))}</span> <span class="${l.kind === "exit" || l.kind === "fill" || l.kind === "order" ? "" : "dim"}">${esc(l.kind.toUpperCase())}</span> ${esc(l.msg)}</div>`).join("") || empty("No activity yet")}</div></div>
    </div>
    <div class="explain lim">⚠ Paper trading on DELAYED data (~10 min). Results show what the rules would have done on these bars — not fills you could have had live. No real orders are ever sent.</div>`, "spanall");
}

function bindTrade(t) {
  if (!document.getElementById("ttoggle")) return;
  const reload = async () => renderEngine();
  const guardFn = (fn) => async () => { try { await fn(); } catch (e) { alert(e.message); } await reload(); };
  $("#ttoggle").onclick = guardFn(() => api(`/api/trade/enable?on=${!t.config.enabled}`, { method: "POST" }));
  $("#tkill").onclick = guardFn(async () => { if (confirm("KILL SWITCH: turn auto-trading off and close all paper positions?")) await api("/api/trade/kill", { method: "POST" }); });
  $("#tbuy").onclick = guardFn(async () => { if (confirm("Paper BUY at the next bar's open?")) await api("/api/trade/order?side=buy", { method: "POST" }); });
  $("#tsell").onclick = guardFn(async () => { if (confirm("Paper SELL at the next bar's open?")) await api("/api/trade/order?side=sell", { method: "POST" }); });
  $("#tflat").onclick = guardFn(() => api("/api/trade/flatten", { method: "POST" }));
  $("#treset").onclick = guardFn(async () => { if (confirm("Delete all paper trades and start over?")) await api("/api/trade/reset", { method: "POST" }); });
  $("#tsave").onclick = guardFn(() => api("/api/trade/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    allowed_status: [...document.querySelectorAll("[data-st]:checked")].map((x) => x.dataset.st), interval: $("#t_interval").value, horizon: $("#t_horizon").value,
    stop_atr: +$("#t_stop").value, target_r: +$("#t_tgt").value, sizing: $("#t_sizing").value, contracts: +$("#t_qty").value, risk_pct: +$("#t_risk").value,
    max_contracts: +$("#t_max").value, daily_loss_limit: +$("#t_dll").value, max_trades_per_day: +$("#t_mtd").value, starting_equity: +$("#t_eq").value }) }));
  const ec = t.performance.equity_curve;
  if (ec) plot("teq", [{ x: ec.t, y: ec.equity, mode: "lines+markers", line: { color: C.gold, width: 2 }, marker: { size: 5 }, hovertemplate: "%{x}<br>$%{y:.2f}<extra></extra>" }], { showlegend: false, yaxis: { gridcolor: C.grid } });
  else { $("#teq").style.height = "auto"; $("#teq").innerHTML = empty("No closed paper trades yet"); }
}

// -------------------------------------------------------------- routing ---
async function go(name) {
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === name));
  $("#title").textContent = document.querySelector(`#nav a[data-view="${name}"]`).textContent;
  view.innerHTML = `<div class="dim">Loading…</div>`;
  await refreshStatus();
  await guard(views[name]);
}
document.querySelectorAll("#nav a").forEach((a) => a.onclick = () => { location.hash = a.dataset.view; });
window.addEventListener("hashchange", () => go(location.hash.slice(1) || "engine"));
go(location.hash.slice(1) || "engine");
