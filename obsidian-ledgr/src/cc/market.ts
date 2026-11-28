/** CME Globex hours (US Eastern time), as in the prototype: Sun 18:00 → Fri 17:00 with a daily 17:00–18:00 break. */
import { fmtDur } from "./logic";

export function etParts(now = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
  const o: Record<string, string> = {};
  f.forEach((p) => (o[p.type] = p.value));
  return { d: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), h: (+o.hour % 24) + +o.minute / 60 };
}

export function cmeOpen(now = new Date()) {
  const { d, h } = etParts(now);
  if (d === 6) return false;
  if (d === 0) return h >= 18;
  if (d === 5) return h < 17;
  return !(h >= 17 && h < 18);
}

export function cmeNext(now = new Date()) {
  const { d, h } = etParts(now);
  let mins: number;
  if (cmeOpen(now)) {
    mins = ((d === 5 ? 17 : h < 17 ? 17 : 41) - h) * 60;
    if (d !== 5 && h >= 18) mins = (24 - h + 17) * 60;
    return "Daily break in " + fmtDur(mins);
  }
  if (d === 6 || (d === 5 && h >= 17)) mins = (d === 5 ? 24 - h + 24 + 18 : 24 - h + 18) * 60;
  else mins = (18 - h) * 60;
  return "Opens in " + fmtDur(mins);
}
