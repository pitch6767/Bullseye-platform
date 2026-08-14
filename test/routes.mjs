import { fauxEnv, requete, cookieAdmin, verifier, bilan } from './faux.js';
import travailleur from '../src/index.js';

const env = fauxEnv();
const appel = (chemin, options) => travailleur.fetch(requete(chemin, options), env);
const corpsDe = async (r) => await r.text();

// --- garde admin -----------------------------------------------------------
verifier((await appel('/admin')).status === 302, 'back office ferme sans cookie');
verifier((await appel('/admin/biens')).status === 302, 'toutes les pages admin protegees');
const mauvais = await appel('/admin/connexion', { method: 'POST', form: { code: 'faux' } });
verifier(mauvais.status === 401, 'mauvais code refuse');
const bon = await appel('/admin/connexion', { method: 'POST', form: { code: 'test1234' } });
verifier(bon.status === 302 && bon.headers.get('Set-Cookie').includes('HttpOnly'), 'cookie admin pose');
verifier((await appel('/admin', { headers: cookieAdmin })).status === 200, 'back office ouvert avec cookie');

// --- sante et 404 ----------------------------------------------------------
const sante = await appel('/sante');
verifier(sante.status === 200 && (await sante.json()).ok === true, 'sonde de sante');
verifier((await appel('/nexiste-pas')).status === 404, 'page inconnue en 404');

// --- partenaires -----------------------------------------------------------
await appel('/admin/partenaires', {
  method: 'POST', headers: cookieAdmin,
  form: { nom: 'Garage du Chablais', type: 'garage', verticale_id: '1', courriel: 'a@b.ch' },
});
await appel('/admin/partenaires', {
  method: 'POST', headers: cookieAdmin,
  form: { nom: 'Garage de Vouvry', type: 'garage', verticale_id: '1', courriel: 'c@d.ch' },
});
await appel('/admin/partenaires', {
  method: 'POST', headers: cookieAdmin,
  form: { nom: 'Garage de Monthey', type: 'garage', verticale_id: '1', courriel: 'e@f.ch' },
});
const partenaires = env._sqlite.prepare('SELECT * FROM partenaires').all();
verifier(partenaires.length === 3, 'trois partenaires crees');
verifier(/^[a-f0-9]{32}$/.test(partenaires[0].jeton), 'jeton partenaire sur 32 hex');
verifier(partenaires[0].jeton !== partenaires[1].jeton, 'jetons distincts');

verifier((await appel('/partenaire/' + 'f'.repeat(32))).status === 404, 'jeton inconnu refuse');
verifier((await appel('/partenaire/trop-court')).status === 404, 'jeton malforme refuse');

// --- saisie partenaire -----------------------------------------------------
const prix = [3150000, 1520000, 3380000, 2890000, 1240000, 4560000, 2100000, 1870000, 2650000];
for (let i = 0; i < 9; i += 1) {
  const jeton = partenaires[i % 3].jeton;
  const r = await appel('/partenaire/' + jeton, {
    method: 'POST',
    form: {
      marque: 'VW', modele: 'Golf ' + i, annee: '2021', km: String(40000 + i * 1000),
      boite: 'automatique', carburant: 'essence', canton: 'VS', etat: 'bon',
      prix: String(prix[i] / 100), vendu_le: '2026-07-0' + ((i % 8) + 1),
      reference: String((prix[i] / 100) * 1.02),
    },
  });
  verifier(r.status === 200, 'saisie partenaire acceptee ' + i);
}
verifier(env._sqlite.prepare("SELECT COUNT(*) n FROM biens WHERE statut='brouillon'").get().n === 9,
  'neuf biens en attente');

const doublon = await appel('/partenaire/' + partenaires[0].jeton, {
  method: 'POST',
  form: { marque: 'VW', modele: 'Golf 0', annee: '2021', km: '40000', boite: 'automatique',
    carburant: 'essence', canton: 'VS', etat: 'bon', prix: String(prix[0] / 100),
    vendu_le: '2026-07-01' },
});
verifier((await corpsDe(doublon)).includes('déjà'), 'doublon detecte et signale');

