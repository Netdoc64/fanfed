import type { DbEnv } from '../db/env';

export type Sichtbarkeit = 'public' | 'paid';

export interface Post {
  id: string;
  creator_id: string;
  titel: string;
  teaser: string;
  inhalt: string;
  sichtbarkeit: Sichtbarkeit;
  tier_id: string | null;
  veroeffentlicht_am: string;
}

export interface NewPost {
  creatorId: string;
  titel?: string;
  teaser?: string;
  inhalt?: string;
  sichtbarkeit: Sichtbarkeit;
  tierId?: string | null;
  veroeffentlichtAm?: string;
}

const COLUMNS = 'id, creator_id, titel, teaser, inhalt, sichtbarkeit, tier_id, veroeffentlicht_am';

export async function createPost(db: DbEnv['DB'], input: NewPost): Promise<Post> {
  if (input.sichtbarkeit !== 'public' && input.sichtbarkeit !== 'paid') {
    throw new Error('sichtbarkeit muss public oder paid sein');
  }
  const post: Post = {
    id: crypto.randomUUID(),
    creator_id: input.creatorId,
    titel: input.titel ?? '',
    teaser: input.teaser ?? '',
    inhalt: input.inhalt ?? '',
    sichtbarkeit: input.sichtbarkeit,
    tier_id: input.tierId ?? null,
    veroeffentlicht_am: input.veroeffentlichtAm ?? new Date().toISOString(),
  };
  await db
    .prepare(`INSERT INTO posts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      post.id,
      post.creator_id,
      post.titel,
      post.teaser,
      post.inhalt,
      post.sichtbarkeit,
      post.tier_id,
      post.veroeffentlicht_am,
    )
    .run();
  return post;
}

export async function getPost(db: DbEnv['DB'], id: string): Promise<Post | null> {
  return db.prepare(`SELECT ${COLUMNS} FROM posts WHERE id = ?`).bind(id).first<Post>();
}

/** Nur Beiträge mit sichtbarkeit='public', neueste zuerst. */
export async function listPublicPosts(
  db: DbEnv['DB'],
  creatorId: string,
  limit = 20,
): Promise<Post[]> {
  const n = Math.max(1, Math.min(100, Math.trunc(limit)));
  const res = await db
    .prepare(
      `SELECT ${COLUMNS} FROM posts WHERE creator_id = ? AND sichtbarkeit = 'public'
       ORDER BY veroeffentlicht_am DESC, id DESC LIMIT ?`,
    )
    .bind(creatorId, n)
    .all<Post>();
  return res.results;
}
