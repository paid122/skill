/** What the calendar parts say when there's no calendar to show. */
import type { CalendarState } from "./calendar";

export function calendarText(s: CalendarState) {
  if (s.kind === "error") return {
    ticker: "ECONOMIC CALENDAR · OFFLINE · couldn't load this week's events",
    list: `Couldn't load the calendar: ${s.message}`,
    checklist: " (calendar offline)",
  };
  return {
    ticker: "ECONOMIC CALENDAR · NOT CONNECTED YET",
    list: "The economic calendar isn't connected yet. It will load here from LEDGR once it's available.",
    checklist: " (calendar not connected)",
  };
}
