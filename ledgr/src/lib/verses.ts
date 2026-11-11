/**
 * Ledgr verse library — King James Version (public domain).
 * Text is reproduced verbatim from the KJV. Only translations Ledgr is licensed to
 * display are enabled (see TRANSLATIONS). Never add paraphrases to this file.
 */

export type VerseTopic =
  | "Discipline" | "Patience" | "Wisdom" | "Honesty" | "Perseverance"
  | "Humility" | "Self-control" | "Planning" | "Faith" | "Responsibility" | "Reflection" | "Learning" | "Order";

export const TOPICS: VerseTopic[] = ["Discipline", "Patience", "Wisdom", "Honesty", "Perseverance", "Humility", "Self-control", "Planning", "Faith", "Responsibility", "Reflection", "Learning", "Order"];

export interface Verse {
  id: string;
  reference: string;
  text: string;
  topics: VerseTopic[];
  reflection: string;
}

export const TRANSLATIONS = [
  { code: "KJV", name: "King James Version", available: true, note: "Public domain" },
  { code: "ESV", name: "English Standard Version", available: false, note: "Requires a licence from Crossway" },
  { code: "NIV", name: "New International Version", available: false, note: "Requires a licence from Biblica" },
  { code: "NKJV", name: "New King James Version", available: false, note: "Requires a licence from Thomas Nelson" },
] as const;

