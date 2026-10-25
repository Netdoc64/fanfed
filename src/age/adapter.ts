/**
 * Schnittstelle für Altersprüfungs-Anbieter. Der Kern kennt nur diese Form;
 * welcher Anbieter dahintersteht, ist Konfiguration (Phase 0 ist offen).
 * Ein Adapter liefert nur das Ergebnis — nie Ausweis- oder Personendaten.
 */

export type AgeErgebnis = 'bestanden' | 'abgelehnt';

export interface AgeStart {
  /** Anbieterseitige Kennung dieser Prüfung, wird im Callback zurückgegeben. */
  referenz: string;
  /** Adresse, zu der der Abonnent für die Prüfung geleitet wird (falls nötig). */
  weiterleitung?: string;
}

export interface AgeResult {
  referenz: string;
  ergebnis: AgeErgebnis;
}

export interface AgeVerificationAdapter {
  readonly name: string;
  /** Startet eine Prüfung für einen pseudonymen Abonnenten-Bezug. */
  start(abonnentRef: string): Promise<AgeStart>;
  /** Prüft einen Callback des Anbieters; wirft AgeCallbackError, wenn er ungültig ist. */
  pruefeCallback(payload: unknown): Promise<AgeResult>;
}

export class AgeCallbackError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AgeCallbackError';
  }
}
