"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { askMatrixx, useMatrixxReady } from "@/lib/matrixxClient";
import type { AIReview } from "@/lib/types";
import { fmtDate, nowISO } from "@/lib/util";

/** Minimal, safe markdown: headings, paragraphs, lists, **bold**, _italic_, and validated record citations. */
export function renderMarkdown(text: string, byNumber: Map<number, string>): ReactNode[] {
  const inline = (s: string, key: string): ReactNode[] => {
    const parts = s.split(/(\*\*[^*]+\*\*|\b_[^_]+_\b|\[T#\d+\]|\[D:\d{4}-\d{2}-\d{2}\])/g);
    return parts.map((p, i) => {
      const k = `${key}-${i}`;
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k} className="font-semibold">{inline(p.slice(2, -2), k)}</strong>;
      if (/^_[^_]+_$/.test(p)) return <em key={k} className="text-text-2">{inline(p.slice(1, -1), k)}</em>;
      const t = p.match(/^\[T#(\d+)\]$/);
      if (t) { const id = byNumber.get(Number(t[1])); return id ? <Link key={k} href={`/journal/${id}`} className="num rounded border border-accent/40 px-1 text-[12px] text-accent hover:bg-accent/10">#{t[1]}</Link> : <span key={k} className="text-muted line-through" title="Not found in your journal">#{t[1]}</span>; }
      const d = p.match(/^\[D:(\d{4}-\d{2}-\d{2})\]$/);
      if (d) return <Link key={k} href={`/daily-journal?date=${d[1]}`} className="rounded border border-accent/40 px-1 text-[12px] text-accent hover:bg-accent/10">{fmtDate(d[1], "day")}</Link>;
      return <Fragment key={k}>{p}</Fragment>;
    });
  };
  const LIST = /^\s*([-*•]|\d+\.)\s+/;
  const out: ReactNode[] = [];
  const lines = text.trim().split("\n");
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => { if (para.length) { const k = `p${out.length}`; out.push(<p key={k} className="whitespace-pre-wrap">{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${k}-${j}`)}</Fragment>)}</p>); para = []; } };
  const flushList = () => { if (list) { const k = `l${out.length}`; const items = list.items.map((l, j) => <li key={j}>{inline(l, `${k}-${j}`)}</li>); out.push(list.ordered ? <ol key={k} className="ml-5 list-decimal space-y-1">{items}</ol> : <ul key={k} className="ml-5 list-disc space-y-1 marker:text-muted">{items}</ul>); list = null; } };
  for (const line of lines) {
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (LIST.test(line)) {
      flushPara();
      const ordered = /^\s*\d+\./.test(line);
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(line.replace(LIST, ""));
      continue;
    }
    flushList();
    if (/^#{1,4}\s/.test(line)) { flushPara(); out.push(<p key={`h${out.length}`} className="font-semibold">{inline(line.replace(/^#{1,4}\s/, ""), `h${out.length}`)}</p>); continue; }
    para.push(line);
  }
  flushPara(); flushList();
  return out;
}

/** The MatrixX app icon (from MatrixX's own assets). */
export function MatrixXLogo({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/matrixx-logo.png" alt="MatrixX" width={size} height={size} className="inline-block shrink-0" style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }} />;
}

/**
 * "Review with MatrixX": asks MatrixX for a coach's review (of a trade or a week), streams it in and saves it.
 * Not connected: a Sign in with MatrixX button that comes back to this page.
 */
export function MatrixxReview({ title, sub, prompt, context, saved, onSave, byNumber, disabledReason }: {
  title: string;
  sub: string;
  prompt: string;
  /** Built when asked (it can be large). */
  context: () => string;
  saved: AIReview | null | undefined;
  onSave: (review: AIReview) => void;
  byNumber: Map<number, string>;
  /** When set, the button is off and this says why (e.g. no closed trades). */
  disabledReason?: string;
}) {
  const ready = useMatrixxReady();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setLive("");
    const res = await askMatrixx(prompt, context(), (t) => setLive(t));
    if (res.ok && res.text) onSave({ text: res.text, at: nowISO() });
    else setError(res.error ?? "MatrixX didn't answer. Try again.");
    setLive(null); setBusy(false);
  };

  const shown = live ?? saved?.text ?? "";
  return (
    <Card>
      <SectionTitle
        title={<span className="inline-flex items-center gap-2"><MatrixXLogo size={18} /> {title}</span>}
        sub={saved && live === null ? `${sub} · ${fmtDate(saved.at)}` : sub}
        action={ready ? (
          <Button size="sm" onClick={run} disabled={busy || !!disabledReason}>{busy ? "Reviewing…" : saved ? "Review again" : "Review with MatrixX"}</Button>
        ) : undefined}
      />
      {ready === false ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[13px] text-text-2">Connect MatrixX to get a coach&apos;s review from your own records. A free MatrixX account works.</p>
          <a href={`/api/matrixx/connect?back=${encodeURIComponent(pathname || "/ai")}`} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-text px-4 text-[13px] font-semibold text-bg hover:opacity-90"><MatrixXLogo size={20} /> Sign in with MatrixX</a>
        </div>
      ) : busy && !live ? (
        <p className="flex items-center gap-2 text-[13px] text-muted"><span className="animate-pulse"><MatrixXLogo size={18} /></span> MatrixX is reviewing…</p>
      ) : shown ? (
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-text">{renderMarkdown(shown, byNumber)}</div>
      ) : (
        <p className="text-[13px] text-muted">{disabledReason ?? "Ask MatrixX for a short review: what went well, what to improve, and one lesson."}</p>
      )}
      {error && <p className="mt-3 text-[12.5px] text-neg">{error}</p>}
      {shown && !busy && <p className="mt-3 text-[11px] text-muted">From your own records. It can be wrong; check it against your journal. Not financial advice.</p>}
    </Card>
  );
}
