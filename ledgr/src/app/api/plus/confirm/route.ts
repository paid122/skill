import { callMatrixx, customerKey } from "@/lib/plusServer";

export const dynamic = "force-dynamic";

/** Back from paying: MatrixX checks the payment with Ziina and applies it (once). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ref = typeof body?.ref === "string" && /^[\w-]{10,64}$/.test(body.ref) ? body.ref : "";
  if (!ref) return Response.json({ error: "Missing payment reference." }, { status: 400 });
  return callMatrixx("/apps/confirm", customerKey(req), { ref });
}
