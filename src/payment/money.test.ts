import { expect, it } from 'vitest';
import { formatEuro } from './money';

it.each([
  [0, '0,00 €'],
  [5, '0,05 €'],
  [99, '0,99 €'],
  [100, '1,00 €'],
  [123450, '1.234,50 €'],
  [100000000, '1.000.000,00 €'],
  [123456789, '1.234.567,89 €'],
  [-250, '-2,50 €'],
])('formatEuro(%i) = %s', (cent, erwartet) => {
  expect(formatEuro(cent)).toBe(erwartet);
});

it('weist Nicht-Ganzzahlen ab', () => {
  expect(() => formatEuro(1.5)).toThrow(RangeError);
  expect(() => formatEuro(Number.NaN)).toThrow(RangeError);
});
