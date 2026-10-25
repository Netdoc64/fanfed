-- Grundschema einer Creator-Instanz. Zeiten: ISO-8601 (UTC), Beträge: Cent.
-- Keine personenbezogenen Daten in error_logs; Abonnenten stehen nur als
-- undurchsichtige Kennung (abonnent_ref), nie mit Name, E-Mail oder IP.

CREATE TABLE creators (
  id           TEXT PRIMARY KEY,
  handle       TEXT NOT NULL UNIQUE CHECK (handle GLOB '[a-z0-9_]*' AND length(handle) BETWEEN 1 AND 30),
  anzeigename  TEXT NOT NULL,
  beschreibung TEXT NOT NULL DEFAULT '',
  erstellt_am  TEXT NOT NULL
);

CREATE TABLE tiers (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL REFERENCES creators(id),
  name        TEXT NOT NULL,
  preis_cent  INTEGER NOT NULL CHECK (preis_cent >= 0),
  rang        INTEGER NOT NULL DEFAULT 1 CHECK (rang >= 1),
  erstellt_am TEXT NOT NULL
);
CREATE INDEX tiers_creator ON tiers(creator_id);

CREATE TABLE posts (
  id                 TEXT PRIMARY KEY,
  creator_id         TEXT NOT NULL REFERENCES creators(id),
  titel              TEXT NOT NULL DEFAULT '',
  teaser             TEXT NOT NULL DEFAULT '',
  inhalt             TEXT NOT NULL DEFAULT '',
  sichtbarkeit       TEXT NOT NULL CHECK (sichtbarkeit IN ('public', 'paid')),
  tier_id            TEXT REFERENCES tiers(id),
  veroeffentlicht_am TEXT NOT NULL
);
CREATE INDEX posts_creator_zeit ON posts(creator_id, veroeffentlicht_am);

CREATE TABLE subscriptions (
  id               TEXT PRIMARY KEY,
  creator_id       TEXT NOT NULL REFERENCES creators(id),
  tier_id          TEXT NOT NULL REFERENCES tiers(id),
  abonnent_ref     TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('ausstehend', 'aktiv', 'gekuendigt', 'abgelaufen')),
  gueltig_bis      TEXT,
  erstellt_am      TEXT NOT NULL
);
CREATE INDEX subscriptions_abonnent ON subscriptions(abonnent_ref, creator_id);

CREATE TABLE media (
  id                   TEXT PRIMARY KEY,
  post_id              TEXT NOT NULL REFERENCES posts(id),
  r2_key               TEXT NOT NULL UNIQUE,
  umhuellter_schluessel TEXT NOT NULL,
  iv                   TEXT NOT NULL,
  inhaltstyp           TEXT NOT NULL,
  groesse_byte         INTEGER NOT NULL DEFAULT 0 CHECK (groesse_byte >= 0),
  erstellt_am          TEXT NOT NULL
);
CREATE INDEX media_post ON media(post_id);

CREATE TABLE age_checks (
  id           TEXT PRIMARY KEY,
  abonnent_ref TEXT NOT NULL,
  ergebnis     TEXT NOT NULL CHECK (ergebnis IN ('bestanden', 'abgelehnt', 'ausstehend')),
  anbieter     TEXT NOT NULL,
  geprueft_am  TEXT NOT NULL
);
CREATE INDEX age_checks_abonnent ON age_checks(abonnent_ref, geprueft_am);

CREATE TABLE error_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  bereich   TEXT NOT NULL,
  code      TEXT NOT NULL,
  zeitpunkt TEXT NOT NULL
);
CREATE INDEX error_logs_zeit ON error_logs(zeitpunkt);
