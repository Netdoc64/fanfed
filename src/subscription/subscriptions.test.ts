import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import { activateSubscription, cancelSubscription, createSubscription, getSubscription, isActive } from './subscriptions';
import { createTier } from './tiers';

let t: TestDb;
afterEach(() => t?.close());

async function anlegen() {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const tier = await createTier(t.db, { creator_id: c.id, name: 'Basis', preis_cent: 500 });
  return createSubscription(t.db, { creator_id: c.id, tier_id: tier.id, abonnent_ref: 'abo-1' });
}

const tag = 86_400_000;

it('ausstehend ist nicht aktiv, aktiviert ist aktiv bis zum Laufzeitende', async () => {
  const sub = await anlegen();
  expect(isActive((await getSubscription(t.db, sub.id))!)).toBe(false);
  const bis = new Date(Date.now() + 30 * tag);
  expect(await activateSubscription(t.db, sub.id, bis)).toBe(true);
  const aktiv = (await getSubscription(t.db, sub.id))!;
  expect(aktiv.status).toBe('aktiv');
  expect(isActive(aktiv)).toBe(true);
  expect(isActive(aktiv, new Date(bis.getTime() + 1))).toBe(false);
  expect(isActive(aktiv, bis)).toBe(false);
});

it('gekündigt ist sofort nicht mehr aktiv', async () => {
  const sub = await anlegen();
  await activateSubscription(t.db, sub.id, new Date(Date.now() + 30 * tag));
  expect(await cancelSubscription(t.db, sub.id)).toBe(true);
  const row = (await getSubscription(t.db, sub.id))!;
  expect(row.status).toBe('gekuendigt');
  expect(isActive(row)).toBe(false);
  expect(await cancelSubscription(t.db, sub.id)).toBe(false);
});

it('unbekanntes Abo → false', async () => {
  await anlegen();
  expect(await activateSubscription(t.db, 'nix', new Date())).toBe(false);
  expect(await cancelSubscription(t.db, 'nix')).toBe(false);
});
