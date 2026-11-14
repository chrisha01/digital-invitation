export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        gap: '0.75rem',
        padding: '4rem 1rem',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid rgba(0,0,0,0.15)',
          borderTopColor: 'rgba(0,0,0,0.55)',
          animation: 'gatherly-spin 0.8s linear infinite',
        }}
      />
      <span className="muted small">Loading…</span>
      <style>{`@keyframes gatherly-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}