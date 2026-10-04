const dateTime = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' });
const time = new Intl.DateTimeFormat('it-IT', { timeStyle: 'short' });

export function formatDateTime(date: Date | null): string {
  return date ? dateTime.format(date) : '—';
}

export function formatTime(date: Date): string {
  return time.format(date);
}
