import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db/creators';
import { createTestDb, type TestDb } from '../db/testing';
import { createPost, getPost, listPublicPosts } from './posts';

let t: TestDb;
afterEach(() => t?.close());

it('legt Beiträge an und liest sie', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const p = await createPost(t.db, { creatorId: c.id, titel: 'Hallo', inhalt: 'Text', sichtbarkeit: 'public' });
  expect(await getPost(t.db, p.id)).toEqual(p);
  expect(await getPost(t.db, 'unbekannt')).toBeNull();
});

it('lehnt unbekannte Sichtbarkeit ab', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  await expect(createPost(t.db, { creatorId: c.id, sichtbarkeit: 'privat' as never })).rejects.toThrow();
});

it('listPublicPosts liefert nur public, neueste zuerst, mit Limit', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const a = await createPost(t.db, { creatorId: c.id, sichtbarkeit: 'public', veroeffentlichtAm: '2026-01-01T00:00:00.000Z' });
  await createPost(t.db, { creatorId: c.id, sichtbarkeit: 'paid', veroeffentlichtAm: '2026-01-02T00:00:00.000Z' });
  const b = await createPost(t.db, { creatorId: c.id, sichtbarkeit: 'public', veroeffentlichtAm: '2026-01-03T00:00:00.000Z' });
  expect((await listPublicPosts(t.db, c.id)).map((p) => p.id)).toEqual([b.id, a.id]);
  expect(await listPublicPosts(t.db, c.id, 1)).toHaveLength(1);
});
