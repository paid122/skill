"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ClassicDashboard from "./ClassicDashboard";
import NewDashboard from "./NewDashboard";

/** The new dashboard layout is in preview: open /dashboard?layout=new to see it. */
function DashboardSwitch() {
  const params = useSearchParams();
  return params.get("layout") === "new" ? <NewDashboard /> : <ClassicDashboard />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardSwitch />
    </Suspense>
  );
}
