/**
 * Testhilfe: eine frische In-Memory-Datenbank mit allen Migrationen, hinter
 * einer kleinen D1-Fassade (node:sqlite). Nur für Tests — nie im Worker laden.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Param = null | number | bigint | string | Uint8Array;

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
}

export interface TestDb {
  db: D1Database;
  /** Roh-Zugriff auf SQLite, etwa um Constraints direkt zu prüfen. */
  raw: DatabaseSync;
  close(): void;
}

function toParam(v: unknown): Param {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as Param;
}

class Statement {
  private params: Param[] = [];
  constructor(
    private readonly raw: DatabaseSync,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): this {
    this.params = values.map(toParam);
    return this;
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.raw.prepare(this.sql).get(...this.params);
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T>(): Promise<{ results: T[]; success: true; meta: Record<string, unknown> }> {
    const results = this.raw.prepare(this.sql).all(...this.params) as T[];
    return { results, success: true, meta: {} };
  }

  async run(): Promise<{ results: never[]; success: true; meta: Record<string, unknown> }> {
    const r = this.raw.prepare(this.sql).run(...this.params);
    return {
      results: [],
      success: true,
      meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  }
}

export function createTestDb(): TestDb {
  const raw = new DatabaseSync(':memory:');
  for (const file of migrationFiles()) {
    raw.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  }
  const db = {
    prepare: (sql: string) => new Statement(raw, sql),
    async batch(stmts: Statement[]) {
      const out = [];
      raw.exec('BEGIN');
      try {
        for (const s of stmts) out.push(await s.run());
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
      return out;
    },
    async exec(sql: string) {
      raw.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
  return { db, raw, close: () => { if (raw.isOpen) raw.close(); } };
}
