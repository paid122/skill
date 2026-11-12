import type { TradeChart } from "./candles";
// Ledgr domain model. Every persisted entity lives here.
// All money values are in the owning account's currency and are simulated / historical records only.

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO timestamp

export type Direction = "long" | "short";
export type Market = "Forex" | "Futures" | "Stocks" | "Crypto" | "Indices" | "Options" | "Commodities" | "Other";
export const MARKETS: Market[] = ["Forex", "Futures", "Stocks", "Crypto", "Indices", "Options", "Commodities", "Other"];

export type Session = "Asia" | "London" | "New York" | "London/NY overlap" | "After hours" | "Other";
export const SESSIONS: Session[] = ["Asia", "London", "New York", "London/NY overlap", "After hours", "Other"];

export type Emotion = "Calm" | "Patient" | "Confident" | "Hesitant" | "Frustrated" | "Distracted" | "Impatient" | "Other";
export const EMOTIONS: Emotion[] = ["Calm", "Patient", "Confident", "Hesitant", "Frustrated", "Distracted", "Impatient", "Other"];
export const POSITIVE_EMOTIONS: Emotion[] = ["Calm", "Patient", "Confident"];
export const STRAINED_EMOTIONS: Emotion[] = ["Frustrated", "Impatient", "Distracted"];

export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";
export const GRADES: Grade[] = ["A+", "A", "B", "C", "D", "F"];
export const GRADE_POINTS: Record<Grade, number> = { "A+": 4.3, A: 4, B: 3, C: 2, D: 1, F: 0 };

export type PlanAdherence = "yes" | "partial" | "no";

export type ExecutionKind = "entry" | "exit";
export interface Execution {
  id: ID;
  kind: ExecutionKind;
  price: number;
  quantity: number;
  time: ISODateTime;
  fees: number;
  note?: string;
}

export interface TradeAttachment {
  id: ID;
  role: "before" | "after" | "additional";
  blobId: ID; // key in the attachment store
  name: string;
  annotation: string;
  createdAt: ISODateTime;
}

export interface TradeReflection {
  wentWell: string;
  improve: string;
  followedPlan: PlanAdherence | null;
  learned: string;
}

export interface ActivityEntry {
  at: ISODateTime;
  message: string;
}

