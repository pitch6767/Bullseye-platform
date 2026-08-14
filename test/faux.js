import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

// Shim D1 minimal au-dessus de SQLite réel : les tests exécutent le vrai SQL
// et les vraies migrations, pas une imitation.
class Instruction {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }
  bind(...params) {
    this.params = params.map((p) => (p === undefined ? null : p));
    return this;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params) };
  }
  async first() {
    return this.db.prepare(this.sql).get(...this.params) ?? null;
  }
  async run() {
    return this.db.prepare(this.sql).run(...this.params);
  }
}

export function fauxEnv() {
  const db = new Database(':memory:');
  const dossier = new URL('../migrations/', import.meta.url);
  for (const fichier of readdirSync(dossier).sort()) {
    db.exec(readFileSync(new URL(fichier, dossier), 'utf8'));
  }
  return {
    CODE_ADMIN: 'test1234',
    DB: { prepare: (sql) => new Instruction(db, sql) },
    _sqlite: db,
  };
}

export const cookieAdmin = { Cookie: 'acces=test1234' };

export function requete(chemin, options = {}) {
  const init = { method: options.method || 'GET', headers: options.headers || {} };
  if (options.form) {
    const corps = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(options.form)) {
      if (Array.isArray(valeur)) valeur.forEach((v) => corps.append(cle, v));
      else corps.append(cle, valeur);
    }
    init.body = corps;
  }
  return new Request('https://bullseye.test' + chemin, init);
}

let compteur = 0;
export function verifier(condition, libelle) {
  compteur += 1;
  if (!condition) {
    console.error(`ECHEC ${compteur} — ${libelle}`);
    process.exit(1);
  }
}

export function bilan(nom) {
  console.log(`${nom} : ${compteur} contrôles passés`);
}
