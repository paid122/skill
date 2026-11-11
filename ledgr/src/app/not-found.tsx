import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 text-center text-text">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={40} />
        <h1 className="text-xl font-semibold">This page isn't in the ledger</h1>
        <p className="text-sm text-text-2">The address may be mistyped, or the record was deleted.</p>
        <Link href="/dashboard" className="rounded-[10px] border border-line bg-card-2 px-4 py-2 text-sm hover:border-muted">Go to dashboard</Link>
      </div>
    </div>
  );
}
