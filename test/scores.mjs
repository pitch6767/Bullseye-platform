import { erreurBien, scoreManche, attribuerRangs, departager, debrief,
  lotHebdo, cagnotteSaison, PLAFOND_ERREUR_BPS } from '../src/scores.js';
import { verifier, bilan } from './faux.js';

verifier(erreurBien(100000, 100000) === 0, 'estimation exacte = 0');
verifier(erreurBien(110000, 100000) === 1000, 'surestimation 10 % = 1000 bps');
verifier(erreurBien(90000, 100000) === 1000, 'sous-estimation 10 % = 1000 bps');
verifier(erreurBien(0, 100000) === PLAFOND_ERREUR_BPS, 'zero atteint le plafond');
verifier(erreurBien(9999999, 100000) === PLAFOND_ERREUR_BPS, 'erreur enorme plafonnee');

let leve = false;
try { erreurBien(1000, 0); } catch { leve = true; }
verifier(leve, 'prix reel nul rejete');

const biens = [{ id: 1, prix_reel_cts: 100000 }, { id: 2, prix_reel_cts: 200000 }];
const s = scoreManche(new Map([[1, 110000], [2, 200000]]), biens);
verifier(s.erreur_totale_bps === 1000, 'somme des erreurs');
verifier(s.detail.length === 2, 'detail par bien');

const manquant = scoreManche(new Map([[1, 100000]]), biens);
verifier(manquant.erreur_totale_bps === PLAFOND_ERREUR_BPS, 'bien non estime = plafond');

const rangs = attribuerRangs([
  { joueur_id: 1, erreur_totale_bps: 500 },
  { joueur_id: 2, erreur_totale_bps: 200 },
  { joueur_id: 3, erreur_totale_bps: 500 },
  { joueur_id: 4, erreur_totale_bps: 900 },
]);
verifier(rangs[0].joueur_id === 2 && rangs[0].rang === 1, 'meilleur score rang 1');
verifier(rangs[1].rang === 2 && rangs[2].rang === 2, 'ex aequo partagent le rang');
verifier(rangs[3].rang === 4, 'le rang suivant saute');

const d1 = departager([{ joueur_id: 1 }, { joueur_id: 2 }], new Map([[1, 300], [2, 100]]));
verifier(d1.issue === 'derniere_manche' && d1.gagnants[0].joueur_id === 2, 'departage par derniere manche');
const d2 = departager([{ joueur_id: 1 }, { joueur_id: 2 }], new Map([[1, 200], [2, 200]]));
verifier(d2.issue === 'barrage', 'egalite persistante = barrage, jamais de tirage');
verifier(departager([{ joueur_id: 9 }], new Map()).issue === 'unique', 'un seul gagnant');

const deb = debrief(biens, new Map([[1, [90000, 92000, 94000]], [2, [200000]]]));
verifier(deb[0].bien_id === 1, 'le plus gros ecart en tete');
verifier(deb[0].mediane_cts === 92000, 'mediane impaire');
verifier(deb[0].ecart_bps === -800, 'ecart signe du groupe');

verifier(lotHebdo(1000000, 2000) === 200000, 'lot hebdo 20 %');
verifier(cagnotteSaison([1000000, 1000000], 4000) === 800000, 'cagnotte cumulee 40 %');
verifier(lotHebdo(999, 2000) === 199, 'arrondi vers le bas, jamais a decouvert');

// Decoupage reel : prix hebdo symbolique, tout le reste dans la cagnotte.
const HEBDO_AUTO = 250, SAISON_AUTO = 5750;
const HEBDO_IMMO = 170, SAISON_IMMO = 5830;
verifier(HEBDO_AUTO + SAISON_AUTO === 6000, 'voiture : reversement total 60 %');
verifier(HEBDO_IMMO + SAISON_IMMO === 6000, 'immobilier : reversement total 60 %');

// Voiture : 200 joueurs a CHF 50, 4 manches.
const collecteAuto = Array(4).fill(200 * 5000);
verifier(lotHebdo(collecteAuto[0], HEBDO_AUTO) === 25000, 'voiture : prix hebdo CHF 250');
verifier(cagnotteSaison(collecteAuto, SAISON_AUTO) === 2300000, 'voiture : cagnotte CHF 23 000');

// Immobilier : 200 joueurs a CHF 300, 4 manches.
const collecteImmo = Array(4).fill(200 * 30000);
verifier(lotHebdo(collecteImmo[0], HEBDO_IMMO) === 102000, 'immobilier : prix hebdo CHF 1 020');
verifier(cagnotteSaison(collecteImmo, SAISON_IMMO) === 13992000, 'immobilier : cagnotte CHF 139 920');

// Regle intangible : jamais plus que ce qui est encaisse.
for (const c of [collecteAuto, collecteImmo]) {
  const total = c.reduce((a, b) => a + b, 0);
  const verse = lotHebdo(c[0], HEBDO_AUTO) * 4 + cagnotteSaison(c, SAISON_AUTO);
  verifier(verse < total, 'jamais a decouvert sur un tour');
}

bilan('scores');
