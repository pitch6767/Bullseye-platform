# COTE — Spécification système

Plateforme de compétition d'estimation de prix. Multi-verticale (voiture, immobilier, autres).
Cagnotte en espèces, gagnant désigné par l'adresse, jamais par tirage.

Stack : Cloudflare Workers + D1 + Durable Objects + R2 (photos). Déploiement par push sur `main`.

---

## 1. Principe d'architecture

**Le système ne connaît pas les voitures.** Il connaît des *biens à estimer* dont le prix réel est
déterminé et scellé avant l'ouverture de la manche. Une verticale n'est qu'un schéma de champs,
une source de prix et un gabarit d'affichage.

Ajouter l'immobilier = insérer une ligne dans `verticals` + un gabarit. Aucun code métier dupliqué.

```
verticals ──< assets ──< round_assets >── rounds >── seasons
                │                            │
            partners                      entries ──< estimates
                                             │
                                          scores ──> standings ──> payouts
```

---

## 2. Modèle de données (D1)

Toutes les valeurs monétaires en **centimes entiers**. Jamais de flottant.
Toutes les dates en **UTC**, affichage `Europe/Zurich`.

### 2.1 Verticales et biens

```sql
verticals (
  id INTEGER PK,
  code TEXT UNIQUE,            -- 'auto' | 'immo' | 'watch' | ...
  label TEXT,
  field_schema TEXT,           -- JSON : définition des champs de la fiche
  price_label TEXT,            -- 'prix de vente' | 'prix de transaction'
  min_assets_per_round INTEGER DEFAULT 8,
  active INTEGER DEFAULT 1
)

partners (
  id INTEGER PK,
  vertical_id INTEGER FK,
  name TEXT, contact_email TEXT, contact_phone TEXT,
  type TEXT,                   -- 'garage' | 'regie' | 'notaire' | 'expert' | 'encheres'
  placement_tier TEXT,         -- NULL | 'catalogue' | 'premium'
  stock_feed_url TEXT,         -- flux du stock actuel, affiché après révélation
  active INTEGER DEFAULT 1,
  created_at TEXT
)

assets (
  id INTEGER PK,
  vertical_id INTEGER FK,
  partner_id INTEGER FK,
  attributes TEXT,             -- JSON conforme à field_schema
  photos TEXT,                 -- JSON : clés R2
  real_price_cents INTEGER,    -- JAMAIS exposé avant reveal_at
  sold_at TEXT,
  price_source TEXT,           -- 'partner' | 'auction' | 'expert'
  reference_value_cents INTEGER,  -- Eurotax / valeur de référence, contrôle qualité
  reference_gap_bps INTEGER,   -- écart calculé, sert au calibrage de difficulté
  status TEXT,                 -- 'draft'|'validated'|'rejected'|'scheduled'|'burned'
  reject_reason TEXT,
  created_at TEXT
)
```

**Règle dure :** un `asset` passé en `burned` n'est jamais réutilisé. Index unique sur
`(vertical_id, partner_id, sold_at, real_price_cents)` pour bloquer les doublons d'import.

### 2.2 Saisons et manches

```sql
seasons (
  id INTEGER PK,
  vertical_id INTEGER FK,
  label TEXT,
  kind TEXT,                   -- 'public' | 'corporate' | 'free'
  is_money_game INTEGER,       -- 0 = hors LJAr (gratuit ou entreprise)
  entry_price_cents INTEGER,
  rounds_count INTEGER DEFAULT 4,
  payout_weekly_bps INTEGER DEFAULT 2000,   -- 20 %
  payout_season_bps INTEGER DEFAULT 4000,   -- 40 %
  corporate_client TEXT,
  corporate_fee_cents INTEGER,
  funded_prize_cents INTEGER,  -- saison entreprise : lot financé par le client
  status TEXT,                 -- 'draft'|'open'|'running'|'settled'|'cancelled'
  starts_at TEXT, ends_at TEXT
)

rounds (
  id INTEGER PK,
  season_id INTEGER FK,
  idx INTEGER,                 -- 1..rounds_count
  opens_at TEXT, closes_at TEXT,
  commit_hash TEXT,            -- SHA-256 publié à l'ouverture
  reveal_salt TEXT,            -- révélé à la clôture
  revealed_at TEXT,
  participants_count INTEGER,
  collected_cents INTEGER,
  weekly_pot_cents INTEGER,
  status TEXT                  -- 'draft'|'committed'|'open'|'closed'|'revealed'|'settled'
)

round_assets (
  round_id INTEGER FK,
  asset_id INTEGER FK,
  position INTEGER,
  PRIMARY KEY (round_id, asset_id)
)
```

### 2.3 Participations et scores

