import { NextResponse, type NextRequest } from "next/server";
import { identityFromCode, signInTokenFor } from "@/lib/tradovate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 2: Tradovate sends the user back here with a one-time code. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (msg: string) => {
    const res = NextResponse.redirect(`${origin}/auth/callback?error_description=${encodeURIComponent(msg)}`);
    res.cookies.delete({ name: "ledgr_tv_state", path: "/api/auth/tradovate" });
    return res;
  };
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return fail(`Tradovate: ${err}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("ledgr_tv_state")?.value;
  if (!code) return fail("Tradovate didn't send a sign-in code. Try again.");
  if (!expected || state !== expected) return fail("This sign-in link expired or didn't start here. Try again.");
  try {
    const id = await identityFromCode(code, origin);
    const tokenHash = await signInTokenFor(id);
    const res = NextResponse.redirect(`${origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&via=tradovate`);
    res.cookies.delete({ name: "ledgr_tv_state", path: "/api/auth/tradovate" });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Tradovate sign-in failed.");
  }
}
