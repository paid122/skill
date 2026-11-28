/** Development only: mounts the command center in a plain page with sample data (see compare.cjs). */
import "./shim";
import { CommandCenter, type CcSettings } from "../../src/cc/app";
import { toEvents } from "../../src/cc/calendar";

const H = (window as unknown as { HARNESS: { trades: never[]; calendar: { events: never[]; updatedAt: string }; tz: string; name: string } }).HARNESS;
const settings: CcSettings = { timezone: H.tz, symbol: "AUTO", sound: true, intro: (window as unknown as { INTRO?: boolean }).INTRO ?? false, tvWidgets: true, notesFolder: "LEDGR", notesAuto: 0, ownWindow: true };
const mem: Record<string, unknown> = {};
const cc = new CommandCenter(document.getElementById("view")!, {
  settings: () => settings,
  setSound: () => undefined,
  store: { get: (k, d) => (k in mem ? (mem[k] as typeof d) : d), set: (k, v) => { mem[k] = v; } },
  name: () => H.name,
  cached: () => null,
  sync: async () => ({ ok: true, trades: H.trades, at: Date.now() }),
  calendar: async () => ({ kind: "ok", events: toEvents(H.calendar), updatedAt: H.calendar.updatedAt, source: null, stale: false }),
  videoUrl: async () => "operator.mp4",
  openSettings: () => undefined,
  openVaultHome: () => undefined,
  ask: async () => null,
});
cc.mount();
(window as unknown as { cc: CommandCenter }).cc = cc;
