import { expect, it } from 'vitest';
import { decryptMedium, encryptMedium, generateWrapKey } from './crypto';

const daten = new TextEncoder().encode('geheimes-medium-inhalt');

it('Rundreise ver-/entschlüsseln; Chiffretext enthält keinen Klartext', async () => {
  const env = { MEDIA_WRAP_KEY: generateWrapKey() };
  const enc = await encryptMedium(env, daten);
  expect(new TextDecoder('latin1').decode(enc.chiffretext)).not.toContain('geheimes');
  expect(await decryptMedium(env, enc, enc.chiffretext)).toEqual(daten);
});

it('zwei Medien haben verschiedene Schlüssel und IVs', async () => {
  const env = { MEDIA_WRAP_KEY: generateWrapKey() };
  const a = await encryptMedium(env, daten);
  const b = await encryptMedium(env, daten);
  expect(a.umhuellterSchluessel).not.toBe(b.umhuellterSchluessel);
  expect(a.iv).not.toBe(b.iv);
  expect(a.chiffretext).not.toEqual(b.chiffretext);
  await expect(decryptMedium(env, { iv: a.iv, umhuellterSchluessel: b.umhuellterSchluessel }, a.chiffretext)).rejects.toThrow();
});

it('falscher Instanz-Schlüssel oder manipulierter Chiffretext scheitern', async () => {
  const env = { MEDIA_WRAP_KEY: generateWrapKey() };
  const enc = await encryptMedium(env, daten);
  await expect(decryptMedium({ MEDIA_WRAP_KEY: generateWrapKey() }, enc, enc.chiffretext)).rejects.toThrow();
  const kaputt = enc.chiffretext.slice();
  kaputt[0] = kaputt[0]! ^ 1;
  await expect(decryptMedium(env, enc, kaputt)).rejects.toThrow();
});

it('fehlender oder zu kurzer Instanz-Schlüssel wird abgelehnt', async () => {
  await expect(encryptMedium({ MEDIA_WRAP_KEY: '' }, daten)).rejects.toThrow();
  await expect(encryptMedium({ MEDIA_WRAP_KEY: 'AAAA' }, daten)).rejects.toThrow();
});
