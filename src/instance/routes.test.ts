import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import { generateWrapKey, storeMedium } from '../media';
import { createFakeR2 } from '../media/testing';
import { createPost } from '../posts';
import { createTier, generateTokenKey } from '../subscription';
import worker, { type Env } from './index';

let t: TestDb;
afterEach(() => t?.close());

async function setup() {
  t = createTestDb();
  const env: Env = {
    DB: t.db,
    MEDIA: createFakeR2(),
    MEDIA_WRAP_KEY: generateWrapKey(),
    SUBSCRIPTION_TOKEN_KEY: generateTokenKey(),
    INSTANCE_DOMAIN: 'example.test',
  };
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const tier = await createTier(t.db, { creator_id: c.id, name: 'Basis', preis_cent: 500 });
  const offen = await createPost(t.db, { creatorId: c.id, sichtbarkeit: 'public', titel: 'Offen', inhalt: 'Sichtbar' });
  const bezahlt = await createPost(t.db, {
    creatorId: c.id,
    sichtbarkeit: 'paid',
    tierId: tier.id,
    titel: 'Geheim',
    inhalt: 'Nur fuer Abos',
  });
  const medium = await storeMedium(env, {
    postId: bezahlt.id,
    inhaltstyp: 'image/png',
    daten: new TextEncoder().encode('bild'),
  });
  const get = (path: string, init?: RequestInit) =>
    worker.fetch(new Request(`https://example.test${path}`, init), env);
  return { get, offen, bezahlt, medium };
}

it('Outbox enthält den public-Beitrag, keinen paid-Beitrag und keine Medien-URL', async () => {
  const { get, offen, bezahlt, medium } = await setup();
  const res = await get('/users/anna/outbox');
  expect(res.status).toBe(200);
  const text = await res.text();
  const body = JSON.parse(text) as { totalItems: number };
  expect(body.totalItems).toBe(1);
  expect(text).toContain(offen.id);
  expect(text).not.toContain(bezahlt.id);
  expect(text).not.toContain('Geheim');
  expect(text).not.toContain('Nur fuer Abos');
  expect(text).not.toContain(medium.id);
  expect(text).not.toMatch(/\/media\//);
});

it('Outbox eines unbekannten Handles ist 404', async () => {
  const { get } = await setup();
  expect((await get('/users/niemand/outbox')).status).toBe(404);
});

it('Medien-Route liefert ohne Token 403 mit leerem Körper', async () => {
  const { get, medium } = await setup();
  const res = await get(`/media/${medium.id}`);
  expect(res.status).toBe(403);
  expect(await res.text()).toBe('');
});

it('Medien-Route liefert bei ungültigem Token 403 mit leerem Körper', async () => {
  const { get, medium } = await setup();
  const res = await get(`/media/${medium.id}`, { headers: { Authorization: 'Bearer kaputt' } });
  expect(res.status).toBe(403);
  expect(await res.text()).toBe('');
});
