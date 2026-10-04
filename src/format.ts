// Date per l'interfaccia (gli importi sono in shared/format.ts).

const time = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'numeric', year: '2-digit' });
const longDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatTime(date: Date): string {
  return time.format(date);
}

export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

/** "sabato 4 ottobre" per l'intestazione della home. */
export function formatToday(date = new Date()): string {
  return weekday.format(date);
}

/** Date relative per le liste: "oggi alle 10:58", "ieri", "3 giorni fa", poi la data. */
export function formatRelative(date: Date | null, now = new Date()): string {
  if (!date) return '—';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return `oggi alle ${formatTime(date)}`;
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  return shortDate.format(date);
}

/** Stato di salvataggio: "Salvato alle 10:58" oggi, altrimenti con la data. */
export function formatSavedAt(date: Date, now = new Date()): string {
  return startOfDay(date) === startOfDay(now)
    ? `Salvato alle ${formatTime(date)}`
    : `Salvato il ${shortDate.format(date)} alle ${formatTime(date)}`;
}
