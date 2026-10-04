// Percorsi dei file in Cloud Storage, usati dal browser e dalle Functions (vedi storage.rules).

export function logoPath(companyId: string): string {
  return `companies/${companyId}/branding/logo`;
}

/** Copia del logo congelata all'emissione: sostituire il logo dopo non cambia i PDF già emessi. */
export function quoteLogoPath(companyId: string, quoteId: string): string {
  return `companies/${companyId}/quotes/${quoteId}/logo`;
}

export function quotePdfPath(companyId: string, quoteId: string, fileName: string): string {
  return `companies/${companyId}/quotes/${quoteId}/${fileName}`;
}

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg'] as const;
