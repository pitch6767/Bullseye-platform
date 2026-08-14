import { page, onglets } from './gabarit.js';
import { echapper, chf, pourcent } from '../socle.js';

const NAV = [
  ['/admin', 'Tableau de bord'],
  ['/admin/biens', 'Biens'],
  ['/admin/partenaires', 'Partenaires'],
  ['/admin/manches', 'Manches'],
  ['/admin/stats', 'Statistiques'],
];

const cadre = (titre, corps, actif) =>
  page({ titre, corps, entete: 'Bullseye — back office', onglets: onglets(NAV, actif) });

export function connexion(erreur) {
  return page({
    titre: 'Accès',
    corps: `<h1>Back office</h1>
${erreur ? `<div class="alerte">${echapper(erreur)}</div>` : ''}
<form method="post" action="/admin/connexion">
<label for="code">Code d'accès</label>
<input class="champ" id="code" name="code" type="password" required>
<button class="bouton" type="submit">Entrer</button>
</form>`,
  });
}

export function tableauBord({ verticales, saisons, manches, stats }) {
  const lignesSaisons = saisons
    .map(
      (s) =>
        `<tr><td>${echapper(s.libelle)}</td><td>${echapper(s.code)}</td>
<td><span class="etiquette${s.statut === 'ouverte' ? ' ok' : ''}">${echapper(s.statut)}</span></td>
<td class="num">${s.jeu_argent ? 'payante' : 'gratuite'}</td></tr>`
    )
    .join('');
  const lignesManches = manches
    .map(
      (m) =>
        `<tr><td><a href="/admin/manche/${m.id}">${echapper(m.saison_libelle)} — M${m.rang}</a></td>
<td><span class="etiquette${m.statut === 'ouverte' ? ' ok' : ''}">${echapper(m.statut)}</span></td>
<td class="num">${m.nb_participants}</td></tr>`
    )
    .join('');
  return cadre(
    'Tableau de bord',
    `<h1>Tableau de bord</h1>
<div class="grille">
  <div class="carte"><div class="doux">Biens validés</div><div class="stat">${stats.biens_valides}</div></div>
  <div class="carte"><div class="doux">Biens en attente</div><div class="stat">${stats.biens_attente}</div></div>
  <div class="carte"><div class="doux">Partenaires actifs</div><div class="stat">${stats.partenaires}</div></div>
  <div class="carte"><div class="doux">Joueurs</div><div class="stat">${stats.joueurs}</div></div>
</div>
<h2>Saisons</h2>
<div class="carte"><table><tr><th>Saison</th><th>Verticale</th><th>Statut</th><th class="num">Genre</th></tr>
${lignesSaisons || '<tr><td colspan="4" class="doux">Aucune saison.</td></tr>'}</table></div>
<a class="bouton pale" href="/admin/saison/nouvelle">Créer une saison</a>
<h2>Manches</h2>
<div class="carte"><table><tr><th>Manche</th><th>Statut</th><th class="num">Participants</th></tr>
${lignesManches || '<tr><td colspan="3" class="doux">Aucune manche.</td></tr>'}</table></div>
<a class="bouton pale" href="/admin/manche/nouvelle">Construire une manche</a>
<p class="doux">Verticales actives : ${verticales.map((v) => echapper(v.libelle)).join(', ')}</p>`,
    '/admin'
  );
}

export function listeBiens({ biens, filtre }) {
  const lignes = biens
    .map((b) => {
      const a = JSON.parse(b.attributs);
      const titre = b.code === 'immo'
        ? `${a.type ?? ''} ${a.pieces ?? ''}p ${a.commune ?? ''}`
        : `${a.marque ?? ''} ${a.modele ?? ''} ${a.annee ?? ''}`;
      const cls = b.statut === 'valide' ? ' ok' : b.statut === 'brule' ? ' stop' : '';
      return `<tr><td>${echapper(titre)}</td><td>${echapper(b.partenaire_nom)}</td>
<td class="num">${chf(b.prix_reel_cts)}</td>
<td class="num">${b.ecart_reference_bps == null ? '—' : pourcent(b.ecart_reference_bps)}</td>
<td><span class="etiquette${cls}">${echapper(b.statut)}</span></td>
<td>${b.statut === 'brouillon'
        ? `<a href="/admin/bien/${b.id}/valider">valider</a>`
        : ''}</td></tr>`;
    })
    .join('');
  return cadre(
    'Biens',
    `<h1>Biens</h1>
<nav class="onglets">
<a href="/admin/biens?statut=brouillon"${filtre === 'brouillon' ? ' class="actif"' : ''}>En attente</a>
<a href="/admin/biens?statut=valide"${filtre === 'valide' ? ' class="actif"' : ''}>Validés</a>
<a href="/admin/biens?statut=brule"${filtre === 'brule' ? ' class="actif"' : ''}>Utilisés</a>
</nav>
<div class="carte"><table>
<tr><th>Bien</th><th>Partenaire</th><th class="num">Prix</th><th class="num">Écart réf.</th>
<th>Statut</th><th></th></tr>
${lignes || '<tr><td colspan="6" class="doux">Aucun bien.</td></tr>'}</table></div>`,
    '/admin/biens'
  );
}

