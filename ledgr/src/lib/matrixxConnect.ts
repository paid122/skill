/** "Sign in with MatrixX": where MatrixX lives and where it sends people back. Server only. */
export const MATRIXX_API = () => (process.env.MATRIXX_API_URL || "https://getmatrixx.com/v1").replace(/\/$/, "");
/** The MatrixX website (its /connect page): MATRIXX_SITE_URL, else the API address without /v1. */
export const MATRIXX_SITE = () => (process.env.MATRIXX_SITE_URL || MATRIXX_API().replace(/\/v1$/, "")).replace(/\/$/, "");
export const STATE_COOKIE = "ledgr_mx_state";
/** The same address in both steps: this site's own callback. */
export const callbackUrl = (req: Request) => `${new URL(req.url).origin}/api/matrixx/callback`;
