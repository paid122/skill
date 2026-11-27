import { apiError, apiJson, journalFor, keyAuth, NO_JOURNAL, pickTrades, preflight } from "@/lib/apiServer";
import { parseApiTrade, publicTrade, type ApiTradeInput } from "@/lib/apiTrade";
import { chronological } from "@/lib/calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/trades: your trades, newest first, with net P&L, R and the review.
 *   ?from=&to=&account=&symbol=&status=open|closed|draft&limit=100 (max 500)&offset=0
 */
export async function GET(req: Request) {
  const a = await keyAuth(req);
  if (a instanceof Response) return a;
  const j = await journalFor(a.sb, a.key.user_id);
  if (!j) return NO_JOURNAL();
  const url = new URL(req.url);
  const { list, error } = pickTrades(j, url);
  if (error) return error;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const sorted = chronological(list).reverse();
  return apiJson({
    trades: sorted.slice(offset, offset + limit).map((x) => publicTrade(x, j.state.strategies)),
    total: sorted.length, limit, offset, syncedAt: j.syncedAt,
  });
}

const MAX_BATCH = 50;
const MAX_PENDING = 1000;

/**
 * POST /api/v1/trades: send in one trade (a JSON object) or up to 50 (an array, or { trades: [...] }).
 * They're added to the journal the next time LEDGR is open. Send externalId to avoid duplicates.
 */
export async function POST(req: Request) {
  const a = await keyAuth(req);
  if (a instanceof Response) return a;
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return apiError(400, "bad_json", "The body must be JSON.");
  const items: unknown[] = Array.isArray(body) ? body : Array.isArray(body?.trades) ? body.trades : [body];
  if (!items.length) return apiError(400, "empty", "Send at least one trade.");
  if (items.length > MAX_BATCH) return apiError(400, "too_many", `Send up to ${MAX_BATCH} trades at a time.`);

  const j = await journalFor(a.sb, a.key.user_id);
  if (!j) return NO_JOURNAL();
  const { count } = await a.sb.from("api_trade_inbox").select("id", { count: "exact", head: true }).eq("user_id", a.key.user_id);
  if ((count ?? 0) + items.length > MAX_PENDING) return apiError(429, "inbox_full", `${count} trades are waiting to be added. Open LEDGR so they're added, then send more.`);

  const parsed: ApiTradeInput[] = [];
  for (let i = 0; i < items.length; i++) {
    try { parsed.push(parseApiTrade(items[i] as Record<string, unknown>, j.state.accounts)); }
    catch (e) { return apiError(400, "invalid_trade", items.length > 1 ? `Trade ${i + 1}: ${(e as Error).message}` : (e as Error).message); }
  }
  const { data, error } = await a.sb.from("api_trade_inbox").insert(parsed.map((trade) => ({ user_id: a.key.user_id, key_id: a.key.id, trade }))).select("id, created_at");
  if (error) return apiError(500, "server_error", "Could not save the trade. Try again.");
  return apiJson({
    queued: data.map((r, i) => ({ id: r.id, externalId: parsed[i].externalId, symbol: parsed[i].symbol, createdAt: r.created_at })),
    message: "Queued. The trades are added to your journal the next time LEDGR is open.",
  }, 202);
}

export const OPTIONS = preflight;