```sql
entries (
  id INTEGER PK,
  round_id INTEGER FK,
  user_id INTEGER FK,
  amount_cents INTEGER,
  payment_id TEXT,
  submitted_at TEXT,
  status TEXT,                 -- 'pending'|'paid'|'submitted'|'scored'|'void'
  UNIQUE (round_id, user_id)   -- ← une seule participation par personne et par manche
)

estimates (
  entry_id INTEGER FK,
  asset_id INTEGER FK,
  value_cents INTEGER,
  entered_at TEXT,
  ms_spent INTEGER,            -- antifraude : saisie trop rapide
  PRIMARY KEY (entry_id, asset_id)
)

scores (
  entry_id INTEGER PK,
  total_error_bps INTEGER,     -- somme des erreurs, plafonnée par bien
  rank INTEGER
)

standings (
  season_id INTEGER FK,
  user_id INTEGER FK,
  rounds_played INTEGER,
  cumulative_error_bps INTEGER,
  rank INTEGER,
  eligible INTEGER,            -- a joué toutes les manches
  PRIMARY KEY (season_id, user_id)
)
```

### 2.4 Utilisateurs et conformité

```sql
users (
  id INTEGER PK,
  email TEXT UNIQUE, email_verified_at TEXT,
  display_name TEXT,
  date_of_birth TEXT,
  kyc_status TEXT,             -- 'none'|'pending'|'verified'|'rejected'
  kyc_ref TEXT,
  monthly_cap_cents INTEGER DEFAULT 20000,   -- CHF 200 par défaut
  self_excluded_until TEXT,
  budget_cents INTEGER,        -- budget d'achat déclaré → sélection à mon budget
  vertical_prefs TEXT,         -- JSON
  created_at TEXT
)

spend_ledger (               -- source de vérité du plafond mensuel
  id INTEGER PK,
  user_id INTEGER FK,
  period TEXT,               -- 'YYYY-MM'
  amount_cents INTEGER,
  entry_id INTEGER FK
)

audit_log (                  -- append-only, jamais d'UPDATE ni de DELETE
  id INTEGER PK,
  at TEXT, actor TEXT, action TEXT,
  object_type TEXT, object_id INTEGER,
  payload TEXT
)
```

### 2.5 Revenus annexes

```sql
payouts (
  id INTEGER PK,
  kind TEXT,                   -- 'weekly'|'season'
  round_id INTEGER, season_id INTEGER,
  user_id INTEGER FK,
  amount_cents INTEGER,
  split_count INTEGER DEFAULT 1,
  status TEXT,                 -- 'due'|'sent'|'confirmed'
  attestation_ref TEXT,        -- pièce remise au gagnant (banque, fisc)
  paid_at TEXT
)

placements (
  id INTEGER PK, partner_id INTEGER FK, season_id INTEGER FK,
  tier TEXT, fee_cents INTEGER, period TEXT, invoiced_at TEXT, paid_at TEXT
)

leads (
  id INTEGER PK, user_id INTEGER FK, partner_id INTEGER FK,
  type TEXT,                   -- 'reprise'|'assurance'|'expertise'
  payload TEXT, price_cents INTEGER,
  status TEXT,                 -- 'new'|'sent'|'accepted'|'rejected'|'billed'
  created_at TEXT
)

subscriptions (
  id INTEGER PK, user_id INTEGER FK,
  plan TEXT,                   -- 'analyste'
  status TEXT, period_start TEXT, period_end TEXT, amount_cents INTEGER
)
```

---

## 3. Intégrité du tirage — le scellement

Le mécanisme qui prouve que l'opérateur ne peut pas modifier les réponses.

**À la préparation de la manche (statut `committed`) :**

```
payload = JSON([{asset_id, real_price_cents}, ...] trié par asset_id)
salt    = 32 octets aléatoires
commit_hash = SHA-256(salt || payload)
```

`commit_hash` est publié sur la page publique dès l'ouverture. `salt` reste secret.

**À la clôture :** publication de `salt` + `payload`. N'importe qui recalcule le hash et vérifie.

**Règles associées, à coder dans le constructeur de manche :**

| Règle | Contrôle |
|---|---|
| Maximum 3 biens par partenaire et par manche | bloquant |
| Aucun bien déjà utilisé | bloquant |
| Nombre de biens ≥ seuil selon participants attendus | avertissement |
| Écart à la valeur de référence < 25 % | avertissement, justification requise |
| Aucun bien d'un partenaire dont un collaborateur a un compte joueur | bloquant |

Barème du nombre minimum de biens :

| Participants | Biens minimum |
|---|---|
| ≤ 60 | 8 |
| ≤ 200 | 12 |
| ≤ 600 | 15 |
| > 600 | 20 |

---

## 4. Calcul des scores

```
erreur_bien = min( |estimation − prix_réel| / prix_réel , 1.0 )   → en points de base
score_manche = Σ erreur_bien
score_saison = Σ score_manche sur toutes les manches jouées
```

