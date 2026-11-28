import { adminClient } from "@/lib/ownerServer";
import { apiError, apiJson, preflight } from "@/lib/apiServer";
import { cleanClient, CODE_TTL_S, deviceHash, ipLimited, newDeviceCode, newUserCode, POLL_INTERVAL_S } from "@/lib/deviceConnect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = "https://www.ledgrjournal.app";

/**
 * POST /api/v1/device/code { client: "Obsidian" } → start "Connect with LEDGR".
 * Answers { device_code (keep secret), user_code, verification_uri, verification_uri_complete, expires_in, interval }.
 */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return apiError(503, "unavailable", "Connect with LEDGR isn't set up on this server yet.");
  if (ipLimited(req)) return apiError(429, "rate_limited", "Too many connection attempts. Try again in a few minutes.");
  const body = (await req.json().catch(() => ({}))) as { client?: unknown };
  const device = newDeviceCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const user = newUserCode();
    const { error } = await sb.from("device_codes").insert({ device_hash: deviceHash(device), user_code: user, client: cleanClient(body.client), expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString() });
    if (!error) {
      // Old codes are cleared as new ones are made.
      void sb.from("device_codes").delete().lt("expires_at", new Date(Date.now() - 24 * 3600e3).toISOString()).then(() => undefined);
      return apiJson({ device_code: device, user_code: user, verification_uri: `${SITE}/connect`, verification_uri_complete: `${SITE}/connect?code=${user}`, expires_in: CODE_TTL_S, interval: POLL_INTERVAL_S });
    }
    if (!/duplicate|unique/i.test(error.message)) return apiError(500, "server_error", "Couldn't start the connection. Did you run 0008_device_connect.sql in Supabase?");
  }
  return apiError(500, "server_error", "Couldn't start the connection. Try again.");
}

export const OPTIONS = preflight;
