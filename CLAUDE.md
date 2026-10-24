# fanfed — Konventionen

## Dieses Repo ist öffentlich

Alles hier ist für jeden lesbar: Dateien, Commit-Nachrichten, PR-Titel,
Workflow-Logs. Nichts davon lässt sich zurückholen.

- Keine Namen anderer Projekte, Repos, Firmen oder Personen des Betreibers.
- Keine E-Mail-Adressen außer `…@users.noreply.github.com`.
- Keine Geheimnisse, auch keine Platzhalter, die wie echte aussehen.
  Geheimnisse kommen als GitHub- oder Cloudflare-Secret, nie in eine Datei.
- Commit-Autor: die GitHub-noreply-Adresse.

## Bezahlinhalte föderieren nie

Actor, Outbox und jede Activity enthalten nur Öffentliches (Profil, Teaser).
Bezahlte Medien werden ausschließlich gegen einen geprüften Abo-Token
ausgeliefert. Ein Test hält das für jeden neuen Endpunkt fest.

## Nichts darf unbemerkt fehlschlagen

Zahlung, Altersprüfung, Auszahlung und Moderation melden Fehlschläge aktiv,
nie nur per `console.error`.

## Geld deutsch geschrieben

`1.234,50 €` — Komma, Tausenderpunkt, Leerzeichen vor dem €.

## Mergen

Pflicht ist nur die Prüfung `test` (Ruleset auf `main`). Gemergt wird mit

```bash
node scripts/merge-pr.mjs <nr>
```

Das Skript wartet auf `test`, mergt per Squash und gibt nur dann 0 zurück, wenn
die PR wirklich gemergt ist. Nicht `gh pr merge --auto` als Ersatz nehmen: das
kehrt sofort mit 0 zurück. Dependabot-PRs setzt ein Workflow selbst auf Auto-Merge.

## Testen

Vitest, Test liegt neben dem Code (`foo.ts` → `foo.test.ts`). Neue Logik bringt
ihren Test im selben PR mit.

```bash
npm run typecheck
npm test
```
