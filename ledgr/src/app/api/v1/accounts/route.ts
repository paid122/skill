import { apiJson, journalFor, keyAuth, NO_JOURNAL, preflight } from "@/lib/apiServer";
import { publicAccount } from "@/lib/apiTrade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/accounts: every account with its balance, P&L and drawdown. ?status=active|paused|archived */
export async function GET(req: Request) {
  const a = await keyAuth(req);
  if (a instanceof Response) return a;
  const j = await journalFor(a.sb, a.key.user_id);
  if (!j) return NO_JOURNAL();
  const status = new URL(req.url).searchParams.get("status");
  const accounts = j.state.accounts.filter((x) => !status || x.status === status).map((x) => publicAccount(x, j.trades, j.state.adjustments));
  return apiJson({ accounts, syncedAt: j.syncedAt });
}

export const OPTIONS = preflight;
