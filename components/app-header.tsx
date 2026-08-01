import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

export function AppHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="app-header">
      <Wordmark />
      {action ? <div>{action}</div> : null}
    </header>
  );
}
