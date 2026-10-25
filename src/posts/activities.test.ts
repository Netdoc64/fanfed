import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db/creators';
import { createTestDb, type TestDb } from '../db/testing';
import { buildActor } from '../instance/activitypub';
import { buildCreateActivity, buildOutbox } from './activities';
import { createPost, listPublicPosts } from './posts';

let t: TestDb;
afterEach(() => t?.close());
const DOMAIN = 'example.test';

it('Bezahltes (Text, ID, Medien-URL, R2-Schlüssel) steht nie in Actor, Outbox oder Activity', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna', beschreibung: 'Profil' });
  const pub = await createPost(t.db, { creatorId: c.id, titel: 'Offen', inhalt: 'öffentlicher Text', sichtbarkeit: 'public' });
  const paid = await createPost(t.db, {
    creatorId: c.id,
    titel: 'GEHEIMTITEL-4711',
    teaser: 'GEHEIMTEASER-4711',
    inhalt: 'GEHEIMTEXT-4711',
    sichtbarkeit: 'paid',
  });
  const r2Key = 'media/GEHEIMKEY-4711.bin';
  t.raw
    .prepare(
      `INSERT INTO media (id, post_id, r2_key, umhuellter_schluessel, iv, inhaltstyp, groesse_byte, erstellt_am)
       VALUES ('m-4711', ?, ?, 'k', 'iv', 'image/png', 3, '2026-01-01T00:00:00.000Z')`,
    )
    .run(paid.id, r2Key);

  const publicPosts = await listPublicPosts(t.db, c.id);
  const out = JSON.stringify([
    buildActor(DOMAIN, { handle: c.handle, displayName: c.anzeigename, summary: c.beschreibung }),
    buildOutbox(DOMAIN, c.handle, publicPosts),
    buildCreateActivity(DOMAIN, c.handle, pub),
  ]);
  for (const geheim of [paid.id, 'GEHEIMTITEL-4711', 'GEHEIMTEASER-4711', 'GEHEIMTEXT-4711', r2Key, 'GEHEIMKEY', 'm-4711', 'image/png']) {
    expect(out).not.toContain(geheim);
  }
  expect(out).toContain(pub.id);
});

it('Outbox verwirft paid selbst bei falsch übergebener Liste, Activity wirft', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const paid = await createPost(t.db, { creatorId: c.id, inhalt: 'GEHEIMTEXT-4711', sichtbarkeit: 'paid' });
  const outbox = buildOutbox(DOMAIN, c.handle, [paid]);
  expect(outbox.totalItems).toBe(0);
  expect(JSON.stringify(outbox)).not.toContain('GEHEIMTEXT-4711');
  expect(() => buildCreateActivity(DOMAIN, c.handle, paid)).toThrow();
});

it('Outbox ist eine OrderedCollection mit Create/Note', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const p = await createPost(t.db, { creatorId: c.id, titel: 'T', inhalt: 'Hi', sichtbarkeit: 'public' });
  const o = buildOutbox(DOMAIN, c.handle, [p]);
  expect(o.type).toBe('OrderedCollection');
  expect(o.id).toBe(`https://${DOMAIN}/users/anna/outbox`);
  expect(o.orderedItems[0]).toMatchObject({ type: 'Create', object: { type: 'Note', content: 'Hi', name: 'T' } });
});
