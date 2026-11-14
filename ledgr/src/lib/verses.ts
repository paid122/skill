/**
 * Ledgr verse library — Orthodox canon, public-domain English.
 * Old Testament: Brenton's English Septuagint (1851, public domain), with
 * Septuagint numbering (e.g. Psalm 38 = Psalm 39 in Hebrew-based Bibles).
 * New Testament: World English Bible (public domain).
 * Text is reproduced verbatim, including Brenton's [bracketed] supplied words.
 * Never add paraphrases to this file.
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
  { code: "LXX+WEB", name: "Orthodox — Brenton Septuagint (OT) and World English Bible (NT)", available: true, note: "Public domain" },
  { code: "OSB", name: "Orthodox Study Bible", available: false, note: "Requires a licence from Thomas Nelson" },
  { code: "EOB", name: "Eastern Orthodox Bible (NT)", available: false, note: "Requires a licence" },
] as const;

export const VERSES: Verse[] = [
  { id: "PSA.36.5", reference: "Psalm 36:5", topics: ["Planning", "Faith"], text: "Disclose thy way to the Lord, and hope in him; and he shall bring [it] to pass.", reflection: "Begin with intention. Write the plan down, then let the session come to you." },
  { id: "PRO.12.22", reference: "Proverbs 12:22", topics: ["Honesty"], text: "Lying lips are an abomination to the Lord; but he that deals faithfully is accepted with him.", reflection: "A journal is only useful if it is true. Record what happened, not what you wish had happened." },
  { id: "JAS.1.5", reference: "James 1:5", topics: ["Wisdom"], text: "But if any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.", reflection: "Numbers describe; understanding interprets. Ask honest questions of your records." },
  { id: "LUK.14.28", reference: "Luke 14:28", topics: ["Planning", "Responsibility"], text: "For which of you, desiring to build a tower, doesn’t first sit down and count the cost, to see if he has enough to complete it?", reflection: "Know your limits before you begin. Every account deserves a plan and a ceiling." },
  { id: "PRO.14.29", reference: "Proverbs 14:29", topics: ["Patience", "Self-control"], text: "A man slow to wrath abounds in wisdom: but a man of impatient spirit is very foolish.", reflection: "Haste rarely improves a decision. Notice the feeling before you act on it." },
  { id: "PRO.15.19", reference: "Proverbs 15:19", topics: ["Discipline", "Planning"], text: "The ways of sluggards are strewn with thorns; but those of the diligent are made smooth.", reflection: "A written strategy smooths the road. Diligence keeps it clear." },
  { id: "PSA.38.5", reference: "Psalm 38:5", topics: ["Reflection", "Wisdom"], text: "O Lord, make me to know mine end, and the number of my days, what it is; that I may know what I lack.", reflection: "Each day is a page. Notice what it shows you're still missing." },
  { id: "PRO.18.15", reference: "Proverbs 18:15", topics: ["Learning", "Wisdom"], text: "The heart of the sensible [man] purchases discretion; and the ears of the wise seek understanding.", reflection: "Study is active. Seek knowledge on purpose and write down what you find." },
  { id: "PRO.12.15", reference: "Proverbs 12:15", topics: ["Wisdom", "Humility"], text: "The ways of fools are right in their own eyes; but a wise man hearkens to counsels.", reflection: "Invite a second view of your records — and weigh it with your own judgement." },
  { id: "GAL.6.9", reference: "Galatians 6:9", topics: ["Perseverance"], text: "Let’s not be weary in doing good, for we will reap in due season if we don’t give up.", reflection: "Progress is often invisible week to week. Keep doing the work well." },
  { id: "1CO.14.40", reference: "1 Corinthians 14:40", topics: ["Order"], text: "Let all things be done decently and in order.", reflection: "A well-ordered workspace makes clear thinking easier." },
  // Discipline
  { id: "HEB.12.11", reference: "Hebrews 12:11", topics: ["Discipline", "Perseverance"], text: "All chastening seems for the present to be not joyous but grievous; yet afterward it yields the peaceful fruit of righteousness to those who have been trained by it.", reflection: "Discipline rarely feels rewarding in the moment. Its fruit comes later." },
  { id: "1CO.9.27", reference: "1 Corinthians 9:27", topics: ["Discipline", "Self-control"], text: "but I beat my body and bring it into submission, lest by any means, after I have preached to others, I myself should be disqualified.", reflection: "Hold yourself to the rules you have written." },
  { id: "PRO.12.1", reference: "Proverbs 12:1", topics: ["Discipline", "Learning"], text: "He that loves instruction loves sense, but he that hates reproofs is a fool.", reflection: "Correction is information. Welcome it." },
  { id: "PRO.13.4", reference: "Proverbs 13:4", topics: ["Discipline", "Responsibility"], text: "Every slothful man desires, but the hands of the active are diligent.", reflection: "Wanting to improve is not the same as doing the work. Finish today's entries." },
  { id: "PRO.6.6", reference: "Proverbs 6:6", topics: ["Discipline", "Wisdom"], text: "Go to the ant, O sluggard; and see, and emulate his ways, and become wiser than he.", reflection: "Small, consistent effort compounds." },
  // Patience
  { id: "ECC.7.8", reference: "Ecclesiastes 7:8", topics: ["Patience", "Humility"], text: "The end of a matter is better than the beginning thereof: the patient is better than the high-minded.", reflection: "Judge the whole process, not the first few minutes of it." },
  { id: "JAS.1.19", reference: "James 1:19", topics: ["Patience", "Self-control"], text: "So, then, my beloved brothers, let every man be swift to hear, slow to speak, and slow to anger;", reflection: "Listen to what your records are telling you before reacting." },
  { id: "ROM.12.12", reference: "Romans 12:12", topics: ["Patience", "Faith"], text: "rejoicing in hope, enduring in troubles, continuing steadfastly in prayer,", reflection: "Difficult stretches are part of every long road." },
  { id: "ISA.40.31", reference: "Isaiah 40:31", topics: ["Patience", "Perseverance", "Faith"], text: "but they that wait on God shall renew [their] strength; they shall put forth new feathers like eagles; they shall run, and not be weary; they shall walk, and not hunger.", reflection: "Waiting well is a skill, not a weakness." },
  // Wisdom
  { id: "PRO.9.6", reference: "Proverbs 9:6", topics: ["Wisdom", "Learning"], text: "Leave folly, that ye may reign for ever; and seek wisdom, and improve understanding by knowledge.", reflection: "Seek understanding of why, not only what." },
  { id: "PRO.1.5", reference: "Proverbs 1:5", topics: ["Wisdom", "Learning"], text: "For by the hearing of these a wise man will be wiser, and the man of understanding will gain direction;", reflection: "The wise keep learning." },
  { id: "PRO.9.9", reference: "Proverbs 9:9", topics: ["Wisdom", "Learning", "Humility"], text: "Give an opportunity to a wise [man], and he will be wiser: instruct a just man, and he will receive more [instruction].", reflection: "Teachability is the beginning of growth." },
  { id: "PRO.19.20", reference: "Proverbs 19:20", topics: ["Wisdom", "Humility"], text: "Hear, son, the instruction of thy father, that thou mayest be wise at thy latter end.", reflection: "Instruction received today becomes judgement tomorrow." },
  { id: "PRO.14.15", reference: "Proverbs 14:15", topics: ["Wisdom", "Planning"], text: "The simple believes every word: but the prudent man betakes himself to after-thought.", reflection: "Verify before you trust — including your own assumptions." },
  // Honesty
  { id: "PRO.11.1", reference: "Proverbs 11:1", topics: ["Honesty"], text: "False balances are an abomination before the Lord: but a just weight is acceptable unto him.", reflection: "Keep an honest ledger. Accurate records are a form of integrity." },
  { id: "PRO.10.9", reference: "Proverbs 10:9", topics: ["Honesty", "Responsibility"], text: "He that walks simply, walks confidently; but he that perverts his ways shall be known.", reflection: "Integrity gives firm footing." },
  { id: "PRO.12.17", reference: "Proverbs 12:17", topics: ["Honesty"], text: "A righteous man declares the open truth; but an unjust witness is deceitful.", reflection: "Record what actually happened, not what you wish had." },
  { id: "LUK.16.10", reference: "Luke 16:10", topics: ["Honesty", "Responsibility"], text: "He who is faithful in a very little is faithful also in much. He who is dishonest in a very little is also dishonest in much.", reflection: "Small records matter. Faithfulness is built in the details." },
  // Perseverance
  { id: "JAS.1.12", reference: "James 1:12", topics: ["Perseverance", "Faith"], text: "Blessed is a person who endures temptation, for when he has been approved, he will receive the crown of life which the Lord promised to those who love him.", reflection: "Endurance is formed in testing." },
  { id: "PHP.3.14", reference: "Philippians 3:14", topics: ["Perseverance"], text: "I press on toward the goal for the prize of the high calling of God in Christ Jesus.", reflection: "Keep your eyes on the long-term aim." },
  { id: "ROM.5.3", reference: "Romans 5:3–4", topics: ["Perseverance", "Patience"], text: "Not only this, but we also rejoice in our sufferings, knowing that suffering produces perseverance; and perseverance, proven character; and proven character, hope;", reflection: "Difficulty builds patience, patience builds experience." },
  // Humility
  { id: "PRO.11.2", reference: "Proverbs 11:2", topics: ["Humility", "Wisdom"], text: "Wherever pride enters, there will be also disgrace: but the mouth of the lowly meditates wisdom.", reflection: "Confidence is useful. Certainty is dangerous." },
  { id: "PRO.16.18", reference: "Proverbs 16:18", topics: ["Humility"], text: "Pride goes before destruction, and folly before a fall.", reflection: "Stay humble after a good week. That is when rules slip." },
  { id: "JAS.4.10", reference: "James 4:10", topics: ["Humility", "Faith"], text: "Humble yourselves in the sight of the Lord, and he will exalt you.", reflection: "Humility keeps learning possible." },
  { id: "MIC.6.8", reference: "Micah 6:8", topics: ["Humility", "Responsibility"], text: "Has it [not] been told thee, O man, what [is] good? or what does the Lord require of thee, but to do justice, and love mercy, and be ready to walk with the Lord thy God?", reflection: "Act justly, show mercy — including to yourself after a mistake." },
  // Self-control
  { id: "PRO.16.32", reference: "Proverbs 16:32", topics: ["Self-control", "Patience"], text: "A man slow to anger is better than a strong [man]; and he that governs [his] temper better than he that takes a city.", reflection: "Mastery of self is the harder victory." },
  { id: "PRO.13.3", reference: "Proverbs 13:3", topics: ["Self-control"], text: "He that keeps his own mouth keeps his own life: but he that is hasty with his lips shall bring terror upon himself.", reflection: "Rules are walls. Keep them standing, and keep impulse behind them." },
  { id: "GAL.5.22", reference: "Galatians 5:22–23", topics: ["Self-control", "Patience", "Faith"], text: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith, gentleness, and self-control. Against such things there is no law.", reflection: "Temperance and longsuffering are quiet strengths." },
  { id: "2TI.1.7", reference: "2 Timothy 1:7", topics: ["Self-control", "Faith"], text: "For God didn’t give us a spirit of fear, but of power, love, and self-control.", reflection: "Decide from a sound mind, not from fear." },
  { id: "PRO.29.11", reference: "Proverbs 29:11", topics: ["Self-control", "Wisdom"], text: "A fool utters all his mind: but the wise reserves his in part.", reflection: "Let strong feelings settle before you act on them." },
  { id: "PRO.17.27", reference: "Proverbs 17:27", topics: ["Self-control", "Patience"], text: "He that forbears to utter a hard word is discreet, and a patient man is wise.", reflection: "Pause before you act. Patience is part of the edge." },
  // Planning
  { id: "PRO.19.21", reference: "Proverbs 19:21", topics: ["Planning", "Faith"], text: "[There are] many thoughts in a man's heart; but the counsel of the Lord abides for ever.", reflection: "Plan carefully, hold outcomes loosely." },
  { id: "PRO.24.27", reference: "Proverbs 24:27", topics: ["Planning", "Discipline"], text: "Prepare thy works for [thy] going forth, and prepare thyself for the field; and come after me, and thou shalt rebuild thine house.", reflection: "Preparation comes before the session, not during it." },
  { id: "PRO.27.23", reference: "Proverbs 27:23", topics: ["Planning", "Responsibility"], text: "Do thou thoroughly know the number of thy flock, and pay attention to thine herds.", reflection: "Know the true state of every account you keep." },
  { id: "PRO.11.14", reference: "Proverbs 11:14", topics: ["Planning", "Wisdom"], text: "They that have no guidance fall like leaves: but in much counsel there is safety.", reflection: "Plans improve when tested against good counsel." },
  { id: "PRO.4.26", reference: "Proverbs 4:26", topics: ["Planning", "Reflection"], text: "Make straight paths for thy feet, and order thy ways aright.", reflection: "Review where your steps have taken you." },
  // Faith
  { id: "PRO.3.5", reference: "Proverbs 3:5–6", topics: ["Faith", "Humility"], text: "Trust in God with all thine heart; and be not exalted in thine own wisdom. In all thy ways acquaint thyself with her, that she may rightly direct thy paths.", reflection: "Your understanding is limited. Hold it with humility." },
  { id: "HEB.11.1", reference: "Hebrews 11:1", topics: ["Faith"], text: "Now faith is assurance of things hoped for, proof of things not seen.", reflection: "Some growth is unseen for a long time." },
  { id: "PSA.45.11", reference: "Psalm 45:11", topics: ["Faith", "Patience"], text: "Be still, and know that I am God: I will be exalted among the nations, I will be exalted in the earth.", reflection: "Stillness is a discipline. Step away when the mind is loud." },
  { id: "PHP.4.6", reference: "Philippians 4:6", topics: ["Faith", "Patience"], text: "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.", reflection: "Bring anxiety into the open rather than into the next decision." },
  { id: "MAT.6.34", reference: "Matthew 6:34", topics: ["Faith", "Patience"], text: "Therefore don’t be anxious for tomorrow, for tomorrow will be anxious for itself. Each day’s own evil is sufficient.", reflection: "Today has enough to attend to." },
  // Responsibility
  { id: "COL.3.23", reference: "Colossians 3:23", topics: ["Responsibility", "Discipline"], text: "And whatever you do, work heartily, as for the Lord and not for men,", reflection: "Do the unseen work — the journaling, the review — wholeheartedly." },
  { id: "GAL.6.5", reference: "Galatians 6:5", topics: ["Responsibility"], text: "For each man will bear his own burden.", reflection: "Own your decisions, both the good and the poor ones." },
  { id: "PRO.22.29", reference: "Proverbs 22:29", topics: ["Responsibility", "Discipline"], text: "It is fit that an observant man and [one] diligent in his business should attend on kings, and not attend on slothful men.", reflection: "Diligence is noticed — first by yourself." },
  { id: "1CO.4.2", reference: "1 Corinthians 4:2", topics: ["Responsibility", "Honesty"], text: "Here, moreover, it is required of stewards that they be found faithful.", reflection: "Be a faithful steward of what you have been given." },
  { id: "PRO.28.6", reference: "Proverbs 28:6", topics: ["Honesty", "Humility"], text: "A poor man walking in truth is better than a rich liar.", reflection: "An honest record is worth more than a flattering one." },
  { id: "PRO.13.11", reference: "Proverbs 13:11", topics: ["Patience", "Discipline"], text: "Wealth gotten hastily with iniquity is diminished: but he that gathers for himself with godliness shall be increased. The righteous is merciful, and lends.", reflection: "Steady labour outlasts shortcuts." },
  // Reflection
  { id: "LAM.3.40", reference: "Lamentations 3:40", topics: ["Reflection", "Humility"], text: "Our way has been searched out and examined, and we will turn to the Lord.", reflection: "Examine your ways honestly, then turn and adjust." },
  { id: "PSA.138.23", reference: "Psalm 138:23–24", topics: ["Reflection", "Faith"], text: "Prove me, O God, and know my heart; examine me, and know my paths; and see if [there is any] way of iniquity in me, and lead me in an everlasting way.", reflection: "Look beneath the decision to the thought that drove it." },
  { id: "ECC.3.1", reference: "Ecclesiastes 3:1", topics: ["Reflection", "Patience"], text: "To all things there is a time, and a season for every matter under heaven.", reflection: "There is a time to act and a time to wait." },
  { id: "PRO.22.21", reference: "Proverbs 22:21", topics: ["Learning", "Honesty"], text: "I therefore teach thee truth, and knowledge good to hear; that thou mayest answer words of truth to them that question thee.", reflection: "Learn the truth of your records so you can answer for every trade." },
];

/** Ids used before the switch to the Septuagint, mapped to their replacements. */
export const LEGACY_VERSE_IDS: Record<string, string> = { "PRO.16.3": "PSA.36.5", "PRO.21.5": "PRO.15.19", "PSA.90.12": "PSA.38.5", "PRO.15.22": "PRO.12.15", "PRO.4.7": "PRO.9.6", "PRO.11.3": "PRO.12.17", "PRO.25.28": "PRO.13.3", "PRO.19.2": "PRO.17.27", "PRO.16.9": "PRO.19.21", "PRO.20.18": "PRO.11.14", "PSA.46.10": "PSA.45.11", "PRO.28.20": "PRO.28.6", "PSA.139.23": "PSA.138.23", "PRO.23.23": "PRO.22.21" };

