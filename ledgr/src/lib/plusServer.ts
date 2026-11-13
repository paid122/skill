/** Server only: LEDGR+ talks to MatrixX's app routes with the app secret plus the customer's own MatrixX key. */
import { MATRIXX_API } from "./matrixxConnect";

/** The same clean-up as MatrixX: spaces, line breaks or quote marks pasted around the value are not part of it. */
export const appSecret = () => (process.env.MATRIXX_APP_SECRET ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

/** The customer's MatrixX key from the request (their browser keeps it after Sign in with MatrixX). */
export const customerKey = (req: Request) => {
  const k = (req.headers.get("x-matrixx-key") ?? "").trim();
  return /^mxk_[\w-]{8,200}$/.test(k) ? k : "";
};

/** Calls MatrixX and passes its answer (or its error message) through as JSON. */
export async function callMatrixx(path: string, key: string, body?: unknown): Promise<Response> {
  if (!appSecret()) return Response.json({ error: "LEDGR+ isn't available yet." }, { status: 503 });
  if (!key) return Response.json({ error: "Sign in with MatrixX first." }, { status: 401 });
  try {
    const res = await fetch(`${MATRIXX_API()}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, "X-App-Secret": appSecret(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: String(j?.error?.message ?? j?.detail ?? `MatrixX returned an error (${res.status}).`).slice(0, 300) }, { status: res.status });
    return Response.json(j);
  } catch {
    return Response.json({ error: "Could not reach MatrixX. Try again." }, { status: 502 });
  }
}
