import { afterEach, expect, it } from 'vitest';
import { createTestAgeAdapter, handleAgeCallback, startAgeCheck } from '../age';
import { createCreator, listErrors } from '../db';
import { createTestDb, type TestDb } from '../db/testing';
import { createPost } from '../posts';
import {
  activateSubscription,
  createSubscription,
  createTier,
  generateTokenKey,
  issueToken,
} from '../subscription';
import { generateWrapKey } from './crypto';
import { handleMediaRequest, type MediaDeliveryEnv } from './deliver';
import { storeMedium } from './store';
import { createFakeR2, type FakeR2 } from './testing';

let t: TestDb;
afterEach(() => t?.close());

const klartext = new TextEncoder().encode('nur-fuer-abonnenten');
const tag = 86_400_000;

async function aufbau(opts: { altersPruefung?: 'bestanden' | 'abgelehnt' | null; aktiv?: boolean } = {}) {
  const { altersPruefung = 'bestanden', aktiv = true } = opts;
  t = createTestDb();
  const r2: FakeR2 = createFakeR2();
  const env: MediaDeliveryEnv = {
    DB: t.db,
    MEDIA: r2,
    MEDIA_WRAP_KEY: generateWrapKey(),
    SUBSCRIPTION_TOKEN_KEY: generateTokenKey(),
  };
  const c = await createCreator(t.db, { handle: 'anna', anzeigename: 'Anna' });
  const tier = await createTier(t.db, { creator_id: c.id, name: 'Basis', preis_cent: 500 });
  const post = await createPost(t.db, { creatorId: c.id, sichtbarkeit: 'paid', tierId: tier.id });
  const medium = await storeMedium(env, { postId: post.id, inhaltstyp: 'image/png', daten: klartext });
  const abo = await createSubscription(t.db, { creator_id: c.id, tier_id: tier.id, abonnent_ref: 'abo-1' });
  if (aktiv) await activateSubscription(t.db, abo.id, new Date(Date.now() + 30 * tag));
  if (altersPruefung) {
    const adapter = createTestAgeAdapter({ ergebnis: altersPruefung });
    const start = await startAgeCheck(t.db, adapter, 'abo-1');
    await handleAgeCallback(t.db, adapter, { referenz: start!.referenz });
  }
  const token = await issueToken(env, { subscriptionId: abo.id, tier: tier.rang });
  return { env, r2, medium, abo, tier, token };
}

