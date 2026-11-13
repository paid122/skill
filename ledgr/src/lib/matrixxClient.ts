"use client";
/**
 * Talking to MatrixX from the browser: the key from "Sign in with MatrixX" (kept in this browser) and a streaming
 * ask that LEDGR's server passes through to MatrixX. Used by the AI page, trade reviews and weekly reviews.
 */
import { useEffect, useState } from "react";

const KEY = "ledgr.matrixxKey";

export function getMatrixxKey(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

/** Whether MatrixX can answer here: a key on LEDGR's server, or this browser is connected. null while checking. */
export function useMatrixxReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const local = !!getMatrixxKey();
    if (local) { setReady(true); return; }
    fetch("/api/matrixx").then((r) => r.json()).then((d) => live && setReady(!!d.configured)).catch(() => live && setReady(false));
    return () => { live = false; };
  }, []);
  return ready;
}

export interface MatrixxAnswer { ok: boolean; text: string; error?: string }

/**
 * One question to MatrixX with the journal context. Streams the answer into onText as it arrives.
 * Never throws: a failure comes back as { ok: false, error } with MatrixX's own message when there is one.
 */
export async function askMatrixx(question: string, context: string, onText?: (soFar: string) => void, history: { role: "user" | "assistant"; content: string }[] = []): Promise<MatrixxAnswer> {
  const key = getMatrixxKey();
  try {
    const res = await fetch("/api/matrixx", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "x-matrixx-key": key } : {}) },
      body: JSON.stringify({ messages: [...history, { role: "user", content: question.slice(0, 8000) }], context }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, text: "", error: err.error === "not_configured" ? "Connect MatrixX first." : (err.error ?? `MatrixX returned an error (${res.status}).`) };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      const cut = text.indexOf("[[ledgr-error]]");
      onText?.(cut >= 0 ? text.slice(0, cut).trimEnd() : text);
    }
    if (text.includes("[[ledgr-error]]")) {
      const [before, err] = text.split("[[ledgr-error]]");
      return { ok: false, text: before.trim(), error: err.trim() };
    }
    return { ok: true, text: text.trim() };
  } catch {
    return { ok: false, text: "", error: "Could not reach MatrixX. Check your connection and try again." };
  }
}
