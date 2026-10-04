// Icone a linea (DESIGN §4), sempre decorative: il testo o l'aria-label del pulsante dice cosa fanno.

const common = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function BackIcon() {
  return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
}

export function ArrowRightIcon() {
  return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
}

export function UpIcon() {
  return <svg {...common}><path d="M6 15l6-6 6 6" /></svg>;
}

export function DownIcon() {
  return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
}

export function PlusIcon() {
  return <svg {...common} width={18} height={18}><path d="M12 5v14M5 12h14" /></svg>;
}
