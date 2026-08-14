-- Recalibrage du découpage du reversement.
-- Le prix hebdomadaire n'est pas une récompense, c'est une preuve : il montre chaque
-- semaine qu'il y a un vrai gagnant et un vrai versement. Toute la tension se reporte
-- sur la cagnotte, qui est ce qui fait revenir les joueurs.
-- Le total reste à 6000 bps (60 %) dans les deux cas.

UPDATE saisons
SET reversement_hebdo_bps = 250,
    reversement_saison_bps = 5750
WHERE verticale_id = (SELECT id FROM verticales WHERE code = 'auto');

UPDATE saisons
SET reversement_hebdo_bps = 170,
    reversement_saison_bps = 5830
WHERE verticale_id = (SELECT id FROM verticales WHERE code = 'immo');

-- Nouveaux defauts pour les saisons a venir.
CREATE TABLE saisons_nouveau (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verticale_id INTEGER NOT NULL REFERENCES verticales(id),
  libelle TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT 'gratuite',
  jeu_argent INTEGER NOT NULL DEFAULT 0,
  prix_entree_cts INTEGER NOT NULL DEFAULT 0,
  nb_manches INTEGER NOT NULL DEFAULT 4,
  reversement_hebdo_bps INTEGER NOT NULL DEFAULT 250,
  reversement_saison_bps INTEGER NOT NULL DEFAULT 5750,
  client_entreprise TEXT,
  forfait_cts INTEGER,
  lot_finance_cts INTEGER,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  debute_le TEXT,
  termine_le TEXT
);

INSERT INTO saisons_nouveau SELECT * FROM saisons;
DROP TABLE saisons;
ALTER TABLE saisons_nouveau RENAME TO saisons;
