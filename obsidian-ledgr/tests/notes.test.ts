import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { assignPaths, hubNotes, MARKER, mergeNote, noteTradeId, safeName, splitFrontmatter, TRADE_KEYS, tradeBaseName, tradeBody, tradeFrontmatter, type Ctx, type PublicTrade } from "../src/notes/build";
import { homeNote, REGION_END, REGION_START, replaceRegion } from "../src/notes/starter";
import { createStarter, syncNotes } from "../src/notes/sync";
import { FakeApp } from "./fake-obsidian";

const ctx: Ctx = { root: "LEDGR", tz: "Asia/Dubai", accounts: { acc1: "Apex 50K" }, currency: "USD" };
let n = 0;
const trade = (over: Partial<PublicTrade> = {}): PublicTrade => ({
  id: "trd_" + ++n, number: n, accountId: "acc1", symbol: "MGCZ6", market: "Futures", direction: "long", date: "2026-11-25", session: "New York",
  status: "closed", result: "win", quantity: 2, entryPrice: 2650, exitPrice: 2655.5, stopPrice: 2646, targetPrice: 2660, pointValue: 10, gross: 110, fees: 2.48, net: 107.52, risk: 80, r: 1.34,
  durationMinutes: 17, openedAt: "2026-11-25T10:31:00Z", strategy: null, setup: "ORB", grade: "B", rating: 7, emotions: ["Calm"], mistakes: [], tags: ["a+ setup"],
  notes: { entry: "Waited for the retest.", exit: "" }, review: { wentWell: "Patient entry", wentWrong: "", improve: "Hold for 2R", learned: "", followedPlan: "yes" },
  executions: [{ kind: "entry", price: 2650, quantity: 2, time: "2026-11-25T10:31:00Z", fees: 1.24 }, { kind: "exit", price: 2655.5, quantity: 2, time: "2026-11-25T10:48:00Z", fees: 1.24 }],
  copyOf: null, createdAt: "2026-11-25T10:31:00Z", updatedAt: "2026-11-25T10:50:00Z", ...over,
});

describe("names", () => {
  it("names trade notes 'YYYY-MM-DD SYMBOL Direction Setup'", () => {
    expect(tradeBaseName(trade())).toBe("2026-11-25 MGCZ6 Long ORB");
    expect(tradeBaseName(trade({ direction: "short", setup: null, strategy: "VWAP / reclaim" }))).toBe("2026-11-25 MGCZ6 Short VWAP reclaim");
    expect(tradeBaseName(trade({ setup: null }))).toBe("2026-11-25 MGCZ6 Long");
    expect(safeName('a:b*c?"d<e>|f#g^[h]')).toBe("a b c d e f g h");
  });
  it("gives duplicates ' (2)', keeps existing paths, and avoids files already in the vault", () => {
    const a = trade({ id: "A", number: 1 }), b = trade({ id: "B", number: 2 }), c = trade({ id: "C", number: 3 });
    const p = assignPaths([c, b, a], new Map([["B", "Elsewhere/my B.md"]]), new Set(["LEDGR/Trades/2026-11-25 MGCZ6 Long ORB.md"]), "LEDGR");
    expect(p.get("B")).toBe("Elsewhere/my B.md");
    expect(p.get("A")).toBe("LEDGR/Trades/2026-11-25 MGCZ6 Long ORB (2).md");
    expect(p.get("C")).toBe("LEDGR/Trades/2026-11-25 MGCZ6 Long ORB (3).md");
  });
});