Le plafond à 100 % par bien évite qu'une faute de frappe détruise une saison entière, sans
affaiblir la discrimination entre joueurs.

**Départage**, dans cet ordre — jamais de tirage :

1. Meilleur score sur la dernière manche
2. Manche de barrage sur un bien unique
3. Partage du lot à parts égales

**Éligibilité à la cagnotte de saison :** avoir participé à toutes les manches.
Les prix hebdomadaires n'exigent aucune éligibilité.

---

## 5. Cagnottes

```
collecte_manche  = participants × prix_entrée
prix_hebdo       = collecte_manche × payout_weekly_bps / 10000
cagnotte_saison  = Σ (collecte_manche × payout_season_bps / 10000)
```

La cagnotte n'est **jamais** garantie ni annoncée à l'avance. La page affiche son montant en
direct et trois biens réellement disponibles à ce montant chez les partenaires, actualisés à
chaque manche.

Aucun remboursement, aucune saison annulée. Le lot est toujours une somme déjà encaissée.

---

## 6. Durable Objects

| Objet | Rôle |
|---|---|
| `RoundDO` (un par manche) | compteur de participants et cagnotte en direct, sérialisation des inscriptions, transaction de clôture atomique |
| `SeasonDO` (un par saison) | classement cumulé, recalcul incrémental après chaque clôture |
| `RateLimitDO` | anti-abus sur inscription et soumission |

La clôture est la seule opération critique : `RoundDO` gèle les participations, calcule les
scores, écrit les rangs, publie la révélation et déclenche les `payouts` — le tout dans une
seule transaction, idempotente et rejouable.

---

## 7. Back office

Accès : authentification forte + IP allow-list. Badge de version en haut à droite, incrémenté
à chaque push.

### 7.1 Tableau de bord
Saisons actives par verticale, joueurs actifs, collecte du mois, cagnottes en cours,
prochaines échéances, alertes (manche non préparée, bien manquant, paiement en attente).

### 7.2 Verticales
Création et édition du `field_schema` (nom du champ, type, obligatoire, affiché sur la fiche).
Prévisualisation du gabarit de fiche.

### 7.3 Partenaires
Fiche partenaire, quota de biens fournis, historique, placements facturés, flux de stock,
état des leads envoyés.

### 7.4 Biens
- Import : formulaire manuel, import CSV, formulaire public partenaire (lien à jeton)
- File de validation : contrôle de la valeur de référence, photos, complétude
- Statuts et journal
- Recherche et filtres, détection de doublons

### 7.5 Constructeur de manche
Sélection des biens, ordre d'affichage, contrôles automatiques (§3), génération du
`commit_hash`, aperçu de la manche telle que la verra le joueur.
Boutons : **Sceller** → **Ouvrir** → **Clôturer** → **Révéler** → **Régler**.

### 7.6 Scores et classements
Résultats de la manche, distribution des scores, détection d'anomalies, traitement des
litiges avec justification obligatoire consignée au journal.

### 7.7 Paiements
Liste des versements dus, exécution, marquage, génération de l'attestation de gain remise au
gagnant (utile pour sa banque et sa déclaration).

### 7.8 Conformité
Vérification d'âge, état KYC, plafonds de dépense, auto-exclusions, comptes suspects,
journal d'audit intégral, **export du rapport réglementaire** (participants, collecte,
redistribution, incidents).

### 7.9 Revenus
Vue consolidée : billets, placements, leads, abonnements, saisons entreprise.
Marge par ligne, seuil de rentabilité en direct.

### 7.10 Statistiques de marché
Écart par modèle entre estimation collective et prix réel. Génération du rapport mensuel
professionnel. Export CSV et PDF.

### 7.11 Saisons entreprise
Création d'une saison fermée : client, forfait, lot financé, code d'accès, liste des
participants invités. Drapeau `is_money_game = 0`, les garde-fous LJAr sont désactivés.

---

## 8. Application client

Progressive web app. Mobile d'abord. Aucune installation.

### 8.1 Accueil
Cagnotte en direct + trois biens disponibles à ce montant. Compte à rebours de la manche.
Position au classement. Bouton d'entrée.

### 8.2 Manche
Liste des biens, saisie d'une estimation par bien, brouillon sauvegardé en continu,
validation en un geste. Barre de progression. Verrouillage à la clôture.

### 8.3 Fiche du bien
Photos, caractéristiques selon le schéma de la verticale.
**Après révélation uniquement :** prix réel, estimation médiane du groupe, ton écart, nom du
partenaire, stock similaire disponible chez lui.

### 8.4 Résultats
Ton score, ton rang, le débrief des trois biens où le groupe s'est le plus trompé, avec
l'explication. C'est le contenu qui fait revenir.

