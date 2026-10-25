/** Teilmenge der Worker-Umgebung, die die Datenbankschicht braucht. */
export interface DbEnv {
  DB: D1Database;
}