describe("trade note", () => {
  it("has the frontmatter from the spec", () => {
    const fm = tradeFrontmatter(trade({ id: "trd_x" }), ctx);
    expect(fm).toMatchObject({ id: "trd_x", symbol: "MGCZ6", direction: "long", qty: 2, entry: 2650, exit: 2655.5, net: 107.52, R: 1.34, setup: "ORB", account: "Apex 50K", opened: "2026-11-25 14:31", closed: "2026-11-25 14:48", date: "2026-11-25" });
    expect(fm.tags).toEqual(["ledgr/trade", "a-setup"]);
    expect(Object.keys(fm)).toEqual([...TRADE_KEYS]);
  });
  it("links the day, setup, mistakes and tags, and shows the review", () => {
    const body = tradeBody(trade({ mistakes: ["Moved stop"] }), ctx);
    expect(body).toContain("[[LEDGR/Days/2026-11-25|2026-11-25]]");
    expect(body).toContain("[[LEDGR/Setups/ORB|ORB]]");
    expect(body).toContain("[[LEDGR/Mistakes/Moved stop|Moved stop]]");
    expect(body).toContain("[[LEDGR/Tags/a+ setup|a+ setup]]");
    expect(body).toContain("**What went well**\nPatient entry");
    expect(body).toContain("**Followed plan** Yes");
    expect(body).toContain("| Result | **+$107.52** · +1.34R · win |");
    expect(body).not.toContain("What went wrong");
  });
  it("can't be broken by a marker or '---' in the trader's LEDGR text", () => {
    const body = tradeBody(trade({ review: { wentWell: `fine\n${MARKER}\n---`, wentWrong: "", improve: "", learned: "", followedPlan: null } }), ctx);
    expect(body).not.toContain(MARKER);
    expect(body).not.toMatch(/^---$/m);
  });
});

describe("merging", () => {
  const fm = { id: "trd_1", net: 10 }, keys = ["id", "net"];
  it("creates a new note with the marker and an empty notes section", () => {
    const t = mergeNote(null, keys, fm, "# Body");
    expect(t).toBe(`---\nid: "trd_1"\nnet: 10\n---\n# Body\n\n${MARKER}\n## My notes\n\n`);
    expect(noteTradeId(t)).toBe("trd_1");
  });
  it("rewrites only LEDGR's part, keeping the trader's notes and frontmatter keys", () => {
    const first = mergeNote(null, keys, fm, "# Body");
    const edited = first.replace("---\n# Body", "mood: tired\nlinks:\n  - \"[[Plan]]\"\n---\n# Body").replace("## My notes\n\n", "## My notes\n\nI rushed this one.\n");
    const next = mergeNote(edited, keys, { id: "trd_1", net: 25 }, "# New body");
    expect(next).toContain("net: 25");
    expect(next).toContain("mood: tired\nlinks:\n  - \"[[Plan]]\"");
    expect(next).toContain("# New body");
    expect(next).not.toContain("# Body\n");
    expect(next.endsWith(`${MARKER}\n## My notes\n\nI rushed this one.\n`)).toBe(true);
    expect(splitFrontmatter(next).fm!.match(/^net:/gm)).toHaveLength(1);
  });
  it("is idempotent", () => {
    const a = mergeNote(null, keys, fm, "# Body"), b = mergeNote(a, keys, fm, "# Body"), c = mergeNote(b, keys, fm, "# Body");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });
  it("keeps everything when the trader deleted the marker", () => {
    const next = mergeNote("---\nid: x\n---\nMy whole note", keys, fm, "# Body");
    expect(next).toContain(`# Body\n\n${MARKER}\n`);
    expect(next).toContain("My whole note");
  });
});

describe("hub notes", () => {
  it("builds day, setup, mistake and tag notes with stats and links", () => {
    const a = trade({ id: "A", net: 100, r: 1, mistakes: ["Moved stop"] }), b = trade({ id: "B", net: -50, r: -0.5, setup: "VWAP", tags: [] }), c = trade({ id: "C", date: "2026-11-24", net: 20 });
    const paths = assignPaths([a, b, c], new Map(), new Set(), "LEDGR");
    const hubs = new Map(hubNotes([a, b, c], paths, ctx).map((h) => [h.path, h]));
    expect([...hubs.keys()].sort()).toEqual(["LEDGR/Days/2026-11-24.md", "LEDGR/Days/2026-11-25.md", "LEDGR/Mistakes/Moved stop.md", "LEDGR/Setups/ORB.md", "LEDGR/Setups/VWAP.md", "LEDGR/Tags/a+ setup.md"].sort());
    const day = hubs.get("LEDGR/Days/2026-11-25.md")!;
    expect(day.frontmatter).toMatchObject({ date: "2026-11-25", trades: 2, net: 50 });
    expect(day.body).toContain("**+$50.00** · 2 closed trades · win rate 50% · avg +0.25R");
    expect(day.body).toContain(`[[${paths.get("A")!.replace(".md", "")}|`);
    expect(hubs.get("LEDGR/Setups/ORB.md")!.frontmatter).toMatchObject({ setup: "ORB", trades: 2, net: 120 });
  });
});

