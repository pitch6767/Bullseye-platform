-- Bullseye — socle multi-verticale
-- Argent en centimes entiers. Dates en UTC (ISO 8601).

CREATE TABLE verticales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  libelle TEXT NOT NULL,
  schema_champs TEXT NOT NULL,
  libelle_prix TEXT NOT NULL DEFAULT 'prix de vente',
  biens_min_defaut INTEGER NOT NULL DEFAULT 8,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE partenaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verticale_id INTEGER NOT NULL REFERENCES verticales(id),
  nom TEXT NOT NULL,
  courriel TEXT,
  telephone TEXT,
  type TEXT NOT NULL DEFAULT 'garage',
  jeton TEXT NOT NULL UNIQUE,
  flux_stock TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  cree_le TEXT NOT NULL
);

CREATE TABLE biens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verticale_id INTEGER NOT NULL REFERENCES verticales(id),
  partenaire_id INTEGER NOT NULL REFERENCES partenaires(id),
  attributs TEXT NOT NULL,
  photos TEXT NOT NULL DEFAULT '[]',
  prix_reel_cts INTEGER NOT NULL,
  vendu_le TEXT,
  source_prix TEXT NOT NULL DEFAULT 'partenaire',
  valeur_reference_cts INTEGER,
  ecart_reference_bps INTEGER,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  motif_rejet TEXT,
  cree_le TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_biens_doublon
  ON biens (verticale_id, partenaire_id, vendu_le, prix_reel_cts);
CREATE INDEX idx_biens_statut ON biens (verticale_id, statut);

CREATE TABLE saisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verticale_id INTEGER NOT NULL REFERENCES verticales(id),
  libelle TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT 'gratuite',
  jeu_argent INTEGER NOT NULL DEFAULT 0,
  prix_entree_cts INTEGER NOT NULL DEFAULT 0,
  nb_manches INTEGER NOT NULL DEFAULT 4,
  reversement_hebdo_bps INTEGER NOT NULL DEFAULT 2000,
  reversement_saison_bps INTEGER NOT NULL DEFAULT 4000,
  client_entreprise TEXT,
  forfait_cts INTEGER,
  lot_finance_cts INTEGER,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  debute_le TEXT,
  termine_le TEXT
);

CREATE TABLE manches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saison_id INTEGER NOT NULL REFERENCES saisons(id),
  rang INTEGER NOT NULL,
  ouvre_le TEXT,
  ferme_le TEXT,
  empreinte TEXT,
  sel TEXT,
  revele_le TEXT,
  nb_participants INTEGER NOT NULL DEFAULT 0,
  collecte_cts INTEGER NOT NULL DEFAULT 0,
  lot_hebdo_cts INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  UNIQUE (saison_id, rang)
);

CREATE TABLE manche_biens (
  manche_id INTEGER NOT NULL REFERENCES manches(id),
  bien_id INTEGER NOT NULL REFERENCES biens(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (manche_id, bien_id)
);
CREATE UNIQUE INDEX idx_manche_position ON manche_biens (manche_id, position);

CREATE TABLE joueurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  courriel TEXT NOT NULL UNIQUE,
  courriel_verifie_le TEXT,
  pseudo TEXT NOT NULL,
  date_naissance TEXT,
  statut_kyc TEXT NOT NULL DEFAULT 'aucun',
  plafond_mensuel_cts INTEGER NOT NULL DEFAULT 20000,
  auto_exclu_jusqu TEXT,
  budget_cts INTEGER,
  cree_le TEXT NOT NULL
);

CREATE TABLE participations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manche_id INTEGER NOT NULL REFERENCES manches(id),
  joueur_id INTEGER NOT NULL REFERENCES joueurs(id),
  montant_cts INTEGER NOT NULL DEFAULT 0,
  reference_paiement TEXT,
  soumis_le TEXT,
  statut TEXT NOT NULL DEFAULT 'ouverte',
  UNIQUE (manche_id, joueur_id)
);

CREATE TABLE estimations (
  participation_id INTEGER NOT NULL REFERENCES participations(id),
  bien_id INTEGER NOT NULL REFERENCES biens(id),
  valeur_cts INTEGER NOT NULL,
  saisi_le TEXT NOT NULL,
  ms_saisie INTEGER,
  PRIMARY KEY (participation_id, bien_id)
);

CREATE TABLE scores (
  participation_id INTEGER PRIMARY KEY REFERENCES participations(id),
  erreur_totale_bps INTEGER NOT NULL,
  rang INTEGER
);

CREATE TABLE classements (
  saison_id INTEGER NOT NULL REFERENCES saisons(id),
  joueur_id INTEGER NOT NULL REFERENCES joueurs(id),
  manches_jouees INTEGER NOT NULL DEFAULT 0,
  erreur_cumulee_bps INTEGER NOT NULL DEFAULT 0,
  rang INTEGER,
  eligible INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (saison_id, joueur_id)
);

CREATE TABLE journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  le TEXT NOT NULL,
  acteur TEXT NOT NULL,
  action TEXT NOT NULL,
  objet_type TEXT,
  objet_id INTEGER,
  charge TEXT
);
CREATE INDEX idx_journal_objet ON journal (objet_type, objet_id);
