// Dati di intestazione dell'azienda, stampati sui preventivi emessi.

export const COMPANY_LIMITS = {
  legalName: 200,
  vatNumber: 11,
  taxCode: 16,
  address: 300,
  phone: 50,
  email: 200,
  website: 200,
  signerName: 200,
} as const;

export interface CompanyProfile {
  legalName: string;
  vatNumber: string;
  /** Facoltativo */
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  /** Facoltativo */
  website: string;
  signerName: string;
}

export const EMPTY_PROFILE: CompanyProfile = {
  legalName: '',
  vatNumber: '',
  taxCode: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  signerName: '',
};

/** Partita IVA italiana: 11 cifre, l'ultima è il carattere di controllo. */
export function isValidVatNumber(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const d = [...value].map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      sum += d[i];
    } else {
      const doubled = d[i] * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  return (10 - (sum % 10)) % 10 === d[10];
}

/** Codice fiscale: 16 caratteri alfanumerici (persona) oppure 11 cifre (società). Solo controllo di forma. */
export function isValidTaxCode(value: string): boolean {
  return /^[A-Z0-9]{16}$/.test(value) || /^\d{11}$/.test(value);
}

export interface ProfileIssue {
  field: keyof CompanyProfile;
  message: string;
}

/** Problemi che impediscono il salvataggio dei dati (campi facoltativi vuoti ammessi). */
export function validateProfile(p: CompanyProfile): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  for (const field of Object.keys(COMPANY_LIMITS) as (keyof CompanyProfile)[]) {
    if (p[field].length > COMPANY_LIMITS[field]) {
      issues.push({ field, message: `Al massimo ${COMPANY_LIMITS[field]} caratteri.` });
    }
  }
  if (p.vatNumber && !isValidVatNumber(p.vatNumber)) {
    issues.push({ field: 'vatNumber', message: 'Partita IVA non valida: servono 11 cifre con il carattere di controllo corretto.' });
  }
  if (p.taxCode && !isValidTaxCode(p.taxCode)) {
    issues.push({ field: 'taxCode', message: 'Codice fiscale non valido: 16 caratteri oppure 11 cifre.' });
  }
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    issues.push({ field: 'email', message: 'Email non valida.' });
  }
  return issues;
}

/** Dati minimi per emettere: ragione sociale, partita IVA valida, indirizzo. */
export function missingForIssue(p: CompanyProfile): (keyof CompanyProfile)[] {
  const missing: (keyof CompanyProfile)[] = [];
  if (!p.legalName.trim()) missing.push('legalName');
  if (!isValidVatNumber(p.vatNumber)) missing.push('vatNumber');
  if (!p.address.trim()) missing.push('address');
  return missing;
}
