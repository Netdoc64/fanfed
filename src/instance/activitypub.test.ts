import { describe, expect, it } from 'vitest';
import { buildActor, buildWebfinger, isValidHandle, parseWebfingerResource } from './activitypub';

const DOMAIN = 'example.test';
const OTHER = 'other.test';

describe('parseWebfingerResource', () => {
  it('nimmt ein Konto dieser Instanz an', () => {
    expect(parseWebfingerResource(`acct:Anna@${DOMAIN}`, DOMAIN)).toBe('anna');
  });

  it('weist fremde Instanzen ab', () => {
    expect(parseWebfingerResource(`acct:anna@${OTHER}`, DOMAIN)).toBeNull();
  });

  it('weist ungültige Eingaben ab', () => {
    expect(parseWebfingerResource(null, DOMAIN)).toBeNull();
    expect(parseWebfingerResource(`anna@${DOMAIN}`, DOMAIN)).toBeNull();
    expect(parseWebfingerResource(`acct:../x@${DOMAIN}`, DOMAIN)).toBeNull();
  });
});

describe('isValidHandle', () => {
  it('erlaubt nur Kleinbuchstaben, Ziffern und Unterstrich', () => {
    expect(isValidHandle('anna_99')).toBe(true);
    expect(isValidHandle('Anna')).toBe(false);
    expect(isValidHandle('')).toBe(false);
    expect(isValidHandle('a'.repeat(31))).toBe(false);
  });
});

describe('buildWebfinger / buildActor', () => {
  it('verweist auf denselben Actor', () => {
    const wf = buildWebfinger(DOMAIN, 'anna');
    const actor = buildActor(DOMAIN, { handle: 'anna', displayName: 'Anna', summary: '' });
    expect(wf.links[0]?.href).toBe(actor.id);
    expect(actor.inbox).toBe('https://example.test/users/anna/inbox');
  });
});

describe('Gegenprobe', () => { it('ist absichtlich rot', () => { expect(1).toBe(2); }); });
