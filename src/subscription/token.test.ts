import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import { activateSubscription, cancelSubscription, createSubscription, getSubscription, isActive } from './subscriptions';
import { createTier } from './tiers';
import { generateTokenKey, issueToken, verifyToken } from './token';

let t: TestDb;
afterEach(() => t?.close());

// Jeder Lauf erzeugt seinen eigenen Schlüssel; kein festes Geheimnis im Repo.
const env = { SUBSCRIPTION_TOKEN_KEY: generateTokenKey() };
const jetzt = new Date('2026-10-25T12:00:00Z');

it('gültiger Token → ok mit Nutzlast', async () => {
  const token = await issueToken(env, { subscriptionId: 's1', tier: 2 }, jetzt);
  const r = await verifyToken(env, token, 2, new Date(jetzt.getTime() + 60_000));
  expect(r).toEqual({ status: 'ok', payload: { sub: 's1', tier: 2, exp: jetzt.getTime() / 1000 + 300 } });
});

it('abgelaufen', async () => {
  const token = await issueToken(env, { subscriptionId: 's1', tier: 1 }, jetzt);
  expect((await verifyToken(env, token, 1, new Date(jetzt.getTime() + 301_000))).status).toBe('abgelaufen');
});

it('manipulierte Nutzlast → signatur', async () => {
  const token = await issueToken(env, { subscriptionId: 's1', tier: 1 }, jetzt);
  const sig = token.split('.')[1];
  const fremd = btoa(JSON.stringify({ sub: 's1', tier: 9, exp: jetzt.getTime() / 1000 + 300 })).replace(/=+$/, '');
  expect((await verifyToken(env, `${fremd}.${sig}`, 1, jetzt)).status).toBe('signatur');
});

it('falscher Schlüssel → signatur', async () => {
  const token = await issueToken(env, { subscriptionId: 's1', tier: 1 }, jetzt);
  const andere = { SUBSCRIPTION_TOKEN_KEY: generateTokenKey() };
  expect((await verifyToken(andere, token, 1, jetzt)).status).toBe('signatur');
});

it('zu niedrige Stufe → stufe', async () => {
  const token = await issueToken(env, { subscriptionId: 's1', tier: 1 }, jetzt);
  expect((await verifyToken(env, token, 2, jetzt)).status).toBe('stufe');
});

it('kaputte Eingaben → kaputt', async () => {
  for (const x of ['', 'abc', 'a.b.c', '!!.??', '.']) {
    expect((await verifyToken(env, x, 1, jetzt)).status).toBe('kaputt');
  }
});

it('zu kurzer Schlüssel wird abgelehnt', async () => {
  await expect(issueToken({ SUBSCRIPTION_TOKEN_KEY: 'kurz' }, { subscriptionId: 's', tier: 1 })).rejects.toThrow();
});

it('gekündigtes Abo: Token bleibt formal gültig, isActive aber false', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const tier = await createTier(t.db, { creator_id: c.id, name: 'Basis', preis_cent: 500 });
  const sub = await createSubscription(t.db, { creator_id: c.id, tier_id: tier.id, abonnent_ref: 'abo-1' });
  await activateSubscription(t.db, sub.id, new Date(Date.now() + 86_400_000));
  const token = await issueToken(env, { subscriptionId: sub.id, tier: tier.rang });
  expect((await verifyToken(env, token, 1)).status).toBe('ok');
  expect(isActive((await getSubscription(t.db, sub.id))!)).toBe(true);
  await cancelSubscription(t.db, sub.id);
  expect(isActive((await getSubscription(t.db, sub.id))!)).toBe(false);
});
