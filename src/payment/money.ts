/** Geldbeträge sind durchgehend ganzzahlige Cent; nur die Anzeige formatiert. */

/** 123450 -> "1.234,50 €" (Komma, Tausenderpunkt, Leerzeichen vor dem €). */
export function formatEuro(cent: number): string {
  if (!Number.isSafeInteger(cent)) throw new RangeError('cent muss eine ganze Zahl sein');
  const negativ = cent < 0;
  const betrag = Math.abs(cent);
  const euro = Math.floor(betrag / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rest = (betrag % 100).toString().padStart(2, '0');
  return `${negativ ? '-' : ''}${euro},${rest} €`;
}
