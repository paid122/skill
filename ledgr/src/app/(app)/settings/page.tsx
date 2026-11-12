"use client";
import { Database, Download, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { AccountCard } from "@/components/AccountCard";
import { PageIntro } from "@/components/blocks";
import { SettingsNav } from "@/components/SettingsNav";
import { Button, Card, Field, Input, NumberInput, SectionTitle, Select, Toggle, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { updateSettings } from "@/lib/actions";
import { createBackup, restoreBackup } from "@/lib/backup";
import { buildSampleState } from "@/lib/sample";
import { clearAll, getState, replaceState, useLedgr } from "@/lib/store";
import { download, today } from "@/lib/util";
import { TRANSLATIONS } from "@/lib/verses";

export default function SettingsPage() {
  const s = useLedgr((x) => x.settings);
  const sample = useLedgr((x) => x.sampleData);
  const counts = useLedgr((x) => ({ trades: x.trades.length, accounts: x.accounts.length, notes: x.studyNotes.length, journals: x.dailyJournals.length }));
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState(s.displayName);
  const [includeImages, setIncludeImages] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Settings" sub="Profile, journal preferences and your data." />
      <PageVerse page="settings" compact />
      <SettingsNav />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-2">
        <div className="xl:col-span-2"><AccountCard /></div>
        <Card>
          <SectionTitle title="Profile" />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <Field label="Display name"><Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() !== s.displayName) { updateSettings({ displayName: name.trim() }); toast("Name updated"); } }} /></Field>
            <Field label="Base currency" hint="Used for combined views across accounts"><Input value={s.baseCurrency} maxLength={3} onChange={(e) => /^[A-Za-z]{0,3}$/.test(e.target.value) && updateSettings({ baseCurrency: e.target.value.toUpperCase() || "USD" })} /></Field>
            <Field label="Bible translation" hint="Only translations Ledgr is licensed to display can be selected" className="sm:col-span-2">
              <Select value={s.translation} onChange={() => undefined}>
                {TRANSLATIONS.map((t) => <option key={t.code} value={t.code} disabled={!t.available}>{t.name} ({t.code}){t.available ? "" : ` — ${t.note}`}</option>)}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Calculations" />
          <Field label="Break-even threshold" hint={`Closed trades with |net| at or below this amount count as break-even, not as wins or losses. Currently ${s.breakevenThreshold}.`}>
            <NumberInput value={s.breakevenThreshold} allowEmpty={false} onChange={(n) => updateSettings({ breakevenThreshold: Math.max(0, n ?? 0) })} className="w-32" />
          </Field>
          <p className="mt-4 text-xs leading-relaxed text-muted">Drafts and open positions never count toward statistics. Win rate = wins ÷ (wins + losses). Full formulas are in the project's CALCULATIONS document.</p>
        </Card>

        <ListEditor title="Setups" sub="Suggested in the trade editor. Added automatically when you save a trade with a new setup." items={s.setups} onChange={(setups) => updateSettings({ setups })} />
        <ListEditor title="Confluence library" sub="Options shown on the Execution tab." items={s.confluenceLibrary} onChange={(confluenceLibrary) => updateSettings({ confluenceLibrary })} />

        <Card className="xl:col-span-2" id="data">
          <SectionTitle title="Your data" sub={`${counts.trades} trades · ${counts.accounts} accounts · ${counts.journals} daily entries · ${counts.notes} notes. Stored privately in this browser.`} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-medium">Back up</p>
              <Toggle label="Include images and PDFs" checked={includeImages} onChange={setIncludeImages} />
              <Button icon={<Download size={14} />} onClick={async () => { download(`ledgr-backup-${today()}.json`, await createBackup(includeImages), "application/json"); toast("Backup downloaded"); }}>Download backup</Button>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-medium">Restore</p>
              <p className="text-xs text-muted">Replaces everything in this browser with the backup's contents.</p>
              <Button icon={<Upload size={14} />} onClick={() => file.current?.click()}>Restore from file</Button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 200 * 1024 * 1024) { setImportError("Backup is larger than 200 MB."); return; }
                if (!(await confirm({ title: "Replace all data with this backup?", body: "Your current journal will be overwritten. Download a backup first if you may need it.", confirm: "Restore backup", danger: true }))) return;
                try { await restoreBackup(await f.text()); setImportError(null); toast("Backup restored"); } catch (err) { setImportError(err instanceof Error ? err.message : "Could not restore."); }
              }} />
              {importError && <p className="text-xs text-neg">{importError}</p>}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-medium">Sample records</p>
              {sample ? (
                <Button icon={<X size={14} />} onClick={async () => { if (await confirm({ title: "Remove sample records?", body: "All records will be cleared so you can start your own journal. Settings and appearance are kept.", confirm: "Remove sample data", danger: true })) { const keep = getState().settings; await clearAll(); await replaceState({ ...getState(), settings: { ...keep, setups: [], onboarded: false } }); toast("Sample records removed"); } }}>Remove sample records</Button>
              ) : (
                <Button icon={<Database size={14} />} onClick={async () => { if (await confirm({ title: "Load sample records?", body: "Simulated accounts, trades and journals will replace your current data. Back up first if needed.", confirm: "Load sample data", danger: true })) { await replaceState(buildSampleState({ ...getState(), trades: [] })); toast("Sample records loaded"); } }}>Load sample records</Button>
              )}
              <Button variant="danger" onClick={async () => { if (await confirm({ title: "Delete all Ledgr data in this browser?", body: "Every trade, journal, note, image and setting will be permanently removed.", confirm: "Delete everything", danger: true })) { await clearAll(); toast("All data deleted"); } }}>Delete all data</Button>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle title="About Ledgr" />
          <p className="max-w-3xl text-[13px] leading-relaxed text-text-2">Ledgr is a personal journal for simulated and historical trading records. It does not connect to brokers, execute trades, or provide financial advice. Statistics describe your saved records only. Scripture is quoted from the King James Version, which is in the public domain.</p>
        </Card>
      </div>
    </div>
  );
}

function ListEditor({ title, sub, items, onChange }: { title: string; sub: string; items: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState("");
  const add = () => { const n = v.trim().slice(0, 50); if (n && !items.includes(n)) onChange([...items, n]); setV(""); };
  return (
    <Card>
      <SectionTitle title={title} sub={sub} />
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <span key={i} className="inline-flex h-7 items-center gap-1 rounded-full border border-line pl-3 pr-1 text-[12.5px] text-text-2">{i}<button type="button" aria-label={`Remove ${i}`} onClick={() => onChange(items.filter((x) => x !== i))} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-neg"><X size={11} /></button></span>)}
        {items.length === 0 && <span className="text-xs text-muted">None yet.</span>}
      </div>
      <div className="mt-3 flex gap-2"><Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={`Add to ${title.toLowerCase()}`} /><Button icon={<Plus size={14} />} onClick={add}>Add</Button></div>
    </Card>
  );
}
