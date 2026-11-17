export default function Loading() {
  return (
    <div className="loading-screen" aria-busy="true" aria-live="polite">
      <span className="loading-ring" aria-hidden />
      <span className="loading-label">Loading…</span>
    </div>
  );
}
