/** MatrixX helpers: where MatrixX lives, where "Sign in with MatrixX" returns, which model to use. Server only. */
export const MATRIXX_API = () => (process.env.MATRIXX_API_URL || "https://getmatrixx.com/v1").replace(/\/$/, "");
/** The MatrixX website (its /connect page): MATRIXX_SITE_URL, else the API address without /v1. */
export const MATRIXX_SITE = () => (process.env.MATRIXX_SITE_URL || MATRIXX_API().replace(/\/v1$/, "")).replace(/\/$/, "");
export const STATE_COOKIE = "ledgr_mx_state";
/** The same address in both steps: this site's own callback. */
export const callbackUrl = (req: Request) => `${new URL(req.url).origin}/api/matrixx/callback`;

interface MxModel { id?: unknown; free?: unknown; recommended?: unknown }
/** The plan's recommended model (MatrixX lists the ones its own app uses), else a free one, else the first. */
export function chooseModel(j: { data?: MxModel[]; recommended?: Record<string, unknown> } | null): string | null {
  const ids = (Array.isArray(j?.data) ? j!.data : []).filter((m) => typeof m?.id === "string");
  const rec = j?.recommended ?? {};
  for (const role of ["smart", "fast"]) {
    const list = rec[role];
    const hit = Array.isArray(list) ? list.find((x) => typeof x === "string" && ids.some((m) => m.id === x)) : undefined;
    if (typeof hit === "string") return hit;
  }
  const flagged = ids.find((m) => m.recommended === true) ?? ids.find((m) => m.free === true) ?? ids[0];
  return flagged ? String(flagged.id) : null;
}
