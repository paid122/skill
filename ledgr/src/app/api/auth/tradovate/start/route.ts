import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl, tradovateMissing } from "@/lib/tradovate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1: send the user to Tradovate's own sign-in page. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const missing = tradovateMissing();
  if (missing.length) {
    const msg = `Tradovate sign-in isn't set up on this copy of Ledgr yet (missing ${missing.join(", ")}).`;
    return NextResponse.redirect(`${origin}/auth/callback?error_description=${encodeURIComponent(msg)}`);
  }
  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(origin, state));
  res.cookies.set("ledgr_tv_state", state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/api/auth/tradovate", maxAge: 600 });
  return res;
}
