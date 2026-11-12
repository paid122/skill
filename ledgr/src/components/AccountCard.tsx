"use client";
import { Cloud, CloudOff, LogOut, RefreshCw } from "lucide-react";
import { clearAll } from "@/lib/store";
import { supabase, supabaseConfigured, useSession } from "@/lib/supabase";
import { writeMeta } from "@/lib/sync";
import { fmtDate, fmtTime } from "@/lib/util";
import { useSyncStatus } from "./SyncManager";
import { Badge, Button, ButtonLink, Card, SectionTitle, useFeedback } from "./ui";

export function AccountCard() {
  const session = useSession();
  const sync = useSyncStatus();
  const { confirm, toast } = useFeedback();

  if (!supabaseConfigured) {
    return (
      <Card>
        <SectionTitle title="Account & cloud sync" sub="Not connected on this deployment" />
        <p className="text-[13px] leading-relaxed text-text-2">Your journal is saved in this browser. To sign in and sync across devices, the site owner adds a Supabase project: set <code className="rounded bg-card-2 px-1 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-card-2 px-1 font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then run the SQL in <code className="rounded bg-card-2 px-1 font-mono text-xs">supabase/migrations</code>.</p>
      </Card>
    );
  }
  if (session === undefined) return <Card><SectionTitle title="Account & cloud sync" /><div className="skeleton h-10 rounded-lg" /></Card>;
  if (!session) {
    return (
      <Card>
        <SectionTitle title="Account & cloud sync" sub="You're using Ledgr without an account" />
        <p className="text-[13px] text-text-2">Create a free account to back up your journal and use it on any device. Your existing entries come with you.</p>
        <div className="mt-4 flex gap-2"><ButtonLink href="/signup" variant="accent">Create account</ButtonLink><ButtonLink href="/login">Log in</ButtonLink></div>
      </Card>
    );
  }

  const signOut = async (wipe: boolean) => {
    if (wipe && !(await confirm({ title: "Sign out and remove data from this device?", body: "Your journal stays safe in your Ledgr account. This browser's copy is deleted.", confirm: "Sign out and remove", danger: true }))) return;
    await supabase()?.auth.signOut();
    writeMeta(null);
    if (wipe) await clearAll();
    toast("Signed out");
  };

  return (
    <Card>
      <SectionTitle title="Account & cloud sync" sub={session.user.email} action={
        sync.state === "synced" ? <Badge tone="pos"><Cloud size={11} /> Synced</Badge>
          : sync.state === "syncing" ? <Badge><RefreshCw size={11} className="animate-spin" /> Syncing</Badge>
            : sync.state === "conflict" ? <Badge tone="neutral">Choose a copy</Badge>
              : sync.state === "error" ? <Badge tone="neg"><CloudOff size={11} /> Not synced</Badge> : <Badge tone="muted">Idle</Badge>
      } />
      <p className="text-[13px] text-text-2">
        {sync.state === "error" ? `Sync failed: ${sync.message}. Your changes are safe on this device and will sync when the problem is fixed.`
          : sync.at ? `Last synced ${fmtDate(sync.at)} at ${fmtTime(sync.at)}. Changes sync automatically.` : "Changes sync automatically while you're signed in."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<RefreshCw size={14} />} onClick={() => window.dispatchEvent(new Event("focus"))}>Sync now</Button>
        <Button icon={<LogOut size={14} />} onClick={() => signOut(false)}>Sign out</Button>
        <Button variant="danger" onClick={() => signOut(true)}>Sign out and remove from this device</Button>
      </div>
    </Card>
  );
}
