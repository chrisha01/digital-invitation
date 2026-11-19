export default function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-screen" aria-busy="true" aria-live="polite">
      <span className="loading-ring" aria-hidden />
      <span className="loading-label">{label}</span>
    </div>
  );
}
