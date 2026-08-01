import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { requireHousehold } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  await requireHousehold();

  return (
    <>
      <AppHeader />
      <main id="main" className="app-main">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