export interface Trade {
  id: ID;
  number: number;
  accountId: ID | null;
  symbol: string;
  market: Market | null;
  direction: Direction | null;
  date: ISODate;
  session: Session | null;
  // Execution
  executions: Execution[];
  pointValue: number; // currency per 1.0 price move per unit (contract multiplier)
  stopPrice: number | null;
  targetPrice: number | null;
  plannedRisk: number | null; // explicit currency risk, overrides stop-derived risk
  manualNet: number | null; // used only when no executions are recorded
  fees: number; // trade-level fees (commissions not attached to an execution)
  strategyId: ID | null;
  setup: string;
  confluences: string[];
  grade: Grade | null;
  entryNotes: string;
  exitNotes: string;
  // Psychology
  emotions: Emotion[];
  emotionNote: string;
  mistakes: string[];
  // Reflection
  reflection: TradeReflection;
  attachments: TradeAttachment[];
  tags: string[];
  // Showcase
  showcase: {
    pinned: boolean;
    description: string;
    background: string;
    layout?: "classic" | "poster";
    media?: { blobId: ID; kind: "image" | "video"; dim: number; blur: number } | null;
    /** Real candles from a market-data provider, saved when the user loads them. */
    chart?: TradeChart | null;
    /** Optional custom market icon (an uploaded image). */
    icon?: ID | null;
  } | null;
  isDraft: boolean;
  /** Fingerprint of the CSV row(s) this trade was imported from; used to skip re-imports. */
  importKey?: string;
  activity: ActivityEntry[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AccountType = "Personal simulation" | "Hypothetical evaluation" | "Demo" | "Backtest";
export const ACCOUNT_TYPES: AccountType[] = ["Personal simulation", "Hypothetical evaluation", "Demo", "Backtest"];
export type AccountStatus = "active" | "paused" | "archived";

export interface AccountRules {
  profitTarget: number | null; // currency
  maxDrawdown: number | null; // currency, measured from peak balance
  dailyLossLimit: number | null; // currency
  minTradingDays: number | null;
}

export interface Account {
  id: ID;
  name: string;
  type: AccountType;
  currency: string;
  startingBalance: number;
  status: AccountStatus;
  color: string;
  goals: string;
  rules: AccountRules;
  createdAt: ISODateTime;
}

export interface BalanceAdjustment {
  id: ID;
  accountId: ID;
  date: ISODate;
  amount: number; // positive = virtual deposit, negative = virtual withdrawal
  note: string;
}

export interface Strategy {
  id: ID;
  name: string;
  description: string;
  market: string;
  timeframe: string;
  entryCriteria: string;
  exitCriteria: string;
  confluences: string[];
  invalidation: string;
  notes: string;
  screenshots: { id: ID; blobId: ID; name: string }[];
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DailyJournal {
  id: ID;
  date: ISODate;
  pre: { intentions: string; learning: string; habits: string; avoid: string; reflectionPlan: string };
  post: { happened: string; learned: string; followedProcess: PlanAdherence | null; difficult: string; improve: string };
  mood: Emotion | null;
  updatedAt: ISODateTime;
}

export interface WeeklyJournal {
  id: ID;
  weekStart: ISODate; // Monday
  reflection: string;
  progress: string;
  recurringMistakes: string;
  lessons: string;
  nextObjectives: string[];
  updatedAt: ISODateTime;
}

export type NoteBlockType = "heading" | "paragraph" | "bullet" | "numbered" | "check" | "quote" | "divider" | "image" | "link";
export interface NoteBlock {
  id: ID;
  type: NoteBlockType;
  text: string;
  checked?: boolean;
  level?: 1 | 2 | 3;
  url?: string;
  blobId?: ID;
}

export interface StudyFolder {
  id: ID;
  name: string;
  createdAt: ISODateTime;
}

export interface StudyNote {
  id: ID;
  folderId: ID;
  title: string;
  blocks: NoteBlock[];
  videoUrl: string;
  pinned: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BoardCardKind = "note" | "image" | "pdf" | "strategy" | "video" | "trade" | "text";
export interface BoardCard {
  id: ID;
  kind: BoardCardKind;
  refId: ID | null; // note / strategy / trade id
  blobId: ID | null; // image or pdf
  title: string;
  body: string;
  url: string;
  x: number;
  y: number;
  w: number;
}

export interface StudyBoard {
  id: ID;
  name: string;
  cards: BoardCard[];
  createdAt: ISODateTime;
}

export interface FavouriteVerse {
  verseId: string;
  reflection: string;
  savedAt: ISODateTime;
}

export interface VerseView {
  verseId: string;
  page: string;
  at: ISODateTime;
}

export interface Goal {
  id: ID;
  title: string;
  target: number;
  progress: number;
  unit: string;
  due: ISODate | null;
  createdAt: ISODateTime;
}

export interface ChecklistItem {
  id: ID;
  label: string;
}

export interface SavedFilter {
  id: ID;
  name: string;
  filter: TradeFilter;
}

export interface TradeFilter {
  q: string;
  accountId: ID | "all";
  market: Market | "all";
  direction: Direction | "all";
  result: "all" | "win" | "loss" | "breakeven" | "draft";
  setup: string | "all";
  session: Session | "all";
  emotion: Emotion | "all";
  from: ISODate | "";
  to: ISODate | "";
}

export interface AIMessage {
  id: ID;
  role: "user" | "assistant";
  content: string;
  citations: string[]; // trade ids / journal dates referenced
  mode?: "model" | "offline";
  at: ISODateTime;
}

export interface AIConversation {
  id: ID;
  title: string;
  messages: AIMessage[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReportDoc {
  id: ID;
  name: string;
  type: "trade" | "daily" | "weekly" | "monthly" | "strategy" | "overview";
  theme: string;
  refId: string | null; // trade id, date, strategy id
  stats: string[];
  reflection: string;
  font: "sans" | "serif";
  showLogo: boolean;
  showChart: boolean;
  createdAt: ISODateTime;
}

export type ThemeName = "midnight" | "onyx" | "platinum" | "light";
export interface Appearance {
  theme: ThemeName;
  accent: string;
  font: "inter" | "system" | "serif-accent";
  numberFormat: "en-US" | "en-GB" | "de-DE" | "fr-FR";
  positiveColor: string;
  negativeColor: string;
  density: "comfortable" | "compact";
  backgroundImage: string; // data URL or ""
  backgroundOpacity: number;
  sidebar: "solid" | "translucent";
  nav: "top" | "side"; // main navigation position
  cursor: "system" | "ring"; // optional trailing ring cursor
  savedThemes: { id: ID; name: string; values: Omit<Appearance, "savedThemes"> }[];
}

export interface InsightConfig {
  enabled: Record<string, boolean>;
  minSample: number;
}

export interface Settings {
  displayName: string;
  baseCurrency: string;
  breakevenThreshold: number; // |net| <= threshold counts as break-even
  translation: "KJV";
  checklist: ChecklistItem[];
  mistakeCategories: string[];
  setups: string[];
  confluenceLibrary: string[];
  weekStartsOn: 1;
  sidebarCollapsed: boolean;
  insights: InsightConfig;
  onboarded: boolean;
  appearance: Appearance;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  href: string;
}

export interface LedgrState {
  version: number;
  settings: Settings;
  accounts: Account[];
  adjustments: BalanceAdjustment[];
  trades: Trade[];
  strategies: Strategy[];
  dailyJournals: DailyJournal[];
  weeklyJournals: WeeklyJournal[];
  studyFolders: StudyFolder[];
  studyNotes: StudyNote[];
  studyBoards: StudyBoard[];
  favouriteVerses: FavouriteVerse[];
  verseHistory: VerseView[];
  goals: Goal[];
  checklistLog: Record<ISODate, string[]>; // completed checklist item ids per day
  studyLog: Record<ISODate, number>; // minutes of focused study per day
  savedFilters: SavedFilter[];
  conversations: AIConversation[];
  reports: ReportDoc[];
  dismissedNotifications: string[];
  sampleData: boolean;
}
