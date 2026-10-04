// Istantanea → definizione pdfmake. Funzione pura: usa solo i dati congelati all'emissione.

import type { Content, ContentTable, CustomTableLayout, Style, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatEuro, formatPercent, formatQuantity } from '../../../shared/format';
import { divRoundHalfUp } from '../../../shared/money';
import type { QuoteLine, QuoteSection } from '../../../shared/quote';
import type { QuoteSnapshot } from '../../../shared/snapshot';
import { PLACEHOLDER_PREFIX, type VatCode } from '../../../shared/vat';

const INK = '#1B2433';
const TEXT_2 = '#3D4555';
const TEXT_3 = '#5A6170';
const LINE = '#D9D3C6';
const WARNING = '#A8460C';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const VAT_SHORT: Record<VatCode, string> = { VAT22: '22%', VAT10: '10%', RC_ATER: 'RC', RC_A: 'RC', FORF: '—' };

export interface PdfLogo {
  /** data URL (image/png o image/jpeg) */
  dataUrl: string;
}

/** "2026-10-04" → "4 ottobre 2026" (senza passare da Date: niente problemi di fuso). */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Sul PDF i prezzi unitari hanno 2 decimali (DECISIONI.md), arrotondati half-up. */
function unitPrice(tenThousandths: number | null): string {
  return tenThousandths === null ? '' : formatEuro(Number(divRoundHalfUp(BigInt(tenThousandths), 100n)));
}

function quantity(line: QuoteLine): string {
  return line.quantityMilli === null ? '' : `${formatQuantity(line.quantityMilli)} ${line.unit}`;
}

function legendText(legend: string): Content {
  if (!legend.startsWith(PLACEHOLDER_PREFIX)) return { text: legend, color: TEXT_2 };
  return { text: [{ text: PLACEHOLDER_PREFIX, bold: true, color: WARNING }, legend.slice(PLACEHOLDER_PREFIX.length)], color: TEXT_2 };
}

function descriptionCell(line: QuoteLine): TableCell {
  return line.itemCode
    ? { stack: [line.description, { text: `Cod. ${line.itemCode}`, fontSize: 8, color: TEXT_3 }] }
    : { text: line.description };
}

const tableLayout: CustomTableLayout = {
  hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.4),
  vLineWidth: () => 0,
  hLineColor: (i: number) => (i === 1 ? INK : LINE),
  paddingLeft: (i: number) => (i === 0 ? 0 : 6),
  paddingRight: (i: number, node: ContentTable) => (i === (Array.isArray(node.table.widths) ? node.table.widths.length : 1) - 1 ? 0 : 6),
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