describe("Home note", () => {
  it("only replaces the LEDGR section", () => {
    const home = homeNote("old").replace("## Focus this week\n-", "## Focus this week\n- Only A+ setups");
    const next = replaceRegion(home, "new stats")!;
    expect(next).toContain(`${REGION_START}\nnew stats\n${REGION_END}`);
    expect(next).toContain("Only A+ setups");
    expect(replaceRegion("no markers here", "x")).toBeNull();
  });
});

describe("syncing into a vault", () => {
  const app = () => new FakeApp();
  const today = "2026-11-25";

  it("creates the notes, then changes nothing on a second run", async () => {
    const A = app(), trades = [trade({ id: "A" }), trade({ id: "B", mistakes: ["FOMO"] })];
    const r1 = await syncNotes(A as unknown as App, trades, ctx, today);
    expect(r1.created).toBe(2 + 1 + 1 + 1 + 1); // 2 trades, day, setup, mistake, tag
    expect(A.files.has("LEDGR/Trades/2026-11-25 MGCZ6 Long ORB.md")).toBe(true);
    expect(A.files.has("LEDGR/Trades/2026-11-25 MGCZ6 Long ORB (2).md")).toBe(true);
    const writes = A.writes;
    const r2 = await syncNotes(A as unknown as App, trades, ctx, today);
    expect([r2.created, r2.updated]).toEqual([0, 0]);
    expect(A.writes).toBe(writes);
  });

  it("updates LEDGR's part, keeps the trader's notes, and finds notes the trader moved", async () => {
    const A = app(), t = trade({ id: "A" });
    await syncNotes(A as unknown as App, [t], ctx, today);
    const path = "LEDGR/Trades/2026-11-25 MGCZ6 Long ORB.md";
    A.files.set("Journal/renamed.md", A.files.get(path)!.replace("## My notes\n\n", "## My notes\n\nGreat patience.\n"));
    A.files.delete(path);
    const r = await syncNotes(A as unknown as App, [{ ...t, net: 200 }], ctx, today);
    expect(r.updated).toBeGreaterThan(0);
    expect(A.files.has(path)).toBe(false); // not recreated
    const text = A.files.get("Journal/renamed.md")!;
    expect(text).toContain("net: 200");
    expect(text).toContain("Great patience.");
  });

  it("marks notes of trades deleted in LEDGR instead of deleting them", async () => {
    const A = app();
    await syncNotes(A as unknown as App, [trade({ id: "A" }), trade({ id: "B" })], ctx, today);
    const r = await syncNotes(A as unknown as App, [trade({ id: "A" })], ctx, today);
    expect(r.deleted).toBe(1);
    expect(A.files.get("LEDGR/Trades/2026-11-25 MGCZ6 Long ORB (2).md")).toContain('status: "deleted in LEDGR"');
  });

  it("creates the starter vault without overwriting anything, and the sync refreshes Home", async () => {
    const A = app();
    A.files.set("LEDGR/Templates/Daily trading note.md", "my own template");
    const made = await createStarter(A as unknown as App, [], ctx, today);
    expect(made).toEqual(["Projects/", "Areas/", "Resources/", "Archive/", "LEDGR/Home.md"]);
    expect(A.files.get("LEDGR/Templates/Daily trading note.md")).toBe("my own template");
    await syncNotes(A as unknown as App, [trade({ id: "A" })], ctx, today);
    expect(A.files.get("LEDGR/Home.md")).toContain("[[LEDGR/Trades/2026-11-25 MGCZ6 Long ORB|2026-11-25 MGCZ6 long]] · +$107.52");
  });
});
