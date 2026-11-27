import { hashKey, MAX_KEYS, newKey, proFor, sessionUser, shownPrefix } from "@/lib/apiServer";
import { adminClient } from "@/lib/ownerServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The app's side of API keys (Settings → API). Every call needs the person's LEDGR session
 * (Authorization: Bearer <Supabase access token>); creating and refreshing also check LEDGR Pro.
 *   GET     list your keys (never the key itself)
 *   POST    { name } → create a key; the full key is in this answer only
 *   PATCH   re-check LEDGR Pro and switch your keys back on after renewing
 *   DELETE  ?id=… → revoke a key
 */
const COLS = "id, name, prefix, plan_source, pro_until, created_at, last_used_at";

async function who(req: Request) {
  const sb = adminClient();
  if (!sb) return { error: Response.json({ error: "The LEDGR API isn't set up on this server yet." }, { status: 503 }) };
  const user = await sessionUser(req, sb);
  if (!user) return { error: Response.json({ error: "Sign in to LEDGR first." }, { status: 401 }) };
  return { sb, user };
}

export async function GET(req: Request) {
  const w = await who(req);
  if ("error" in w) return w.error;
  const { data, error } = await w.sb.from("api_keys").select(COLS).eq("user_id", w.user.id).is("revoked_at", null).order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Could not load your keys." }, { status: 500 });
  return Response.json({ keys: data });
}

export async function POST(req: Request) {
  const w = await who(req);
  if ("error" in w) return w.error;
  const pro = await proFor(req, w.user);
  if (!pro.ok) return Response.json({ error: pro.message }, { status: 402 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 40) || "API key";
  const { count } = await w.sb.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", w.user.id).is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) return Response.json({ error: `You can have up to ${MAX_KEYS} keys. Revoke one first.` }, { status: 400 });
  const key = newKey();
  const { data, error } = await w.sb.from("api_keys")
    .insert({ user_id: w.user.id, name, prefix: shownPrefix(key), key_hash: hashKey(key), plan_source: pro.source, pro_until: pro.until })
    .select(COLS).single();
  if (error) return Response.json({ error: "Could not create the key. Did you run 0007_api_keys.sql in Supabase?" }, { status: 500 });
  return Response.json({ key, info: data });
}

export async function PATCH(req: Request) {
  const w = await who(req);
  if ("error" in w) return w.error;
  const pro = await proFor(req, w.user);
  if (!pro.ok) return Response.json({ error: pro.message }, { status: 402 });
  await w.sb.from("api_keys").update({ plan_source: pro.source, pro_until: pro.until }).eq("user_id", w.user.id).is("revoked_at", null);
  return Response.json({ ok: true, source: pro.source, until: pro.until });
}

export async function DELETE(req: Request) {
  const w = await who(req);
  if ("error" in w) return w.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Which key?" }, { status: 400 });
  const { error } = await w.sb.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", w.user.id);
  if (error) return Response.json({ error: "Could not revoke the key." }, { status: 500 });
  return Response.json({ ok: true });
}