// --- validation des biens --------------------------------------------------
const tousIds = env._sqlite.prepare('SELECT id FROM biens ORDER BY id').all().map((b) => b.id);
const ids = tousIds.slice(0, 8);
const nonValide = tousIds[8];
for (const id of ids) await appel(`/admin/bien/${id}/valider`, { headers: cookieAdmin });
verifier(env._sqlite.prepare("SELECT COUNT(*) n FROM biens WHERE statut='valide'").get().n === 8,
  'huit biens valides, un laisse en attente');

// --- saison et manche ------------------------------------------------------
await appel('/admin/saison/nouvelle', {
  method: 'POST', headers: cookieAdmin,
  form: { verticale_id: '1', libelle: 'Essai gratuit', nb_manches: '2' },
});
const saison = env._sqlite.prepare('SELECT * FROM saisons').get();
verifier(saison && saison.jeu_argent === 0, 'saison gratuite : hors jeu d argent');

const refus = await appel('/admin/manche/nouvelle', {
  method: 'POST', headers: cookieAdmin,
  form: { saison_id: String(saison.id), attendus: '40', action: 'sceller',
    bien: [...ids, nonValide].map(String) },
});
const corpsRefus = await corpsDe(refus);
verifier(corpsRefus.includes('non validé') || corpsRefus.includes('non valid'),
  'bien non valide refuse au scellement');
verifier(env._sqlite.prepare('SELECT COUNT(*) n FROM manches').get().n === 0, 'aucune manche creee sur refus');

const refusPartenaire = await appel('/admin/manche/nouvelle', {
  method: 'POST', headers: cookieAdmin,
  form: { saison_id: String(saison.id), attendus: '40', action: 'controler', bien: ids.map(String) },
});
verifier((await corpsDe(refusPartenaire)).includes('Contr'), 'action controler ne scelle pas');
verifier(env._sqlite.prepare('SELECT COUNT(*) n FROM manches').get().n === 0, 'controler ne cree rien');

const cree = await appel('/admin/manche/nouvelle', {
  method: 'POST', headers: cookieAdmin,
  form: { saison_id: String(saison.id), attendus: '40', action: 'sceller', bien: ids.map(String) },
});
verifier(cree.status === 302, 'manche scellee et redirigee');
const manche = env._sqlite.prepare('SELECT * FROM manches').get();
verifier(manche.statut === 'scellee', 'statut scellee');
verifier(/^[a-f0-9]{64}$/.test(manche.empreinte), 'empreinte publiee');
verifier(env._sqlite.prepare('SELECT COUNT(*) n FROM manche_biens WHERE manche_id=?').get(manche.id).n === 8,
  'huit biens rattaches');

// --- etancheite des prix avant revelation ----------------------------------
await appel(`/admin/manche/${manche.id}/ouvrir`, { method: 'POST', headers: cookieAdmin });
const accueil = await corpsDe(await appel('/'));
verifier(accueil.includes(manche.empreinte), 'empreinte visible sur l accueil');
for (const p of prix) {
  verifier(!accueil.includes(String(p / 100)), 'aucun prix reel sur l accueil');
}
const verif = await corpsDe(await appel('/verification/' + manche.id));
verifier(!verif.includes('"prix"'), 'aucune charge revelee avant cloture');
verifier(verif.includes('secret'), 'le sel reste secret');

// --- parcours joueur -------------------------------------------------------
verifier((await appel('/manche')).status === 302, 'manche exige une inscription');
const inscrit = await appel('/rejoindre', {
  method: 'POST', form: { pseudo: 'Pitch', courriel: 'PITCH@Test.CH' },
});
verifier(inscrit.status === 302, 'inscription acceptee');
const cookieJoueur = { Cookie: inscrit.headers.get('Set-Cookie').split(';')[0] };
verifier(env._sqlite.prepare('SELECT courriel FROM joueurs').get().courriel === 'pitch@test.ch',
  'courriel normalise en minuscules');

const refusInscription = await appel('/rejoindre', { method: 'POST', form: { pseudo: '', courriel: 'x' } });
verifier(refusInscription.status === 400, 'inscription invalide refusee');

const page = await corpsDe(await appel('/manche', { headers: cookieJoueur }));
verifier(page.includes('bien_' + ids[0]), 'formulaire avec un champ par bien');
for (const p of prix) verifier(!page.includes(String(p / 100)), 'aucun prix reel dans le formulaire');

