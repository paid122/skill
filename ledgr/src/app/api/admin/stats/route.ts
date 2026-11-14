import { clientIp, limited } from "@/lib/aiServer";
import { adminClient, ownerEmails, ownerFor } from "@/lib/ownerServer";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const day = (iso: string) => iso.slice(0, 10);

/** The owner dashboard's numbers. Only for the emails in LEDGR_OWNER_EMAILS, signed in and confirmed. */
export async function GET(req: Request) {
  if (limited(`admin:${clientIp(req)}`, 30)) return Response.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  const sb = adminClient();
  if (!sb || !ownerEmails().length) {
    return Response.json({ error: "not_configured", missing: [...(!sb ? ["SUPABASE_SERVICE_ROLE_KEY"] : []), ...(!ownerEmails().length ? ["LEDGR_OWNER_EMAILS"] : [])] }, { status: 503 });
  }
  const who = await ownerFor(req, sb);
  if (who === "signed-out") return Response.json({ error: "signed_out" }, { status: 401 });
  if (who === "not-owner") return Response.json({ error: "not_owner" }, { status: 403 });

  // every account (1,000 per page)
  type U = { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null; app_metadata?: { provider?: string; providers?: string[] } };
  const users: U[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return Response.json({ error: `Supabase: ${error.message}` }, { status: 502 });
    users.push(...(data.users as U[]));
    if (data.users.length < 1000) break;
  }
  const now = Date.now();
  const since = (iso: string | null | undefined, days: number) => !!iso && now - Date.parse(iso) <= days * DAY;
  const providers = (u: U) => u.app_metadata?.providers ?? (u.app_metadata?.provider ? [u.app_metadata.provider] : []);

  // sign-ups per day, last 30 days
  const perDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) perDay.set(day(new Date(now - i * DAY).toISOString()), 0);
  for (const u of users) { const d = day(u.created_at); if (perDay.has(d)) perDay.set(d, perDay.get(d)! + 1); }

  // journals and trades (needs migration 0003; without it, journals are counted the simple way)
  let journals: { journals: number; trades: number | null; journals_with_trades: number | null; synced_7d: number | null; synced_30d: number | null };
  const rpc = await sb.rpc("ledgr_owner_stats");
  if (!rpc.error && rpc.data) journals = rpc.data as typeof journals;
  else {
    const { count } = await sb.from("user_snapshots").select("user_id", { count: "exact", head: true });
    journals = { journals: count ?? 0, trades: null, journals_with_trades: null, synced_7d: null, synced_30d: null };
  }

  const [reviews, signups] = await Promise.all([
    sb.from("reviews").select("id, display_name, rating, title, status, created_at").order("created_at", { ascending: false }).limit(20),
    sb.from("site_signups").select("kind, name, email, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return Response.json({
    you: who,
    owners: ownerEmails().map((e, i) => ({ email: e, role: i === 0 ? "Owner" : "Co-owner" })),
    users: {
      total: users.length,
      new1d: users.filter((u) => since(u.created_at, 1)).length,
      new7d: users.filter((u) => since(u.created_at, 7)).length,
      new30d: users.filter((u) => since(u.created_at, 30)).length,
      active1d: users.filter((u) => since(u.last_sign_in_at, 1)).length,
      active7d: users.filter((u) => since(u.last_sign_in_at, 7)).length,
      active30d: users.filter((u) => since(u.last_sign_in_at, 30)).length,
      google: users.filter((u) => providers(u).includes("google")).length,
      email: users.filter((u) => providers(u).includes("email")).length,
      unconfirmed: users.filter((u) => !u.email_confirmed_at).length,
      perDay: [...perDay].map(([d, n]) => ({ day: d, count: n })),
      recent: [...users].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15)
        .map((u) => ({ email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, provider: providers(u)[0] ?? "", confirmed: !!u.email_confirmed_at })),
    },
    journals,
    reviews: { pending: (reviews.data ?? []).filter((r) => r.status === "pending").length, recent: reviews.data ?? [] },
    signups: signups.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
