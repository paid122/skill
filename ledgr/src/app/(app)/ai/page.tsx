"use client";
import { ArrowUp, Eye, MessageSquare, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageIntro, ScopeControls } from "@/components/blocks";
import { LogoMark } from "@/components/Logo";
import { Badge, Button, Card, IconButton, Input, Modal, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { appendMessage, deleteConversation, newConversation } from "@/lib/actions";
import { buildContext, extractCitations, offlineAnswer, SUGGESTED } from "@/lib/ai";
import { useScoped } from "@/lib/hooks";
import { getState, useLedgr } from "@/lib/store";
import type { AIMessage } from "@/lib/types";
import { cx, fmtDate, nowISO, uid } from "@/lib/util";

export default function AIPage() {
  const conversations = useLedgr((s) => s.conversations);
  const trades = useLedgr((s) => s.trades);
  const { current } = useScoped();
  const { confirm, toast } = useFeedback();
  const [activeId, setActiveId] = useState<string | null>(conversations[conversations.length - 1]?.id ?? null);
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // MatrixX is the assistant: server key (MATRIXX_API_KEY) or the user's own key from "Connect MatrixX".
  const [mxConfigured, setMxConfigured] = useState<boolean | null>(null);
  // The user's own MatrixX key, kept in this browser only and sent with each MatrixX question.
  const [mxKey, setMxKeyState] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  useEffect(() => {
    try { setMxKeyState(localStorage.getItem("ledgr.matrixxKey") ?? ""); } catch { /* ignore */ }
    const mxBack = new URLSearchParams(window.location.search).get("mx");
    if (mxBack) {
      toast(mxBack === "connected" ? "MatrixX connected" : mxBack === "cancelled" ? "MatrixX wasn't connected" : "Couldn't connect MatrixX. Try again.");
      window.history.replaceState(null, "", "/ai");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setMxKey = (k: string) => { setMxKeyState(k); try { if (k) localStorage.setItem("ledgr.matrixxKey", k); else localStorage.removeItem("ledgr.matrixxKey"); } catch { /* ignore */ } };
  const [showContext, setShowContext] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => buildContext(getState(), current), [current]);
  const byNumber = useMemo(() => new Map(trades.map((t) => [t.number, t.id])), [trades]);

  useEffect(() => { fetch("/api/matrixx").then((r) => r.json()).then((d) => setMxConfigured(!!d.configured)).catch(() => setMxConfigured(false)); }, []);
  const mxReady = mxConfigured === null ? null : mxConfigured || !!mxKey;
  const live = mxReady;
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [active?.messages.length, pending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const endpoint = "/api/matrixx";
    const conv = active ?? newConversation();
    setActiveId(conv.id);
    const userMsg: AIMessage = { id: uid("m"), role: "user", content: q.slice(0, 4000), citations: [], at: nowISO() };
    appendMessage(conv.id, userMsg);
    setInput("");
    setBusy(true);
    let answer = "";
    let mode: AIMessage["mode"] = "offline";
    if (live) {
      try {
        const history = [...(conv.messages ?? []), userMsg].slice(-20).map((m) => ({ role: m.role, content: m.content }));
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(mxKey ? { "x-matrixx-key": mxKey } : {}) }, body: JSON.stringify({ messages: history, context: ctx.text }) });
        if (res.ok && res.body) {
          mode = "model";
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          setPending("");
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            answer += dec.decode(value, { stream: true });
            setPending(answer);
          }
          if (answer.includes("[[ledgr-error]]")) {
            const err = answer.split("[[ledgr-error]]")[1].trim();
            answer = `${offlineAnswer(q, getState(), current)}\n\n_${err} This answer was produced by offline analysis._`;
            mode = "offline";
          }
        } else {
          const err = await res.json().catch(() => ({}));
          answer = `${offlineAnswer(q, getState(), current)}${err.error && err.error !== "not_configured" ? `\n\n_${err.error}_` : ""}`;
        }
      } catch {
        answer = `${offlineAnswer(q, getState(), current)}\n\n_Could not reach MatrixX; this answer was produced by offline analysis._`;
      }
    } else {
      answer = `${offlineAnswer(q, getState(), current)}\n\n_Connect MatrixX above the chat to get MatrixX answers. This one was produced by offline analysis._`;
    }
    appendMessage(conv.id, { id: uid("m"), role: "assistant", content: answer, citations: extractCitations(answer, ctx), mode, ...(mode === "model" ? { by: "matrixx" as const } : {}), at: nowISO() });
    setPending(null);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="MatrixX AI" sub="A historical analyst for your own journal. It reviews what you have recorded — it never gives financial advice or tells you what to trade." actions={<ScopeControls />} />
      <PageVerse page="ai" compact />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card pad={false} className="p-2">
          <Button className="mb-2 w-full" icon={<Plus size={14} />} onClick={() => { const c = newConversation(); setActiveId(c.id); }}>New conversation</Button>
          <ul className="max-h-[60vh] overflow-y-auto scroll-thin">
            {[...conversations].reverse().map((c) => (
              <li key={c.id} className="group flex items-center">
                <button type="button" onClick={() => setActiveId(c.id)} className={cx("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]", c.id === activeId ? "bg-card-2 text-text" : "text-text-2 hover:bg-card-2/60")}>
                  <MessageSquare size={13} className="shrink-0 text-muted" /><span className="truncate">{c.title}</span>
                </button>
                <IconButton label="Delete conversation" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={async () => { if (await confirm({ title: "Delete this conversation?", confirm: "Delete", danger: true })) { deleteConversation(c.id); if (c.id === activeId) setActiveId(null); } }}><Trash2 size={12} /></IconButton>
              </li>
            ))}
            {conversations.length === 0 && <li className="px-3 py-4 text-xs text-muted">Conversations are saved in this browser.</li>}
          </ul>
        </Card>

        <Card pad={false} className="flex min-h-[620px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3 text-xs">
            {live === null ? <Badge>Checking…</Badge> : mxReady ? <Badge tone="accent"><MatrixXLogo size={13} /> MatrixX connected</Badge> : <Badge tone="muted">Not connected · offline analysis</Badge>}
            <span className="text-muted">{mxReady ? `MatrixX answers here, using ${current.length} records in the selected scope as summary rows.` : "Sign in with MatrixX to get MatrixX answers in this chat."}</span>
            <button type="button" onClick={() => setShowContext(true)} className="ml-auto inline-flex items-center gap-1 text-text-2 hover:text-text"><Eye size={13} /> What is shared</button>
          </div>
          {mxConfigured === false && (mxKey ? (
            <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2 text-xs text-muted">
              <span>Connected to MatrixX (saved in this browser only).</span>
              <button type="button" onClick={() => { setMxKey(""); toast("MatrixX disconnected"); }} className="ml-auto text-text-2 hover:text-text">Disconnect</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 border-b border-line-soft bg-card-2/40 px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/matrixx/connect" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-text px-4 text-[13px] font-semibold text-bg hover:opacity-90"><MatrixXLogo size={20} /> Sign in with MatrixX</a>
                <span className="text-muted">Free MatrixX account works. Your questions use your own MatrixX plan.</span>
              </div>
              <details className="group">
                <summary className="cursor-pointer list-none text-text-2 hover:text-text">Use an API key instead</summary>
                <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); const k = keyDraft.trim(); if (!/^mxk_\S{8,}$/.test(k)) { toast("A MatrixX API key starts with mxk_ — make one on getmatrixx.com/developers."); return; } setMxKey(k); setKeyDraft(""); toast("MatrixX connected"); }}>
                  <Input type="password" autoComplete="off" aria-label="MatrixX key" placeholder="Paste your MatrixX API key (mxk_…)" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} className="h-8 min-w-[200px] flex-1 text-xs" />
                  <Button type="submit" size="sm">Connect</Button>
                  <a href="https://getmatrixx.com/developers" target="_blank" rel="noreferrer" className="text-text-2 underline-offset-2 hover:underline">Get a key</a>
                </form>
              </details>
              <span className="text-[11px] text-muted">Your MatrixX connection stays in this browser and is only passed through to MatrixX with your questions.</span>
            </div>
          ))}

          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-6 scroll-thin sm:px-8" style={{ maxHeight: "62vh" }} aria-live="polite">
            {!active?.messages.length && !pending ? (
              <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-10 text-center">
                <span className="text-text">{mxReady ? <MatrixXLogo size={40} /> : <LogoMark size={36} />}</span>
                <div>
                  <p className="text-[15px] font-medium">Ask about your records</p>
                  <p className="mt-1 text-[13px] text-muted">Trade reviews, weekly summaries, setup and emotion patterns. Answers cite the trades they draw on.</p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)] w-full gap-2 sm:grid-cols-2">
                  {SUGGESTED.map((s) => <button key={s} type="button" disabled={busy} onClick={() => send(s)} className="rounded-xl border border-line-soft bg-bg-2/50 px-3 py-2.5 text-left text-[13px] text-text-2 transition-colors hover:border-line hover:text-text">{s}</button>)}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {active?.messages.map((m) => <Message key={m.id} m={m} byNumber={byNumber} />)}
                {pending !== null && (pending ? <Message m={{ id: "p", role: "assistant", content: pending, citations: [], at: "" }} byNumber={byNumber} /> : <Thinking />)}
                {busy && pending === null && <Thinking />}
              </div>
            )}
          </div>

          <form className="border-t border-line-soft p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <div className="flex items-end gap-2 rounded-xl border border-line bg-bg-2 p-2 focus-within:border-accent">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={1} maxLength={4000} placeholder="Ask about a trade (#12), this week, setups, emotions or mistakes…" className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted" aria-label="Message" />
              <Button type="submit" variant="accent" size="sm" disabled={busy || !input.trim()} aria-label="Send" className="h-9 w-9 px-0"><ArrowUp size={16} /></Button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-muted">MatrixX AI analyses past records only. It can be wrong; check figures against your journal. Not financial advice.</p>
          </form>
        </Card>
      </div>

      <Modal open={showContext} onClose={() => setShowContext(false)} size="lg" title="What MatrixX AI can see" description="Only the records in your selected account and date range, summarised as below. Images and attachments are never sent.">
        <div className="mb-3 flex items-center gap-2 text-xs text-text-2"><ShieldCheck size={14} className="text-pos" /> {live ? "Sent to MatrixX (getmatrixx.com) over HTTPS when you ask a question. Not stored by Ledgr's server." : "Used locally in your browser only, until MatrixX is connected."}</div>
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg bg-bg-2 p-3 font-mono text-[11px] leading-relaxed text-text-2 scroll-thin">{ctx.text}</pre>
      </Modal>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted">
      <LogoMark size={22} animated />
      Reviewing your records…
    </div>
  );
}

function Message({ m, byNumber }: { m: AIMessage; byNumber: Map<number, string> }) {
  if (m.role === "user") return <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-card-2 px-4 py-2.5 text-[14px] text-text">{m.content}</div>;
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-text">{m.by === "matrixx" ? <MatrixXLogo size={22} /> : <LogoMark size={22} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-text">{renderMarkdown(m.content, byNumber)}</div>
        {(m.mode || m.citations.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {m.mode && <span>{m.by === "matrixx" ? "MatrixX" : m.mode === "model" ? "Model analysis" : "Offline analysis"}{m.at && ` · ${fmtDate(m.at)}`}</span>}
            {m.citations.length > 0 && <span>· Cites {m.citations.length} record{m.citations.length > 1 ? "s" : ""}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Minimal, safe markdown: headings, paragraphs, lists, **bold**, _italic_, and validated record citations. */
function renderMarkdown(text: string, byNumber: Map<number, string>): ReactNode[] {
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
function MatrixXLogo({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/matrixx-logo.png" alt="MatrixX" width={size} height={size} className="inline-block shrink-0" style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }} />;
}
