import { controlerManche, biensMinimum, concentrationPartenaires, ecartReferenceBps,
  MAX_BIENS_PAR_PARTENAIRE } from '../src/manche.js';
import { verifier, bilan } from './faux.js';

const bien = (id, partenaire, extra = {}) => ({
  id, partenaire_id: partenaire, statut: 'valide', prix_reel_cts: 2000000,
  valeur_reference_cts: 2000000, ecart_reference_bps: 0, ...extra,
});

verifier(biensMinimum(40) === 8, 'seuil 40 joueurs = 8 biens');
verifier(biensMinimum(170) === 12, 'seuil 170 joueurs = 12 biens');
verifier(biensMinimum(500) === 15, 'seuil 500 joueurs = 15 biens');
verifier(biensMinimum(2000) === 20, 'seuil au dela = 20 biens');

const valide = [1,2,3,4,5,6,7,8].map((i) => bien(i, ((i - 1) % 4) + 1));
const c1 = controlerManche(valide, { participantsAttendus: 40 });
verifier(c1.valide, 'manche conforme acceptee');
verifier(c1.bloquants.length === 0, 'aucun bloquant');

const trop = [1,2,3,4].map((i) => bien(i, 1));
const c2 = controlerManche(trop, { participantsAttendus: 40 });
verifier(!c2.valide, 'plus de 3 biens du meme partenaire refuse');
verifier(c2.bloquants.some((m) => m.includes('maximum ' + MAX_BIENS_PAR_PARTENAIRE)), 'motif explicite');

const brule = [...valide.slice(0, 7), bien(9, 4, { statut: 'brule' })];
verifier(!controlerManche(brule, { participantsAttendus: 40 }).valide, 'bien deja utilise refuse');

const brouillon = [...valide.slice(0, 7), bien(9, 4, { statut: 'brouillon' })];
verifier(!controlerManche(brouillon, { participantsAttendus: 40 }).valide, 'bien non valide refuse');

const doublon = [...valide.slice(0, 7), bien(1, 3)];
verifier(!controlerManche(doublon, { participantsAttendus: 40 }).valide, 'bien selectionne deux fois refuse');

const sansPrix = [...valide.slice(0, 7), bien(9, 4, { prix_reel_cts: 0 })];
verifier(!controlerManche(sansPrix, { participantsAttendus: 40 }).valide, 'prix reel nul refuse');

verifier(!controlerManche([], {}).valide, 'manche vide refusee');

const c3 = controlerManche(valide.slice(0, 4), { participantsAttendus: 40 });
verifier(c3.valide, 'trop peu de biens reste valide');
verifier(c3.avertissements.some((m) => m.includes('minimum')), 'mais avertit sur le minimum');

const ecarte = [...valide.slice(0, 7), bien(9, 4, { ecart_reference_bps: 4000 })];
verifier(
  controlerManche(ecarte, { participantsAttendus: 40 }).avertissements.some((m) => m.includes('40.0 %')),
  'ecart anormal a la reference signale'
);

const conc = concentrationPartenaires(valide);
verifier(conc.nb_partenaires === 4, 'quatre partenaires distincts');
verifier(conc.part_max_bps === 2500, 'part maximale 25 %');
verifier(concentrationPartenaires([]).part_max_bps === 0, 'liste vide sans division par zero');

verifier(ecartReferenceBps(2200000, 2000000) === 1000, 'ecart reference 10 %');
verifier(ecartReferenceBps(2000000, null) === null, 'sans reference, pas d ecart');

bilan('manche');
