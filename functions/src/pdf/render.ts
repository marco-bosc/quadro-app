import { existsSync } from 'node:fs';
import path from 'node:path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- pdfmake 0.3 esporta un'istanza CommonJS
const pdfmake = require('pdfmake') as {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  setLocalAccessPolicy(cb: (p: string) => boolean): void;
  createPdf(doc: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

/** Cartella functions/fonts, sia dal sorgente (test) sia dal codice compilato in lib/. */
function findFontsDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'fonts');
    if (existsSync(path.join(candidate, 'instrument-sans-latin-400.woff'))) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error('Font del PDF non trovati');
}

let configured = false;

function configure() {
  if (configured) return;
  const dir = findFontsDir();
  const f = (name: string) => path.join(dir, name);
  pdfmake.setFonts({
    // Non abbiamo un corsivo: i commenti usano il tondo (pdfmake richiede comunque la voce).
    Body: {
      normal: f('instrument-sans-latin-400.woff'),
      bold: f('instrument-sans-latin-700.woff'),
      italics: f('instrument-sans-latin-400.woff'),
      bolditalics: f('instrument-sans-latin-700.woff'),
    },
    Display: {
      normal: f('bricolage-grotesque-latin-700.woff'),
      bold: f('bricolage-grotesque-latin-700.woff'),
      italics: f('bricolage-grotesque-latin-700.woff'),
      bolditalics: f('bricolage-grotesque-latin-700.woff'),
    },
  });
  // Nessuna risorsa esterna: solo i font locali; le immagini arrivano come data URL.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p) => path.resolve(p).startsWith(dir));
  configured = true;
}

export async function renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
  configure();
  return pdfmake.createPdf(definition).getBuffer();
}
