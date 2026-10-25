/**
 * Medienverschlüsselung: je Medium ein eigener AES-GCM-Schlüssel mit zufälligem
 * IV. Der Medienschlüssel wird mit dem Instanz-Schlüssel (MEDIA_WRAP_KEY aus
 * env, base64url, genau 32 Byte) per AES-GCM umhüllt; in der Datenbank liegt
 * nur die umhüllte Form. Schlüssel stehen in keiner Datei.
 */

export interface MediaWrapEnv {
  MEDIA_WRAP_KEY: string;
}

const IV_BYTES = 12;

export function toB64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64u(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('kein base64url');
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Erzeugt einen frischen Instanz-Schlüssel (32 Byte, base64url) — für Tests und die Einrichtung. */
export function generateWrapKey(): string {
  return toB64u(crypto.getRandomValues(new Uint8Array(32)));
}

function importWrapKey(env: MediaWrapEnv): Promise<CryptoKey> {
  const raw = fromB64u(env.MEDIA_WRAP_KEY ?? '');
  if (raw.length !== 32) throw new Error('MEDIA_WRAP_KEY fehlt oder hat nicht 32 Byte');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedMedium {
  /** IV der Inhaltsverschlüsselung, base64url */
  iv: string;
  /** Medienschlüssel, mit dem Instanz-Schlüssel umhüllt (IV + Chiffretext), base64url */
  umhuellterSchluessel: string;
  /** Chiffretext inklusive GCM-Tag */
  chiffretext: Uint8Array;
}

export async function encryptMedium(env: MediaWrapEnv, klartext: Uint8Array): Promise<EncryptedMedium> {
  const wrapKey = await importWrapKey(env);
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const chiffretext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, klartext));

  const wrapIv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, wrapKey, rawKey));
  const umhuellt = new Uint8Array(IV_BYTES + wrapped.length);
  umhuellt.set(wrapIv, 0);
  umhuellt.set(wrapped, IV_BYTES);
  rawKey.fill(0);
  return { iv: toB64u(iv), umhuellterSchluessel: toB64u(umhuellt), chiffretext };
}

/** Wirft, wenn Schlüssel, IV oder Chiffretext nicht zusammenpassen (GCM-Tag). */
export async function decryptMedium(
  env: MediaWrapEnv,
  medium: Pick<EncryptedMedium, 'iv' | 'umhuellterSchluessel'>,
  chiffretext: Uint8Array,
): Promise<Uint8Array> {
  const wrapKey = await importWrapKey(env);
  const umhuellt = fromB64u(medium.umhuellterSchluessel);
  const rawKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: umhuellt.slice(0, IV_BYTES) },
    wrapKey,
    umhuellt.slice(IV_BYTES),
  );
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(medium.iv) }, key, chiffretext),
  );
}
