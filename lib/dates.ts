/** "Sat 22 May · 11:00 am", or a dash when no date is set. */
export function formatWhen(value?: string | null): string {
  if (!value) return 'No date yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date yet';
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
