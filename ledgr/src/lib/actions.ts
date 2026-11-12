"use client";
import { blankTrade } from "./defaults";
import { deleteBlob, getState, setState } from "./store";
import type {
  Account, AIConversation, AIMessage, BalanceAdjustment, DailyJournal, FavouriteVerse, Goal, LedgrState, ReportDoc,
  SavedFilter, Settings, Strategy, StudyBoard, StudyFolder, StudyNote, Trade, WeeklyJournal,
} from "./types";
import { nowISO, today, uid } from "./util";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ValidationError extends Error {}

const finite = (n: unknown, field: string) => {
  if (n === null) return;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ValidationError(`${field} must be a number.`);
};

export function validateTrade(t: Trade) {
  if (t.symbol.length > 24) throw new ValidationError("Symbol must be 24 characters or fewer.");
  if (t.symbol && !/^[A-Za-z0-9.\-/_:! ]+$/.test(t.symbol)) throw new ValidationError("Symbol contains unsupported characters.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) throw new ValidationError("Date is invalid.");
  finite(t.pointValue, "Point value");
  if (t.pointValue <= 0) throw new ValidationError("Point value must be greater than zero.");
  finite(t.stopPrice, "Stop");
  finite(t.targetPrice, "Target");
  finite(t.plannedRisk, "Planned risk");
  finite(t.manualNet, "Net result");
  finite(t.fees, "Fees");
  if (t.fees < 0) throw new ValidationError("Fees cannot be negative.");
  for (const e of t.executions) {
    finite(e.price, "Execution price");
    finite(e.quantity, "Execution quantity");
    finite(e.fees, "Execution fees");
    if (e.quantity <= 0) throw new ValidationError("Execution quantity must be greater than zero.");
    if (e.price < 0) throw new ValidationError("Execution price cannot be negative.");
    if (Number.isNaN(new Date(e.time).getTime())) throw new ValidationError("Execution time is invalid.");
  }
  const entryQty = t.executions.filter((e) => e.kind === "entry").reduce((s, e) => s + e.quantity, 0);
  const exitQty = t.executions.filter((e) => e.kind === "exit").reduce((s, e) => s + e.quantity, 0);
  if (exitQty - entryQty > 1e-9) throw new ValidationError("Exited quantity cannot exceed entered quantity.");
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

function nextTradeNumber(s: LedgrState) {
  return s.trades.reduce((m, t) => Math.max(m, t.number), 0) + 1;
}

export function newTradeDraft(accountId?: string | null): Trade {
  const s = getState();
  const acct = accountId ?? s.accounts.find((a) => a.status === "active")?.id ?? null;
  return blankTrade(nextTradeNumber(s), acct);
}

function diffMessage(prev: Trade | undefined, next: Trade): string {
  if (!prev) return next.isDraft ? "Saved as draft" : "Trade logged";
  const changes: string[] = [];
  if (prev.isDraft && !next.isDraft) changes.push("completed draft");
  if (prev.executions.length !== next.executions.length) changes.push(`executions ${prev.executions.length} → ${next.executions.length}`);
  if (prev.symbol !== next.symbol) changes.push("symbol");
  if (JSON.stringify(prev.reflection) !== JSON.stringify(next.reflection)) changes.push("reflection");
  if (prev.emotions.join() !== next.emotions.join()) changes.push("psychology");
  if (prev.attachments.length !== next.attachments.length) changes.push("attachments");
  if (prev.grade !== next.grade) changes.push("grade");
  if (prev.manualNet !== next.manualNet) changes.push("net result");
  return changes.length ? `Edited: ${changes.join(", ")}` : "Edited";
}

export function saveTrade(t: Trade) {
  validateTrade(t);
  const before = getState().trades.find((x) => x.id === t.id);
  if (before) {
    const kept = new Set(t.attachments.map((a) => a.blobId));
    before.attachments.filter((a) => !kept.has(a.blobId)).forEach((a) => deleteBlob(a.blobId).catch(() => undefined));
  }
  setState((s) => {
    const prev = s.trades.find((x) => x.id === t.id);
    const at = nowISO();
    const next: Trade = { ...t, symbol: t.symbol.trim().toUpperCase(), updatedAt: at, activity: [...t.activity, { at, message: diffMessage(prev, t) }].slice(-50) };
    const setups = next.setup.trim() && !s.settings.setups.includes(next.setup.trim()) ? [...s.settings.setups, next.setup.trim()] : s.settings.setups;
    return {
      ...s,
      settings: { ...s.settings, setups },
      trades: prev ? s.trades.map((x) => (x.id === t.id ? next : x)) : [...s.trades, next],
    };
  });
}

export function patchTrade(id: string, patch: Partial<Trade>, message?: string) {
  setState((s) => ({
    ...s,
    trades: s.trades.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: nowISO(), activity: message ? [...t.activity, { at: nowISO(), message }].slice(-50) : t.activity } : t,
    ),
  }));
}