export function buildPdfDefinition(snapshot: QuoteSnapshot, logo: PdfLogo | null): TDocumentDefinitions {
  const { company, content, totals, number } = snapshot;
  // Un'istantanea emessa è sempre completa; se mancasse un importo la cella resta vuota, mai "0,00 €".
  const amountText = (id: string) => {
    const value = totals.lineAmounts[id];
    return value === null || value === undefined ? '' : formatEuro(value);
  };
  const subtotal = (sectionId: string) => totals.sectionSubtotals.find((s) => s.sectionId === sectionId)?.amountCents ?? 0;
  const allLines = content.sections.flatMap((s) => s.lines);
  const showDiscount = allLines.some((l) => l.type !== 'text' && !l.optional && l.discountBp > 0);
  const usedCodes = new Set(Object.values(totals.lineVatCodes));
  const showVat = company.taxRegime === 'ordinary' && usedCodes.size > 1;
  const optionalLines = content.sections.flatMap((s) => s.lines.filter((l) => l.optional && l.type !== 'text'));

  // ---------- Intestazione ----------
  const companyLines: Content[] = [
    { text: company.legalName, style: 'companyName' },
    company.address,
    `P. IVA ${company.vatNumber}${company.taxCode ? ` · C.F. ${company.taxCode}` : ''}`,
    [company.phone, company.email].filter(Boolean).join(' · '),
    company.website,
  ].filter((l) => l !== '');

  const header: Content = {
    columns: [
      {
        width: '*',
        stack: [...(logo ? [{ image: logo.dataUrl, fit: [150, 60] as [number, number], margin: [0, 0, 0, 8] as [number, number, number, number] }] : []), ...companyLines],
        fontSize: 9,
        color: TEXT_2,
      },
      {
        width: 'auto',
        alignment: 'right',
        stack: [
          { text: 'Preventivo', style: 'docTitle' },
          { text: `N. ${number.display}`, bold: true, fontSize: 11 },
          { text: formatIsoDate(snapshot.issueDate), color: TEXT_2 },
        ],
      },
    ],
    margin: [0, 0, 0, 18],
  };

  const customer: Content = {
    columns: [
      {
        width: '*',
        stack: [{ text: 'SPETT.LE', style: 'label' }, { text: content.customer.name || '—', bold: true }, content.customer.contact].filter(
          (l) => l !== '',
        ),
      },
      {
        width: '*',
        stack: [{ text: 'LUOGO DELL’INTERVENTO', style: 'label' }, content.customer.siteAddress || '—'],
      },
    ],
    columnGap: 20,
    margin: [0, 0, 0, 14],
  };

  const subject: Content[] = content.title ? [{ text: 'OGGETTO', style: 'label' }, { text: content.title, style: 'subject' }] : [];

  // ---------- Corpo ----------
  function sectionTitle(section: QuoteSection, index: number): Content {
    return {
      text: [{ text: `${index + 1}  `, color: '#1F3F99' }, section.title || `Sezione ${index + 1}`],
      style: 'sectionTitle',
    };
  }

  function linesTable(section: QuoteSection): Content | null {
    const lines = section.lines.filter((l) => !l.optional);
    if (lines.length === 0) return null;
    const headerRow: TableCell[] = [
      { text: 'Descrizione', style: 'th' },
      { text: 'Q.tà', style: 'th', alignment: 'right' },
      { text: 'Prezzo', style: 'th', alignment: 'right' },
      ...(showDiscount ? [{ text: 'Sconto', style: 'th', alignment: 'right' } as TableCell] : []),
      ...(showVat ? [{ text: 'IVA', style: 'th', alignment: 'right' } as TableCell] : []),
      { text: 'Importo', style: 'th', alignment: 'right' },
    ];
    const cols = headerRow.length;
    const body: TableCell[][] = [headerRow];
    for (const line of lines) {
      if (line.type === 'text') {
        body.push([{ text: line.description, italics: true, color: TEXT_2, colSpan: cols }, ...Array<TableCell>(cols - 1).fill('')]);
        continue;
      }
      body.push([
        descriptionCell(line),
        { text: quantity(line), alignment: 'right', noWrap: true },
        { text: unitPrice(line.unitPriceTenThousandths), alignment: 'right', noWrap: true },
        ...(showDiscount ? [{ text: line.discountBp > 0 ? formatPercent(line.discountBp) : '', alignment: 'right' } as TableCell] : []),
        ...(showVat ? [{ text: VAT_SHORT[totals.lineVatCodes[line.id]], alignment: 'right' } as TableCell] : []),
        { text: amountText(line.id), alignment: 'right', noWrap: true },
      ]);
    }
    body.push([
      { text: 'Totale sezione', bold: true, colSpan: cols - 1 },
      ...Array<TableCell>(cols - 2).fill(''),
      { text: formatEuro(subtotal(section.id)), bold: true, alignment: 'right', noWrap: true },
    ]);
    return {
      table: { headerRows: 1, widths: ['*', ...Array(cols - 1).fill('auto')], body, dontBreakRows: true },
      layout: tableLayout,
      margin: [0, 0, 0, 12],
    };
  }

  function descriptionsOnly(section: QuoteSection, withSubtotal: boolean): Content[] {
    const items: Content[] = section.lines
      .filter((l) => !l.optional)
      .map((l) => (l.type === 'text' ? { text: l.description, italics: true, color: TEXT_2 } : { text: `• ${l.description}` }));
    const out: Content[] = [{ stack: items, margin: [12, 0, 0, 4] }];
    if (withSubtotal) {
      out.push({
        columns: [{ text: 'Totale sezione', bold: true }, { text: formatEuro(subtotal(section.id)), bold: true, alignment: 'right', width: 'auto' }],
        margin: [0, 2, 0, 12],
      });
    } else {
      out.push({ text: '', margin: [0, 0, 0, 8] });
    }
    return out;
  }

  const body: Content[] = content.sections.flatMap((section, i) => {
    if (content.pdfDetail === 'lines') {
      const table = linesTable(section);
      return [sectionTitle(section, i), ...(table ? [table] : [{ text: '', margin: [0, 0, 0, 8] } as Content])];
    }
    return [sectionTitle(section, i), ...descriptionsOnly(section, content.pdfDetail === 'sections')];
  });

  const optional: Content[] =
    optionalLines.length === 0
      ? []
      : [
          { text: 'Voci opzionali (non incluse nel totale)', style: 'sectionTitle' },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Descrizione', style: 'th' },
                  { text: 'Q.tà', style: 'th', alignment: 'right' },
                  { text: 'Prezzo', style: 'th', alignment: 'right' },
                  { text: 'Importo', style: 'th', alignment: 'right' },
                ],
                ...optionalLines.map((l): TableCell[] => [
                  descriptionCell(l),
                  { text: quantity(l), alignment: 'right', noWrap: true },
                  { text: unitPrice(l.unitPriceTenThousandths), alignment: 'right', noWrap: true },
                  { text: amountText(l.id), alignment: 'right', noWrap: true },
                ]),
              ],
              dontBreakRows: true,
            },
            layout: tableLayout,
            margin: [0, 0, 0, 12],
          },
        ];

  // ---------- Riepilogo ----------
  const summaryRows: TableCell[][] = [[{ text: 'Imponibile' }, { text: formatEuro(totals.taxableCents), alignment: 'right' }]];
  if (totals.finalDiscountCents > 0) {
    summaryRows.push([{ text: 'Sconto' }, { text: `−${formatEuro(totals.finalDiscountCents)}`, alignment: 'right' }]);
    summaryRows.push([{ text: 'Imponibile scontato' }, { text: formatEuro(totals.discountedTaxableCents), alignment: 'right' }]);
  }
  for (const group of totals.vatGroups) {
    const label = snapshot.vatTexts.find((t) => t.code === group.code)?.label ?? group.code;
    summaryRows.push(
      group.rateBp > 0
        ? [{ text: `${label} su ${formatEuro(group.discountedTaxableCents)}` }, { text: formatEuro(group.vatCents), alignment: 'right' }]
        : [{ text: label }, { text: 'senza IVA', alignment: 'right', color: TEXT_3 }],
    );
  }
  summaryRows.push([
    { text: totals.vatCents > 0 ? 'Totale IVA inclusa' : 'Totale', style: 'total' },
    { text: formatEuro(totals.totalCents), style: 'total', alignment: 'right', noWrap: true },
  ]);
  const summary: Content = {
    columns: [
      { width: '*', text: '' },
      {
        width: 'auto',
        table: { widths: [200, 'auto'], body: summaryRows },
        layout: {
          hLineWidth: (i: number, node: ContentTable) => (i === node.table.body.length - 1 ? 0.8 : 0),
          vLineWidth: () => 0,
          hLineColor: () => INK,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    margin: [0, 6, 0, 12],
    unbreakable: true,
  };

  const legends: Content[] = snapshot.vatTexts
    .filter((t) => t.legend)
    .map((t) => ({ ...(legendText(t.legend!) as object), fontSize: 8.5, margin: [0, 0, 0, 4] }) as Content);

  // Etichetta e testo restano sulla stessa pagina.
  const term = (label: string, text: string): Content[] =>
    text ? [{ stack: [{ text: label, style: 'label' }, { text }], margin: [0, 0, 0, 8], unbreakable: true }] : [];
  const terms: Content[] = [
    ...term('VALIDITÀ DELL’OFFERTA', content.validityText),
    ...term('CONDIZIONI DI PAGAMENTO', content.paymentTermsText),
    ...term('NOTE', content.notes),
  ];

  const signature: Content = {
    columns: [
      {
        width: '*',
        stack: [{ text: 'IL PREVENTIVO È REDATTO DA', style: 'label' }, { text: company.signerName || company.legalName, bold: true }, company.legalName !== company.signerName && company.signerName ? company.legalName : ''],
      },
      {
        width: 220,
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: 'Per accettazione', bold: true, margin: [0, 0, 0, 18] },
                  { text: 'Data ______________________', margin: [0, 0, 0, 18] },
                  { text: 'Firma del cliente ___________________' },
                ],
                margin: [6, 6, 6, 8],
              },
            ],
          ],
        },
        layout: { hLineColor: () => INK, vLineColor: () => INK, hLineWidth: () => 0.8, vLineWidth: () => 0.8 },
      },
    ],
    columnGap: 20,
    margin: [0, 16, 0, 0],
    unbreakable: true,
  };

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    info: { title: `Preventivo ${number.display}`, author: company.legalName, subject: content.title },
    // Senza legature ("fi", "fl"): il testo copiato dal PDF resta identico all'originale.
    // pdfmake passa fontFeatures a fontkit, che le disattiva solo con un oggetto { liga: false }
    // (i tipi di pdfmake prevedono solo una lista di nomi da attivare).
    defaultStyle: { font: 'Body', fontSize: 9.5, color: INK, lineHeight: 1.2, fontFeatures: { liga: false } as unknown as Style['fontFeatures'] },
    styles: {
      docTitle: { font: 'Display', fontSize: 22, margin: [0, 0, 0, 2] },
      companyName: { font: 'Display', fontSize: 13, color: INK, margin: [0, 0, 0, 2] },
      label: { fontSize: 7.5, bold: true, color: TEXT_3, characterSpacing: 0.6, margin: [0, 0, 0, 2] },
      subject: { font: 'Display', fontSize: 15, margin: [0, 0, 0, 14] },
      sectionTitle: { font: 'Display', fontSize: 12, margin: [0, 6, 0, 6] },
      th: { fontSize: 8, bold: true, color: TEXT_3 },
      total: { font: 'Display', fontSize: 13 },
    },
    content: [header, customer, ...subject, ...body, ...optional, summary, ...legends, { text: '', margin: [0, 6, 0, 0] }, ...terms, signature],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Preventivo ${number.display}`, color: TEXT_3 },
        { text: `Pagina ${currentPage} di ${pageCount}`, alignment: 'right', color: TEXT_3 },
      ],
      fontSize: 8,
      margin: [40, 16, 40, 0],
    }),
  };
}
