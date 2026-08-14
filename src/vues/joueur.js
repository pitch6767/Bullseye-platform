import { page } from './gabarit.js';
import { echapper, chf, pourcent } from '../socle.js';

const specs = (attributs, schema) =>
  schema
    .filter((c) => attributs[c.cle] !== undefined && attributs[c.cle] !== '')
    .map((c) => echapper(attributs[c.cle]))
    .join(' · ');

const titreBien = (attributs, code) =>
  code === 'immo'
    ? `${attributs.type ?? ''} ${attributs.pieces ?? ''} pièces — ${attributs.commune ?? ''}`
    : `${attributs.marque ?? ''} ${attributs.modele ?? ''} ${attributs.annee ?? ''}`;

export function accueil({ saison, manche, biens, cagnotte, participants, inscrit }) {
  if (!manche) {
    return page({
      titre: 'Bullseye',
      corps: `<h1>Aucune manche en cours</h1>
<p class="doux">La prochaine manche sera annoncée ici. En attendant, entraîne-toi librement.</p>
<a class="bouton pale" href="/entrainement">Mode entraînement</a>`,
    });
  }
  const ouverte = manche.statut === 'ouverte';
  return page({
    titre: 'Bullseye',
    corps: `
<div class="carte cagnotte">
  <div class="montant">CHF ${chf(cagnotte)}</div>
  <div class="legende">cagnotte de la saison, en direct</div>
</div>
<div class="carte">
  <h1>${echapper(saison.libelle)} — manche ${manche.rang}</h1>
  <p class="doux">${biens.length} biens à estimer · ${participants} participants</p>
  ${ouverte
    ? inscrit
      ? '<a class="bouton pale" href="/manche">Reprendre mes estimations</a>'
      : '<a class="bouton" href="/manche">Entrer dans la manche</a>'
    : '<p class="doux">Manche fermée. Résultats en préparation.</p>'}
</div>
<div class="carte">
  <h2>Intégrité</h2>
  <p class="doux">Les prix réels ont été scellés avant l'ouverture. Personne, pas même
  l'organisateur, ne peut les modifier.</p>
  <div class="empreinte">${echapper(manche.empreinte || '—')}</div>
  <p><a href="/verification/${manche.id}" class="doux">Vérifier le scellement</a></p>
</div>`,
  });
}

export function formulaireManche({ manche, biens, schema, code, valeurs }) {
  const champs = biens
    .map((bien, i) => {
      const attributs = bien.attributs;
      const valeur = valeurs[bien.id] != null ? Math.round(valeurs[bien.id] / 100) : '';
      const photo = bien.photos[0]
        ? `<img src="${echapper(bien.photos[0])}" alt="" style="width:100%;border-radius:8px;margin-bottom:10px">`
        : '';
      return `<div class="fiche">
  ${photo}
  <div class="titre">${i + 1}. ${echapper(titreBien(attributs, code))}</div>
  <div class="specs">${specs(attributs, schema)}</div>
  <label for="b${bien.id}">Ton estimation en francs</label>
  <input class="champ" type="number" inputmode="numeric" min="0" step="100"
    id="b${bien.id}" name="bien_${bien.id}" value="${valeur}" placeholder="0">
</div>`;
    })
    .join('');
  return page({
    titre: `Manche ${manche.rang}`,
    corps: `<h1>Manche ${manche.rang}</h1>
<p class="doux">Une estimation par bien. Tu peux revenir et corriger jusqu'à la clôture.</p>
<form method="post" action="/manche">
${champs}
<button class="bouton" type="submit">Enregistrer mes estimations</button>
</form>
<a class="bouton pale" href="/">Retour</a>`,
  });
}