export function listePartenaires({ partenaires, base }) {
  const lignes = partenaires
    .map(
      (p) =>
        `<tr><td>${echapper(p.nom)}</td><td>${echapper(p.type)}</td>
<td class="num">${p.nb_biens}</td>
<td><a href="${base}/partenaire/${echapper(p.jeton)}">lien de saisie</a></td></tr>`
    )
    .join('');
  return cadre(
    'Partenaires',
    `<h1>Partenaires</h1>
<p class="doux">Chaque partenaire reçoit un lien personnel. Il saisit ses ventes en deux minutes,
sans compte ni mot de passe.</p>
<div class="carte"><table>
<tr><th>Nom</th><th>Type</th><th class="num">Biens</th><th></th></tr>
${lignes || '<tr><td colspan="4" class="doux">Aucun partenaire.</td></tr>'}</table></div>
<h2>Ajouter</h2>
<form method="post" action="/admin/partenaires" class="carte">
<label for="nom">Nom</label><input class="champ" id="nom" name="nom" required>
<label for="type">Type</label>
<select class="champ" id="type" name="type">
<option value="garage">Garage</option><option value="regie">Régie</option>
<option value="notaire">Notaire</option><option value="expert">Expert</option>
<option value="encheres">Enchères</option></select>
<label for="verticale">Verticale</label>
<select class="champ" id="verticale" name="verticale_id">
<option value="1">Voiture</option><option value="2">Immobilier</option></select>
<label for="courriel">Courriel</label><input class="champ" id="courriel" name="courriel" type="email">
<button class="bouton" type="submit">Créer</button>
</form>`,
    '/admin/partenaires'
  );
}

export function constructeur({ verticale, biens, selection, controle, saisons }) {
  const lignes = biens
    .map((b) => {
      const a = JSON.parse(b.attributs);
      const titre = verticale.code === 'immo'
        ? `${a.type ?? ''} ${a.pieces ?? ''}p ${a.commune ?? ''}`
        : `${a.marque ?? ''} ${a.modele ?? ''} ${a.annee ?? ''}`;
      const coche = selection.includes(b.id) ? ' checked' : '';
      return `<tr><td><input type="checkbox" name="bien" value="${b.id}"${coche}></td>
<td>${echapper(titre)}</td><td>${echapper(b.partenaire_nom)}</td>
<td class="num">${chf(b.prix_reel_cts)}</td>
<td class="num">${b.ecart_reference_bps == null ? '—' : pourcent(b.ecart_reference_bps)}</td></tr>`;
    })
    .join('');
  const alertes =
    controle
      ? controle.bloquants.map((m) => `<div class="alerte">${echapper(m)}</div>`).join('') +
        controle.avertissements.map((m) => `<div class="alerte info">${echapper(m)}</div>`).join('')
      : '';
  return cadre(
    'Construire une manche',
    `<h1>Construire une manche</h1>
${alertes}
<form method="post" action="/admin/manche/nouvelle">
<div class="carte">
<label for="saison">Saison</label>
<select class="champ" id="saison" name="saison_id">
${saisons.map((s) => `<option value="${s.id}">${echapper(s.libelle)}</option>`).join('')}
</select>
<label for="attendus">Participants attendus</label>
<input class="champ" id="attendus" name="attendus" type="number" value="40" min="1">
</div>
<div class="carte"><table>
<tr><th></th><th>Bien</th><th>Partenaire</th><th class="num">Prix</th><th class="num">Écart</th></tr>
${lignes || '<tr><td colspan="5" class="doux">Aucun bien validé disponible.</td></tr>'}</table></div>
<button class="bouton pale" type="submit" name="action" value="controler">Contrôler</button>
<button class="bouton" type="submit" name="action" value="sceller">Sceller la manche</button>
</form>`,
    '/admin/manches'
  );
}

export function detailManche({ manche, biens, concentration, base }) {
  const etapes = {
    scellee: ['ouvrir', 'Ouvrir la manche'],
    ouverte: ['fermer', 'Clôturer la manche'],
    fermee: ['reveler', 'Révéler et calculer les scores'],
  };
  const suite = etapes[manche.statut];
  return cadre(
    `Manche ${manche.rang}`,
    `<h1>${echapper(manche.saison_libelle)} — manche ${manche.rang}</h1>
<div class="carte">
<table>
<tr><td>Statut</td><td class="num"><span class="etiquette">${echapper(manche.statut)}</span></td></tr>
<tr><td>Biens</td><td class="num">${biens.length}</td></tr>
<tr><td>Participants</td><td class="num">${manche.nb_participants}</td></tr>
<tr><td>Partenaires distincts</td><td class="num">${concentration.nb_partenaires}</td></tr>
<tr><td>Part du partenaire principal</td><td class="num">${pourcent(concentration.part_max_bps)}</td></tr>
</table>
</div>
<div class="carte">
<h2>Empreinte</h2><div class="empreinte">${echapper(manche.empreinte || '—')}</div>
<p><a href="${base}/verification/${manche.id}">Page publique de vérification</a></p>
</div>
${suite
  ? `<form method="post" action="/admin/manche/${manche.id}/${suite[0]}">
     <button class="bouton" type="submit">${suite[1]}</button></form>`
  : '<p class="doux">Manche terminée.</p>'}
<a class="bouton pale" href="/admin">Retour</a>`,
    '/admin/manches'
  );
}

export function statistiques({ lignes }) {
  const table = lignes
    .map(
      (l) =>
        `<tr><td>${echapper(l.libelle)}</td><td class="num">${l.nb}</td>
<td class="num">${pourcent(l.ecart_moyen_bps)}</td></tr>`
    )
    .join('');
  return cadre(
    'Statistiques',
    `<h1>Statistiques de marché</h1>
<p class="doux">Écart moyen entre l'estimation médiane du groupe et le prix réel. C'est la matière
du rapport professionnel et la preuve de séparation adresse/hasard pour le dossier réglementaire.</p>
<div class="carte"><table>
<tr><th>Segment</th><th class="num">Biens</th><th class="num">Écart moyen</th></tr>
${table || '<tr><td colspan="3" class="doux">Pas encore de manche révélée.</td></tr>'}</table></div>
<a class="bouton pale" href="/admin/stats/export">Exporter en CSV</a>`,
    '/admin/stats'
  );
}