const estimer = (ecarts) => {
  const form = {};
  ids.forEach((id, i) => { form['bien_' + id] = String(Math.round((prix[i] / 100) * ecarts[i])); });
  return form;
};
await appel('/manche', { method: 'POST', headers: cookieJoueur,
  form: estimer([1.02, 0.98, 1.01, 1.0, 1.03, 0.99, 1.02, 1.0]) });
verifier(env._sqlite.prepare('SELECT COUNT(*) n FROM estimations').get().n === 8, 'huit estimations');
verifier(env._sqlite.prepare('SELECT nb_participants n FROM manches').get().n === 1, 'un participant');

await appel('/manche', { method: 'POST', headers: cookieJoueur,
  form: estimer([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]) });
verifier(env._sqlite.prepare('SELECT COUNT(*) n FROM estimations').get().n === 8, 'correction sans doublon');
verifier(env._sqlite.prepare('SELECT nb_participants n FROM manches').get().n === 1,
  'renvoyer ne cree pas une seconde participation');

const second = await appel('/rejoindre', { method: 'POST', form: { pseudo: 'Novice', courriel: 'n@t.ch' } });
const cookieNovice = { Cookie: second.headers.get('Set-Cookie').split(';')[0] };
await appel('/manche', { method: 'POST', headers: cookieNovice,
  form: estimer([1.4, 0.6, 1.35, 0.7, 1.5, 0.65, 1.3, 0.75]) });
verifier(env._sqlite.prepare('SELECT nb_participants n FROM manches').get().n === 2, 'deux participants');

// --- cloture et revelation -------------------------------------------------
await appel(`/admin/manche/${manche.id}/fermer`, { method: 'POST', headers: cookieAdmin });
verifier((await corpsDe(await appel('/manche', { headers: cookieJoueur }))).includes('fermée'),
  'manche fermee refuse les estimations');
verifier((await appel('/resultats/' + manche.id)).status === 404, 'resultats indisponibles avant revelation');

await appel(`/admin/manche/${manche.id}/reveler`, { method: 'POST', headers: cookieAdmin });
const apres = env._sqlite.prepare('SELECT * FROM manches').get();
verifier(apres.statut === 'revelee' && apres.sel, 'manche revelee');
verifier(env._sqlite.prepare("SELECT COUNT(*) n FROM biens WHERE statut='brule'").get().n === 8,
  'les huit biens joues sont brules et non reutilisables');
verifier(env._sqlite.prepare('SELECT statut FROM biens WHERE id=?').get(nonValide).statut === 'brouillon',
  'le bien non retenu reste disponible');

const scores = env._sqlite.prepare('SELECT * FROM scores ORDER BY rang').all();
verifier(scores.length === 2, 'deux scores calcules');
verifier(scores[0].erreur_totale_bps === 0, 'estimations exactes = zero erreur');
verifier(scores[0].rang === 1 && scores[1].rang === 2, 'le meilleur estimateur gagne');
verifier(scores[1].erreur_totale_bps > 20000, 'le novice est nettement derriere');

const classement = env._sqlite.prepare('SELECT * FROM classements').all();
verifier(classement.length === 2, 'classement de saison alimente');
verifier(classement.every((c) => c.manches_jouees === 1), 'une manche jouee');
verifier(classement.every((c) => c.eligible === 0), 'non eligible avant les deux manches');

const resultats = await corpsDe(await appel('/resultats/' + manche.id, { headers: cookieJoueur }));
verifier(resultats.includes('Pitch'), 'classement publie');
const attenduFr = (prix[0] / 100).toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
verifier(resultats.includes(attenduFr), 'prix reel visible apres revelation');

const verifApres = await corpsDe(await appel('/verification/' + manche.id));
verifier(verifApres.includes('vérifié'), 'scellement verifie apres revelation');
verifier(verifApres.includes(apres.sel), 'sel publie');

env._sqlite.prepare("UPDATE biens SET prix_reel_cts = 1 WHERE id = ?").run(ids[0]);
verifier((await corpsDe(await appel('/verification/' + manche.id))).includes('ANOMALIE'),
  'une falsification posterieure est detectee publiquement');

bilan('routes');
