/**
 * Fehlerprotokoll in D1. Bewusst ohne Freitext: nur Bereich und Code, damit
 * keine personenbezogenen Daten (E-Mail, IP, Name) hineingelangen können.
 */

export type ErrorBereich = 'zahlung' | 'alterspruefung' | 'medien' | 'moderation' | 'auszahlung' | (string & {});

export interface ErrorLogEntry {
  bereich: ErrorBereich;
  code: string;
}

export interface ErrorLogRow extends ErrorLogEntry {
  id: number;
  zeitpunkt: string;
}

const CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Schreibt eine Zeile. Wirft nie; gibt zurück, ob das Schreiben gelang. */
export async function logError(db: D1Database, entry: ErrorLogEntry): Promise<boolean> {
  try {
    // Ein Code mit Freitext (womöglich personenbezogen) wird nicht gespeichert.
    const code = CODE.test(entry.code) ? entry.code : 'UNGUELTIGER_CODE';
    await db
      .prepare('INSERT INTO error_logs (bereich, code, zeitpunkt) VALUES (?, ?, ?)')
      .bind(entry.bereich, code, new Date().toISOString())
      .run();
    return true;
  } catch {
    return false;
  }
}

export async function listErrors(db: D1Database, limit = 100): Promise<ErrorLogRow[]> {
  const res = await db
    .prepare('SELECT id, bereich, code, zeitpunkt FROM error_logs ORDER BY id DESC LIMIT ?')
    .bind(limit)
    .all<ErrorLogRow>();
  return res.results;
}