export const VERSES: Verse[] = [
  { id: "PRO.16.3", reference: "Proverbs 16:3", topics: ["Planning", "Faith"], text: "Commit thy works unto the LORD, and thy thoughts shall be established.", reflection: "Begin with intention. Write the plan down before the session asks anything of you." },
  { id: "PRO.12.22", reference: "Proverbs 12:22", topics: ["Honesty"], text: "Lying lips are abomination to the LORD: but they that deal truly are his delight.", reflection: "A journal is only useful if it is true. Record what happened, not what you wish had happened." },
  { id: "JAS.1.5", reference: "James 1:5", topics: ["Wisdom"], text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.", reflection: "Numbers describe; understanding interprets. Ask honest questions of your records." },
  { id: "LUK.14.28", reference: "Luke 14:28", topics: ["Planning", "Responsibility"], text: "For which of you, intending to build a tower, sitteth not down first, and counteth the cost, whether he have sufficient to finish it?", reflection: "Know your limits before you begin. Every account deserves a plan and a ceiling." },
  { id: "PRO.14.29", reference: "Proverbs 14:29", topics: ["Patience", "Self-control"], text: "He that is slow to wrath is of great understanding: but he that is hasty of spirit exalteth folly.", reflection: "Haste rarely improves a decision. Notice the feeling before you act on it." },
  { id: "PRO.21.5", reference: "Proverbs 21:5", topics: ["Discipline", "Planning"], text: "The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want.", reflection: "A written strategy is a promise to your future self. Diligence keeps it." },
  { id: "PSA.90.12", reference: "Psalm 90:12", topics: ["Reflection", "Wisdom"], text: "So teach us to number our days, that we may apply our hearts unto wisdom.", reflection: "Each day is a page. Use it to learn something you can carry forward." },
  { id: "PRO.18.15", reference: "Proverbs 18:15", topics: ["Learning", "Wisdom"], text: "The heart of the prudent getteth knowledge; and the ear of the wise seeketh knowledge.", reflection: "Study is active. Seek knowledge on purpose and write down what you find." },
  { id: "PRO.15.22", reference: "Proverbs 15:22", topics: ["Wisdom", "Humility"], text: "Without counsel purposes are disappointed: but in the multitude of counsellors they are established.", reflection: "Invite a second view of your records — and weigh it with your own judgement." },
  { id: "GAL.6.9", reference: "Galatians 6:9", topics: ["Perseverance"], text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not.", reflection: "Progress is often invisible week to week. Keep doing the work well." },
  { id: "1CO.14.40", reference: "1 Corinthians 14:40", topics: ["Order"], text: "Let all things be done decently and in order.", reflection: "A well-ordered workspace makes clear thinking easier." },
  // Discipline
  { id: "HEB.12.11", reference: "Hebrews 12:11", topics: ["Discipline", "Perseverance"], text: "Now no chastening for the present seemeth to be joyous, but grievous: nevertheless afterward it yieldeth the peaceable fruit of righteousness unto them which are exercised thereby.", reflection: "Discipline rarely feels rewarding in the moment. Its fruit comes later." },
  { id: "1CO.9.27", reference: "1 Corinthians 9:27", topics: ["Discipline", "Self-control"], text: "But I keep under my body, and bring it into subjection: lest that by any means, when I have preached to others, I myself should be a castaway.", reflection: "Hold yourself to the rules you have written." },
  { id: "PRO.12.1", reference: "Proverbs 12:1", topics: ["Discipline", "Learning"], text: "Whoso loveth instruction loveth knowledge: but he that hateth reproof is brutish.", reflection: "Correction is information. Welcome it." },
  { id: "PRO.13.4", reference: "Proverbs 13:4", topics: ["Discipline", "Responsibility"], text: "The soul of the sluggard desireth, and hath nothing: but the soul of the diligent shall be made fat.", reflection: "Wanting to improve is not the same as doing the work. Finish today's entries." },
  { id: "PRO.6.6", reference: "Proverbs 6:6", topics: ["Discipline", "Wisdom"], text: "Go to the ant, thou sluggard; consider her ways, and be wise:", reflection: "Small, consistent effort compounds." },
  // Patience
  { id: "ECC.7.8", reference: "Ecclesiastes 7:8", topics: ["Patience", "Humility"], text: "Better is the end of a thing than the beginning thereof: and the patient in spirit is better than the proud in spirit.", reflection: "Judge the whole process, not the first few minutes of it." },
  { id: "JAS.1.19", reference: "James 1:19", topics: ["Patience", "Self-control"], text: "Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath:", reflection: "Listen to what your records are telling you before reacting." },
  { id: "ROM.12.12", reference: "Romans 12:12", topics: ["Patience", "Faith"], text: "Rejoicing in hope; patient in tribulation; continuing instant in prayer;", reflection: "Difficult stretches are part of every long road." },
  { id: "ISA.40.31", reference: "Isaiah 40:31", topics: ["Patience", "Perseverance", "Faith"], text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.", reflection: "Waiting well is a skill, not a weakness." },
  // Wisdom
  { id: "PRO.4.7", reference: "Proverbs 4:7", topics: ["Wisdom", "Learning"], text: "Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.", reflection: "Seek understanding of why, not only what." },
  { id: "PRO.1.5", reference: "Proverbs 1:5", topics: ["Wisdom", "Learning"], text: "A wise man will hear, and will increase learning; and a man of understanding shall attain unto wise counsels:", reflection: "The wise keep learning." },
  { id: "PRO.9.9", reference: "Proverbs 9:9", topics: ["Wisdom", "Learning", "Humility"], text: "Give instruction to a wise man, and he will be yet wiser: teach a just man, and he will increase in learning.", reflection: "Teachability is the beginning of growth." },
  { id: "PRO.19.20", reference: "Proverbs 19:20", topics: ["Wisdom", "Humility"], text: "Hear counsel, and receive instruction, that thou mayest be wise in thy latter end.", reflection: "Instruction received today becomes judgement tomorrow." },
  { id: "PRO.14.15", reference: "Proverbs 14:15", topics: ["Wisdom", "Planning"], text: "The simple believeth every word: but the prudent man looketh well to his going.", reflection: "Verify before you trust — including your own assumptions." },
  // Honesty
  { id: "PRO.11.1", reference: "Proverbs 11:1", topics: ["Honesty"], text: "A false balance is abomination to the LORD: but a just weight is his delight.", reflection: "Keep an honest ledger. Accurate records are a form of integrity." },
  { id: "PRO.10.9", reference: "Proverbs 10:9", topics: ["Honesty", "Responsibility"], text: "He that walketh uprightly walketh surely: but he that perverteth his ways shall be known.", reflection: "Integrity gives firm footing." },
  { id: "PRO.11.3", reference: "Proverbs 11:3", topics: ["Honesty"], text: "The integrity of the upright shall guide them: but the perverseness of transgressors shall destroy them.", reflection: "Let integrity, not impulse, guide the next decision." },
  { id: "LUK.16.10", reference: "Luke 16:10", topics: ["Honesty", "Responsibility"], text: "He that is faithful in that which is least is faithful also in much: and he that is unjust in the least is unjust also in much.", reflection: "Small records matter. Faithfulness is built in the details." },
  // Perseverance
  { id: "JAS.1.12", reference: "James 1:12", topics: ["Perseverance", "Faith"], text: "Blessed is the man that endureth temptation: for when he is tried, he shall receive the crown of life, which the Lord hath promised to them that love him.", reflection: "Endurance is formed in testing." },
  { id: "PHP.3.14", reference: "Philippians 3:14", topics: ["Perseverance"], text: "I press toward the mark for the prize of the high calling of God in Christ Jesus.", reflection: "Keep your eyes on the long-term aim." },
  { id: "ROM.5.3", reference: "Romans 5:3–4", topics: ["Perseverance", "Patience"], text: "And not only so, but we glory in tribulations also: knowing that tribulation worketh patience; And patience, experience; and experience, hope:", reflection: "Difficulty builds patience, patience builds experience." },
  // Humility
  { id: "PRO.11.2", reference: "Proverbs 11:2", topics: ["Humility", "Wisdom"], text: "When pride cometh, then cometh shame: but with the lowly is wisdom.", reflection: "Confidence is useful. Certainty is dangerous." },
  { id: "PRO.16.18", reference: "Proverbs 16:18", topics: ["Humility"], text: "Pride goeth before destruction, and an haughty spirit before a fall.", reflection: "Stay humble after a good week. That is when rules slip." },
  { id: "JAS.4.10", reference: "James 4:10", topics: ["Humility", "Faith"], text: "Humble yourselves in the sight of the Lord, and he shall lift you up.", reflection: "Humility keeps learning possible." },
  { id: "MIC.6.8", reference: "Micah 6:8", topics: ["Humility", "Responsibility"], text: "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?", reflection: "Act justly, show mercy — including to yourself after a mistake." },
  // Self-control
  { id: "PRO.16.32", reference: "Proverbs 16:32", topics: ["Self-control", "Patience"], text: "He that is slow to anger is better than the mighty; and he that ruleth his spirit than he that taketh a city.", reflection: "Mastery of self is the harder victory." },
  { id: "PRO.25.28", reference: "Proverbs 25:28", topics: ["Self-control"], text: "He that hath no rule over his own spirit is like a city that is broken down, and without walls.", reflection: "Rules are walls. Keep them standing." },
  { id: "GAL.5.22", reference: "Galatians 5:22–23", topics: ["Self-control", "Patience", "Faith"], text: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, Meekness, temperance: against such there is no law.", reflection: "Temperance and longsuffering are quiet strengths." },
  { id: "2TI.1.7", reference: "2 Timothy 1:7", topics: ["Self-control", "Faith"], text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.", reflection: "Decide from a sound mind, not from fear." },
  { id: "PRO.29.11", reference: "Proverbs 29:11", topics: ["Self-control", "Wisdom"], text: "A fool uttereth all his mind: but a wise man keepeth it in till afterwards.", reflection: "Let strong feelings settle before you act on them." },
  { id: "PRO.19.2", reference: "Proverbs 19:2", topics: ["Self-control", "Planning"], text: "Also, that the soul be without knowledge, it is not good; and he that hasteth with his feet sinneth.", reflection: "Haste without knowledge leads astray." },
  // Planning
  { id: "PRO.16.9", reference: "Proverbs 16:9", topics: ["Planning", "Faith"], text: "A man's heart deviseth his way: but the LORD directeth his steps.", reflection: "Plan carefully, hold outcomes loosely." },
  { id: "PRO.24.27", reference: "Proverbs 24:27", topics: ["Planning", "Discipline"], text: "Prepare thy work without, and make it fit for thyself in the field; and afterwards build thine house.", reflection: "Preparation comes before the session, not during it." },
  { id: "PRO.27.23", reference: "Proverbs 27:23", topics: ["Planning", "Responsibility"], text: "Be thou diligent to know the state of thy flocks, and look well to thy herds.", reflection: "Know the true state of every account you keep." },
  { id: "PRO.20.18", reference: "Proverbs 20:18", topics: ["Planning", "Wisdom"], text: "Every purpose is established by counsel: and with good advice make war.", reflection: "Plans improve when tested against good counsel." },
  { id: "PRO.4.26", reference: "Proverbs 4:26", topics: ["Planning", "Reflection"], text: "Ponder the path of thy feet, and let all thy ways be established.", reflection: "Review where your steps have taken you." },
  // Faith
  { id: "PRO.3.5", reference: "Proverbs 3:5–6", topics: ["Faith", "Humility"], text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.", reflection: "Your understanding is limited. Hold it with humility." },
  { id: "HEB.11.1", reference: "Hebrews 11:1", topics: ["Faith"], text: "Now faith is the substance of things hoped for, the evidence of things not seen.", reflection: "Some growth is unseen for a long time." },
  { id: "PSA.46.10", reference: "Psalm 46:10", topics: ["Faith", "Patience"], text: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.", reflection: "Stillness is a discipline. Step away when the mind is loud." },
  { id: "PHP.4.6", reference: "Philippians 4:6", topics: ["Faith", "Patience"], text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.", reflection: "Bring anxiety into the open rather than into the next decision." },
  { id: "MAT.6.34", reference: "Matthew 6:34", topics: ["Faith", "Patience"], text: "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.", reflection: "Today has enough to attend to." },
  // Responsibility
  { id: "COL.3.23", reference: "Colossians 3:23", topics: ["Responsibility", "Discipline"], text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;", reflection: "Do the unseen work — the journaling, the review — wholeheartedly." },
  { id: "GAL.6.5", reference: "Galatians 6:5", topics: ["Responsibility"], text: "For every man shall bear his own burden.", reflection: "Own your decisions, both the good and the poor ones." },
  { id: "PRO.22.29", reference: "Proverbs 22:29", topics: ["Responsibility", "Discipline"], text: "Seest thou a man diligent in his business? he shall stand before kings; he shall not stand before mean men.", reflection: "Diligence is noticed — first by yourself." },
  { id: "1CO.4.2", reference: "1 Corinthians 4:2", topics: ["Responsibility", "Honesty"], text: "Moreover it is required in stewards, that a man be found faithful.", reflection: "Be a faithful steward of what you have been given." },
  { id: "PRO.28.20", reference: "Proverbs 28:20", topics: ["Patience", "Humility", "Responsibility"], text: "A faithful man shall abound with blessings: but he that maketh haste to be rich shall not be innocent.", reflection: "Faithfulness over haste." },
  { id: "PRO.13.11", reference: "Proverbs 13:11", topics: ["Patience", "Discipline"], text: "Wealth gotten by vanity shall be diminished: but he that gathereth by labour shall increase.", reflection: "Steady labour outlasts shortcuts." },
  // Reflection
  { id: "LAM.3.40", reference: "Lamentations 3:40", topics: ["Reflection", "Humility"], text: "Let us search and try our ways, and turn again to the LORD.", reflection: "Examine your ways honestly, then turn and adjust." },
  { id: "PSA.139.23", reference: "Psalm 139:23", topics: ["Reflection", "Faith"], text: "Search me, O God, and know my heart: try me, and know my thoughts:", reflection: "Look beneath the decision to the thought that drove it." },
  { id: "ECC.3.1", reference: "Ecclesiastes 3:1", topics: ["Reflection", "Patience"], text: "To every thing there is a season, and a time to every purpose under the heaven:", reflection: "There is a time to act and a time to wait." },
  { id: "PRO.23.23", reference: "Proverbs 23:23", topics: ["Learning", "Honesty", "Wisdom"], text: "Buy the truth, and sell it not; also wisdom, and instruction, and understanding.", reflection: "Truth and understanding are worth keeping." },
];

export const VERSE_BY_ID = new Map(VERSES.map((v) => [v.id, v]));

export type PageKey =
  | "dashboard" | "journal" | "analytics" | "accounts" | "psychology" | "strategies"
  | "daily" | "study" | "ai" | "reports" | "settings" | "weekly" | "showcase" | "score" | "history" | "verses";

/** Page verses, fixed by the product brief. */
export const PAGE_VERSES: Record<PageKey, { verseId: string; theme: string }> = {
  dashboard: { verseId: "PRO.16.3", theme: "Commitment and intention" },
  journal: { verseId: "PRO.12.22", theme: "Honesty and integrity" },
  analytics: { verseId: "JAS.1.5", theme: "Wisdom and understanding" },
  accounts: { verseId: "LUK.14.28", theme: "Planning and preparation" },
  psychology: { verseId: "PRO.14.29", theme: "Patience and self-control" },
  strategies: { verseId: "PRO.21.5", theme: "Diligence and planning" },
  daily: { verseId: "PSA.90.12", theme: "Using time wisely" },
  study: { verseId: "PRO.18.15", theme: "Learning and understanding" },
  ai: { verseId: "PRO.15.22", theme: "Seeking wisdom and counsel" },
  reports: { verseId: "GAL.6.9", theme: "Perseverance" },
  settings: { verseId: "1CO.14.40", theme: "Order and organisation" },
  weekly: { verseId: "LAM.3.40", theme: "Examination and reflection" },
  showcase: { verseId: "PRO.11.1", theme: "Honest records" },
  score: { verseId: "HEB.12.11", theme: "The fruit of discipline" },
  history: { verseId: "PRO.27.23", theme: "Knowing the state of things" },
  verses: { verseId: "PRO.4.7", theme: "Getting understanding" },
};

export interface VerseContext {
  /** Today's daily journal exists and has both pre and post sections filled */
  journalIncomplete?: boolean;
  /** Emotions recorded today (trades or daily mood). Never P&L. */
  emotionsToday?: string[];
}

export interface VerseChoice {
  verse: Verse;
  reason: string;
}

/**
 * Context-aware selection. Inputs are process signals only (journal completeness,
 * self-recorded emotions). Profit and loss are deliberately not accepted.
 */
export function selectVerse(page: PageKey, ctx: VerseContext = {}): VerseChoice {
  const strained = (ctx.emotionsToday ?? []).some((e) => ["Frustrated", "Impatient", "Distracted"].includes(e));
  if ((page === "daily" || page === "dashboard" || page === "psychology") && strained) {
    const v = page === "psychology" ? VERSE_BY_ID.get("PRO.16.32")! : VERSE_BY_ID.get("PRO.14.29")!;
    return { verse: v, reason: "Shown because you recorded frustration, impatience or distraction today." };
  }
  if ((page === "daily" || page === "dashboard") && ctx.journalIncomplete) {
    return { verse: VERSE_BY_ID.get("PRO.13.4")!, reason: "Shown because today's journal is not complete yet." };
  }
  const p = PAGE_VERSES[page];
  return { verse: VERSE_BY_ID.get(p.verseId)!, reason: `Page verse · ${p.theme}` };
}

/** Deterministic verse of the day, rotating through the library by date. */
export function verseOfTheDay(date: string): Verse {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return VERSES[h % VERSES.length];
}
