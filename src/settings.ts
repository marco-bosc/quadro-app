import { doc, getDoc, runTransaction, type Firestore } from 'firebase/firestore';
import { parseSettings, validateSettings, type CompanySettings } from '../shared/quote';
import { SaveError } from './quotes';

export interface Company {
  id: string;
  name: string;
  settings: CompanySettings;
  /** Versione delle impostazioni salvate; 0 se non sono mai state salvate. */
  settingsVersion: number;
}

function settingsVersionOf(data: Record<string, unknown> | undefined): number {
  const settings = data?.settings as Record<string, unknown> | undefined;
  return typeof settings?.version === 'number' ? settings.version : 0;
}

export async function getCompany(db: Firestore, companyId: string): Promise<Company> {
  const snap = await getDoc(doc(db, 'companies', companyId));
  const data = snap.data();
  return {
    id: companyId,
    name: typeof data?.name === 'string' ? data.name : '',
    settings: parseSettings(data?.settings),
    settingsVersion: settingsVersionOf(data),
  };
}

/**
 * Salva le impostazioni solo se nessuno le ha modificate dopo che sono state aperte
 * (stesso controllo di versione delle bozze). Restituisce la nuova versione.
 */
export async function saveSettings(
  db: Firestore,
  companyId: string,
  expectedVersion: number,
  settings: CompanySettings,
): Promise<number> {
  const issues = validateSettings(settings);
  if (issues.length > 0) throw new SaveError('invalid', issues.map((i) => i.message).join(' '));
  const ref = doc(db, 'companies', companyId);
  return runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (settingsVersionOf(current.data()) !== expectedVersion) {
      throw new SaveError(
        'conflict',
        'Le impostazioni sono state modificate altrove dopo che le hai aperte. Le tue modifiche non sono state salvate.',
      );
    }
    const version = expectedVersion + 1;
    tx.update(ref, {
      settings: {
        taxRegime: settings.taxRegime,
        defaultVatCode: settings.defaultVatCode,
        hourlyRate: settings.hourlyRate,
        defaultValidityText: settings.defaultValidityText,
        defaultPaymentTermsText: settings.defaultPaymentTermsText,
        version,
      },
    });
    return version;
  });
}
