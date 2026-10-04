// Operazioni pure sul contenuto della bozza: ognuna restituisce un nuovo oggetto, senza modificare l'originale.

import {
  createLine,
  createSection,
  newId,
  type CompanySettings,
  type LineType,
  type QuoteContent,
  type QuoteLine,
  type QuoteSection,
} from '../../shared/quote';

function move<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function mapSection(content: QuoteContent, sectionId: string, fn: (s: QuoteSection) => QuoteSection): QuoteContent {
  return { ...content, sections: content.sections.map((s) => (s.id === sectionId ? fn(s) : s)) };
}

export function addSection(content: QuoteContent): { content: QuoteContent; sectionId: string } {
  const section = createSection();
  return { content: { ...content, sections: [...content.sections, section] }, sectionId: section.id };
}

export function renameSection(content: QuoteContent, sectionId: string, title: string): QuoteContent {
  return mapSection(content, sectionId, (s) => ({ ...s, title }));
}

export function moveSection(content: QuoteContent, sectionId: string, delta: -1 | 1): QuoteContent {
  const index = content.sections.findIndex((s) => s.id === sectionId);
  return { ...content, sections: move(content.sections, index, delta) };
}

export function deleteSection(content: QuoteContent, sectionId: string): QuoteContent {
  return { ...content, sections: content.sections.filter((s) => s.id !== sectionId) };
}

/** Nuova riga in fondo alla sezione, con l'aliquota predefinita del preventivo. */
export function addLine(
  content: QuoteContent,
  sectionId: string,
  type: LineType,
  settings: CompanySettings,
): { content: QuoteContent; lineId: string } {
  const line = createLine(type, content.defaultVatCode, settings);
  return { content: mapSection(content, sectionId, (s) => ({ ...s, lines: [...s.lines, line] })), lineId: line.id };
}

export function updateLine(content: QuoteContent, sectionId: string, lineId: string, patch: Partial<QuoteLine>): QuoteContent {
  return mapSection(content, sectionId, (s) => ({
    ...s,
    lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...patch, id: l.id } : l)),
  }));
}

/**
 * Cambio di tipo: applica i valori iniziali del nuovo tipo solo dove la riga è ancora vuota,
 * senza mai cancellare quantità o prezzi già inseriti.
 */
export function changeLineType(
  content: QuoteContent,
  sectionId: string,
  lineId: string,
  type: LineType,
  settings: CompanySettings,
): QuoteContent {
  return mapSection(content, sectionId, (s) => ({
    ...s,
    lines: s.lines.map((l) => {
      if (l.id !== lineId) return l;
      const next: QuoteLine = { ...l, type };
      if (type === 'labor') {
        next.unit = 'h';
        if (next.unitPriceTenThousandths === null) next.unitPriceTenThousandths = settings.hourlyRate;
      } else if (type === 'lump_sum') {
        next.unit = 'corpo';
        if (next.quantityMilli === null) next.quantityMilli = 1_000;
      }
      return next;
    }),
  }));
}

export function moveLine(content: QuoteContent, sectionId: string, lineId: string, delta: -1 | 1): QuoteContent {
  return mapSection(content, sectionId, (s) => ({ ...s, lines: move(s.lines, s.lines.findIndex((l) => l.id === lineId), delta) }));
}

/** Copia della riga subito sotto l'originale. */
export function duplicateLine(content: QuoteContent, sectionId: string, lineId: string): { content: QuoteContent; lineId: string } {
  const id = newId();
  const next = mapSection(content, sectionId, (s) => {
    const index = s.lines.findIndex((l) => l.id === lineId);
    if (index < 0) return s;
    const lines = [...s.lines];
    lines.splice(index + 1, 0, { ...s.lines[index], id });
    return { ...s, lines };
  });
  return { content: next, lineId: id };
}

export function deleteLine(content: QuoteContent, sectionId: string, lineId: string): QuoteContent {
  return mapSection(content, sectionId, (s) => ({ ...s, lines: s.lines.filter((l) => l.id !== lineId) }));
}

export { normalizeVatCodes } from '../../shared/quote';
