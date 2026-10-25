/**
 * Abos. Der Abonnent steht nur als undurchsichtige Kennung (abonnent_ref).
 * Aktiv ist ein Abo nur mit Status 'aktiv' UND nicht überschrittenem gueltig_bis.
 */

export type SubscriptionStatus = 'ausstehend' | 'aktiv' | 'gekuendigt' | 'abgelaufen';

export interface Subscription {
  id: string;
  creator_id: string;
  tier_id: string;
  abonnent_ref: string;
  status: SubscriptionStatus;
  gueltig_bis: string | null;
  erstellt_am: string;
}

const SPALTEN = 'id, creator_id, tier_id, abonnent_ref, status, gueltig_bis, erstellt_am';

/** Legt ein Abo im Status 'ausstehend' an (Zahlung noch nicht bestätigt). */
export async function createSubscription(
  db: D1Database,
  input: { creator_id: string; tier_id: string; abonnent_ref: string },
): Promise<Subscription> {
  const sub: Subscription = {
    id: crypto.randomUUID(),
    ...input,
    status: 'ausstehend',
    gueltig_bis: null,
    erstellt_am: new Date().toISOString(),
  };
  await db
    .prepare(
      'INSERT INTO subscriptions (id, creator_id, tier_id, abonnent_ref, status, gueltig_bis, erstellt_am) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(sub.id, sub.creator_id, sub.tier_id, sub.abonnent_ref, sub.status, sub.gueltig_bis, sub.erstellt_am)
    .run();
  return sub;
}

export async function getSubscription(db: D1Database, id: string): Promise<Subscription | null> {
  return db.prepare(`SELECT ${SPALTEN} FROM subscriptions WHERE id = ?`).bind(id).first<Subscription>();
}

/** Aktiviert (oder verlängert) ein Abo bis gueltigBis. true, wenn das Abo existiert. */
export async function activateSubscription(db: D1Database, id: string, gueltigBis: Date): Promise<boolean> {
  if (Number.isNaN(gueltigBis.getTime())) throw new RangeError('gueltigBis ist kein gültiges Datum');
  const res = await db
    .prepare("UPDATE subscriptions SET status = 'aktiv', gueltig_bis = ? WHERE id = ?")
    .bind(gueltigBis.toISOString(), id)
    .run();
  return Number(res.meta.changes) > 0;
}

/** Kündigt ein Abo. gueltig_bis bleibt stehen; isActive ist ab sofort false. */
export async function cancelSubscription(db: D1Database, id: string): Promise<boolean> {
  const res = await db
    .prepare("UPDATE subscriptions SET status = 'gekuendigt' WHERE id = ? AND status IN ('ausstehend', 'aktiv')")
    .bind(id)
    .run();
  return Number(res.meta.changes) > 0;
}

/** Aktiv = Status 'aktiv' und Laufzeitende noch nicht erreicht. */
export function isActive(sub: Pick<Subscription, 'status' | 'gueltig_bis'>, jetzt: Date = new Date()): boolean {
  if (sub.status !== 'aktiv' || !sub.gueltig_bis) return false;
  return new Date(sub.gueltig_bis).getTime() > jetzt.getTime();
}
