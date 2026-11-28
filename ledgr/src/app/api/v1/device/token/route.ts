import { adminClient } from "@/lib/ownerServer";
import { apiError, apiJson, hashKey, MAX_KEYS, newKey, preflight, shownPrefix } from "@/lib/apiServer";
import { deviceHash } from "@/lib/deviceConnect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row { id: string; client: string; status: string; user_id: string | null; plan_source: "owner" | "matrixx" | null; pro_until: string | null; expires_at: string }

/**
 * POST /api/v1/device/token { device_code } → the app's API key, once the user approved.
 * While waiting: 428 authorization_pending. Then: 200 { key, name }, or 403 access_denied, 410 expired_token.
 * Single use: the key is handed out once.
 */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return apiError(503, "unavailable", "Connect with LEDGR isn't set up on this server yet.");
  const body = (await req.json().catch(() => ({}))) as { device_code?: unknown };
  const code = typeof body.device_code === "string" ? body.device_code.trim() : "";
  if (!code || code.length > 100) return apiError(400, "invalid_request", "Send the device_code from /device/code.");
  const { data: row } = await sb.from("device_codes").select("id, client, status, user_id, plan_source, pro_until, expires_at").eq("device_hash", deviceHash(code)).maybeSingle<Row>();
  if (!row) return apiError(400, "invalid_grant", "Unknown code. Start again.");
  if (row.status === "denied") return apiError(403, "access_denied", "The connection was declined.");
  if (row.status === "used") return apiError(400, "invalid_grant", "This code was already used. Start again.");
  if (Date.parse(row.expires_at) < Date.now()) return apiError(410, "expired_token", "The code expired. Start again.");
  if (row.status !== "approved" || !row.user_id || !row.plan_source) return apiError(428, "authorization_pending", "Waiting for you to approve in LEDGR.");

  // Claim the approval once, then make the key.
  const { data: claimed } = await sb.from("device_codes").update({ status: "used" }).eq("id", row.id).eq("status", "approved").select("id");
  if (!claimed?.length) return apiError(400, "invalid_grant", "This code was already used. Start again.");
  const { count } = await sb.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", row.user_id).is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) return apiError(409, "too_many_keys", `You already have ${MAX_KEYS} API keys. Revoke one in LEDGR → Settings → API, then connect again.`);
  const key = newKey();
  const { data: k, error } = await sb.from("api_keys")
    .insert({ user_id: row.user_id, name: row.client, prefix: shownPrefix(key), key_hash: hashKey(key), plan_source: row.plan_source, pro_until: row.pro_until })
    .select("id").single();
  if (error || !k) return apiError(500, "server_error", "Couldn't create the key. Start again.");
  await sb.from("device_codes").update({ key_id: k.id }).eq("id", row.id);
  return apiJson({ key, name: row.client });
}

export const OPTIONS = preflight;
