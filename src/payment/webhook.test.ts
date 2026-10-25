import { afterEach, expect, it } from 'vitest';
import { createCreator, listErrors } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import { createSubscription, createTier, getSubscription, isActive } from '../subscription';
import { createTestPaymentAdapter, signTestWebhook, TEST_SIGNATUR_HEADER } from './test-adapter';
import { handlePaymentWebhook } from './webhook';

let t: TestDb;
afterEach(() => t?.close());

const schluessel = 'test-schluessel-' + crypto.randomUUID();
const adapter = createTestPaymentAdapter({ schluessel });
const tag = 86_400_000;

async function aufbau() {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const tier = await createTier(t.db, { creator_id: c.id, name: 'Basis', preis_cent: 500 });
  const sub = await createSubscription(t.db, { creator_id: c.id, tier_id: tier.id, abonnent_ref: 'abo-1' });
  return { tier, sub };
}

async function webhook(body: object, key = schluessel) {
  const text = JSON.stringify(body);
  return new Request('https://example.invalid/hook', {
    method: 'POST',
    body: text,
    headers: { [TEST_SIGNATUR_HEADER]: await signTestWebhook(key, text) },
  });
}

it('Checkout -> Webhook -> Abo aktiv, dann Kündigung', async () => {
  const { tier, sub } = await aufbau();
  const checkout = await adapter.createCheckout(tier, tier.preis_cent, sub.id);
  expect(checkout.referenz).toMatch(/^test-/);
  expect(isActive((await getSubscription(t.db, sub.id))!)).toBe(false);

  const bis = new Date(Date.now() + 30 * tag);
  const r = await handlePaymentWebhook(
    t.db,
    adapter,
    await webhook({ art: 'activate', subscriptionId: sub.id, gueltigBis: bis.toISOString() }),
  );
  expect(r).toEqual({ status: 'aktiviert', subscriptionId: sub.id });
  expect(isActive((await getSubscription(t.db, sub.id))!)).toBe(true);

  const k = await handlePaymentWebhook(t.db, adapter, await webhook({ art: 'cancel', subscriptionId: sub.id }));
  expect(k.status).toBe('gekuendigt');
  expect((await getSubscription(t.db, sub.id))!.status).toBe('gekuendigt');
  expect(await listErrors(t.db)).toHaveLength(0);
});

it('falsche Signatur wird abgewiesen, Abo bleibt ausstehend, error_logs-Eintrag', async () => {
  const { sub } = await aufbau();
  const bis = new Date(Date.now() + tag).toISOString();
  const r = await handlePaymentWebhook(
    t.db,
    adapter,
    await webhook({ art: 'activate', subscriptionId: sub.id, gueltigBis: bis }, 'anderer-schluessel'),
  );
  expect(r).toEqual({ status: 'abgewiesen', code: 'SIGNATUR_UNGUELTIG' });
  expect((await getSubscription(t.db, sub.id))!.status).toBe('ausstehend');
  const logs = await listErrors(t.db);
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ bereich: 'payment', code: 'SIGNATUR_UNGUELTIG' });
});

it('unbekanntes Ereignis, kaputte Nutzlast und unbekanntes Abo landen in error_logs', async () => {
  await aufbau();
  const bis = new Date(Date.now() + tag).toISOString();
  const r = await handlePaymentWebhook(t.db, adapter, await webhook({ art: 'refund', subscriptionId: 'x' }));
  expect(r.status).toBe('abgewiesen');
  await handlePaymentWebhook(t.db, adapter, await webhook({ art: 'activate', subscriptionId: 'x', gueltigBis: 'kein-datum' }));
  await handlePaymentWebhook(t.db, adapter, await webhook({ art: 'activate', subscriptionId: 'gibt-es-nicht', gueltigBis: bis }));
  await handlePaymentWebhook(t.db, adapter, await webhook({ art: 'cancel', subscriptionId: 'gibt-es-nicht' }));
  const logs = await listErrors(t.db);
  expect(logs.map((l) => l.code).sort()).toEqual([
    'ABO_UNBEKANNT',
    'EREIGNIS_UNBEKANNT',
    'KUENDIGUNG_FEHLGESCHLAGEN',
    'PAYLOAD_UNGUELTIG',
  ]);
  expect(logs.every((l) => l.bereich === 'payment')).toBe(true);
});

it('createCheckout nimmt nur ganze Cent', async () => {
  const { tier, sub } = await aufbau();
  await expect(adapter.createCheckout(tier, 5.5, sub.id)).rejects.toThrow(RangeError);
});
