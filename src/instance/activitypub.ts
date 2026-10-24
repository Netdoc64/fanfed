/**
 * ActivityPub-Grundlagen einer Creator-Instanz: WebFinger und Actor.
 *
 * Reine Funktionen ohne Außenwelt, damit sie ohne Worker-Laufzeit testbar sind.
 * Öffentlich wird hier nur, was föderiert werden darf (Profil, Teaser).
 * Bezahlinhalte laufen nie über Actor oder Outbox.
 */

export interface CreatorProfile {
  handle: string;
  displayName: string;
  summary: string;
}

const HANDLE = /^[a-z0-9_]{1,30}$/;

export function isValidHandle(handle: string): boolean {
  return HANDLE.test(handle);
}

/**
 * Liest `acct:name@domain` aus einer WebFinger-Anfrage. Gibt null zurück,
 * wenn das Konto nicht zu dieser Instanz gehört oder ungültig ist.
 */
export function parseWebfingerResource(resource: string | null, domain: string): string | null {
  if (!resource) return null;
  const m = /^acct:([^@]+)@(.+)$/.exec(resource.trim());
  if (!m) return null;
  const [, name, host] = m;
  if (!name || host?.toLowerCase() !== domain.toLowerCase()) return null;
  const handle = name.toLowerCase();
  return isValidHandle(handle) ? handle : null;
}

export function actorUrl(domain: string, handle: string): string {
  return `https://${domain}/users/${handle}`;
}

export function buildWebfinger(domain: string, handle: string) {
  return {
    subject: `acct:${handle}@${domain}`,
    links: [
      { rel: 'self', type: 'application/activity+json', href: actorUrl(domain, handle) },
    ],
  };
}

export function buildActor(domain: string, profile: CreatorProfile) {
  const id = actorUrl(domain, profile.handle);
  return {
    '@context': ['https://www.w3.org/ns/activitystreams'],
    id,
    type: 'Person',
    preferredUsername: profile.handle,
    name: profile.displayName,
    summary: profile.summary,
    inbox: `${id}/inbox`,
    outbox: `${id}/outbox`,
    followers: `${id}/followers`,
  };
}