const anfrage = (id: string, token?: string) =>
  new Request(`https://x.test/media/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

async function codes(): Promise<string[]> {
  return (await listErrors(t.db)).filter((e) => e.bereich === 'medien').map((e) => e.code);
}

async function leer403(res: Response) {
  expect(res.status).toBe(403);
  expect(await res.text()).toBe('');
}

it('Ablage: R2 enthält keinen Klartext, D1 nur umhüllten Schlüssel', async () => {
  const { r2, medium, env } = await aufbau();
  const roh = r2.inhalt.get(medium.r2_key)!;
  expect(new TextDecoder('latin1').decode(roh)).not.toContain('abonnenten');
  const row = t.raw.prepare('SELECT umhuellter_schluessel, iv FROM media WHERE id = ?').get(medium.id) as Record<string, string>;
  expect(row.umhuellter_schluessel).toBeTruthy();
  expect(row.iv).toBeTruthy();
  expect(env.MEDIA_WRAP_KEY).not.toContain(row.umhuellter_schluessel!);
});

it('zwei Medien haben verschiedene umhüllte Schlüssel', async () => {
  const { env, medium } = await aufbau();
  const post = t.raw.prepare('SELECT post_id FROM media WHERE id = ?').get(medium.id) as { post_id: string };
  const zweites = await storeMedium(env, { postId: post.post_id, inhaltstyp: 'image/png', daten: klartext });
  const rows = t.raw.prepare('SELECT umhuellter_schluessel FROM media').all() as { umhuellter_schluessel: string }[];
  expect(rows).toHaveLength(2);
  expect(rows[0]!.umhuellter_schluessel).not.toBe(rows[1]!.umhuellter_schluessel);
  expect(zweites.id).not.toBe(medium.id);
});

it('200 nur mit Token und Altersprüfung', async () => {
  const { env, medium, token } = await aufbau();
  const res = await handleMediaRequest(anfrage(medium.id, token), env);
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('image/png');
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(klartext);
  expect(await codes()).toEqual([]);
});

it('403 ohne Token', async () => {
  const { env, medium } = await aufbau();
  await leer403(await handleMediaRequest(anfrage(medium.id), env));
  expect(await codes()).toEqual(['TOKEN_FEHLT']);
});

it('403 mit abgelaufenem Token', async () => {
  const { env, medium, token } = await aufbau();
  await leer403(await handleMediaRequest(anfrage(medium.id, token), env, new Date(Date.now() + 3600_000)));
  expect(await codes()).toEqual(['TOKEN_ABGELAUFEN']);
});

it('403 mit gefälschtem Token', async () => {
  const { env, medium, token } = await aufbau();
  await leer403(await handleMediaRequest(anfrage(medium.id, token.slice(0, -2) + 'AA'), env));
  expect(await codes()).toHaveLength(1);
});

it('403 ohne Altersprüfung, auch bei abgelehnter', async () => {
  for (const ap of [null, 'abgelehnt'] as const) {
    const { env, medium, token } = await aufbau({ altersPruefung: ap });
    await leer403(await handleMediaRequest(anfrage(medium.id, token), env));
    expect(await codes()).toEqual(['ALTERSPRUEFUNG_FEHLT']);
    t.close();
  }
});

it('403 bei inaktivem Abo trotz gültigem Token', async () => {
  const { env, medium, token } = await aufbau({ aktiv: false });
  await leer403(await handleMediaRequest(anfrage(medium.id, token), env));
  expect(await codes()).toEqual(['ABO_INAKTIV']);
});

it('403 bei zu niedriger Stufe', async () => {
  const { env, medium, abo } = await aufbau();
  const niedrig = await issueToken(env, { subscriptionId: abo.id, tier: 0 });
  await leer403(await handleMediaRequest(anfrage(medium.id, niedrig), env));
  expect(await codes()).toEqual(['TOKEN_STUFE']);
});

it('403 für unbekanntes Medium, ohne Unterschied zur Verweigerung', async () => {
  const { env, token } = await aufbau();
  await leer403(await handleMediaRequest(anfrage('gibt-es-nicht', token), env));
  expect(await codes()).toEqual(['MEDIUM_UNBEKANNT']);
});

it('Fehlschlag bei R2 und Entschlüsselung: 403 leer und error_logs', async () => {
  const a = await aufbau();
  a.r2.inhalt.delete(a.medium.r2_key);
  await leer403(await handleMediaRequest(anfrage(a.medium.id, a.token), a.env));
  expect(await codes()).toEqual(['R2_OBJEKT_FEHLT']);
  t.close();

  const b = await aufbau();
  const roh = b.r2.inhalt.get(b.medium.r2_key)!;
  roh[0] = roh[0]! ^ 1;
  await leer403(await handleMediaRequest(anfrage(b.medium.id, b.token), b.env));
  expect(await codes()).toEqual(['AUSLIEFERUNG_FEHLGESCHLAGEN']);
  t.close();

  const c = await aufbau();
  c.env.MEDIA = { get: async () => { throw new Error('r2 down'); } } as unknown as R2Bucket;
  await leer403(await handleMediaRequest(anfrage(c.medium.id, c.token), c.env));
  expect(await codes()).toEqual(['AUSLIEFERUNG_FEHLGESCHLAGEN']);
});

it('error_logs enthalten keine Token, Kennungen oder Namen', async () => {
  const { env, medium, token } = await aufbau({ altersPruefung: null });
  await handleMediaRequest(anfrage(medium.id, token), env);
  const roh = JSON.stringify(t.raw.prepare('SELECT * FROM error_logs').all());
  expect(roh).not.toContain(token);
  expect(roh).not.toContain('abo-1');
  expect(roh).not.toContain(medium.id);
});

it('falsche Methode und Pfad: 403 leer', async () => {
  const { env, medium, token } = await aufbau();
  await leer403(await handleMediaRequest(new Request(`https://x.test/media/${medium.id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }), env));
  await leer403(await handleMediaRequest(new Request('https://x.test/anderes', { headers: { Authorization: `Bearer ${token}` } }), env));
});

it('Ablage: Fehler in R2 landet in error_logs und wirft', async () => {
  const { env } = await aufbau();
  env.MEDIA = { put: async () => { throw new Error('r2 down'); } } as unknown as R2Bucket;
  await expect(storeMedium(env, { postId: 'p', inhaltstyp: 'image/png', daten: klartext })).rejects.toThrow();
  expect(await codes()).toEqual(['ABLAGE_FEHLGESCHLAGEN']);
});

it('Ablage: scheitert die Zeile, wird das R2-Objekt entfernt', async () => {
  const { env, r2 } = await aufbau();
  const vorher = r2.inhalt.size;
  await expect(storeMedium(env, { postId: 'gibt-es-nicht', inhaltstyp: 'image/png', daten: klartext })).rejects.toThrow();
  expect(r2.inhalt.size).toBe(vorher);
  expect(await codes()).toEqual(['ABLAGE_METADATEN_FEHLGESCHLAGEN']);
});
