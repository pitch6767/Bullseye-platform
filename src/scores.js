// Calcul des scores. Erreur en points de base, plafonnée à 100 % par bien
// pour qu'une faute de frappe ne détruise pas une saison entière.

export const PLAFOND_ERREUR_BPS = 10000;

export function erreurBien(estimationCts, prixReelCts) {
  if (!prixReelCts || prixReelCts <= 0) throw new Error('prix réel invalide');
  if (!Number.isInteger(estimationCts) || estimationCts < 0) throw new Error('estimation invalide');
  const bps = Math.round((Math.abs(estimationCts - prixReelCts) * 10000) / prixReelCts);
  return Math.min(bps, PLAFOND_ERREUR_BPS);
}

// estimations : Map bien_id -> valeur_cts ; biens : [{id, prix_reel_cts}]
// Un bien non estimé prend le plafond.
export function scoreManche(estimations, biens) {
  let total = 0;
  const detail = [];
  for (const bien of biens) {
    const valeur = estimations.get(bien.id);
    const bps = valeur === undefined ? PLAFOND_ERREUR_BPS : erreurBien(valeur, bien.prix_reel_cts);
    detail.push({ bien_id: bien.id, estimation_cts: valeur ?? null, erreur_bps: bps });
    total += bps;
  }
  return { erreur_totale_bps: total, detail };
}

// Rangs avec ex aequo : deux scores égaux partagent le rang, le suivant saute.
export function attribuerRangs(lignes) {
  const tries = [...lignes].sort((a, b) => a.erreur_totale_bps - b.erreur_totale_bps);
  let rang = 0;
  let precedent = null;
  return tries.map((ligne, index) => {
    if (precedent === null || ligne.erreur_totale_bps !== precedent) rang = index + 1;
    precedent = ligne.erreur_totale_bps;
    return { ...ligne, rang };
  });
}

// Départage : jamais de tirage. Meilleure dernière manche, puis barrage, puis partage.
// derniere : Map joueur_id -> erreur de la dernière manche.
export function departager(exAequo, derniere) {
  if (exAequo.length <= 1) return { issue: 'unique', gagnants: exAequo };
  const avec = exAequo.map((j) => ({ ...j, derniere: derniere.get(j.joueur_id) ?? Infinity }));
  const meilleur = Math.min(...avec.map((j) => j.derniere));
  const restants = avec.filter((j) => j.derniere === meilleur);
  if (restants.length === 1) return { issue: 'derniere_manche', gagnants: restants };
  if (meilleur === Infinity) return { issue: 'barrage', gagnants: avec };
  return { issue: 'barrage', gagnants: restants };
}

// Statistiques du débrief : où le groupe s'est le plus trompé.
export function debrief(biens, estimationsParBien) {
  const lignes = biens.map((bien) => {
    const valeurs = (estimationsParBien.get(bien.id) || []).slice().sort((a, b) => a - b);
    if (valeurs.length === 0) {
      return { bien_id: bien.id, mediane_cts: null, ecart_bps: null, nb: 0 };
    }
    const milieu = Math.floor(valeurs.length / 2);
    const mediane = valeurs.length % 2
      ? valeurs[milieu]
      : Math.round((valeurs[milieu - 1] + valeurs[milieu]) / 2);
    const ecart = Math.round(((mediane - bien.prix_reel_cts) * 10000) / bien.prix_reel_cts);
    return { bien_id: bien.id, mediane_cts: mediane, ecart_bps: ecart, nb: valeurs.length };
  });
  return lignes.sort((a, b) => Math.abs(b.ecart_bps ?? 0) - Math.abs(a.ecart_bps ?? 0));
}

// Cagnottes. Aucun lot garanti : on ne verse que ce qui est encaissé.
export function lotHebdo(collecteCts, bps) {
  return Math.floor((collecteCts * bps) / 10000);
}

export function cagnotteSaison(collectesCts, bps) {
  return collectesCts.reduce((somme, c) => somme + Math.floor((c * bps) / 10000), 0);
}
