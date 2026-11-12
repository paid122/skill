"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { updateSettings } from "@/lib/actions";
import { getState, replaceState, setBlobSync, subscribeState, getBlob } from "@/lib/store";
import { ATTACHMENT_BUCKET, supabase, useSession } from "@/lib/supabase";
import { decideSync, hasUserData, readMeta, referencedBlobs, writeMeta } from "@/lib/sync";
import type { LedgrState } from "@/lib/types";
import { fmtDate, fmtTime } from "@/lib/util";
import { Button, Modal } from "./ui";

export type SyncStatus = { state: "off" | "syncing" | "synced" | "error" | "conflict"; at?: string; message?: string; email?: string };
let status: SyncStatus = { state: "off" };
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => { status = s; listeners.forEach((l) => l()); };
export function useSyncStatus() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status, () => status);
}

const uploadedKey = (uid: string) => `ledgr.uploaded.${uid}`;
const readUploaded = (uid: string) => { try { return new Set<string>(JSON.parse(localStorage.getItem(uploadedKey(uid)) ?? "[]")); } catch { return new Set<string>(); } };
const writeUploaded = (uid: string, s: Set<string>) => { try { localStorage.setItem(uploadedKey(uid), JSON.stringify([...s])); } catch { /* ignore */ } };

export function SyncManager() {
  const session = useSession();
  const uid = session?.user.id ?? null;
  const email = session?.user.email;
  const applyingRemote = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conflict, setConflict] = useState<{ remoteAt: string } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb || !uid) { setStatus({ state: "off" }); setBlobSync(null, null); return; }

    const uploadBlob = async (id: string, blob: Blob) => {
      const { error } = await sb.storage.from(ATTACHMENT_BUCKET).upload(`${uid}/${id}`, blob, { upsert: true, contentType: blob.type || undefined });
      if (!error) { const set = readUploaded(uid); set.add(id); writeUploaded(uid, set); }
    };
    setBlobSync(
      async (id) => { const { data } = await sb.storage.from(ATTACHMENT_BUCKET).download(`${uid}/${id}`); return data ?? undefined; },
      (id, blob) => { void uploadBlob(id, blob); },
    );

    const uploadPendingBlobs = async () => {
      const done = readUploaded(uid);
      for (const id of referencedBlobs(getState())) {
        if (done.has(id)) continue;
        const b = await getBlob(id);
        if (b) await uploadBlob(id, b);
      }
    };

    const push = async () => {
      setStatus({ state: "syncing", email });
      const { data, error } = await sb.from("user_snapshots").upsert({ user_id: uid, state: getState() }).select("updated_at").single();
      if (error) { setStatus({ state: "error", message: error.message, email }); return; }
      writeMeta({ userId: uid, remoteUpdatedAt: data.updated_at, localDirty: false });
      setStatus({ state: "synced", at: data.updated_at, email });
      void uploadPendingBlobs();
    };

    const pull = async () => {
      setStatus({ state: "syncing", email });
      const { data, error } = await sb.from("user_snapshots").select("state, updated_at").eq("user_id", uid).single();
      if (error || !data) { setStatus({ state: "error", message: error?.message ?? "Cloud copy not found", email }); return; }
      applyingRemote.current = true;
      await replaceState(data.state as LedgrState);
      applyingRemote.current = false;
      writeMeta({ userId: uid, remoteUpdatedAt: data.updated_at, localDirty: false });
      // Attachments already in the cloud do not need re-uploading.
      writeUploaded(uid, new Set([...readUploaded(uid), ...referencedBlobs(data.state as LedgrState)]));
      setStatus({ state: "synced", at: data.updated_at, email });
    };

    const reconcile = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { data, error } = await sb.from("user_snapshots").select("updated_at").eq("user_id", uid).maybeSingle();
        if (error) { setStatus({ state: "error", message: error.message, email }); return; }
        const decision = decideSync({ userId: uid, meta: readMeta(), remoteUpdatedAt: data?.updated_at ?? null, localHasData: hasUserData(getState()) });
        if (decision === "push") await push();
        else if (decision === "pull") await pull();
        else if (decision === "conflict") { setConflict({ remoteAt: data!.updated_at }); setStatus({ state: "conflict", email }); }
        else setStatus({ state: "synced", at: readMeta()?.remoteUpdatedAt ?? undefined, email });
      } finally { busy.current = false; }
    };

    const unsub = subscribeState(() => {
      if (applyingRemote.current) return;
      const m = readMeta();
      writeMeta({ userId: uid, remoteUpdatedAt: m?.userId === uid ? m.remoteUpdatedAt : null, localDirty: true });
      if (status.state === "conflict") return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => { void reconcile(); }, 2000);
    });
    const metaName = (session?.user.user_metadata?.display_name as string | undefined)?.trim();
    if (metaName && !getState().settings.displayName) updateSettings({ displayName: metaName.slice(0, 40) });
    const onFocus = () => { void reconcile(); };
    window.addEventListener("focus", onFocus);
    void reconcile();
    (window as unknown as { __ledgrSync?: { push: () => Promise<void>; pull: () => Promise<void> } }).__ledgrSync = { push, pull };
    return () => { unsub(); window.removeEventListener("focus", onFocus); if (pushTimer.current) clearTimeout(pushTimer.current); setBlobSync(null, null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, email]);

  const resolve = async (keep: "cloud" | "device") => {
    const api = (window as unknown as { __ledgrSync?: { push: () => Promise<void>; pull: () => Promise<void> } }).__ledgrSync;
    setConflict(null);
    if (keep === "cloud") await api?.pull(); else await api?.push();
  };

  return (
    <Modal open={!!conflict} onClose={() => undefined} title="Choose which journal to keep" size="sm"
      footer={<><Button onClick={() => resolve("device")}>Keep this device</Button><Button variant="accent" onClick={() => resolve("cloud")}>Keep cloud copy</Button></>}>
      <p className="text-sm text-text-2">This device and your Ledgr account both have changes. The cloud copy was last saved {conflict ? `${fmtDate(conflict.remoteAt)} ${fmtTime(conflict.remoteAt)}` : ""}.</p>
      <p className="mt-3 text-sm text-text-2">The copy you don't keep will be replaced. If you're unsure, download a backup first from Settings → Data.</p>
    </Modal>
  );
}
