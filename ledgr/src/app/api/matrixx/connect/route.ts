import { randomBytes } from "node:crypto";
import { MATRIXX_SITE, STATE_COOKIE, callbackUrl } from "@/lib/matrixxConnect";

export const dynamic = "force-dynamic";

/** Starts "Sign in with MatrixX": a one-time state in a cookie, then MatrixX's approval page. */
export async function GET(req: Request) {
  const state = randomBytes(18).toString("base64url");
  const url = `${MATRIXX_SITE()}/connect?${new URLSearchParams({ redirect_uri: callbackUrl(req), state })}`;
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/api/matrixx; Max-Age=600; HttpOnly; SameSite=Lax${secure}`, "Cache-Control": "no-store" },
  });
}
