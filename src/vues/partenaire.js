import { page } from './gabarit.js';
import { echapper, chf } from '../socle.js';

function champ(c) {
  const requis = c.requis ? ' required' : '';
  if (c.type === 'choix') {
    return `<label for="${c.cle}">${echapper(c.libelle)}</label>
<select class="champ" id="${c.cle}" name="${c.cle}"${requis}>
${c.options.map((o) => `<option value="${echapper(o)}">${echapper(o)}</option>`).join('')}
</select>`;
  }
  if (c.type === 'long') {
    return `<label for="${c.cle}">${echapper(c.libelle)}</label>
<textarea class="champ" id="${c.cle}" name="${c.cle}" rows="2"${requis}></textarea>`;
  }
  const type = c.type === 'entier' ? 'number' : 'text';
  return `<label for="${c.cle}">${echapper(c.libelle)}</label>
<input class="champ" id="${c.cle}" name="${c.cle}" type="${type}"${requis}>`;
}

export function formulaire({ partenaire, verticale, schema, recents, message }) {
  const lignes = recents
    .map((b) => {
      const a = JSON.parse(b.attributs);
      const titre = verticale.code === 'immo'
        ? `${a.type ?? ''} ${a.commune ?? ''}`
        : `${a.marque ?? ''} ${a.modele ?? ''}`;
      return `<tr><td>${echapper(titre)}</td><td class="num">CHF ${chf(b.prix_reel_cts)}</td>
<td><span class="etiquette${b.statut === 'valide' ? ' ok' : ''}">${echapper(b.statut)}</span></td></tr>`;
    })
    .join('');
  return page({
    titre: `Saisie — ${partenaire.nom}`,
    entete: 'Bullseye — partenaire',
    corps: `<h1>${echapper(partenaire.nom)}</h1>
<p class="doux">Saisis les ${verticale.libelle.toLowerCase()}s que tu as vendues cette semaine.
Le prix reste confidentiel jusqu'à la clôture de la manche, puis ton nom apparaît sur la fiche.</p>
${message ? `<div class="alerte info">${echapper(message)}</div>` : ''}
<form method="post" class="carte">
${schema.map(champ).join('')}
<label for="prix">${echapper(verticale.libelle_prix)} réel en francs</label>
<input class="champ" id="prix" name="prix" type="number" min="1" required>
<label for="vendu_le">Date de vente</label>
<input class="champ" id="vendu_le" name="vendu_le" type="date" required>
<label for="reference">Valeur de référence Eurotax en francs (facultatif)</label>
<input class="champ" id="reference" name="reference" type="number" min="0">
<button class="bouton" type="submit">Enregistrer</button>
</form>
<h2>Tes derniers envois</h2>
<div class="carte"><table>
<tr><th>Bien</th><th class="num">Prix</th><th>Statut</th></tr>
${lignes || '<tr><td colspan="3" class="doux">Aucun envoi.</td></tr>'}</table></div>`,
  });
}
