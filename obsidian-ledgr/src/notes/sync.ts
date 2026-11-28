/**
 * Writes trades into the vault as notes (see build.ts for the format). Idempotent: notes are found by the trade's
 * LEDGR id in their frontmatter (wherever the user moved them), unchanged notes aren't rewritten, and text below
 * "<!-- your notes -->" is never touched. Trades deleted in LEDGR keep their note, marked as deleted.
 */
import { normalizePath, TFile, type App } from "obsidian";
import { assignPaths, HUB_KEYS, hubNotes, mergeNote, paths, TRADE_KEYS, tradeBody, tradeFrontmatter, type Ctx, type PublicTrade } from "./build";
import { dailyTemplate, homeNote, homePath, homeRegion, PARA, replaceRegion, templatePath } from "./starter";

export interface NoteSyncResult { created: number; updated: number; unchanged: number; deleted: number; trades: number }

export async function ensureFolder(app: App, path: string) {
  const parts = normalizePath(path).split("/");
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join("/");
    if (!app.vault.getAbstractFileByPath(p)) await app.vault.createFolder(p).catch(() => undefined);
  }
}

/** Every LEDGR trade note in the vault, by trade id (found by frontmatter, so moved or renamed notes still match). */
export function findTradeNotes(app: App): Map<string, TFile> {
  const out = new Map<string, TFile>();
  for (const f of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    if (fm && typeof fm.id === "string" && typeof fm.ledgr === "string" && fm.ledgr.startsWith("https://www.ledgrjournal.app/journal/")) out.set(fm.id, f);
  }
  return out;
}

async function write(app: App, path: string, next: (old: string | null) => string, r: NoteSyncResult) {
  const p = normalizePath(path);
  const f = app.vault.getAbstractFileByPath(p);
  if (f instanceof TFile) {
    const old = await app.vault.read(f);
    const text = next(old);
    if (text === old) { r.unchanged++; return; }
    await app.vault.modify(f, text);
    r.updated++;
  } else {
    await ensureFolder(app, p.split("/").slice(0, -1).join("/"));
    await app.vault.create(p, next(null));
    r.created++;
  }
}

export async function syncNotes(app: App, trades: PublicTrade[], c: Ctx, today: string): Promise<NoteSyncResult> {
  const r: NoteSyncResult = { created: 0, updated: 0, unchanged: 0, deleted: 0, trades: trades.length };
  const found = findTradeNotes(app);
  const existing = new Map(Array.from(found, ([id, f]) => [id, f.path]));
  const taken = new Set(app.vault.getFiles().map((f) => f.path));
  const notePath = assignPaths(trades, existing, taken, c.root);
  for (const folder of Object.values(paths(c.root)).filter((v) => typeof v === "string") as string[]) await ensureFolder(app, folder);

  for (const t of trades) {
    await write(app, notePath.get(t.id)!, (old) => mergeNote(old, TRADE_KEYS, tradeFrontmatter(t, c), tradeBody(t, c)), r);
  }

  // Trades no longer in LEDGR: keep the note (it may hold the user's notes), mark it.
  const ids = new Set(trades.map((t) => t.id));
  for (const [id, f] of found) {
    if (ids.has(id)) continue;
    let changed = false;
    await app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => { if (fm.status !== "deleted in LEDGR") { fm.status = "deleted in LEDGR"; changed = true; } });
    if (changed) r.deleted++;
  }

  for (const h of hubNotes(trades, notePath, c)) await write(app, h.path, (old) => mergeNote(old, HUB_KEYS, h.frontmatter, h.body, ""), r);

  // The Home note's LEDGR section, if the user has the starter Home note.
  const home = app.vault.getAbstractFileByPath(normalizePath(homePath(c.root)));
  if (home instanceof TFile) {
    const old = await app.vault.read(home);
    const text = replaceRegion(old, homeRegion(trades, notePath, c, today));
    if (text !== null && text !== old) await app.vault.modify(home, text);
  }
  return r;
}

/** Creates the starter vault: PARA folders, Home dashboard, daily template. Never overwrites an existing file. */
export async function createStarter(app: App, trades: PublicTrade[], c: Ctx, today: string): Promise<string[]> {
  const made: string[] = [];
  for (const p of PARA) if (!app.vault.getAbstractFileByPath(p)) { await app.vault.createFolder(p).catch(() => undefined); made.push(`${p}/`); }
  const notePath = assignPaths(trades, new Map(Array.from(findTradeNotes(app), ([id, f]) => [id, f.path])), new Set(app.vault.getFiles().map((f) => f.path)), c.root);
  for (const [path, text] of [[homePath(c.root), homeNote(homeRegion(trades, notePath, c, today))], [templatePath(c.root), dailyTemplate(c.root)]] as [string, string][]) {
    const p = normalizePath(path);
    if (app.vault.getAbstractFileByPath(p)) continue;
    await ensureFolder(app, p.split("/").slice(0, -1).join("/"));
    await app.vault.create(p, text);
    made.push(p);
  }
  return made;
}
