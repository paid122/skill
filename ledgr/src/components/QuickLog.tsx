"use client";
import { useEffect, useState } from "react";
import { newTradeDraft, saveTrade, ValidationError } from "@/lib/actions";
import { missingFields, tradeMetrics } from "@/lib/calc";
import { closeQuickLog, openEditor, useOverlays } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import { EMOTIONS, MARKETS, type Emotion, type Trade } from "@/lib/types";
import { fmtMoney, fmtR, nowISO, uid } from "@/lib/util";
import { Button, Chips, Field, Input, Modal, NumberInput, Segmented, Select } from "./ui";

export function QuickLog() {
  const { quickLog } = useOverlays();
  const accounts = useLedgr((s) => s.accounts.filter((a) => a.status !== "archived"));
  const setups = useLedgr((s) => s.settings.setups);
  const [t, setT] = useState<Trade | null>(null);
  const [mode, setMode] = useState<"net" | "prices">("net");
  const [px, setPx] = useState<{ entry: number | null; exit: number | null; qty: number | null }>({ entry: null, exit: null, qty: 1 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quickLog) {
      setT(newTradeDraft());
      setPx({ entry: null, exit: null, qty: 1 });
      setError(null);
    }
  }, [quickLog]);

  if (!t) return null;
  const set = (p: Partial<Trade>) => setT({ ...t, ...p });

  const build = (): Trade => {
    if (mode === "prices" && (px.entry !== null || px.exit !== null)) {
      const time = new Date(`${t.date}T12:00:00`).toISOString();
      const executions = [
        ...(px.entry !== null ? [{ id: uid("ex"), kind: "entry" as const, price: px.entry, quantity: px.qty ?? 1, time, fees: 0 }] : []),
        ...(px.exit !== null ? [{ id: uid("ex"), kind: "exit" as const, price: px.exit, quantity: px.qty ?? 1, time, fees: 0 }] : []),
      ];
      return { ...t, executions, manualNet: null };
    }
    return { ...t, executions: [] };
  };
  const preview = tradeMetrics({ ...build(), isDraft: false });

  const save = (draft: boolean, thenEdit = false) => {
    const next = build();
    const missing = missingFields(next);
    if (!draft && missing.length) {
      setError(`Add ${missing.join(", ").toLowerCase()} to save as a complete trade, or save a draft.`);
      return;
    }
    try {
      saveTrade({ ...next, isDraft: draft, activity: [{ at: nowISO(), message: "Created with Quick Log" }] });
      closeQuickLog();
      if (thenEdit) openEditor(next.id);
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Could not save the trade.");
    }
  };

  return (
    <Modal
      open={quickLog}
      onClose={closeQuickLog}
      title="Quick Log"
      description="Capture the essentials now. Complete the full record later."
      footer={
        <>
          <Button variant="ghost" onClick={() => save(true, true)} className="mr-auto">Save & open full editor</Button>
          <Button onClick={() => save(true)}>Save draft</Button>
          <Button variant="accent" onClick={() => save(false)}>Save trade</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Symbol" htmlFor="ql-symbol" className="col-span-2 sm:col-span-1">
            <Input id="ql-symbol" value={t.symbol} onChange={(e) => set({ symbol: e.target.value.toUpperCase() })} placeholder="ES, EURUSD…" maxLength={24} data-autofocus autoComplete="off" />
          </Field>
          <Field label="Direction">
            <Segmented value={t.direction ?? ("" as never)} onChange={(v) => set({ direction: v })} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} className="w-full [&>button]:flex-1" ariaLabel="Direction" />
          </Field>
          <Field label="Market">
            <Select value={t.market ?? ""} onChange={(e) => set({ market: (e.target.value || null) as Trade["market"] })}>
              <option value="">—</option>
              {MARKETS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Account" className="col-span-2 sm:col-span-2">
            <Select value={t.accountId ?? ""} onChange={(e) => set({ accountId: e.target.value || null })}>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={t.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        </div>

        <div className="rounded-xl border border-line-soft bg-bg-2/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="label">Result</span>
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "net", label: "Net result" }, { value: "prices", label: "Entry & exit" }]} />
          </div>
          {mode === "net" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Net result"><NumberInput value={t.manualNet} onChange={(n) => set({ manualNet: n })} placeholder="e.g. -120 or 340" /></Field>
              <Field label="Planned risk" hint="Used to calculate R"><NumberInput value={t.plannedRisk} onChange={(n) => set({ plannedRisk: n })} placeholder="e.g. 200" /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Entry"><NumberInput value={px.entry} onChange={(n) => setPx({ ...px, entry: n })} /></Field>
              <Field label="Exit"><NumberInput value={px.exit} onChange={(n) => setPx({ ...px, exit: n })} /></Field>
              <Field label="Quantity"><NumberInput value={px.qty} onChange={(n) => setPx({ ...px, qty: n })} /></Field>
              <Field label="Stop"><NumberInput value={t.stopPrice} onChange={(n) => set({ stopPrice: n })} /></Field>
              <Field label="Point value" hint="Per 1.0 move per unit" className="col-span-2"><NumberInput value={t.pointValue} allowEmpty={false} onChange={(n) => set({ pointValue: n ?? 1 })} /></Field>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Calculated: <span className="num text-text-2">{fmtMoney(preview.net)}</span> · <span className="num text-text-2">{fmtR(preview.r)}</span>
          </p>
        </div>

        <Field label="Setup">
          <Input list="ql-setups" value={t.setup} onChange={(e) => set({ setup: e.target.value })} placeholder="Name of the setup you traded" />
          <datalist id="ql-setups">{setups.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="How did you feel?">
          <Chips options={EMOTIONS} value={t.emotions} onChange={(v) => set({ emotions: v as Emotion[] })} />
        </Field>
        {error && <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}
      </div>
    </Modal>
  );
}
