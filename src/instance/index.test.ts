import { afterEach, expect, it } from 'vitest';
import { createCreator } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import worker, { type Env } from './index';

let t: TestDb;
afterEach(() => t?.close());

async function setup() {
  t = createTestDb();
  await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna', beschreibung: 'Hallo zusammen' });
  const env: Env = { DB: t.db, INSTANCE_DOMAIN: 'example.test' };
  const get = (path: string) => worker.fetch(new Request(`https://example.test${path}`), env);
  return get;
}

it('liefert den Actor aus D1, nur mit öffentlichen Feldern', async () => {
  const get = await setup();
  const res = await get('/users/anna');
  expect(res.status).toBe(200);
  const actor = (await res.json()) as Record<string, unknown>;
  expect(actor.preferredUsername).toBe('anna');
  expect(actor.name).toBe('Anna');
  expect(actor.summary).toBe('Hallo zusammen');
  const text = JSON.stringify(actor);
  expect(text).not.toMatch(/preis|tier|stufe|media|medien/i);
});

it('liefert WebFinger für einen angelegten Creator', async () => {
  const get = await setup();
  const res = await get('/.well-known/webfinger?resource=acct:anna@example.test');
  expect(res.status).toBe(200);
  const body = (await res.json()) as { subject: string };
  expect(body.subject).toBe('acct:anna@example.test');
});

it('antwortet 404 für ein unbekanntes Handle', async () => {
  const get = await setup();
  expect((await get('/users/niemand')).status).toBe(404);
  expect((await get('/.well-known/webfinger?resource=acct:niemand@example.test')).status).toBe(404);
});
