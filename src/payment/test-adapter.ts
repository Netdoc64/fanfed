import { PaymentWebhookError, type PaymentAdapter, type PaymentEvent } from './adapter';

export const TEST_SIGNATUR_HEADER = 'x-test-signatur';

export interface TestPaymentConfig {
  /** Geheimnis für die Webhook-Signatur; Tests erzeugen ihr eigenes. */
  schluessel: string;
}

const PREFIX = 'test-';
const encoder = new TextEncoder();

async function hmacHex(schluessel: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(schluessel), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signiert einen Webhook-Body, wie es der Test-Adapter erwartet (für Tests). */
export function signTestWebhook(schluessel: string, body: string): Promise<string> {
  return hmacHex(schluessel, body);
}

/** Der einzige Adapter dieser Phase: kein Anbieter, kein Netz, kein Geld. */
export function createTestPaymentAdapter(config: TestPaymentConfig): PaymentAdapter {
  return {
    name: 'test',
    async createCheckout(_tier, betragCent) {
      if (!Number.isSafeInteger(betragCent) || betragCent < 0) throw new RangeError('betragCent muss ganze Cent >= 0 sein');
      return { referenz: PREFIX + crypto.randomUUID() };
    },
    async verifyWebhook(request) {
      const body = await request.text();
      const gesendet = request.headers.get(TEST_SIGNATUR_HEADER) ?? '';
      if (!gleich(gesendet, await hmacHex(config.schluessel, body))) {
        throw new PaymentWebhookError('SIGNATUR_UNGUELTIG');
      }
      let daten: { art?: unknown; subscriptionId?: unknown; gueltigBis?: unknown };
      try {
        daten = JSON.parse(body);
      } catch {
        throw new PaymentWebhookError('PAYLOAD_UNGUELTIG');
      }
      if (!daten || typeof daten.subscriptionId !== 'string' || !daten.subscriptionId) {
        throw new PaymentWebhookError('PAYLOAD_UNGUELTIG');
      }
      const subscriptionId = daten.subscriptionId;
      if (daten.art === 'cancel') return { art: 'cancel', subscriptionId } satisfies PaymentEvent;
      if (daten.art === 'activate') {
        const bis = typeof daten.gueltigBis === 'string' ? new Date(daten.gueltigBis) : new Date(NaN);
        if (Number.isNaN(bis.getTime())) throw new PaymentWebhookError('PAYLOAD_UNGUELTIG');
        return { art: 'activate', subscriptionId, gueltigBis: bis };
      }
      throw new PaymentWebhookError('EREIGNIS_UNBEKANNT');
    },
  };
}
