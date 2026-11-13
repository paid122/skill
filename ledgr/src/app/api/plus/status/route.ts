import { appSecret, callMatrixx, customerKey } from "@/lib/plusServer";

export const dynamic = "force-dynamic";

/** Whether LEDGR+ can be bought here, and the connected customer's MatrixX plan. */
export async function GET(req: Request) {
  if (!appSecret()) return Response.json({ available: false });
  const key = customerKey(req);
  if (!key) return Response.json({ available: true, plan: null });
  const res = await callMatrixx("/apps/plan", key);
  const j = await res.json();
  return Response.json(res.ok ? { available: true, plan: j } : { available: true, plan: null, error: j.error }, { status: res.ok ? 200 : res.status });
}
