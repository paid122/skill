"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { supabaseConfigured, useSession } from "@/lib/supabase";

/** Primary call to action: sign up when accounts are enabled, otherwise open the app directly. */
export function CtaLink({ children, className }: { children: ReactNode; className?: string }) {
  const session = useSession();
  const href = session ? "/dashboard" : supabaseConfigured ? "/signup" : "/dashboard";
  return <Link href={href} className={className}>{children}</Link>;
}
