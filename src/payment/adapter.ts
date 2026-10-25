/**
 * Schnittstelle für Zahlungsanbieter. Der Kern kennt nur diese Form; welcher
 * Anbieter dahintersteht, ist Konfiguration (Phase 0 ist offen). Beträge sind
 * ganzzahlige Cent.
 */
import type { Tier } from '../subscription';

export interface Checkout {
  /** Anbieterseitige Kennung dieses Bezahlvorgangs. */
  referenz: string;
  /** Adresse, zu der der Abonnent zum Bezahlen geleitet wird (falls nötig). */
  weiterleitung?: string;
}

export type PaymentEvent =
  | { art: 'activate'; subscriptionId: string; gueltigBis: Date }
  | { art: 'cancel'; subscriptionId: string };

export interface PaymentAdapter {
  readonly name: string;
  /** Legt einen Bezahlvorgang für ein (ausstehendes) Abo an. Bewegt selbst kein Geld. */
  createCheckout(tier: Tier, betragCent: number, subscriptionId: string): Promise<Checkout>;
  /** Prüft einen Webhook; wirft PaymentWebhookError bei ungültiger Signatur oder unbekanntem Ereignis. */
  verifyWebhook(request: Request): Promise<PaymentEvent>;
}

/** code ist ein fester Schlüssel ohne Freitext (landet in error_logs). */
export class PaymentWebhookError extends Error {
  constructor(readonly code: 'SIGNATUR_UNGUELTIG' | 'EREIGNIS_UNBEKANNT' | 'PAYLOAD_UNGUELTIG') {
    super(code);
    this.name = 'PaymentWebhookError';
  }
}
