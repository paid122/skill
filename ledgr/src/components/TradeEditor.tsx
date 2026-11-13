"use client";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { deleteTrade, newTradeDraft, saveTrade, ValidationError } from "@/lib/actions";
import { tradeMetrics } from "@/lib/calc";
import { closeEditor, useOverlays } from "@/lib/overlays";
import { deleteBlob, getState, putBlob, useLedgr, validateUpload } from "@/lib/store";
import { EMOTIONS, GRADES, MARKETS, SESSIONS, STRAINED_EMOTIONS, type Emotion, type Execution, type Grade, type Trade, type TradeAttachment } from "@/lib/types";
import { cx, fmtMoney, fmtNum, fmtR, nowISO, uid } from "@/lib/util";
import { BlobImage } from "./BlobImage";
import { Badge, Button, Chips, Field, IconButton, Input, Modal, NumberInput, Segmented, Select, Tabs, Textarea, useFeedback } from "./ui";

type Tab = "trade" | "execution" | "psychology" | "reflection" | "attachments";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function TradeEditor() {
  const { editor } = useOverlays();
  const existing = useLedgr((s) => s.trades.find((t) => t.id === editor?.tradeId) ?? null);
  const [t, setT] = useState<Trade>(() => (existing ? structuredClone(existing) : newTradeDraft()));
  const [tab, setTab] = useState<Tab>((editor?.tab as Tab) ?? "trade");
  const [error, setError] = useState<string | null>(null);
  const [newBlobs, setNewBlobs] = useState<string[]>([]);
  const { toast, confirm } = useFeedback();
  const set = (p: Partial<Trade>) => setT((x) => ({ ...x, ...p }));
  const m = useMemo(() => tradeMetrics({ ...t, isDraft: false }, getState().settings), [t]);

  const close = async () => {
    // Discard blobs uploaded during an unsaved session.
    await Promise.all(newBlobs.map((b) => deleteBlob(b).catch(() => undefined)));
    closeEditor();
  };

  const save = (asDraft: boolean) => {
    if (!asDraft && m.missing.length) {
      setError(`To save a complete trade, add: ${m.missing.join(", ")}. Or save as a draft.`);
      setTab("trade");
      return;
    }
    try {
      saveTrade({ ...t, isDraft: asDraft });
      setNewBlobs([]);
      closeEditor();
      toast(asDraft ? "Draft saved" : existing ? "Trade updated" : "Trade saved");
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Could not save the trade.");
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: `Delete trade #${existing.number}?`, body: "The trade, its executions and attachments will be permanently removed.", confirm: "Delete trade", danger: true })) {
      await deleteTrade(existing.id);
      closeEditor();
      toast("Trade deleted");
    }
  };

  const tabs: { value: Tab; label: string; badge?: React.ReactNode }[] = [
    { value: "trade", label: "Trade", badge: m.missing.length ? <span className="h-1.5 w-1.5 rounded-full bg-neutral" /> : undefined },
    { value: "execution", label: "Execution" },
    { value: "psychology", label: "Psychology" },
    { value: "reflection", label: "Reflection" },
    { value: "attachments", label: "Attachments", badge: t.attachments.length ? <span className="text-[11px] text-muted">{t.attachments.length}</span> : undefined },
  ];

  return (
    <Modal
      open
      onClose={close}
      size="xl"
      title={existing ? `Edit trade #${t.number}` : `New trade #${t.number}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {m.status === "draft" || t.isDraft ? <Badge tone="neutral">Draft</Badge> : m.status === "open" ? <Badge>Open position</Badge> : <Badge tone={m.result === "win" ? "pos" : m.result === "loss" ? "neg" : "default"}>{m.result === "breakeven" ? "Break-even" : m.result === "win" ? "Win" : "Loss"}</Badge>}
          <span className="num">{fmtMoney(m.net)}</span>
          <span className="num">{fmtR(m.r)}</span>
        </span>
      }
      footer={
        <>
          {existing && <Button variant="danger" icon={<Trash2 size={14} />} onClick={remove} className="mr-auto">Delete</Button>}
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={() => save(true)}>Save as draft</Button>
          <Button variant="accent" onClick={() => save(false)}>{existing && !existing.isDraft ? "Save changes" : "Save trade"}</Button>
        </>
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="-mt-2 mb-5" />
      {error && <p className="mb-4 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}
      {tab === "trade" && <TradeTab t={t} set={set} missing={m.missing} />}
      {tab === "execution" && <ExecutionTab t={t} set={set} m={m} />}
      {tab === "psychology" && <PsychologyTab t={t} set={set} />}
      {tab === "reflection" && <ReflectionTab t={t} set={set} />}
      {tab === "attachments" && <AttachmentsTab t={t} set={set} onUploaded={(id) => setNewBlobs((b) => [...b, id])} />}
    </Modal>
  );
}

type TabProps = { t: Trade; set: (p: Partial<Trade>) => void };

function TradeTab({ t, set, missing }: TabProps & { missing: string[] }) {
  const accounts = useLedgr((s) => s.accounts);
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Symbol" htmlFor="te-symbol" error={missing.includes("Symbol") ? "Required" : null}>
          <Input id="te-symbol" value={t.symbol} maxLength={24} onChange={(e) => set({ symbol: e.target.value.toUpperCase() })} placeholder="e.g. ES" />
        </Field>
        <Field label="Market">
          <Select value={t.market ?? ""} onChange={(e) => set({ market: (e.target.value || null) as Trade["market"] })}>
            <option value="">—</option>
            {MARKETS.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Direction" error={missing.includes("Direction") ? "Required" : null}>
          <Segmented value={t.direction ?? ("" as never)} onChange={(v) => set({ direction: v })} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} className="w-full [&>button]:flex-1" ariaLabel="Direction" />
        </Field>
        <Field label="Account" error={missing.includes("Account") ? "Required" : null}>
          <Select value={t.accountId ?? ""} onChange={(e) => set({ accountId: e.target.value || null })}>
            <option value="">Select account</option>
            {accounts.map((a) => <option key={a.id} value={a.id} disabled={a.status === "archived" && a.id !== t.accountId}>{a.name}{a.status === "archived" ? " (archived)" : ""}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={t.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Session">
          <Select value={t.session ?? ""} onChange={(e) => set({ session: (e.target.value || null) as Trade["session"] })}>
            <option value="">—</option>
            {SESSIONS.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Tags" hint="Comma separated" className="col-span-2">
          <Input value={t.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) })} placeholder="news day, replay" />
        </Field>
      </div>
      <p className="text-xs text-muted">Entry and exit prices are recorded as executions on the Execution tab, where you can add multiple entries and partial exits.</p>
      {missing.includes("Executions or net result") && <p className="text-xs text-neutral">This trade needs at least one entry execution or a recorded net result before it can leave draft status.</p>}
    </div>
  );
}

function ExecutionTab({ t, set, m }: TabProps & { m: ReturnType<typeof tradeMetrics> }) {
  const strategies = useLedgr((s) => s.strategies.filter((x) => !x.archived));
  const setups = useLedgr((s) => s.settings.setups);
  const library = useLedgr((s) => s.settings.confluenceLibrary);
  const [custom, setCustom] = useState("");
  const confOptions = [...new Set([...library, ...(strategies.find((s) => s.id === t.strategyId)?.confluences ?? []), ...t.confluences])];
  const currency = useLedgr((s) => s.accounts.find((a) => a.id === t.accountId)?.currency ?? s.settings.baseCurrency);

  const addExec = (kind: Execution["kind"]) => {
    const last = t.executions[t.executions.length - 1];
    const remaining = m.entryQty - m.exitQty;
    set({ executions: [...t.executions, { id: uid("ex"), kind, price: last?.price ?? 0, quantity: kind === "exit" && remaining > 0 ? remaining : last?.quantity ?? 1, time: last ? new Date(new Date(last.time).getTime() + 5 * 60000).toISOString() : new Date(`${t.date}T09:30:00`).toISOString(), fees: 0 }] });
  };
  // Editing a time by hand replaces an estimated one.
  const upd = (id: string, p: Partial<Execution>) => set({ executions: t.executions.map((e) => (e.id === id ? { ...e, ...p, ...(p.time ? { estimated: undefined } : {}) } : e)) });

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Strategy">
          <Select value={t.strategyId ?? ""} onChange={(e) => { const s = strategies.find((x) => x.id === e.target.value); set({ strategyId: e.target.value || null, setup: s ? s.name : t.setup }); }}>
            <option value="">No linked strategy</option>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Setup">
          <Input list="te-setups" value={t.setup} onChange={(e) => set({ setup: e.target.value })} />
          <datalist id="te-setups">{setups.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Trade grade" hint="Your grade of the execution quality, not the outcome">
          <Segmented size="sm" value={t.grade ?? ("" as never)} onChange={(g) => set({ grade: t.grade === g ? null : (g as Grade) })} options={GRADES.map((g) => ({ value: g, label: g }))} className="w-full [&>button]:flex-1" ariaLabel="Trade grade" />
        </Field>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Executions</h3>
          <div className="flex gap-2">
            <Button size="sm" icon={<Plus size={14} />} onClick={() => addExec("entry")}>Entry</Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => addExec("exit")} disabled={!t.executions.some((e) => e.kind === "entry")}>Exit</Button>
          </div>
        </div>
        {t.executions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
            No executions recorded. Add an entry, or record a net result below.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line-soft">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-bg-2/60 text-left text-xs text-muted">
                <tr><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Price</th><th className="px-3 py-2 font-medium">Quantity</th><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Fees</th><th /></tr>
              </thead>
              <tbody>
                {[...t.executions].sort((a, b) => a.time.localeCompare(b.time)).map((e) => (
                  <tr key={e.id} className="border-t border-line-soft">
                    <td className="px-3 py-2">
                      <Select value={e.kind} onChange={(ev) => upd(e.id, { kind: ev.target.value as Execution["kind"] })} className="h-8 w-[96px]">
                        <option value="entry">Entry</option><option value="exit">Exit</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2"><NumberInput value={e.price} allowEmpty={false} onChange={(n) => upd(e.id, { price: n ?? 0 })} className="h-8 w-[120px]" aria-label="Price" /></td>
                    <td className="px-3 py-2"><NumberInput value={e.quantity} allowEmpty={false} onChange={(n) => upd(e.id, { quantity: n ?? 0 })} className="h-8 w-[90px]" aria-label="Quantity" /></td>
                    <td className="px-3 py-2"><input type="datetime-local" className="input h-8 w-[200px]" value={toLocalInput(e.time)} onChange={(ev) => ev.target.value && upd(e.id, { time: new Date(ev.target.value).toISOString() })} aria-label="Time" /></td>
                    <td className="px-3 py-2"><NumberInput value={e.fees} allowEmpty={false} onChange={(n) => upd(e.id, { fees: n ?? 0 })} className="h-8 w-[80px]" aria-label="Fees" /></td>
                    <td className="px-2 py-2 text-right"><IconButton label="Remove execution" onClick={() => set({ executions: t.executions.filter((x) => x.id !== e.id) })}><Trash2 size={14} /></IconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Field label="Recorded stop"><NumberInput value={t.stopPrice} onChange={(n) => set({ stopPrice: n })} /></Field>
        <Field label="Recorded target"><NumberInput value={t.targetPrice} onChange={(n) => set({ targetPrice: n })} /></Field>
        <Field label="Point value" hint="Currency per 1.0 move per unit"><NumberInput value={t.pointValue} allowEmpty={false} onChange={(n) => set({ pointValue: n ?? 1 })} /></Field>
        <Field label="Other fees"><NumberInput value={t.fees} allowEmpty={false} onChange={(n) => set({ fees: n ?? 0 })} /></Field>
        <Field label="Planned risk" hint="Overrides stop-based risk"><NumberInput value={t.plannedRisk} onChange={(n) => set({ plannedRisk: n })} /></Field>
        {t.executions.length === 0 && <Field label="Net result" hint="Used when no executions are recorded" className="col-span-2"><NumberInput value={t.manualNet} onChange={(n) => set({ manualNet: n })} /></Field>}
      </div>

      <section className="rounded-xl border border-line-soft bg-bg-2/40 p-4">
        <h3 className="mb-3 text-[13px] font-semibold">Calculation</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] md:grid-cols-4">
          <Calc label="Entered quantity" value={fmtNum(m.entryQty, 4)} />
          <Calc label="Exited quantity" value={fmtNum(m.exitQty, 4)} />
          <Calc label="Average entry" value={fmtNum(m.avgEntry, 5)} />
          <Calc label="Average exit" value={fmtNum(m.avgExit, 5)} />
          <Calc label="Gross" value={fmtMoney(m.gross, currency)} />
          <Calc label="Total fees" value={fmtMoney(m.totalFees, currency)} />
          <Calc label="Net" value={fmtMoney(m.net, currency)} tone={m.net} />
          <Calc label="Risk" value={fmtMoney(m.risk, currency)} />
          <Calc label="R multiple" value={fmtR(m.r)} tone={m.r} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t.executions.length
            ? `Gross = (average exit − average entry) × exited quantity × point value${t.direction === "short" ? ", reversed for shorts" : ""}. Net = gross − fees. R = net ÷ risk, where risk = ${t.plannedRisk ? "your planned risk" : "|average entry − stop| × entered quantity × point value"}.`
            : "With no executions, net is your recorded net result and R = net ÷ planned risk."}
          {m.entryQty > 0 && m.exitQty < m.entryQty && " This position is still open: exited quantity is below entered quantity, so it is excluded from statistics until closed."}
        </p>
      </section>

      <Field label="Confluences">
        <Chips options={confOptions} value={t.confluences} onChange={(v) => set({ confluences: v })} />
        <div className="mt-2 flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a confluence" className="max-w-xs" onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { e.preventDefault(); set({ confluences: [...new Set([...t.confluences, custom.trim()])] }); setCustom(""); } }} />
          <Button size="sm" onClick={() => { if (custom.trim()) { set({ confluences: [...new Set([...t.confluences, custom.trim()])] }); setCustom(""); } }}>Add</Button>
        </div>
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Field label="Entry notes"><Textarea value={t.entryNotes} onChange={(e) => set({ entryNotes: e.target.value })} placeholder="Why did you enter here?" /></Field>
        <Field label="Exit notes"><Textarea value={t.exitNotes} onChange={(e) => set({ exitNotes: e.target.value })} placeholder="Why did you exit here?" /></Field>
      </div>
    </div>
  );
}

function Calc({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx("num", tone !== undefined && tone !== null && (tone > 0 ? "pos" : tone < 0 ? "neg" : ""))}>{value}</dd>
    </div>
  );
}

function PsychologyTab({ t, set }: TabProps) {
  const mistakes = useLedgr((s) => s.settings.mistakeCategories);
  return (
    <div className="grid gap-6">
      <Field label="Emotional state during the trade" hint="Select all that apply. These are private, self-reported observations.">
        <Chips options={EMOTIONS} value={t.emotions} onChange={(v) => set({ emotions: v as Emotion[] })} tone={(e) => (STRAINED_EMOTIONS.includes(e) ? "neg" : ["Calm", "Patient", "Confident"].includes(e) ? "pos" : "default")} />
      </Field>
      <Field label="Notes on how you felt"><Textarea value={t.emotionNote} onChange={(e) => set({ emotionNote: e.target.value })} placeholder="What were you thinking just before entry?" /></Field>
      <Field label="Documented mistakes" hint="Record honestly. This is for learning, not judgement.">
        <Chips options={mistakes} value={t.mistakes} onChange={(v) => set({ mistakes: v })} />
      </Field>
    </div>
  );
}

function ReflectionTab({ t, set }: TabProps) {
  const r = t.reflection;
  const setR = (p: Partial<Trade["reflection"]>) => set({ reflection: { ...r, ...p } });
  return (
    <div className="grid gap-5">
      <Field label="What went well?"><Textarea value={r.wentWell} onChange={(e) => setR({ wentWell: e.target.value })} /></Field>
      <Field label="What could improve?"><Textarea value={r.improve} onChange={(e) => setR({ improve: e.target.value })} /></Field>
      <Field label="Did I follow my written plan?">
        <Segmented value={r.followedPlan ?? ("" as never)} onChange={(v) => setR({ followedPlan: v })} options={[{ value: "yes", label: "Yes" }, { value: "partial", label: "Partly" }, { value: "no", label: "No" }]} ariaLabel="Followed plan" />
      </Field>
      <Field label="What did I learn?"><Textarea value={r.learned} onChange={(e) => setR({ learned: e.target.value })} /></Field>
    </div>
  );
}

function AttachmentsTab({ t, set, onUploaded }: TabProps & { onUploaded: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<TradeAttachment["role"]>("before");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const added: TradeAttachment[] = [];
    for (const f of Array.from(files)) {
      const problem = validateUpload(f, ["image"]);
      if (problem) { setError(`${f.name}: ${problem}`); continue; }
      const blobId = uid("blob");
      try {
        await putBlob(blobId, f);
        onUploaded(blobId);
        added.push({ id: uid("att"), role, blobId, name: f.name.slice(0, 120), annotation: "", createdAt: nowISO() });
      } catch {
        setError("Could not store the image in this browser.");
      }
    }
    set({ attachments: [...t.attachments, ...added] });
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const groups: { role: TradeAttachment["role"]; label: string }[] = [{ role: "before", label: "Before" }, { role: "after", label: "After" }, { role: "additional", label: "Additional" }];
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented size="sm" value={role} onChange={setRole} options={groups.map((g) => ({ value: g.role, label: g.label }))} ariaLabel="Attachment type" />
        <Button size="sm" icon={<ImagePlus size={14} />} onClick={() => input.current?.click()} disabled={busy}>{busy ? "Uploading…" : `Upload ${role} image`}</Button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} />
        <span className="text-xs text-muted">PNG, JPEG, WebP or GIF up to 8 MB. Stored privately in this browser.</span>
      </div>
      {error && <p className="text-[13px] text-neg">{error}</p>}
      {groups.map((g) => {
        const items = t.attachments.filter((a) => a.role === g.role);
        if (!items.length) return null;
        return (
          <section key={g.role}>
            <h3 className="mb-2 text-[13px] font-semibold">{g.label}</h3>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              {items.map((a) => (
                <div key={a.id} className="overflow-hidden rounded-xl border border-line-soft bg-bg-2/40">
                  <BlobImage blobId={a.blobId} alt={a.name} className="aspect-video w-full" />
                  <div className="flex items-start gap-2 p-3">
                    <Textarea rows={2} value={a.annotation} onChange={(e) => set({ attachments: t.attachments.map((x) => (x.id === a.id ? { ...x, annotation: e.target.value } : x)) })} placeholder="Annotation" className="text-[13px]" />
                    <IconButton label="Remove image" onClick={() => set({ attachments: t.attachments.filter((x) => x.id !== a.id) })}><Trash2 size={14} /></IconButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!t.attachments.length && <p className="text-[13px] text-muted">No images yet. Add a chart before entry and after exit to review your decisions visually.</p>}
    </div>
  );
}
