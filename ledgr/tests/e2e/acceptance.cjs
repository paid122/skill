/**
 * Ledgr end-to-end acceptance tests (brief Part 18).
 * Runs against a live server:  BASE_URL=http://localhost:3000 node tests/e2e/acceptance.cjs
 * Requires the `playwright` package and a Chromium build.
 */
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ROUTES = ["/dashboard", "/journal", "/daily-journal", "/weekly-review", "/showcase", "/analytics", "/psychology", "/strategies", "/performance-score", "/accounts", "/account-history", "/study", "/verses", "/ai", "/reports", "/settings", "/settings/appearance"];
// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const results = [];
let currentPage = null;
async function check(name, fn) {
  try { await fn(); results.push(["PASS", name]); console.log("PASS", name); }
  catch (e) {
    results.push(["FAIL", name, e.message]);
    console.log("FAIL", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | "));
    if (process.env.SHOTS && currentPage) await currentPage.screenshot({ path: `${process.env.SHOTS}/fail-${results.length}.png` }).catch(() => {});
    if (currentPage) await currentPage.keyboard.press("Escape").catch(() => {});
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  currentPage = page;
  page.setDefaultTimeout(Number(process.env.STEP_TIMEOUT || 10000));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(400); };
  const main = () => page.locator("main");
  const dialog = () => page.getByRole("dialog");

  await check("Onboarding creates profile and first account", async () => {
    await go("/dashboard");
    await page.getByLabel("What should Ledgr call you?").fill("Sam");
    await page.getByRole("button", { name: "Set up my journal" }).click();
    await page.getByLabel("Account name").fill("Practice A");
    await page.getByRole("button", { name: "Open my ledger" }).click();
    await page.getByRole("heading", { name: /Sam\./ }).waitFor();
  });

  await check("All pages load without errors", async () => {
    for (const r of ROUTES) {
      await go(r);
      assert.ok(await main().locator("h2").first().isVisible(), `no heading on ${r}`);
    }
    assert.deepEqual(errors, []);
  });

  await check("Sidebar navigation reaches every route with an active state", async () => {
    await go("/dashboard");
    for (const [label, path] of [["Trade Journal", "/journal"], ["Analytics", "/analytics"], ["Study Room", "/study"], ["Settings", "/settings"]]) {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label }).click();
      await page.waitForURL((u) => new URL(u).pathname === path);
      const current = page.getByRole("navigation", { name: "Primary" }).locator('[aria-current="page"]');
      assert.equal((await current.textContent()).trim(), label);
    }
  });

  await check("Analytics shows 'Not enough journal data yet.' with no records", async () => {
    await go("/analytics");
    assert.ok(await main().getByText("Not enough journal data yet.").first().isVisible());
  });

  await check("Quick Log saves a draft that persists after reload", async () => {
    await go("/journal");
    await page.keyboard.press("n");
    await dialog().getByLabel("Symbol").fill("NQ");
    await dialog().getByRole("button", { name: "Save draft" }).click();
    await page.reload(); await page.waitForTimeout(800);
    const row = main().locator("tbody tr", { hasText: "NQ" });
    await row.getByText("Draft").waitFor();
  });

  let tradeUrl = "";
  await check("Trade creation with executions calculates P&L and R", async () => {
    await go("/journal");
    await main().getByRole("button", { name: "New trade" }).click();
    await dialog().getByLabel("Symbol").fill("ES");
    await dialog().getByRole("radio", { name: "Long" }).click();
    await dialog().getByRole("tab", { name: "Execution" }).click();
    await dialog().getByRole("button", { name: "Entry" }).click();
    await dialog().getByLabel("Price").first().fill("100");
    await dialog().getByRole("button", { name: "Exit" }).click();
    await dialog().getByLabel("Price").nth(1).fill("102");
    await dialog().getByLabel("Recorded stop").fill("99");
    await dialog().getByLabel(/Point value/).fill("50");
    await dialog().getByRole("button", { name: "Save trade" }).click();
    await page.waitForTimeout(400);
    await main().locator("tbody tr", { hasText: "ES" }).first().click();
    await page.waitForURL(/\/journal\/trd_/);
    tradeUrl = page.url();
    assert.ok(await main().getByText("+$100.00").first().isVisible(), "net +$100");
    assert.ok(await main().getByText("+2.00R").first().isVisible(), "R +2.00");
  });

  await check("Trade editing persists (grade and reflection)", async () => {
    await page.goto(tradeUrl);
    await main().getByRole("button", { name: "Edit trade" }).click();
    await dialog().getByRole("tab", { name: "Execution" }).click();
    await dialog().getByRole("radio", { name: "A+" }).click();
    await dialog().getByRole("tab", { name: "Reflection" }).click();
    await dialog().getByLabel("What did I learn?").fill("Waited for the close.");
    await dialog().getByRole("button", { name: "Save changes" }).click();
    await page.reload(); await page.waitForTimeout(800);
    assert.ok(await main().getByText("Waited for the close.").isVisible());
    assert.ok(await main().getByText("A+", { exact: true }).first().isVisible());
  });

  await check("Image upload is stored and shown on the trade", async () => {
    await main().getByRole("button", { name: "Edit trade" }).click();
    await dialog().getByRole("tab", { name: "Attachments" }).click();
    await dialog().locator('input[type="file"]').setInputFiles({ name: "after.png", mimeType: "image/png", buffer: PNG });
    await dialog().locator("img").first().waitFor();
    await dialog().getByRole("button", { name: "Save changes" }).click();
    await page.reload(); await page.waitForTimeout(1000);
    await main().locator("img").first().waitFor();
  });

  await check("Rejects unsupported attachment types", async () => {
    await main().getByRole("button", { name: "Edit trade" }).click();
    await dialog().getByRole("tab", { name: "Attachments" }).click();
    await dialog().locator('input[type="file"]').setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await dialog().getByText(/Unsupported file type/).waitFor();
    await dialog().getByRole("button", { name: "Cancel" }).click();
  });

  await check("Accounts remain separated", async () => {
    await go("/accounts");
    await main().getByRole("button", { name: "New account" }).click();
    await dialog().getByLabel("Account name").fill("Backtest B");
    await dialog().getByLabel("Virtual starting balance").fill("5000");
    await dialog().getByRole("button", { name: "Save account" }).click();
    await page.keyboard.press("n");
    await dialog().getByLabel("Symbol").fill("EURUSD");
    await dialog().getByRole("radio", { name: "Short" }).click();
    await dialog().getByLabel("Account").selectOption({ label: "Backtest B" });
    await dialog().getByLabel("Net result").fill("-50");
    await dialog().getByRole("button", { name: "Save trade" }).click();
    await go("/accounts");
    const a = main().locator(".card", { hasText: "Practice A" }).first();
    const b = main().locator(".card", { hasText: "Backtest B" }).first();
    assert.match(await a.textContent(), /\$10,100\.00/);
    assert.match(await b.textContent(), /\$4,950\.00/);
  });

  await check("Charts and statistics update from stored records", async () => {
    await go("/dashboard");
    const kpis = page.getByRole("region", { name: "Key figures" }).or(main().locator('section[aria-label="Key figures"]'));
    assert.match(await kpis.textContent(), /\+\$50\.00/); // 100 − 50
    assert.match(await kpis.textContent(), /50\.0%/);
  });

  await check("Daily journal entries persist", async () => {
    await go("/daily-journal");
    await main().getByLabel("What are my intentions?").fill("Only A-grade setups today.");
    await page.waitForTimeout(1200);
    await page.reload(); await page.waitForTimeout(800);
    assert.equal(await main().getByLabel("What are my intentions?").inputValue(), "Only A-grade setups today.");
  });

  await check("Context-aware verse responds to recorded frustration (not P&L)", async () => {
    await go("/daily-journal");
    await main().getByRole("button", { name: "Frustrated" }).click();
    await main().getByText("Proverbs 14:29").first().waitFor();
  });

  await check("Favourite verses persist", async () => {
    await go("/journal");
    await main().getByRole("button", { name: "Save to favourites" }).first().click();
    await page.waitForTimeout(500);
    await page.reload(); await go("/verses");
    await main().getByRole("tab", { name: /Favourites \(1\)/ }).waitFor();
  });

  await check("Ledgr AI answers from journal records with valid citations", async () => {
    await go("/ai");
    await main().getByRole("button", { name: "Review my most recent trade" }).click();
    await main().getByText(/Trade/).first().waitFor();
    await page.waitForTimeout(1500);
    const cite = main().locator('a[href^="/journal/trd_"]').first();
    await cite.waitFor({ timeout: 60000 });
  });

  await check("Reports export PNG and PDF", async () => {
    await go("/reports");
    const [png] = await Promise.all([page.waitForEvent("download"), main().getByRole("button", { name: "PNG" }).click()]);
    assert.match(png.suggestedFilename(), /\.png$/);
    const [pdf] = await Promise.all([page.waitForEvent("download"), main().getByRole("button", { name: "PDF" }).click()]);
    assert.match(pdf.suggestedFilename(), /\.pdf$/);
  });

  await check("CSV export downloads", async () => {
    await go("/journal");
    const [csv] = await Promise.all([page.waitForEvent("download"), main().getByRole("button", { name: "Export CSV" }).click()]);
    assert.match(csv.suggestedFilename(), /\.csv$/);
  });

  await check("Themes apply and persist; unreadable accents are rejected", async () => {
    await go("/settings/appearance");
    await main().getByRole("button", { name: /^Light/ }).click();
    await page.reload(); await page.waitForTimeout(800);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await main().getByLabel("Custom accent hex").fill("#FFFFF0");
    await main().getByLabel("Custom accent hex").press("Enter");
    await page.getByRole("alert").filter({ hasText: "contrast" }).waitFor();
    await main().getByRole("button", { name: /^Midnight/ }).click();
  });

  await check("Trade deletion removes the record", async () => {
    await page.goto(tradeUrl); await page.waitForTimeout(800);
    await main().getByRole("button", { name: "Delete" }).click();
    await dialog().getByRole("button", { name: "Delete trade" }).click();
    await page.waitForURL(/\/journal$/);
    assert.equal(await main().locator("tbody tr td:nth-child(2)").filter({ hasText: /^ES$/ }).count(), 0);
  });

  await check("Public website pages load with the 3D hero and working navigation", async () => {
    await page.goto(BASE + "/"); await page.waitForTimeout(1500);
    assert.ok(await page.getByRole("heading", { name: "Discipline over impulse." }).isVisible());
    await page.locator("canvas").first().waitFor({ state: "attached" });
    for (const [label, heading] of [["Features", /Every feature/], ["Pricing", /Simple\. Free\./], ["Reviews", /^Reviews$/], ["Community", /Grow alongside/], ["Affiliates", /Share Ledgr/]]) {
      await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: label }).click();
      await page.getByRole("heading", { level: 1, name: heading }).waitFor();
    }
    for (const r of ["/privacy", "/terms"]) { await page.goto(BASE + r); await page.getByRole("heading", { level: 1 }).waitFor(); }
  });

  await check("Sign-up explains when accounts are not connected and still lets you in", async () => {
    await page.goto(BASE + "/signup"); await page.waitForTimeout(800);
    const notConnected = await page.getByRole("heading", { name: /Accounts aren't switched on yet/ }).isVisible().catch(() => false);
    if (notConnected) {
      await page.getByRole("link", { name: "Continue without an account" }).click();
      await page.waitForURL(/\/dashboard$/);
    } else {
      assert.ok(await page.getByLabel("Email").isVisible());
      assert.ok(await page.getByRole("button", { name: "Continue with Google" }).isVisible());
    }
  });

  await check("Mobile layout: bottom navigation and no horizontal overflow", async () => {
    const m = await browser.newContext({ ...devices["iPhone 13"] });
    const mp = await m.newPage();
    await mp.goto(BASE + "/dashboard"); await mp.waitForTimeout(1500);
    assert.ok(await mp.getByRole("navigation", { name: "Mobile" }).isVisible());
    assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
    await m.close();
  });

  await check("No uncaught page errors during the run", async () => assert.deepEqual(errors, []));

  await browser.close();
  const failed = results.filter((r) => r[0] === "FAIL");
  console.log(`\n${results.length - failed.length}/${results.length} acceptance checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
