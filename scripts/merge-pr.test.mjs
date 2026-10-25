import { describe, expect, it, vi } from 'vitest';
import { mergePr } from './merge-pr.mjs';

const GRUEN = [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }];

/** Fake-gh: `zustaende` wird je `pr view` der Reihe nach verbraucht. */
function fake({ zustaende, mergeFehler, loeschFehler }) {
  const aufrufe = [];
  const gh = (args) => {
    aufrufe.push(args);
    if (args[0] === 'pr' && args[1] === 'view') {
      const state = zustaende.length > 1 ? zustaende.shift() : zustaende[0];
      return JSON.stringify({ state, headRefName: 'orchester/x/y', statusCheckRollup: GRUEN });
    }
    if (args[0] === 'pr' && args[1] === 'merge') {
      if (mergeFehler) throw Object.assign(new Error('x'), { stderr: mergeFehler });
      return '';
    }
    if (args[0] === 'api') {
      if (loeschFehler) throw new Error(loeschFehler);
      return '';
    }
    throw new Error(`unerwartet: ${args.join(' ')}`);
  };
  return { gh, aufrufe };
}

describe('mergePr', () => {
  it('mergt ohne --delete-branch und löscht den Zweig per gh api', async () => {
    const { gh, aufrufe } = fake({ zustaende: ['OPEN', 'MERGED'] });
    expect(await mergePr('7', { gh })).toBe(0);
    const merge = aufrufe.find((a) => a[1] === 'merge');
    expect(merge).toEqual(['pr', 'merge', '7', '--squash']);
    const api = aufrufe.find((a) => a[0] === 'api');
    expect(api?.join(' ')).toContain('DELETE repos/{owner}/{repo}/git/refs/heads/orchester/x/y');
  });

  it('Worktree-Fall: gh pr merge scheitert lokal, PR ist MERGED → Exit 0', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gh } = fake({
      zustaende: ['OPEN', 'MERGED'],
      mergeFehler: "fatal: 'main' is already used by worktree at '/pfad'",
    });
    expect(await mergePr('7', { gh })).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('Merge scheitert und PR bleibt OPEN → Exit 1', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { gh } = fake({ zustaende: ['OPEN'], mergeFehler: 'abgelehnt' });
    expect(await mergePr('7', { gh })).toBe(1);
    err.mockRestore();
  });

  it('Zweig-Löschung scheitert → trotzdem Exit 0', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gh } = fake({ zustaende: ['OPEN', 'MERGED'], loeschFehler: 'HTTP 422' });
    expect(await mergePr('7', { gh })).toBe(0);
    warn.mockRestore();
  });
});
