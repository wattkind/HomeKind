/** "HomeKind" wordmark: Home in Ink, Kind in Coral (text). */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`.trim()}>
      <span className="wordmark__home">Home</span>
      <span className="wordmark__kind">Kind</span>
    </span>
  );
}

/** The approved HomeKind mark. Always the PNG, never redrawn. */
export function BrandMark({ size = 96 }: { size?: number }) {
  return (
    <img
      className="brand-mark"
      src="./brand/homekind-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