export function resultats({ manche, lignes, monScore, debriefLignes, biensParId, code, schema }) {
  const table = lignes
    .slice(0, 20)
    .map(
      (l) =>
        `<tr><td class="num">${l.rang}</td><td>${echapper(l.pseudo)}</td>
<td class="num">${pourcent(l.erreur_totale_bps)}</td></tr>`
    )
    .join('');
  const debriefHtml = debriefLignes
    .slice(0, 3)
    .map((d) => {
      const bien = biensParId.get(d.bien_id);
      const sens = d.ecart_bps > 0 ? 'sous-estimé' : 'surestimé';
      return `<div class="fiche">
  <div class="titre">${echapper(titreBien(bien.attributs, code))}</div>
  <div class="specs">${specs(bien.attributs, schema)}</div>
  <table>
    <tr><td>Prix réel</td><td class="num">CHF ${chf(bien.prix_reel_cts)}</td></tr>
    <tr><td>Estimation médiane</td><td class="num">CHF ${chf(d.mediane_cts)}</td></tr>
    <tr><td>Écart du groupe</td><td class="num">${pourcent(Math.abs(d.ecart_bps))} ${sens}</td></tr>
  </table>
  ${bien.partenaire_nom ? `<p class="doux">Vendu par ${echapper(bien.partenaire_nom)}</p>` : ''}
</div>`;
    })
    .join('');
  return page({
    titre: `Résultats manche ${manche.rang}`,
    corps: `<h1>Résultats — manche ${manche.rang}</h1>
${monScore
  ? `<div class="carte"><p>Ton score : <strong>${pourcent(monScore.erreur_totale_bps)}</strong>
     d'erreur cumulée — rang <strong>${monScore.rang}</strong> sur ${lignes.length}.</p></div>`
  : ''}
<h2>Là où le groupe s'est le plus trompé</h2>
${debriefHtml}
<h2>Classement de la manche</h2>
<div class="carte"><table>
<tr><th class="num">Rang</th><th>Joueur</th><th class="num">Erreur</th></tr>${table}
</table></div>
<a class="bouton pale" href="/classement/${manche.saison_id}">Classement de la saison</a>
<a class="bouton pale" href="/">Accueil</a>`,
  });
}

export function classement({ saison, lignes }) {
  const table = lignes
    .map(
      (l) =>
        `<tr><td class="num">${l.rang ?? '—'}</td><td>${echapper(l.pseudo)}</td>
<td class="num">${l.manches_jouees}</td>
<td class="num">${pourcent(l.erreur_cumulee_bps)}</td>
<td>${l.eligible ? '<span class="etiquette ok">éligible</span>' : '<span class="etiquette">partiel</span>'}</td></tr>`
    )
    .join('');
  return page({
    titre: 'Classement',
    corps: `<h1>${echapper(saison.libelle)}</h1>
<p class="doux">Seuls les joueurs ayant participé à toutes les manches sont éligibles à la cagnotte.</p>
<div class="carte"><table>
<tr><th class="num">Rang</th><th>Joueur</th><th class="num">Manches</th>
<th class="num">Erreur</th><th></th></tr>${table}
</table></div>
<a class="bouton pale" href="/">Accueil</a>`,
  });
}

export function verification({ manche, charge, valide }) {
  return page({
    titre: 'Vérification du scellement',
    corps: `<h1>Vérification — manche ${manche.rang}</h1>
${manche.revele_le
  ? `<div class="alerte ${valide ? 'info' : ''}">${valide
      ? 'Scellement vérifié : les prix révélés correspondent exactement à ceux scellés avant l\'ouverture.'
      : 'ANOMALIE : le recalcul ne correspond pas à l\'empreinte publiée.'}</div>`
  : '<div class="alerte">Manche non révélée. Le sel reste secret jusqu\'à la clôture.</div>'}
<div class="carte">
  <h2>Empreinte publiée à l'ouverture</h2>
  <div class="empreinte">${echapper(manche.empreinte || '—')}</div>
</div>
${manche.revele_le
  ? `<div class="carte">
  <h2>Sel révélé</h2><div class="empreinte">${echapper(manche.sel)}</div>
  <h2>Charge</h2><div class="empreinte">${echapper(charge)}</div>
  <p class="doux">Recalcule toi-même : SHA-256 de « sel|charge ». Tu dois retrouver l'empreinte.</p>
</div>`
  : ''}
<a class="bouton pale" href="/">Accueil</a>`,
  });
}

export function messageSimple(titre, texte, lien = '/') {
  return page({
    titre,
    corps: `<h1>${echapper(titre)}</h1><p>${echapper(texte)}</p>
<a class="bouton pale" href="${lien}">Continuer</a>`,
  });
}

export function inscription(erreur) {
  return page({
    titre: 'Rejoindre',
    corps: `<h1>Rejoindre la manche</h1>
<p class="doux">Aucune mise, aucun lot. Version d'essai gratuite.</p>
${erreur ? `<div class="alerte">${echapper(erreur)}</div>` : ''}
<form method="post" action="/rejoindre">
<label for="pseudo">Pseudo affiché au classement</label>
<input class="champ" id="pseudo" name="pseudo" required maxlength="30">
<label for="courriel">Courriel</label>
<input class="champ" id="courriel" name="courriel" type="email" required>
<button class="bouton" type="submit">Entrer</button>
</form>`,
  });
}
