import { afterEach, expect, it } from 'vitest';
import { listErrors } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import type { AgeVerificationAdapter } from './adapter';
import { handleAgeCallback, hasPassedAgeCheck, startAgeCheck } from './age-checks';
import { createTestAgeAdapter } from './test-adapter';

let t: TestDb;
afterEach(() => t?.close());

async function durchlauf(adapter: AgeVerificationAdapter, ref = 'abo-1') {
  const start = await startAgeCheck(t.db, adapter, ref);
  return handleAgeCallback(t.db, adapter, { referenz: start!.referenz });
}

it('bestanden → true', async () => {
  t = createTestDb();
  expect(await durchlauf(createTestAgeAdapter({ ergebnis: 'bestanden' }))).toBe(true);
  expect(await hasPassedAgeCheck(t.db, 'abo-1')).toBe(true);
  const row = t.raw.prepare('SELECT * FROM age_checks').get() as Record<string, unknown>;
  expect(row).toMatchObject({ ergebnis: 'bestanden', anbieter: 'test' });
  expect(Object.keys(row).sort()).toEqual(['abonnent_ref', 'anbieter', 'ergebnis', 'geprueft_am', 'id']);
});

it('abgelehnt → false', async () => {
  t = createTestDb();
  await durchlauf(createTestAgeAdapter({ ergebnis: 'abgelehnt' }));
  expect(await hasPassedAgeCheck(t.db, 'abo-1')).toBe(false);
});

it('keine Prüfung oder nur ausstehend → false', async () => {
  t = createTestDb();
  expect(await hasPassedAgeCheck(t.db, 'abo-1')).toBe(false);
  await startAgeCheck(t.db, createTestAgeAdapter({ ergebnis: 'bestanden' }), 'abo-1');
  expect(await hasPassedAgeCheck(t.db, 'abo-1')).toBe(false);
});

it('abgelaufenes Ergebnis → false, anderer Abonnent → false', async () => {
  t = createTestDb();
  await durchlauf(createTestAgeAdapter({ ergebnis: 'bestanden' }));
  const spaeter = new Date(Date.now() + 366 * 86_400_000);
  expect(await hasPassedAgeCheck(t.db, 'abo-1', spaeter)).toBe(false);
  expect(await hasPassedAgeCheck(t.db, 'abo-2')).toBe(false);
});

it('ungültiger Callback landet in error_logs', async () => {
  t = createTestDb();
  const a = createTestAgeAdapter({ ergebnis: 'bestanden' });
  expect(await handleAgeCallback(t.db, a, { referenz: 'fremd' })).toBe(false);
  expect(await listErrors(t.db)).toMatchObject([{ bereich: 'age', code: 'CALLBACK_UNGUELTIG' }]);
});

it('unbekannte Referenz landet in error_logs', async () => {
  t = createTestDb();
  const a = createTestAgeAdapter({ ergebnis: 'bestanden' });
  expect(await handleAgeCallback(t.db, a, { referenz: 'test-unbekannt' })).toBe(false);
  expect((await listErrors(t.db))[0]).toMatchObject({ bereich: 'age', code: 'CALLBACK_UNBEKANNT' });
});

it('Adapterfehler beim Start landet in error_logs', async () => {
  t = createTestDb();
  const kaputt: AgeVerificationAdapter = {
    name: 'test',
    start: async () => {
      throw new Error('Anbieter down');
    },
    pruefeCallback: async () => {
      throw new Error('x');
    },
  };
  expect(await startAgeCheck(t.db, kaputt, 'abo-1')).toBeNull();
  expect(await listErrors(t.db)).toMatchObject([{ bereich: 'age', code: 'START_FEHLGESCHLAGEN' }]);
});
