import { expect, it } from 'vitest';
import { AgeCallbackError } from './adapter';
import { createTestAgeAdapter } from './test-adapter';

it('liefert das konfigurierte Ergebnis', async () => {
  for (const ergebnis of ['bestanden', 'abgelehnt'] as const) {
    const a = createTestAgeAdapter({ ergebnis });
    const { referenz } = await a.start('abo-1');
    expect(await a.pruefeCallback({ referenz })).toEqual({ referenz, ergebnis });
  }
});

it('weist einen ungültigen Callback ab', async () => {
  const a = createTestAgeAdapter({ ergebnis: 'bestanden' });
  await expect(a.pruefeCallback({ referenz: 'fremd-1' })).rejects.toBeInstanceOf(AgeCallbackError);
  await expect(a.pruefeCallback(null)).rejects.toBeInstanceOf(AgeCallbackError);
});
