import { afterEach, expect, it } from 'vitest';
import { createCreator, getCreatorByHandle } from './creators';
import { createTestDb, type TestDb } from './testing';

let t: TestDb;
afterEach(() => t?.close());

it('legt einen Creator an und findet ihn über den Handle', async () => {
  t = createTestDb();
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  expect(c.beschreibung).toBe('');
  expect(await getCreatorByHandle(t.db, 'anna')).toEqual(c);
});

it('gibt null für unbekannte Handles zurück', async () => {
  t = createTestDb();
  expect(await getCreatorByHandle(t.db, 'niemand')).toBeNull();
});

it('lehnt doppelte und ungültige Handles ab', async () => {
  t = createTestDb();
  await createCreator(t.db, { handle: 'anna', anzeigename: 'A' });
  await expect(createCreator(t.db, { handle: 'anna', anzeigename: 'B' })).rejects.toThrow();
  await expect(createCreator(t.db, { handle: 'Gross!', anzeigename: 'C' })).rejects.toThrow();
});
