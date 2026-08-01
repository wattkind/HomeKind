import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="column">
      <div className="empty-state">
        <h1>
          Home
          <span style={{ color: "var(--coral-text)" }}>Kind</span> is offline
        </h1>
        <div className="card">
          <p>
            You&apos;re not connected right now. Any manuals you&apos;ve already opened
            on this device are still available from their device pages.
          </p>
          <p>Everything else — adding devices, receipts and new manuals — needs a connection.</p>
        </div>
        <Link href="/home" className="text-link">
          Back to your home
        </Link>
      </div>
    </div>
  );
}
