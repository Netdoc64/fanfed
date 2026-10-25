/**
 * Kurzlebiger Abo-Token: base64url(Nutzlast).base64url(HMAC-SHA-256).
 * Der Schlüssel kommt aus env (SUBSCRIPTION_TOKEN_KEY, base64url, mind. 32 Byte);
 * er steht in keiner Datei. Die Prüfung der Signatur läuft über
 * crypto.subtle.verify und ist damit zeitkonstant.
 */

export interface SubscriptionTokenEnv {
  SUBSCRIPTION_TOKEN_KEY: string;
}

/** Laufzeit eines Tokens in Sekunden. */
export const TOKEN_LAUFZEIT_SEKUNDEN = 300;

export interface TokenPayload {
  /** subscription_id */
  sub: string;
  /** Stufe (tiers.rang) des Abos */
  tier: number;
  /** Ablauf, Sekunden seit Epoche */
  exp: number;
}

export type VerifyResult =
  | { status: 'ok'; payload: TokenPayload }
  | { status: 'abgelaufen' | 'signatur' | 'stufe' | 'kaputt' };

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64u(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function importKey(key: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const raw = fromB64u(key ?? '');
  if (!raw || raw.length < 32) throw new Error('SUBSCRIPTION_TOKEN_KEY fehlt oder ist zu kurz');
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/** Erzeugt einen frischen Schlüssel (32 Byte, base64url) — etwa für Tests oder die erste Einrichtung. */
export function generateTokenKey(): string {
  return toB64u(crypto.getRandomValues(new Uint8Array(32)));
}

export async function issueToken(
  env: SubscriptionTokenEnv,
  input: { subscriptionId: string; tier: number },
  jetzt: Date = new Date(),
  laufzeitSekunden: number = TOKEN_LAUFZEIT_SEKUNDEN,
): Promise<string> {
  const payload: TokenPayload = {
    sub: input.subscriptionId,
    tier: input.tier,
    exp: Math.floor(jetzt.getTime() / 1000) + laufzeitSekunden,
  };
  const body = toB64u(enc.encode(JSON.stringify(payload)));
  const key = await importKey(env.SUBSCRIPTION_TOKEN_KEY, 'sign');
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${toB64u(sig)}`;
}

/** Prüft Form, Signatur, Ablauf und Mindeststufe (in dieser Reihenfolge). */
export async function verifyToken(
  env: SubscriptionTokenEnv,
  token: string,
  mindestStufe: number = 1,
  jetzt: Date = new Date(),
): Promise<VerifyResult> {
  const teile = typeof token === 'string' ? token.split('.') : [];
  if (teile.length !== 2) return { status: 'kaputt' };
  const body = teile[0]!;
  const sig = fromB64u(teile[1]!);
  const bodyBytes = fromB64u(body);
  if (!sig || !bodyBytes || !body) return { status: 'kaputt' };

  const key = await importKey(env.SUBSCRIPTION_TOKEN_KEY, 'verify');
  if (!(await crypto.subtle.verify('HMAC', key, sig, enc.encode(body)))) return { status: 'signatur' };

  let payload: TokenPayload;
  try {
    const p = JSON.parse(dec.decode(bodyBytes)) as Partial<TokenPayload>;
    if (typeof p.sub !== 'string' || !Number.isInteger(p.tier) || !Number.isInteger(p.exp)) {
      return { status: 'kaputt' };
    }
    payload = { sub: p.sub, tier: p.tier as number, exp: p.exp as number };
  } catch {
    return { status: 'kaputt' };
  }
  if (payload.exp <= Math.floor(jetzt.getTime() / 1000)) return { status: 'abgelaufen' };
  if (payload.tier < mindestStufe) return { status: 'stufe' };
  return { status: 'ok', payload };
}