const NT_BOOKS = new Set(["MAT", "MAR", "LUK", "JOH", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD", "REV"]);

/** Short source label for a verse: Septuagint (Old Testament) or World English Bible (New Testament). */
export function verseSource(v: Verse): "LXX" | "WEB" {
  return NT_BOOKS.has(v.id.split(".")[0]) ? "WEB" : "LXX";
}

export const SCRIPTURE_ATTRIBUTION = "Old Testament from Brenton's English Septuagint (1851); New Testament from the World English Bible. Both are in the public domain.";

export const VERSE_BY_ID = new Map(VERSES.map((v) => [v.id, v]));

export type PageKey =
  | "dashboard" | "journal" | "analytics" | "accounts" | "psychology" | "strategies"
  | "daily" | "study" | "ai" | "reports" | "settings" | "weekly" | "showcase" | "score" | "history" | "verses";

/** Page verses, fixed by the product brief. */
export const PAGE_VERSES: Record<PageKey, { verseId: string; theme: string }> = {
  dashboard: { verseId: "PSA.36.5", theme: "Commitment and intention" },
  journal: { verseId: "PRO.12.22", theme: "Honesty and integrity" },
  analytics: { verseId: "JAS.1.5", theme: "Wisdom and understanding" },
  accounts: { verseId: "LUK.14.28", theme: "Planning and preparation" },
  psychology: { verseId: "PRO.14.29", theme: "Patience and self-control" },
  strategies: { verseId: "PRO.15.19", theme: "Diligence and planning" },
  daily: { verseId: "PSA.38.5", theme: "Knowing the measure of your days" },
  study: { verseId: "PRO.18.15", theme: "Learning and understanding" },
  ai: { verseId: "PRO.12.15", theme: "Seeking wisdom and counsel" },
  reports: { verseId: "GAL.6.9", theme: "Perseverance" },
  settings: { verseId: "1CO.14.40", theme: "Order and organisation" },
  weekly: { verseId: "LAM.3.40", theme: "Examination and reflection" },
  showcase: { verseId: "PRO.11.1", theme: "Honest records" },
  score: { verseId: "HEB.12.11", theme: "The fruit of discipline" },
  history: { verseId: "PRO.27.23", theme: "Knowing the state of things" },
  verses: { verseId: "PRO.9.6", theme: "Seeking understanding" },
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
