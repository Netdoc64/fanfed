import type { DbEnv } from './env';

export interface Creator {
  id: string;
  handle: string;
  anzeigename: string;
  beschreibung: string;
  erstellt_am: string;
}

export interface NewCreator {
  handle: string;
  anzeigename: string;
  beschreibung?: string;
}

export async function getCreatorByHandle(db: DbEnv['DB'], handle: string): Promise<Creator | null> {
  return db
    .prepare('SELECT id, handle, anzeigename, beschreibung, erstellt_am FROM creators WHERE handle = ?')
    .bind(handle)
    .first<Creator>();
}

export async function createCreator(db: DbEnv['DB'], input: NewCreator): Promise<Creator> {
  const creator: Creator = {
    id: crypto.randomUUID(),
    handle: input.handle,
    anzeigename: input.anzeigename,
    beschreibung: input.beschreibung ?? '',
    erstellt_am: new Date().toISOString(),
  };
  await db
    .prepare('INSERT INTO creators (id, handle, anzeigename, beschreibung, erstellt_am) VALUES (?, ?, ?, ?, ?)')
    .bind(creator.id, creator.handle, creator.anzeigename, creator.beschreibung, creator.erstellt_am)
    .run();
  return creator;
}
