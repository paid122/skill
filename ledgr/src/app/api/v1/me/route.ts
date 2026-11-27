import { apiJson, journalFor, keyAuth, preflight } from "@/lib/apiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/me: who this key belongs to, its plan, and what's in the journal. */
export async function GET(req: Request) {
  const a = await keyAuth(req);
  if (a instanceof Response) return a;
  const j = await journalFor(a.sb, a.key.user_id);
  return apiJson({
    key: { id: a.key.id, name: a.key.name },
    plan: { name: "LEDGR Pro", until: a.key.plan_source === "owner" ? null : a.key.pro_until },
    journal: j
      ? { displayName: j.state.settings?.displayName || null, currency: j.state.settings?.baseCurrency ?? "USD", accounts: j.state.accounts.length, trades: j.state.trades.length, syncedAt: j.syncedAt }
      : null,
  });
}

export const OPTIONS = preflight;