export async function deleteTrade(id: string) {
  const t = getState().trades.find((x) => x.id === id);
  setState((s) => ({ ...s, trades: s.trades.filter((x) => x.id !== id) }));
  if (t) await Promise.all([...t.attachments.map((a) => a.blobId), ...(t.showcase?.media ? [t.showcase.media.blobId] : [])].map((b) => deleteBlob(b).catch(() => undefined)));
}

export function duplicateTrade(id: string) {
  const s = getState();
  const t = s.trades.find((x) => x.id === id);
  if (!t) return null;
  const copy: Trade = { ...structuredClone(t), id: uid("trd"), number: nextTradeNumber(s), attachments: [], showcase: null, isDraft: true, activity: [{ at: nowISO(), message: `Duplicated from #${t.number}` }], createdAt: nowISO(), updatedAt: nowISO() };
  setState((st) => ({ ...st, trades: [...st.trades, copy] }));
  return copy.id;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function saveAccount(a: Account) {
  if (!a.name.trim()) throw new ValidationError("Account name is required.");
  if (a.name.length > 60) throw new ValidationError("Account name must be 60 characters or fewer.");
  if (!Number.isFinite(a.startingBalance) || a.startingBalance < 0) throw new ValidationError("Starting balance must be zero or more.");
  if (!/^[A-Z]{3}$/.test(a.currency)) throw new ValidationError("Currency must be a three-letter code, e.g. USD.");
  setState((s) => ({ ...s, accounts: s.accounts.some((x) => x.id === a.id) ? s.accounts.map((x) => (x.id === a.id ? a : x)) : [...s.accounts, a] }));
}

export function newAccount(): Account {
  return {
    id: uid("acc"), name: "", type: "Personal simulation", currency: getState().settings.baseCurrency, startingBalance: 10000, status: "active",
    color: "#F5F5F5", goals: "", rules: { profitTarget: null, maxDrawdown: null, dailyLossLimit: null, minTradingDays: null }, createdAt: nowISO(),
  };
}

export function setAccountStatus(id: string, status: Account["status"]) {
  setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, status } : a)) }));
}

export function deleteAccount(id: string) {
  const used = getState().trades.some((t) => t.accountId === id);
  if (used) throw new ValidationError("This account has trades. Archive it instead, or reassign its trades first.");
  setState((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id), adjustments: s.adjustments.filter((a) => a.accountId !== id) }));
}

export function saveAdjustment(a: BalanceAdjustment) {
  if (!Number.isFinite(a.amount) || a.amount === 0) throw new ValidationError("Enter a non-zero amount.");
  setState((s) => ({ ...s, adjustments: s.adjustments.some((x) => x.id === a.id) ? s.adjustments.map((x) => (x.id === a.id ? a : x)) : [...s.adjustments, a] }));
}

