import { afterEach, expect, it } from 'vitest';
import { listErrors, logError } from './error-logs';
import { createTestDb, type TestDb } from './testing';

let t: TestDb;
afterEach(() => t?.close());

it('schreibt Bereich, Code und Zeitpunkt', async () => {
  t = createTestDb();
  expect(await logError(t.db, { bereich: 'zahlung', code: 'WEBHOOK_UNGUELTIG' })).toBe(true);
  const [row] = await listErrors(t.db);
  expect(row).toMatchObject({ bereich: 'zahlung', code: 'WEBHOOK_UNGUELTIG' });
  expect(Date.parse(row!.zeitpunkt)).not.toBeNaN();
});

it('speichert keinen Freitext als Code', async () => {
  t = createTestDb();
  await logError(t.db, { bereich: 'zahlung', code: 'fehler fuer jemand@beispiel.invalid von 10.0.0.1' });
  const [row] = await listErrors(t.db);
  expect(row?.code).toBe('UNGUELTIGER_CODE');
});

it('wirft nie, auch wenn die Datenbank fehlschlägt', async () => {
  const kaputt = {
    prepare: () => {
      throw new Error('D1 down');
    },
  } as unknown as D1Database;
  expect(await logError(kaputt, { bereich: 'medien', code: 'X' })).toBe(false);
});
