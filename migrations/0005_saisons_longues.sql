-- Trois ajustements lies aux saisons longues a faible nombre de biens par manche.
--
-- 1. Eligibilite a 80 % des manches et non 100 % : sur une saison trimestrielle,
--    exiger toutes les manches fait decrocher ceux qui ratent deux semaines.
-- 2. Prix hebdomadaire attribue au leader du classement cumule et non au meilleur
--    de la semaine : avec 3 biens par manche, le meilleur de la semaine serait
--    designe par le hasard, ce qui requalifierait le jeu en loterie.
-- 3. Nombre de biens par manche configurable par saison.

CREATE TABLE saisons_nouveau (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verticale_id INTEGER NOT NULL REFERENCES verticales(id),
  libelle TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT 'gratuite',
  jeu_argent INTEGER NOT NULL DEFAULT 0,
  prix_entree_cts INTEGER NOT NULL DEFAULT 0,
  nb_manches INTEGER NOT NULL DEFAULT 4,
  biens_par_manche INTEGER NOT NULL DEFAULT 12,
  reversement_hebdo_bps INTEGER NOT NULL DEFAULT 250,
  reversement_saison_bps INTEGER NOT NULL DEFAULT 5750,
  seuil_eligibilite_bps INTEGER NOT NULL DEFAULT 8000,
  prix_hebdo_sur_cumul INTEGER NOT NULL DEFAULT 1,
  client_entreprise TEXT,
  forfait_cts INTEGER,
  lot_finance_cts INTEGER,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  debute_le TEXT,
  termine_le TEXT
);

INSERT INTO saisons_nouveau (
  id, verticale_id, libelle, genre, jeu_argent, prix_entree_cts, nb_manches,
  biens_par_manche, reversement_hebdo_bps, reversement_saison_bps,
  seuil_eligibilite_bps, prix_hebdo_sur_cumul,
  client_entreprise, forfait_cts, lot_finance_cts, statut, debute_le, termine_le
)
SELECT
  id, verticale_id, libelle, genre, jeu_argent, prix_entree_cts, nb_manches,
  12, reversement_hebdo_bps, reversement_saison_bps,
  8000, 1,
  client_entreprise, forfait_cts, lot_finance_cts, statut, debute_le, termine_le
FROM saisons;

DROP TABLE saisons;
ALTER TABLE saisons_nouveau RENAME TO saisons;

-- L'immobilier tourne a 3 biens par manche sur un trimestre.
UPDATE saisons SET biens_par_manche = 3, nb_manches = 13
WHERE verticale_id = (SELECT id FROM verticales WHERE code = 'immo');

-- Le gagnant du prix hebdomadaire est trace par manche.
CREATE TABLE prix_hebdo (
  manche_id INTEGER PRIMARY KEY REFERENCES manches(id),
  joueur_id INTEGER REFERENCES joueurs(id),
  montant_cts INTEGER NOT NULL,
  base TEXT NOT NULL,
  biens_cumules INTEGER NOT NULL,
  attribue_le TEXT NOT NULL
);
