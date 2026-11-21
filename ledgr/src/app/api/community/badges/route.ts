import { adminClient, ownerEmails } from "@/lib/ownerServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Community badges: which user ids are LEDGR's owner and co-owners, from LEDGR_OWNER_EMAILS
 * (first email = Owner). Worked out on the server, so nobody can give themselves the tag.
 * Only confirmed accounts count. Cached for 10 minutes.
 */
let cache: { at: number; badges: Record<string, "Owner" | "Co-owner"> } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 10 * 60_000) return Response.json({ badges: cache.badges }, { headers: { "Cache-Control": "public, max-age=300" } });
  const sb = adminClient();
  const emails = ownerEmails();
  const badges: Record<string, "Owner" | "Co-owner"> = {};
  if (sb && emails.length) {
    for (let page = 1; page <= 20 && Object.keys(badges).length < emails.length; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users.length) break;
      for (const u of data.users) {
        const i = u.email ? emails.indexOf(u.email.toLowerCase()) : -1;
        if (i >= 0 && u.email_confirmed_at) badges[u.id] = i === 0 ? "Owner" : "Co-owner";
      }
      if (data.users.length < 1000) break;
    }
  }
  cache = { at: Date.now(), badges };
  return Response.json({ badges }, { headers: { "Cache-Control": "public, max-age=300" } });
}
