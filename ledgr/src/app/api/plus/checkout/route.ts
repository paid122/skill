import { limited, clientIp } from "@/lib/aiServer";
import { PLUS, PRO } from "@/lib/plus";
import { callMatrixx, customerKey } from "@/lib/plusServer";

export const dynamic = "force-dynamic";

/** Opens the card payment (Ziina, through MatrixX) for LEDGR+ or LEDGR Pro: 30 days of the matching MatrixX plan. */
export async function POST(req: Request) {
  if (limited(`plus:${clientIp(req)}`, 10)) return Response.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const plan = body?.plan === "pro" ? PRO : PLUS;
  const origin = new URL(req.url).origin;
  return callMatrixx("/apps/checkout", customerKey(req), {
    tier: plan.matrixxTier, price_usd: plan.priceUsd, name: plan.name,
    return_url: `${origin}/plus`, cancel_url: `${origin}/plus?cancelled=1`,
  });
}
