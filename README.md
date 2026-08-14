# Bullseye

Plateforme de compétition d'estimation de prix. Multi-verticale : voiture, immobilier, et tout
bien dont le prix de transaction est déterminé mais inconnu du joueur.

Le gagnant est désigné par l'adresse — la précision de ses estimations — jamais par un tirage.

**La spécification complète est dans [`SPEC.md`](SPEC.md). Elle fait autorité.**

## État

Phase 0 : version gratuite, sans mise ni lot. Hors du champ de la loi sur les jeux d'argent.

## Architecture

Cloudflare Workers + D1. Déploiement automatique par Workers Builds sur push vers `main`.
Migrations D1 appliquées par le workflow GitHub Actions, jamais depuis la console Cloudflare.

```
migrations/   schéma D1, numéroté
src/
  index.js       routeur : public, partenaire, back office
  socle.js       helpers D1, gardes d'accès, filtre des prix réels
  scellement.js  engagement SHA-256 et vérification publique
  scores.js      erreurs, rangs, départage, cagnottes
  manche.js      constructeur et contrôles bloquants
  vues/          gabarit et pages
test/         suite complète, SQLite réel sur les vraies migrations
```

## Tests

```
npm install
npm test
```

132 contrôles. La suite exécute le vrai SQL contre les vraies migrations.

## Mise en route

1. Créer la base D1 `bullseye` sur Cloudflare, coller l'identifiant dans `wrangler.toml`
2. Créer le Worker et le connecter au dépôt
3. Variable Workers `CODE_ADMIN` — code d'accès au back office
4. Secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` pour les migrations
5. Lancer le workflow « Migrations D1 »

## Séquence d'une manche

Le back office pilote : **Sceller** → **Ouvrir** → **Clôturer** → **Révéler**.

Au scellement, l'empreinte SHA-256 des prix réels est publiée. À la révélation, le sel est
publié. N'importe qui recalcule et vérifie que rien n'a bougé sur `/verification/:id`.

## La ligne qui ne bouge jamais

Le gagnant reçoit son argent en espèces, sans condition, quoi qu'il en fasse.
