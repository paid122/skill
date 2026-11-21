"use client";
import { BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { loadBadges } from "@/lib/community";
import { cx } from "@/lib/util";

/** The OWNER / CO-OWNER tag next to a name. */
export function useBadge(userId: string | undefined) {
  const [b, setB] = useState<"Owner" | "Co-owner" | null>(null);
  useEffect(() => { if (userId) void loadBadges().then((m) => setB(m[userId] ?? null)); }, [userId]);
  return b;
}

export function RoleTag({ userId, className }: { userId: string | undefined; className?: string }) {
  const b = useBadge(userId);
  if (!b) return null;
  return (
    <span className={cx("ml-1.5 inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#f2c14e] to-[#e0a83a] px-1.5 py-[1px] align-middle text-[10.5px] font-bold uppercase tracking-[0.08em] text-black", className)} title={b === "Owner" ? "LEDGR's owner" : "LEDGR co-owner"}>
      <BadgeCheck size={11} strokeWidth={2.5} />{b}
    </span>
  );
}
