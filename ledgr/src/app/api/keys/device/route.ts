import { MAX_KEYS, proFor, sessionUser } from "@/lib/apiServer";
import { normalizeUserCode } from "@/lib/deviceConnect";
import { adminClient } from "@/lib/ownerServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The approval page's side of "Connect with LEDGR" (ledgrjournal.app/connect). Needs the person's LEDGR session.
 *   GET  ?code=K7QX-3MRT → which app is asking, and whether the code is still valid
 *   POST { code, action: "approve" | "deny" } → approving checks LEDGR Pro (owners free)
 */
async function lookup(req: Request, raw: string | null) {
  const sb = adminClient();
  if (!sb) return { error: Response.json({ error: "Connect with LEDGR isn't set up on this server yet." }, { status: 503 }) };
  const user = await sessionUser(req, sb);
  if (!user) return { error: Response.json({ error: "Sign in to LEDGR first." }, { status: 401 }) };
  const code = normalizeUserCode(raw ?? "");
  if (!code) return { error: Response.json({ error: "That code doesn't look right. It has 8 letters and numbers, like K7QX-3MRT." }, { status: 400 }) };
  const { data: row } = await sb.from("device_codes").select("id, client, status, expires_at").eq("user_code", code).maybeSingle<{ id: string; client: string; status: string; expires_at: string }>();
  if (!row || Date.parse(row.expires_at) < Date.now()) return { error: Response.json({ error: "This code expired or doesn't exist. Start again in the app." }, { status: 404 }) };
  if (row.status !== "pending") return { error: Response.json({ error: "This code was already used." }, { status: 409 }) };
  return { sb, user, row, code };
}

export async function GET(req: Request) {
  const r = await lookup(req, new URL(req.url).searchParams.get("code"));
  if ("error" in r) return r.error;
  return Response.json({ client: r.row.client, code: r.code, expiresAt: r.row.expires_at });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: string; action?: string };
  const r = await lookup(req, body.code ?? null);
  if ("error" in r) return r.error;
  if (body.action === "deny") {
    await r.sb.from("device_codes").update({ status: "denied", decided_at: new Date().toISOString() }).eq("id", r.row.id).eq("status", "pending");
    return Response.json({ ok: true, status: "denied" });
  }
  if (body.action !== "approve") return Response.json({ error: "Approve or deny?" }, { status: 400 });
  const pro = await proFor(req, r.user);
  if (!pro.ok) return Response.json({ error: pro.message }, { status: 402 });
  const { count } = await r.sb.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", r.user.id).is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) return Response.json({ error: `You already have ${MAX_KEYS} API keys. Revoke one in Settings → API first.` }, { status: 400 });
  const { data } = await r.sb.from("device_codes")
    .update({ status: "approved", user_id: r.user.id, plan_source: pro.source, pro_until: pro.until, decided_at: new Date().toISOString() })
    .eq("id", r.row.id).eq("status", "pending").select("id");
  if (!data?.length) return Response.json({ error: "This code was already used." }, { status: 409 });
  return Response.json({ ok: true, status: "approved", client: r.row.client });
}
