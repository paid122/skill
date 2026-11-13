import { limited, clientIp } from "@/lib/aiServer";
import { PLUS } from "@/lib/plus";
import { callMatrixx, customerKey } from "@/lib/plusServer";

export const dynamic = "force-dynamic";

/** Opens the card payment (Ziina, through MatrixX) for LEDGR+: 30 days of MatrixX Starter. */
export async function POST(req: Request) {
  if (limited(`plus:${clientIp(req)}`, 10)) return Response.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  const origin = new URL(req.url).origin;
  return callMatrixx("/apps/checkout", customerKey(req), {
    tier: PLUS.matrixxTier, price_usd: PLUS.priceUsd, name: PLUS.name,
    return_url: `${origin}/plus`, cancel_url: `${origin}/plus?cancelled=1`,
  });
}
