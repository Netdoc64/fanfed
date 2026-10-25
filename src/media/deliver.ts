/**
 * Auslieferung: Inhalt nur mit gültigem Abo-Token, aktivem Abo (passend zu
 * Creator und Stufe des Beitrags) UND bestandener Altersprüfung. Jede andere
 * Antwort ist 403 mit leerem Körper — ohne Hinweis, ob es das Medium gibt.
 * Jede Abweisung und jeder Fehlschlag landet in error_logs (nur Code, keine
 * personenbezogenen Daten).
 */
import { hasPassedAgeCheck } from '../age';
import { logError } from '../db';
import { getSubscription, isActive, verifyToken, type SubscriptionTokenEnv } from '../subscription';
import { decryptMedium } from './crypto';
import { BEREICH, type MediaEnv } from './store';

export type MediaDeliveryEnv = MediaEnv & SubscriptionTokenEnv;

interface MediumRow {
  r2_key: string;
  umhuellter_schluessel: string;
  iv: string;
  inhaltstyp: string;
  creator_id: string;
  rang: number | null;
}

const PFAD = /^\/media\/([A-Za-z0-9-]{1,64})$/;

function verweigert(): Response {
  return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
}

function tokenAus(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  const m = auth ? /^Bearer\s+(\S+)$/i.exec(auth) : null;
  return m ? m[1]! : null;
}

/** GET /media/<id> mit „Authorization: Bearer <Abo-Token>“. */
export async function handleMediaRequest(
  request: Request,
  env: MediaDeliveryEnv,
  jetzt: Date = new Date(),
): Promise<Response> {
  const abgewiesen = async (code: string) => {
    await logError(env.DB, { bereich: BEREICH, code });
    return verweigert();
  };

  const id = PFAD.exec(new URL(request.url).pathname)?.[1];
  if (request.method !== 'GET' || !id) return abgewiesen('ANFRAGE_UNGUELTIG');

  try {
    const token = tokenAus(request);
    if (!token) return await abgewiesen('TOKEN_FEHLT');

    const row = await env.DB
      .prepare(
        `SELECT m.r2_key, m.umhuellter_schluessel, m.iv, m.inhaltstyp, p.creator_id, t.rang
         FROM media m JOIN posts p ON p.id = m.post_id LEFT JOIN tiers t ON t.id = p.tier_id
         WHERE m.id = ?`,
      )
      .bind(id)
      .first<MediumRow>();
    if (!row) return await abgewiesen('MEDIUM_UNBEKANNT');

    const pruefung = await verifyToken(env, token, row.rang ?? 1, jetzt);
    if (pruefung.status !== 'ok') return await abgewiesen(`TOKEN_${pruefung.status.toUpperCase()}`);

    const abo = await getSubscription(env.DB, pruefung.payload.sub);
    if (!abo || abo.creator_id !== row.creator_id) return await abgewiesen('ABO_UNBEKANNT');
    if (!isActive(abo, jetzt)) return await abgewiesen('ABO_INAKTIV');

    if (!(await hasPassedAgeCheck(env.DB, abo.abonnent_ref, jetzt))) return await abgewiesen('ALTERSPRUEFUNG_FEHLT');

    const objekt = await env.MEDIA.get(row.r2_key);
    if (!objekt) return await abgewiesen('R2_OBJEKT_FEHLT');
    const klartext = await decryptMedium(env, { iv: row.iv, umhuellterSchluessel: row.umhuellter_schluessel }, new Uint8Array(await objekt.arrayBuffer()));
    return new Response(klartext, {
      status: 200,
      headers: { 'Content-Type': row.inhaltstyp, 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return abgewiesen('AUSLIEFERUNG_FEHLGESCHLAGEN');
  }
}
