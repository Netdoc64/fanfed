import { afterEach, describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles, type TestDb } from './testing';

let t: TestDb;
afterEach(() => t?.close());

const NOW = '2026-10-25T00:00:00.000Z';

function insertCreator(id = 'c1', handle = 'anna') {
  t.raw
    .prepare('INSERT INTO creators (id, handle, anzeigename, erstellt_am) VALUES (?, ?, ?, ?)')
    .run(id, handle, 'Anna', NOW);
}

function insertPost(id: string, sichtbarkeit: string) {
  t.raw
    .prepare('INSERT INTO posts (id, creator_id, sichtbarkeit, veroeffentlicht_am) VALUES (?, ?, ?, ?)')
    .run(id, 'c1', sichtbarkeit, NOW);
}

describe('Migrationen', () => {
  it('sind nummeriert und lückenlos aufsteigend', () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f, i) => expect(f.startsWith(String(i + 1).padStart(4, '0'))).toBe(true));
  });

  it('legen alle Tabellen an', () => {
    t = createTestDb();
    const rows = t.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const names = rows.map((r) => r.name);
    for (const n of ['creators', 'posts', 'tiers', 'subscriptions', 'media', 'age_checks', 'error_logs']) {
      expect(names).toContain(n);
    }
  });

  it('lassen sichtbarkeit nur public oder paid zu', () => {
    t = createTestDb();
    insertCreator();
    insertPost('p1', 'public');
    insertPost('p2', 'paid');
    expect(() => insertPost('p3', 'geheim')).toThrow();
    expect(() => insertPost('p4', '')).toThrow();
  });

  it('erzwingen Fremdschlüssel', () => {
    t = createTestDb();
    expect(() => insertPost('p1', 'public')).toThrow();
  });

  it('error_logs hat keine Spalte für personenbezogene Daten', () => {
    t = createTestDb();
    const cols = t.raw
      .prepare('PRAGMA table_info(error_logs)')
      .all()
      .map((c) => c.name);
    expect(cols).toEqual(['id', 'bereich', 'code', 'zeitpunkt']);
  });
});

describe('D1-Fassade', () => {
  it('bindet Parameter, first/all/run und batch mit Rollback', async () => {
    t = createTestDb();
    const ins = t.db.prepare('INSERT INTO creators (id, handle, anzeigename, erstellt_am) VALUES (?, ?, ?, ?)');
    await t.db.batch([ins.bind('c1', 'anna', 'Anna', NOW)]);
    const row = await t.db.prepare('SELECT handle FROM creators WHERE id = ?').bind('c1').first<{ handle: string }>();
    expect(row?.handle).toBe('anna');
    await expect(
      t.db.batch([
        t.db.prepare('INSERT INTO creators (id, handle, anzeigename, erstellt_am) VALUES (?, ?, ?, ?)').bind('c2', 'bob', 'Bob', NOW),
        t.db.prepare('INSERT INTO creators (id, handle, anzeigename, erstellt_am) VALUES (?, ?, ?, ?)').bind('c3', 'anna', 'Doppelt', NOW),
      ]),
    ).rejects.toThrow();
    const all = await t.db.prepare('SELECT id FROM creators').all();
    expect(all.results).toHaveLength(1);
  });
});
