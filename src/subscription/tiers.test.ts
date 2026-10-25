import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import { createTier, getTier, listTiers } from './tiers';

let t: TestDb;
afterEach(() => t?.close());

it('legt Stufen mit Cent-Preis an und listet sie nach Rang', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const gold = await createTier(t.db, { creator_id: c.id, name: 'Gold', preis_cent: 123450, rang: 2 });
  await createTier(t.db, { creator_id: c.id, name: 'Basis', preis_cent: 500 });
  expect((await listTiers(t.db, c.id)).map((x) => x.name)).toEqual(['Basis', 'Gold']);
  expect(await getTier(t.db, gold.id)).toMatchObject({ preis_cent: 123450, rang: 2 });
  expect(await getTier(t.db, 'nix')).toBeNull();
});

it('lehnt Preise ohne ganze Cent ab', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  await expect(createTier(t.db, { creator_id: c.id, name: 'x', preis_cent: 9.5 })).rejects.toThrow(RangeError);
  await expect(createTier(t.db, { creator_id: c.id, name: 'x', preis_cent: -1 })).rejects.toThrow(RangeError);
});
