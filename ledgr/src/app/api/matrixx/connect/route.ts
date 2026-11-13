import { randomBytes } from "node:crypto";
import { BACK_COOKIE, MATRIXX_SITE, STATE_COOKIE, callbackUrl, safeBack } from "@/lib/matrixxConnect";

export const dynamic = "force-dynamic";

/** Starts "Sign in with MatrixX": a one-time state in a cookie, then MatrixX's approval page. */
export async function GET(req: Request) {
  const state = randomBytes(18).toString("base64url");
  const url = `${MATRIXX_SITE()}/connect?${new URLSearchParams({ redirect_uri: callbackUrl(req), state })}`;
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  const back = safeBack(new URL(req.url).searchParams.get("back"));
  const headers = new Headers({ Location: url, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `${STATE_COOKIE}=${state}; Path=/api/matrixx; Max-Age=600; HttpOnly; SameSite=Lax${secure}`);
  headers.append("Set-Cookie", `${BACK_COOKIE}=${encodeURIComponent(back)}; Path=/api/matrixx; Max-Age=600; HttpOnly; SameSite=Lax${secure}`);
  return new Response(null, { status: 302, headers });
}
