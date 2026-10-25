/**
 * Ablage: verschlüsseln, nach R2 schreiben, Metadaten in D1. Geschrieben wird
 * erst nach R2, dann die Zeile — scheitert die Zeile, wird das Objekt wieder
 * entfernt, damit kein unverwaltetes Objekt liegen bleibt.
 */
import { logError } from '../db';
import type { DbEnv } from '../db/env';
import { encryptMedium, type MediaWrapEnv } from './crypto';

export interface MediaEnv extends DbEnv, MediaWrapEnv {
  MEDIA: R2Bucket;
}

export const BEREICH = 'medien';

export interface Medium {
  id: string;
  post_id: string;
  r2_key: string;
  inhaltstyp: string;
  groesse_byte: number;
  erstellt_am: string;
}

export async function storeMedium(
  env: MediaEnv,
  input: { postId: string; inhaltstyp: string; daten: Uint8Array },
): Promise<Medium> {
  const id = crypto.randomUUID();
  const r2Key = `media/${id}`;
  const erstelltAm = new Date().toISOString();
  let enc;
  try {
    enc = await encryptMedium(env, input.daten);
    await env.MEDIA.put(r2Key, enc.chiffretext);
  } catch (e) {
    await logError(env.DB, { bereich: BEREICH, code: 'ABLAGE_FEHLGESCHLAGEN' });
    throw e;
  }
  try {
    await env.DB
      .prepare(
        'INSERT INTO media (id, post_id, r2_key, umhuellter_schluessel, iv, inhaltstyp, groesse_byte, erstellt_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, input.postId, r2Key, enc.umhuellterSchluessel, enc.iv, input.inhaltstyp, input.daten.length, erstelltAm)
      .run();
  } catch (e) {
    await env.MEDIA.delete(r2Key).catch(() => undefined);
    await logError(env.DB, { bereich: BEREICH, code: 'ABLAGE_METADATEN_FEHLGESCHLAGEN' });
    throw e;
  }
  return { id, post_id: input.postId, r2_key: r2Key, inhaltstyp: input.inhaltstyp, groesse_byte: input.daten.length, erstellt_am: erstelltAm };
}
