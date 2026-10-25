import { logError } from '../db';
import { activateSubscription, cancelSubscription } from '../subscription';
import { PaymentWebhookError, type PaymentAdapter } from './adapter';

export type WebhookOutcome =
  | { status: 'aktiviert' | 'gekuendigt'; subscriptionId: string }
  | { status: 'abgewiesen'; code: string };

const BEREICH = 'payment';

/**
 * Verarbeitet einen Webhook: prüfen, dann Abo aktivieren/kündigen. Jeder
 * Fehlschlag landet in error_logs (nur Code, keine personenbezogenen Daten).
 * Bewusst nicht an eine öffentliche Route gehängt.
 */
export async function handlePaymentWebhook(
  db: D1Database,
  adapter: PaymentAdapter,
  request: Request,
): Promise<WebhookOutcome> {
  const abgewiesen = async (code: string): Promise<WebhookOutcome> => {
    await logError(db, { bereich: BEREICH, code });
    return { status: 'abgewiesen', code };
  };
  let event;
  try {
    event = await adapter.verifyWebhook(request);
  } catch (e) {
    return abgewiesen(e instanceof PaymentWebhookError ? e.code : 'WEBHOOK_FEHLER');
  }
  try {
    if (event.art === 'activate') {
      if (!(await activateSubscription(db, event.subscriptionId, event.gueltigBis))) {
        return abgewiesen('ABO_UNBEKANNT');
      }
      return { status: 'aktiviert', subscriptionId: event.subscriptionId };
    }
    if (!(await cancelSubscription(db, event.subscriptionId))) return abgewiesen('KUENDIGUNG_FEHLGESCHLAGEN');
    return { status: 'gekuendigt', subscriptionId: event.subscriptionId };
  } catch {
    return abgewiesen('ABO_UPDATE_FEHLER');
  }
}