export function deleteAdjustment(id: string) {
  setState((s) => ({ ...s, adjustments: s.adjustments.filter((a) => a.id !== id) }));
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export function newStrategy(): Strategy {
  const t = nowISO();
  return { id: uid("str"), name: "", description: "", market: "", timeframe: "", entryCriteria: "", exitCriteria: "", confluences: [], invalidation: "", notes: "", screenshots: [], archived: false, createdAt: t, updatedAt: t };
}

export function saveStrategy(st: Strategy) {
  if (!st.name.trim()) throw new ValidationError("Strategy name is required.");
  const next = { ...st, name: st.name.trim(), updatedAt: nowISO() };
  setState((s) => ({ ...s, strategies: s.strategies.some((x) => x.id === st.id) ? s.strategies.map((x) => (x.id === st.id ? next : x)) : [...s.strategies, next] }));
}

export function deleteStrategy(id: string) {
  setState((s) => ({ ...s, strategies: s.strategies.filter((x) => x.id !== id), trades: s.trades.map((t) => (t.strategyId === id ? { ...t, strategyId: null } : t)) }));
}

// ---------------------------------------------------------------------------
// Journals
// ---------------------------------------------------------------------------

export function blankDaily(date: string): DailyJournal {
  return { id: uid("day"), date, pre: { intentions: "", learning: "", habits: "", avoid: "", reflectionPlan: "" }, post: { happened: "", learned: "", followedProcess: null, difficult: "", improve: "" }, mood: null, updatedAt: nowISO() };
}

export function saveDaily(j: DailyJournal) {
  const next = { ...j, updatedAt: nowISO() };
  setState((s) => ({ ...s, dailyJournals: s.dailyJournals.some((x) => x.date === j.date) ? s.dailyJournals.map((x) => (x.date === j.date ? next : x)) : [...s.dailyJournals, next] }));
}

export function deleteDaily(date: string) {
  setState((s) => ({ ...s, dailyJournals: s.dailyJournals.filter((x) => x.date !== date) }));
}

export function blankWeekly(weekStart: string): WeeklyJournal {
  return { id: uid("wk"), weekStart, reflection: "", progress: "", recurringMistakes: "", lessons: "", nextObjectives: [], updatedAt: nowISO() };
}

export function saveWeekly(w: WeeklyJournal) {
  const next = { ...w, updatedAt: nowISO() };
  setState((s) => ({ ...s, weeklyJournals: s.weeklyJournals.some((x) => x.weekStart === w.weekStart) ? s.weeklyJournals.map((x) => (x.weekStart === w.weekStart ? next : x)) : [...s.weeklyJournals, next] }));
}

// ---------------------------------------------------------------------------
// Checklist, goals, filters
// ---------------------------------------------------------------------------

export function toggleChecklist(date: string, itemId: string) {
  setState((s) => {
    const done = s.checklistLog[date] ?? [];
    return { ...s, checklistLog: { ...s.checklistLog, [date]: done.includes(itemId) ? done.filter((x) => x !== itemId) : [...done, itemId] } };
  });
}

/** Add focused study minutes to a day's total. */
export function addStudyMinutes(date: string, minutes: number) {
  if (!(minutes > 0)) return;
  setState((s) => ({ ...s, studyLog: { ...s.studyLog, [date]: Math.round(((s.studyLog?.[date] ?? 0) + minutes) * 10) / 10 } }));
}

export function saveGoal(g: Goal) {
  if (!g.title.trim()) throw new ValidationError("Goal title is required.");
  if (!(g.target > 0)) throw new ValidationError("Target must be greater than zero.");
  setState((s) => ({ ...s, goals: s.goals.some((x) => x.id === g.id) ? s.goals.map((x) => (x.id === g.id ? g : x)) : [...s.goals, g] }));
}

export function deleteGoal(id: string) {
  setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
}

export function saveFilter(f: SavedFilter) {
  setState((s) => ({ ...s, savedFilters: [...s.savedFilters.filter((x) => x.id !== f.id), f] }));
}

export function deleteFilter(id: string) {
  setState((s) => ({ ...s, savedFilters: s.savedFilters.filter((x) => x.id !== id) }));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function updateAppearance(patch: Partial<Settings["appearance"]>) {
  setState((s) => ({ ...s, settings: { ...s.settings, appearance: { ...s.settings.appearance, ...patch } } }));
}

export function dismissNotification(id: string) {
  setState((s) => ({ ...s, dismissedNotifications: [...s.dismissedNotifications, id] }));
}

// ---------------------------------------------------------------------------
// Verses
// ---------------------------------------------------------------------------

export function toggleFavourite(verseId: string) {
  setState((s) => {
    const exists = s.favouriteVerses.some((f) => f.verseId === verseId);
    const fav: FavouriteVerse = { verseId, reflection: "", savedAt: nowISO() };
    return { ...s, favouriteVerses: exists ? s.favouriteVerses.filter((f) => f.verseId !== verseId) : [...s.favouriteVerses, fav] };
  });
}

export function setVerseReflection(verseId: string, reflection: string) {
  setState((s) => {
    const exists = s.favouriteVerses.some((f) => f.verseId === verseId);
    return {
      ...s,
      favouriteVerses: exists
        ? s.favouriteVerses.map((f) => (f.verseId === verseId ? { ...f, reflection } : f))
        : [...s.favouriteVerses, { verseId, reflection, savedAt: nowISO() }],
    };
  });
}

export function recordVerseView(verseId: string, page: string) {
  const s = getState();
  const last = s.verseHistory[s.verseHistory.length - 1];
  const d = today();
  if (s.verseHistory.some((v) => v.verseId === verseId && v.at.slice(0, 10) === d)) return;
  if (last && last.verseId === verseId && last.page === page) return;
  setState((st) => ({ ...st, verseHistory: [...st.verseHistory, { verseId, page, at: nowISO() }].slice(-300) }));
}

// ---------------------------------------------------------------------------
// Study
// ---------------------------------------------------------------------------

export function saveFolder(f: StudyFolder) {
  if (!f.name.trim()) throw new ValidationError("Folder name is required.");
  setState((s) => ({ ...s, studyFolders: s.studyFolders.some((x) => x.id === f.id) ? s.studyFolders.map((x) => (x.id === f.id ? f : x)) : [...s.studyFolders, f] }));
}

export function deleteFolder(id: string) {
  const s = getState();
  if (s.studyNotes.some((n) => n.folderId === id)) throw new ValidationError("Move or delete the notes in this folder first.");
  setState((st) => ({ ...st, studyFolders: st.studyFolders.filter((f) => f.id !== id) }));
}

export function newNote(folderId: string): StudyNote {
  const t = nowISO();
  return { id: uid("note"), folderId, title: "Untitled note", blocks: [{ id: uid("b"), type: "paragraph", text: "" }], videoUrl: "", pinned: false, createdAt: t, updatedAt: t };
}

export function saveNote(n: StudyNote) {
  const next = { ...n, updatedAt: nowISO() };
  setState((s) => ({ ...s, studyNotes: s.studyNotes.some((x) => x.id === n.id) ? s.studyNotes.map((x) => (x.id === n.id ? next : x)) : [...s.studyNotes, next] }));
}

export async function deleteNote(id: string) {
  const n = getState().studyNotes.find((x) => x.id === id);
  setState((s) => ({ ...s, studyNotes: s.studyNotes.filter((x) => x.id !== id) }));
  if (n) await Promise.all(n.blocks.filter((b) => b.blobId).map((b) => deleteBlob(b.blobId!).catch(() => undefined)));
}

export function saveBoard(b: StudyBoard) {
  if (!b.name.trim()) throw new ValidationError("Board name is required.");
  setState((s) => ({ ...s, studyBoards: s.studyBoards.some((x) => x.id === b.id) ? s.studyBoards.map((x) => (x.id === b.id ? b : x)) : [...s.studyBoards, b] }));
}

export function deleteBoard(id: string) {
  setState((s) => ({ ...s, studyBoards: s.studyBoards.filter((x) => x.id !== id) }));
}

// ---------------------------------------------------------------------------
// AI conversations
// ---------------------------------------------------------------------------

export function newConversation(): AIConversation {
  const t = nowISO();
  const c: AIConversation = { id: uid("conv"), title: "New conversation", messages: [], createdAt: t, updatedAt: t };
  setState((s) => ({ ...s, conversations: [...s.conversations, c] }));
  return c;
}

export function appendMessage(convId: string, m: AIMessage) {
  setState((s) => ({
    ...s,
    conversations: s.conversations.map((c) =>
      c.id === convId
        ? { ...c, title: c.messages.length === 0 && m.role === "user" ? m.content.slice(0, 60) : c.title, messages: [...c.messages, m], updatedAt: nowISO() }
        : c,
    ),
  }));
}

export function deleteConversation(id: string) {
  setState((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== id) }));
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function saveReport(r: ReportDoc) {
  setState((s) => ({ ...s, reports: s.reports.some((x) => x.id === r.id) ? s.reports.map((x) => (x.id === r.id ? r : x)) : [...s.reports, r] }));
}

export function deleteReport(id: string) {
  setState((s) => ({ ...s, reports: s.reports.filter((x) => x.id !== id) }));
}
