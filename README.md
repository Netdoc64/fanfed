# fanfed

[![CI](https://github.com/Netdoc64/fanfed/actions/workflows/ci.yml/badge.svg)](https://github.com/Netdoc64/fanfed/actions/workflows/ci.yml)

Föderierte Creator-Abo-Plattform: Creator betreiben ihre eigene Instanz,
öffentliche Teaser laufen über ActivityPub ins Fediverse, Bezahlinhalte bleiben
verschlüsselt auf der Instanz und werden nur gegen ein gültiges Abo ausgeliefert.

> Stand: Gerüst. Es gibt noch keinen Produktivbetrieb. Phase 0 (Recht, Zahlung,
> Altersprüfung) ist nicht entschieden. Siehe [docs/PLAN.md](docs/PLAN.md).

## Grundsatz: föderiert, nicht unveränderlich

Kein IPFS, keine Blockchain für Inhalte. Inhalte müssen löschbar und sperrbar
bleiben: Recht auf Löschung, Widerruf der Einwilligung gezeigter Personen,
unverzügliche Entfernung rechtswidriger Inhalte.

## Entwicklung

```bash
npm ci
npm run typecheck
npm test
npm run dev        # lokale Instanz unter http://localhost:8787
```

Endpunkte des Gerüsts: `/health`, `/.well-known/webfinger?resource=acct:name@domain`,
`/users/:name`.

## Mitmachen

PRs gegen `main`; die Prüfung `test` muss grün sein. Sicherheitslücken bitte
privat melden, siehe [SECURITY.md](SECURITY.md).
