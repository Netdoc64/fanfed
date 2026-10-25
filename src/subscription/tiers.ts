/** Abo-Stufen. Preise sind ganzzahlige Cent-Beträge; höherer rang = höhere Stufe. */

export interface Tier {
  id: string;
  creator_id: string;
  name: string;
  preis_cent: number;
  rang: number;
  erstellt_am: string;
}

export interface NewTier {
  creator_id: string;
  name: string;
  preis_cent: number;
  rang?: number;
}

export async function createTier(db: D1Database, input: NewTier): Promise<Tier> {
  if (!Number.isInteger(input.preis_cent) || input.preis_cent < 0) {
    throw new RangeError('preis_cent muss eine ganze Zahl >= 0 sein');
  }
  const rang = input.rang ?? 1;
  if (!Number.isInteger(rang) || rang < 1) throw new RangeError('rang muss eine ganze Zahl >= 1 sein');
  const tier: Tier = {
    id: crypto.randomUUID(),
    creator_id: input.creator_id,
    name: input.name,
    preis_cent: input.preis_cent,
    rang,
    erstellt_am: new Date().toISOString(),
  };
  await db
    .prepare('INSERT INTO tiers (id, creator_id, name, preis_cent, rang, erstellt_am) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(tier.id, tier.creator_id, tier.name, tier.preis_cent, tier.rang, tier.erstellt_am)
    .run();
  return tier;
}

export async function getTier(db: D1Database, id: string): Promise<Tier | null> {
  return db
    .prepare('SELECT id, creator_id, name, preis_cent, rang, erstellt_am FROM tiers WHERE id = ?')
    .bind(id)
    .first<Tier>();
}

export async function listTiers(db: D1Database, creatorId: string): Promise<Tier[]> {
  const res = await db
    .prepare(
      'SELECT id, creator_id, name, preis_cent, rang, erstellt_am FROM tiers WHERE creator_id = ? ORDER BY rang, preis_cent',
    )
    .bind(creatorId)
    .all<Tier>();
  return res.results;
}
