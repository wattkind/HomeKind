import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";

// P2: requireHousehold — this layout will gate on an authenticated
// household session once auth lands; no auth yet in P0.
export default function AppShellLayout({ children }: { children: ReactNode }) {
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