### 8.5 Classement de saison
Cumul, progression, nombre de manches restantes.

### 8.6 Sélection à mon budget
Après chaque manche : biens du marché correspondant au budget déclaré, partenaires signalés
comme tels, marché complet affiché.

### 8.7 Entraînement
Anciens biens, illimité, gratuit, sans mise ni lot. Hors LJAr. Sert au référencement naturel
et à la conversion.

### 8.8 Ma cote
Outil public d'estimation gratuit. Génère le lead reprise vers les partenaires.

### 8.9 Profil
Budget d'achat, préférences de verticale, statistiques personnelles, **plafond de dépense
mensuel**, **auto-exclusion**, historique des participations et des gains.

### 8.10 Abonnement analyste
Base historique complète, statistiques par marque et par segment, comparaison au groupe,
export. CHF 15 par mois.

---

## 9. Garde-fous à coder, non négociables

| Garde-fou | Implémentation |
|---|---|
| Une participation par personne et par manche | index unique `(round_id, user_id)` |
| Une saison active par personne et par verticale | contrôle à l'inscription |
| Plafond mensuel de dépense | `spend_ledger`, refus au-delà |
| Âge minimum 18 ans | à l'inscription, bloquant |
| Auto-exclusion | refus d'inscription pendant la période |
| Aucun bien réutilisé | statut `burned` |
| Maximum 3 biens par partenaire et par manche | constructeur de manche |
| Prix réels jamais exposés avant révélation | filtré au niveau du sérialiseur d'API |
| Stock partenaire affiché après révélation seulement | condition sur `revealed_at` |
| Aucune tentative supplémentaire achetable | absent du produit, définitivement |
| Aucune commission par gagnant converti | absent du modèle de facturation |
| Journal d'audit inaltérable | append-only, pas de route d'écriture |

---

## 10. Antifraude

**Comptes multiples :** empreinte d'appareil, adresse IP, moyen de paiement, nom et date de
naissance identiques. Score de suspicion, revue manuelle avant versement.

**Fuite côté partenaire :** répartition des biens sur au moins 5 partenaires, personne ne
détient plus d'un quart des réponses. Rapprochement automatique entre les comptes joueurs et
les contacts partenaires.

**Comportement :** temps de saisie anormalement court, estimations identiques au franc entre
deux comptes, précision incompatible avec la distribution du groupe.

**Contrôle systématique avant tout versement supérieur à CHF 5 000.**

---

## 11. Paiements

Deux fournisseurs derrière une même abstraction :

| Usage | Fournisseur |
|---|---|
| Abonnements, saisons entreprise, placements | processeur standard |
| Mises des saisons publiques | processeur spécialisé jeux |

Stripe interdit les jeux d'argent : la mise ne peut pas y transiter. À cadrer avant la phase 2.

Versements des gains : virement bancaire, jamais en espèces physiques, toujours accompagné
d'une attestation.

---

## 12. Ordre de construction

### Phase 0 — gratuit, hors LJAr *(immédiat)*
Verticales, biens, partenaires, constructeur de manche, scellement, manche, scores,
classement, débrief, entraînement, back office minimal.
Aucun paiement, aucun lot. Objectif : la démonstration statistique pour le dossier Gespa et
la constitution de l'audience.

### Phase 1 — saisons entreprise, hors LJAr *(mois 2)*
Saisons fermées, codes d'accès, facturation client, lot financé par le client, placements
partenaires, leads reprise. **Première ligne de revenus, sans autorisation.**

### Phase 2 — dossier Gespa *(en parallèle)*
Export des données de séparation adresse/hasard, description du mécanisme, règles de
départage, dispositif d'intégrité, mesures de protection déjà implémentées.

### Phase 3 — saisons publiques payantes *(après autorisation)*
KYC, vérification d'âge, plafonds, auto-exclusion, processeur jeux, cagnottes, versements,
attestations, rapport réglementaire.

### Phase 4 — extension
Verticale immobilier, abonnement analyste, rapport marché professionnel, certification des
estimateurs, licence du moteur.

---

## 13. Règles de développement

- Un seul remplacement à la fois, jamais de réécriture globale
- `node --check` sur le JS rendu, pas sur la source
- Suite de tests complète avant chaque push
- Badge de version incrémenté à chaque push
- Migrations D1 numérotées, appliquées par le workflow GitHub Actions
- Dépôt public : aucun secret dans le code, tout en variables Workers
- Couverture prioritaire sur `src/index.ts` (routes et gardes) — c'est là que naissent les bugs
- Argent en centimes entiers, dates en UTC

---

## 14. La ligne qui ne bouge jamais

**Le gagnant reçoit son argent en espèces, sans condition, quoi qu'il en fasse.**

Toute fonctionnalité qui contredit cette phrase est refusée sans discussion.
