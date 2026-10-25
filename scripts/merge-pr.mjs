#!/usr/bin/env node
/**
 * Eine PR mergen — nur wenn die Pflichtprüfung `test` grün ist.
 *
 *   node scripts/merge-pr.mjs <nr>
 *
 * Wartet, bis `test` fertig ist, und mergt dann per Squash.
 * Exit 0 heißt: die PR IST gemergt (nicht nur vorgemerkt).
 * Exit 1: `test` rot oder Merge abgelehnt. Exit 2: Bedienfehler.
 *
 * Maßgeblich ist der Zustand danach (`gh pr view --json state`): steht die PR auf
 * MERGED, ist es Exit 0 — auch wenn ein lokaler Schritt von `gh pr merge`
 * scheitert (z. B. Zweig-Wechsel im Worktree). Darum kein `--delete-branch`;
 * der Zweig wird remote per `gh api` gelöscht, ein Fehlschlag dort warnt nur.
 *
 * Warum nicht `gh pr merge --auto`: das kehrt sofort mit 0 zurück, auch wenn
 * die CI noch läuft — wer den Exit-Code liest, hielte die PR für gemergt.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PRUEFUNG = 'test';
const WARTEN_MS = 15_000;
const HOECHSTENS_MS = 30 * 60_000;

/** @param {string[]} args */
function ghEcht(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * @param {string} nr
 * @param {{gh?: (args: string[]) => string, wartenMs?: number, hoechstensMs?: number}} [opt]
 * @returns {Promise<number>} Exit-Code
 */
export async function mergePr(nr, opt = {}) {
  const gh = opt.gh ?? ghEcht;
  const wartenMs = opt.wartenMs ?? WARTEN_MS;
  const bis = Date.now() + (opt.hoechstensMs ?? HOECHSTENS_MS);

  /** @returns {{state: string, branch: string, checks: {name: string, status: string, conclusion: string}[]}} */
  const lies = () => {
    const roh = JSON.parse(gh(['pr', 'view', nr, '--json', 'state,headRefName,statusCheckRollup']));
    return { state: roh.state, branch: roh.headRefName, checks: roh.statusCheckRollup ?? [] };
  };

  let branch;
  for (;;) {
    const { state, checks, branch: b } = lies();
    branch = b;
    if (state === 'MERGED') {
      console.log(`#${nr} ist bereits gemergt.`);
      return 0;
    }
    if (state !== 'OPEN') {
      console.error(`#${nr} ist ${state}, nicht offen.`);
      return 1;
    }
    const lauf = checks.find((c) => c.name === PRUEFUNG);
    if (lauf?.status === 'COMPLETED') {
      if (lauf.conclusion !== 'SUCCESS') {
        console.error(`#${nr}: Prüfung ${PRUEFUNG} ist ${lauf.conclusion} — kein Merge.`);
        return 1;
      }
      break;
    }
    if (Date.now() > bis) {
      console.error(`#${nr}: Prüfung ${PRUEFUNG} nach 30 min nicht fertig — kein Merge.`);
      return 1;
    }
    console.log(`#${nr}: warte auf ${PRUEFUNG} (${lauf?.status ?? 'noch nicht gestartet'}) …`);
    await new Promise((r) => setTimeout(r, wartenMs));
  }

  /** @type {string | undefined} */
  let mergeFehler;
  try {
    gh(['pr', 'merge', nr, '--squash']);
  } catch (err) {
    mergeFehler = String(err.stderr || err.message).trim();
  }

  // Der Zustand entscheidet, nicht der Exit von `gh pr merge`.
  const { state } = lies();
  if (state !== 'MERGED') {
    console.error(
      mergeFehler
        ? `#${nr}: Merge abgelehnt — ${mergeFehler}`
        : `#${nr}: nach dem Merge-Aufruf steht die PR auf ${state}.`,
    );
    return 1;
  }
  if (mergeFehler) {
    console.warn(`#${nr}: gh meldete einen Fehler, die PR ist trotzdem gemergt — ${mergeFehler}`);
  }

  try {
    gh(['api', '-X', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${branch}`]);
  } catch (err) {
    console.warn(`#${nr}: Zweig ${branch} nicht gelöscht — ${String(err.stderr || err.message).trim()}`);
  }
  console.log(`#${nr} gemergt.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const nr = process.argv[2];
  if (!/^\d+$/.test(nr ?? '')) {
    console.error('Aufruf: node scripts/merge-pr.mjs <nr>');
    process.exit(2);
  }
  process.exit(await mergePr(nr));
}
