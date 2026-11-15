"use client";
import { ExternalLink, GraduationCap, PlayCircle, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { saveFolder, saveNote } from "@/lib/actions";
import { useEnriched } from "@/lib/hooks";
import { getState } from "@/lib/store";
import { buildStudyPlan, youtubeSearchUrl, type StudyFocus } from "@/lib/studyPlan";
import { nowISO, uid } from "@/lib/util";

interface Video { id: string; title: string; channel: string; thumb: string }

/** Turns a suggested video into a study note: the video embedded, why it was suggested, and what to look for. */
function startNote(focus: StudyFocus, v: Video) {
  const s = getState();
  let folderId = s.studyFolders.find((f) => f.name === "Study plan")?.id;
  if (!folderId) {
    folderId = uid("fld");
    saveFolder({ id: folderId, name: "Study plan", createdAt: nowISO() });
  }
  const t = nowISO();
  const id = uid("note");
  saveNote({
    id, folderId, pinned: false, createdAt: t, updatedAt: t,
    title: `${focus.title}: ${v.title}`.slice(0, 120),
    videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
    blocks: [
      { id: uid("b"), type: "quote", text: focus.why },
      { id: uid("b"), type: "heading", level: 2, text: "What to look for" },
      { id: uid("b"), type: "check", text: focus.watchFor, checked: false },
      { id: uid("b"), type: "heading", level: 2, text: "My notes" },
      { id: uid("b"), type: "paragraph", text: "" },
      { id: uid("b"), type: "heading", level: 2, text: "One rule I'll try next session" },
      { id: uid("b"), type: "check", text: "", checked: false },
    ],
  });
  return id;
}

function FocusVideos({ focus, configured }: { focus: StudyFocus; configured: boolean | null }) {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!configured) return;
    let live = true;
    fetch(`/api/youtube?q=${encodeURIComponent(focus.queries[0])}`)
      .then((r) => r.json())
      .then((j: { videos?: Video[] }) => { if (live) setVideos((j.videos ?? []).slice(0, 3)); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [configured, focus.queries]);

  if (configured && !error && videos === null) {
    return <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="aspect-video animate-pulse rounded-xl bg-card-2" />)}</div>;
  }
  if (configured && videos?.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {videos.map((v) => (
          <div key={v.id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-line-soft bg-card-2/40">
            <button type="button" onClick={() => router.push(`/study?note=${startNote(focus, v)}`)} className="relative block aspect-video overflow-hidden" aria-label={`Study “${v.title}” in a note`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumb} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
              <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30"><PlayCircle size={36} className="text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" /></span>
            </button>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="line-clamp-2 text-[13px] font-medium leading-snug text-text">{v.title}</p>
              <p className="truncate text-[11.5px] text-muted">{v.channel}</p>
              <div className="mt-auto flex items-center gap-2">
                <Button size="sm" variant="accent" icon={<GraduationCap size={13} />} onClick={() => router.push(`/study?note=${startNote(focus, v)}`)}>Study this</Button>
                <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-text-2 hover:text-text">YouTube <ExternalLink size={11} /></a>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  // No API key (or no results): real YouTube searches, never made-up links.
  return (
    <div className="flex flex-wrap gap-2">
      {focus.queries.map((q) => (
        <a key={q} href={youtubeSearchUrl(q)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-text-2 hover:text-text">
          <Search size={12} /> {q}
        </a>
      ))}
    </div>
  );
}

/** "Your study plan": what your records say to work on next, with videos for each. */
export function StudyPlan() {
  const all = useEnriched();
  const plan = useMemo(() => buildStudyPlan(all), [all]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/youtube").then((r) => r.json()).then((j: { configured?: boolean }) => setConfigured(!!j.configured)).catch(() => setConfigured(false));
  }, []);

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-text"><Sparkles size={15} className="text-accent" /> Your study plan</p>
          <p className="mt-1 text-[13px] text-text-2">{plan.focus.length ? `Built from your last ${plan.sample} closed trades — what to work on next, with videos for each.` : "Close at least 5 trades and LEDGR will suggest what to study, with videos."}</p>
        </div>
      </div>
      {plan.focus.length > 0 && (
        <ol className="grid gap-6">
          {plan.focus.map((f, i) => (
            <li key={f.key} className="grid gap-3 border-t border-line-soft pt-5 first:border-0 first:pt-0">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card-2 text-[12px] font-semibold text-text">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-text">{f.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-2">{f.why}</p>
                  <p className="mt-1 text-[12.5px] text-muted">Look for: {f.watchFor}</p>
                </div>
              </div>
              <div className="sm:pl-9"><FocusVideos focus={f} configured={configured} /></div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-5 text-[11.5px] text-muted">Videos are by other creators, found on YouTube for each topic; LEDGR doesn't make or endorse them. Based on your own records only — not financial advice.</p>
    </Card>
  );
}
