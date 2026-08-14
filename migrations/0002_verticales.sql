-- Verticales initiales. Le schema_champs pilote la fiche et le formulaire partenaire.

INSERT INTO verticales (code, libelle, schema_champs, libelle_prix, biens_min_defaut, active) VALUES
('auto', 'Voiture', '[
  {"cle":"marque","libelle":"Marque","type":"texte","requis":true},
  {"cle":"modele","libelle":"Modèle","type":"texte","requis":true},
  {"cle":"annee","libelle":"Année","type":"entier","requis":true},
  {"cle":"km","libelle":"Kilomètres","type":"entier","requis":true},
  {"cle":"boite","libelle":"Boîte","type":"choix","options":["manuelle","automatique"],"requis":true},
  {"cle":"carburant","libelle":"Carburant","type":"choix","options":["essence","diesel","hybride","électrique"],"requis":true},
  {"cle":"canton","libelle":"Canton","type":"texte","requis":true},
  {"cle":"mains","libelle":"Nombre de mains","type":"entier","requis":false},
  {"cle":"options","libelle":"Options","type":"long","requis":false},
  {"cle":"etat","libelle":"État","type":"choix","options":["excellent","bon","moyen"],"requis":true}
]', 'prix de vente', 8, 1),
('immo', 'Immobilier', '[
  {"cle":"type","libelle":"Type","type":"choix","options":["appartement","maison","terrain"],"requis":true},
  {"cle":"commune","libelle":"Commune","type":"texte","requis":true},
  {"cle":"canton","libelle":"Canton","type":"texte","requis":true},
  {"cle":"surface","libelle":"Surface habitable m2","type":"entier","requis":true},
  {"cle":"pieces","libelle":"Pièces","type":"texte","requis":true},
  {"cle":"annee","libelle":"Année de construction","type":"entier","requis":true},
  {"cle":"etage","libelle":"Étage","type":"texte","requis":false},
  {"cle":"parking","libelle":"Places de parc","type":"entier","requis":false},
  {"cle":"charges","libelle":"Charges annuelles CHF","type":"entier","requis":false},
  {"cle":"etat","libelle":"État","type":"choix","options":["neuf","rénové","à rafraîchir","à rénover"],"requis":true}
]', 'prix de transaction', 10, 1);
