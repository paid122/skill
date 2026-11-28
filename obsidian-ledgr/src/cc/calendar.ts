/**
 * The economic calendar, from LEDGR (GET /api/v1/calendar), replacing the prototype's Forex Factory download.
 *
 * Expected answer (proposed; the endpoint isn't built yet, see the README):
 *   { events: [{ title, country, date, impact: "High"|"Medium"|"Low"|"Holiday", forecast?, previous? }],
 *     updatedAt: ISO string, source?: { name, url } }
 * Until it exists LEDGR answers 404, and the command center shows "calendar not connected".
 */
import { IMP, type CalEvent } from "./logic";

export interface RawEvent { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string }
export interface CalendarAnswer { events: RawEvent[]; updatedAt?: string; source?: { name: string; url: string } }

export type CalendarState =
  | { kind: "ok"; events: CalEvent[]; updatedAt: string | null; source: { name: string; url: string } | null; stale: boolean }
  | { kind: "missing" } // LEDGR doesn't serve a calendar yet
  | { kind: "error"; message: string };

export function toEvents(a: CalendarAnswer): CalEvent[] {
  return (a.events ?? [])
    .map((e) => ({ ...e, title: String(e.title ?? ""), country: String(e.country ?? "").toUpperCase(), t: new Date(e.date), i: IMP[e.impact] ?? 0 }))
    .filter((e) => !isNaN(+e.t))
    .sort((a, b) => +a.t - +b.t);
}
