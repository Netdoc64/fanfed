import { AgeCallbackError, type AgeVerificationAdapter } from './adapter';

export interface TestAdapterConfig {
  /** Ob die Prüfung besteht oder scheitert. */
  ergebnis: 'bestanden' | 'abgelehnt';
}

const PREFIX = 'test-';

/** Der einzige Adapter dieser Phase: kein Anbieter, das Ergebnis steht in der Konfiguration. */
export function createTestAgeAdapter(config: TestAdapterConfig): AgeVerificationAdapter {
  return {
    name: 'test',
    async start() {
      return { referenz: PREFIX + crypto.randomUUID() };
    },
    async pruefeCallback(payload) {
      const referenz = (payload as { referenz?: unknown } | null)?.referenz;
      if (typeof referenz !== 'string' || !referenz.startsWith(PREFIX)) {
        throw new AgeCallbackError('CALLBACK_UNGUELTIG');
      }
      return { referenz, ergebnis: config.ergebnis };
    },
  };
}
