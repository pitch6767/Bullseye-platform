// Constructeur de manche. Les contrôles bloquants protègent la qualification
// du jeu comme jeu d'adresse : ils ne sont pas négociables.

export const MAX_BIENS_PAR_PARTENAIRE = 3;
export const ECART_REFERENCE_MAX_BPS = 2500;

// Nombre minimum de biens selon les participants attendus.
// Moins de biens = le hasard désigne le gagnant = requalification en loterie.
export function biensMinimum(participantsAttendus) {
  if (participantsAttendus <= 60) return 8;
  if (participantsAttendus <= 200) return 12;
  if (participantsAttendus <= 600) return 15;
  return 20;
}

// Le minimum s'apprecie sur le CUMUL de la saison, pas sur la manche isolee.
// Une saison de 13 manches a 3 biens produit 39 mesures : le hasard s'annule.
// Une manche isolee de 3 biens ne departagerait rien.
export function biensCumulesSaison(biensParManche, nbManches) {
  return biensParManche * nbManches;
}

export function saisonSuffisante(biensParManche, nbManches, participantsAttendus) {
  const cumul = biensCumulesSaison(biensParManche, nbManches);
  const requis = biensMinimum(participantsAttendus);
  return { cumul, requis, suffisante: cumul >= requis };
}

// biens : [{id, partenaire_id, statut, prix_reel_cts, valeur_reference_cts, ecart_reference_bps}]
// options.biensDejaJoues : biens deja reveles dans la saison en cours.
export function controlerManche(biens, options = {}) {
  const participants = options.participantsAttendus ?? 0;
  const minimum = options.biensMinimum ?? biensMinimum(participants);
  const dejaJoues = options.biensDejaJoues ?? 0;
  const manchesRestantes = options.manchesRestantes ?? 0;
  const bloquants = [];
  const avertissements = [];

  if (biens.length === 0) {
    bloquants.push('Aucun bien sélectionné.');
    return { valide: false, bloquants, avertissements, minimum };
  }

  const vus = new Set();
  for (const bien of biens) {
    if (vus.has(bien.id)) bloquants.push(`Bien ${bien.id} sélectionné deux fois.`);
    vus.add(bien.id);
    if (bien.statut === 'brule') bloquants.push(`Bien ${bien.id} déjà utilisé dans une manche.`);
    if (bien.statut !== 'valide' && bien.statut !== 'brule') {
      bloquants.push(`Bien ${bien.id} non validé (statut ${bien.statut}).`);
    }
    if (!Number.isInteger(bien.prix_reel_cts) || bien.prix_reel_cts <= 0) {
      bloquants.push(`Bien ${bien.id} sans prix réel exploitable.`);
    }
  }

  const parPartenaire = new Map();
  for (const bien of biens) {
    parPartenaire.set(bien.partenaire_id, (parPartenaire.get(bien.partenaire_id) || 0) + 1);
  }
  for (const [partenaire, nombre] of parPartenaire) {
    if (nombre > MAX_BIENS_PAR_PARTENAIRE) {
      bloquants.push(
        `Partenaire ${partenaire} : ${nombre} biens, maximum ${MAX_BIENS_PAR_PARTENAIRE}.`
      );
    }
  }

  // Projection du cumul de la saison : c'est lui qui designe le gagnant.
  const cumulProjete = dejaJoues + biens.length + manchesRestantes * biens.length;
  if (cumulProjete < minimum) {
    avertissements.push(
      `${cumulProjete} biens cumulés sur la saison pour ${participants} participants attendus, ` +
        `minimum ${minimum}. Allonge la saison ou ajoute des biens.`
    );
  }

  for (const bien of biens) {
    if (bien.ecart_reference_bps != null && Math.abs(bien.ecart_reference_bps) > ECART_REFERENCE_MAX_BPS) {
      avertissements.push(
        `Bien ${bien.id} : écart de ${(bien.ecart_reference_bps / 100).toFixed(1)} % à la valeur de référence.`
      );
    }
    if (bien.valeur_reference_cts == null) {
      avertissements.push(`Bien ${bien.id} : aucune valeur de référence pour le contrôle qualité.`);
    }
  }

  return { valide: bloquants.length === 0, bloquants, avertissements, minimum };
}

// Part d'un partenaire dans les réponses d'une manche. Sert au dossier d'intégrité.
export function concentrationPartenaires(biens) {
  const parPartenaire = new Map();
  for (const bien of biens) {
    parPartenaire.set(bien.partenaire_id, (parPartenaire.get(bien.partenaire_id) || 0) + 1);
  }
  const maximum = Math.max(...parPartenaire.values(), 0);
  return {
    nb_partenaires: parPartenaire.size,
    part_max_bps: biens.length ? Math.round((maximum * 10000) / biens.length) : 0,
  };
}

export function ecartReferenceBps(prixReelCts, referenceCts) {
  if (!referenceCts || referenceCts <= 0) return null;
  return Math.round(((prixReelCts - referenceCts) * 10000) / referenceCts);
}
