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
 * Warum nicht `gh pr merge --auto`: das kehrt sofort mit 0 zurück, auch wenn
 * die CI noch läuft — wer den Exit-Code liest, hielte die PR für gemergt.
 */
import { execFileSync } from 'node:child_process';

const PRUEFUNG = 'test';
const WARTEN_MS = 15_000;
const HOECHSTENS_MS = 30 * 60_000;

const nr = process.argv[2];
if (!/^\d+$/.test(nr ?? '')) {
  console.error('Aufruf: node scripts/merge-pr.mjs <nr>');
  process.exit(2);
}

/** @param {string[]} args */
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** @returns {{state: string, checks: {name: string, status: string, conclusion: string}[]}} */
function lies() {
  const roh = JSON.parse(gh(['pr', 'view', nr, '--json', 'state,statusCheckRollup']));
  return { state: roh.state, checks: roh.statusCheckRollup ?? [] };
}

const bis = Date.now() + HOECHSTENS_MS;
for (;;) {
  const { state, checks } = lies();
  if (state === 'MERGED') {
    console.log(`#${nr} ist bereits gemergt.`);
    process.exit(0);
  }
  if (state !== 'OPEN') {
    console.error(`#${nr} ist ${state}, nicht offen.`);
    process.exit(1);
  }
  const lauf = checks.find((c) => c.name === PRUEFUNG);
  if (lauf?.status === 'COMPLETED') {
    if (lauf.conclusion !== 'SUCCESS') {
      console.error(`#${nr}: Prüfung ${PRUEFUNG} ist ${lauf.conclusion} — kein Merge.`);
      process.exit(1);
    }
    break;
  }
  if (Date.now() > bis) {
    console.error(`#${nr}: Prüfung ${PRUEFUNG} nach 30 min nicht fertig — kein Merge.`);
    process.exit(1);
  }
  console.log(`#${nr}: warte auf ${PRUEFUNG} (${lauf?.status ?? 'noch nicht gestartet'}) …`);
  await new Promise((r) => setTimeout(r, WARTEN_MS));
}

try {
  gh(['pr', 'merge', nr, '--squash', '--delete-branch']);
} catch (err) {
  console.error(`#${nr}: Merge abgelehnt — ${String(err.stderr || err.message).trim()}`);
  process.exit(1);
}

const { state } = lies();
if (state !== 'MERGED') {
  console.error(`#${nr}: nach dem Merge-Aufruf steht die PR auf ${state}.`);
  process.exit(1);
}
console.log(`#${nr} gemergt.`);
