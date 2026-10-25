/**
 * Altersprüfung gegen D1. age_checks speichert nur Ergebnis, Zeitpunkt und
 * Adaptername — keine Ausweis- oder Personendaten. Ohne bestandenen,
 * nicht abgelaufenen Eintrag gibt es keinen paid-Inhalt.
 */
import { logError } from '../db';
import type { AgeVerificationAdapter } from './adapter';

const BEREICH = 'age';

/** Wie lange ein bestandenes Ergebnis gilt. */
export const GUELTIGKEIT_TAGE = 365;

export interface AgeCheckRow {
  id: string;
  abonnent_ref: string;
  ergebnis: 'bestanden' | 'abgelehnt' | 'ausstehend';
  anbieter: string;
  geprueft_am: string;
}

/** Legt eine ausstehende Prüfung an. Gibt Referenz und Weiterleitung zurück, bei Adapterfehler null. */
export async function startAgeCheck(
  db: D1Database,
  adapter: AgeVerificationAdapter,
  abonnentRef: string,
): Promise<{ referenz: string; weiterleitung?: string } | null> {
  try {
    const start = await adapter.start(abonnentRef);
    await db
      .prepare(
        "INSERT INTO age_checks (id, abonnent_ref, ergebnis, anbieter, geprueft_am) VALUES (?, ?, 'ausstehend', ?, ?)",
      )
      .bind(start.referenz, abonnentRef, adapter.name, new Date().toISOString())
      .run();
    return start;
  } catch {
    await logError(db, { bereich: BEREICH, code: 'START_FEHLGESCHLAGEN' });
    return null;
  }
}

/** Verarbeitet den Anbieter-Callback. true nur, wenn das Ergebnis gespeichert wurde. */
export async function handleAgeCallback(
  db: D1Database,
  adapter: AgeVerificationAdapter,
  payload: unknown,
): Promise<boolean> {
  try {
    const result = await adapter.pruefeCallback(payload);
    const res = await db
      .prepare(
        "UPDATE age_checks SET ergebnis = ?, geprueft_am = ? WHERE id = ? AND anbieter = ? AND ergebnis = 'ausstehend'",
      )
      .bind(result.ergebnis, new Date().toISOString(), result.referenz, adapter.name)
      .run();
    if (!res.meta.changes) {
      await logError(db, { bereich: BEREICH, code: 'CALLBACK_UNBEKANNT' });
      return false;
    }
    return true;
  } catch {
    await logError(db, { bereich: BEREICH, code: 'CALLBACK_UNGUELTIG' });
    return false;
  }
}

/** true nur bei einem bestandenen, nicht abgelaufenen Eintrag. Sonst (auch bei Fehlern) false. */
export async function hasPassedAgeCheck(
  db: D1Database,
  abonnentRef: string,
  jetzt: Date = new Date(),
  gueltigkeitTage: number = GUELTIGKEIT_TAGE,
): Promise<boolean> {
  try {
    const grenze = new Date(jetzt.getTime() - gueltigkeitTage * 86_400_000).toISOString();
    const row = await db
      .prepare(
        "SELECT 1 AS ok FROM age_checks WHERE abonnent_ref = ? AND ergebnis = 'bestanden' AND geprueft_am > ? AND geprueft_am <= ? LIMIT 1",
      )
      .bind(abonnentRef, grenze, jetzt.toISOString())
      .first<number>('ok');
    return row === 1;
  } catch {
    await logError(db, { bereich: BEREICH, code: 'ABFRAGE_FEHLGESCHLAGEN' });
    return false;
  }
}
