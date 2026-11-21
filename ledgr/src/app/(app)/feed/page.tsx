"use client";
import { MessageCircle, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { Crews, Feed, Messages, ProfileEditor } from "@/components/community/sections";
import { ButtonLink, EmptyState, Segmented } from "@/components/ui";
import { myProfile, type Profile } from "@/lib/community";
import { supabaseConfigured, useSession } from "@/lib/supabase";

type Tab = "feed" | "crews" | "messages" | "profile";

export default function CommunityPage() {
  return <Suspense><Community /></Suspense>;
}

function Community() {
  const session = useSession();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "feed");
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const me = session?.user.id ?? null;
  const dmWith = params.get("dm");
  useEffect(() => { if (dmWith) setTab("messages"); }, [dmWith]);
  useEffect(() => {
    if (!me) return;
    myProfile(me).then(setProfile).catch((e: Error) => { setError(e.message); setProfile(null); });
  }, [me]);

  const intro = <PageIntro title="Community" sub="Traders journaling the process together. Posts, stories, crews and messages. No signals, no financial advice." actions={profile ? <Segmented ariaLabel="Community view" value={tab} onChange={setTab} options={[{ value: "feed", label: "Feed" }, { value: "crews", label: "Crews" }, { value: "messages", label: "Messages" }, { value: "profile", label: "Profile" }]} /> : undefined} />;

  if (!supabaseConfigured) return <div className="flex flex-col gap-6">{intro}<EmptyState icon={<Users size={18} />} title="The community needs LEDGR's cloud" body="This deployment doesn't have Supabase set up, so there's nowhere to share posts yet." /></div>;
  if (session === undefined || (me && profile === undefined)) return <div className="flex flex-col gap-6">{intro}<p className="py-16 text-center text-[13px] text-muted">Loading…</p></div>;
  if (!me) return <div className="flex flex-col gap-6">{intro}<EmptyState icon={<Users size={18} />} title="Sign in to join the community" body="Share your trading days, join crews and message other traders. Your journal stays private." action={<div className="flex gap-2"><ButtonLink href="/signup" variant="accent">Create account</ButtonLink><ButtonLink href="/login">Log in</ButtonLink></div>} /></div>;
  if (error) return <div className="flex flex-col gap-6">{intro}<EmptyState icon={<MessageCircle size={18} />} title="The community isn't available yet" body={error} /></div>;
  if (!profile) return <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">{intro}<ProfileEditor me={me} profile={null} first onSaved={setProfile} /></div>;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      {intro}
      {tab === "feed" && <Feed me={me} profile={profile} />}
      {tab === "crews" && <Crews me={me} profile={profile} />}
      {tab === "messages" && <Messages me={me} startWith={dmWith} />}
      {tab === "profile" && <ProfileEditor me={me} profile={profile} onSaved={setProfile} />}
    </div>
  );
}
