# Plan

## Architektur

| Baustein | Aufgabe | Technik |
| --- | --- | --- |
| Creator-Instanz | Profil, Beiträge, Abo-Stufen | Cloudflare Worker + D1 |
| Föderation | Teaser, Follows, Entdecken | ActivityPub (Actor, Inbox, Outbox, WebFinger) |
| Bezahlinhalte | Medien verschlüsselt ablegen | R2, ein Schlüssel je Beitrag, kurzlebige signierte URLs |
| Zugangsnachweis | Abo instanzübergreifend nachweisen | signierter Abo-Token |
| Zahlung | Abos, Trinkgeld, Pay-per-View | Zahlungsanbieter mit Freigabe für Erwachseneninhalte; keine eigenen Auszahlungen (ZAG) |
| Altersprüfung | Pflicht vor jedem Erwachseneninhalt | von der KJM anerkanntes AV-System |
| Moderation | Meldungen, Hash-Abgleich, Sperren | Melde-Weg nach DSA, Instanz-Sperrlisten |
| Creator-Prüfung | Identität und Einwilligung | KYC des Creators + Alters- und Einwilligungsnachweis jeder gezeigten Person |

## Phasen

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| 0 – Recht | JMStV, DSA, ZAG, DSGVO, Steuern; Zahlungsanbieter wählen | Go/No-Go |
| 1 – Eine Instanz | Profil, Beiträge, Abo-Stufen, Zahlung, Altersprüfung | läuft mit einem Creator |
| 2 – Föderation | ActivityPub für Teaser, Follows aus Mastodon | im Fediverse auffindbar |
| 3 – Mehrere Instanzen | Abo-Token zwischen Instanzen, Instanz-Verzeichnis | echt dezentral |
| 4 – Moderation im Netz | gemeinsame Sperrlisten, Melde-Weiterleitung | Betrieb im Maßstab |

## Offene Fragen für Phase 0

- Welches AV-System ist anerkannt und für eine föderierte Instanz nutzbar?
- Wer ist Anbieter im Sinne von JMStV und DSA: der Instanzbetreiber, die Plattform oder beide?
- Welcher Zahlungsanbieter nimmt Erwachseneninhalte an und übernimmt die Auszahlung an Creator?
- Wie wird Löschung über föderierte Teaser hinweg durchgesetzt (`Delete`-Activity reicht rechtlich nicht allein)?
- Welche Nachweise gezeigter Personen müssen wie lange aufbewahrt werden?
