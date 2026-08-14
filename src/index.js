import {
  VERSION, maintenant, echapper, tous, un, executer, journaliser,
  estAdmin, cookieAcces, reponseHtml, redirection,
} from './socle.js';
import { sceller, chargeCanonique, verifier } from './scellement.js';
import { scoreManche, attribuerRangs, debrief, PLAFOND_ERREUR_BPS } from './scores.js';
import { controlerManche, concentrationPartenaires, ecartReferenceBps } from './manche.js';
import * as vueJoueur from './vues/joueur.js';
import * as vueAdmin from './vues/admin.js';
import * as vuePartenaire from './vues/partenaire.js';

const jetonAleatoire = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');

async function joueurCourant(requete, env) {
  const cookie = requete.headers.get('Cookie') || '';
  const trouve = cookie.match(/(?:^|;\s*)joueur=([^;]+)/);
  if (!trouve) return null;
  return await un(env, 'SELECT * FROM joueurs WHERE jeton = ?', trouve[1]);
}

async function mancheCourante(env) {
  return await un(
    env,
    `SELECT m.*, s.libelle AS saison_libelle, s.jeu_argent, s.prix_entree_cts,
            s.reversement_saison_bps, v.code, v.schema_champs
     FROM manches m
     JOIN saisons s ON s.id = m.saison_id
     JOIN verticales v ON v.id = s.verticale_id
     WHERE m.statut IN ('ouverte','fermee')
     ORDER BY m.ouvre_le DESC LIMIT 1`
  );
}

async function biensDeManche(env, mancheId) {
  return await tous(
    env,
    `SELECT b.*, mb.position, p.nom AS partenaire_nom, p.flux_stock
     FROM manche_biens mb
     JOIN biens b ON b.id = mb.bien_id
     JOIN partenaires p ON p.id = b.partenaire_id
     WHERE mb.manche_id = ? ORDER BY mb.position`,
    mancheId
  );
}

const parse = (biens) =>
  biens.map((b) => ({ ...b, attributs: JSON.parse(b.attributs), photos: JSON.parse(b.photos || '[]') }));

async function cagnotteDe(env, saisonId, bps) {
  const r = await un(
    env,
    'SELECT COALESCE(SUM(collecte_cts),0) AS total FROM manches WHERE saison_id = ?',
    saisonId
  );
  return Math.floor(((r?.total ?? 0) * bps) / 10000);
}

// ---------------------------------------------------------------- révélation

async function revelerManche(env, mancheId) {
  const manche = await un(env, 'SELECT * FROM manches WHERE id = ?', mancheId);
  if (!manche || manche.statut !== 'fermee') return { ok: false, motif: 'manche non fermée' };

  const biens = await biensDeManche(env, mancheId);
  const participations = await tous(
    env,
    `SELECT p.*, j.pseudo FROM participations p JOIN joueurs j ON j.id = p.joueur_id
     WHERE p.manche_id = ? AND p.statut != 'annulee'`,
    mancheId
  );
  const estimations = await tous(
    env,
    `SELECT e.* FROM estimations e JOIN participations p ON p.id = e.participation_id
     WHERE p.manche_id = ?`,
    mancheId
  );

  const parParticipation = new Map();
  for (const e of estimations) {
    if (!parParticipation.has(e.participation_id)) parParticipation.set(e.participation_id, new Map());
    parParticipation.get(e.participation_id).set(e.bien_id, e.valeur_cts);
  }

  const lignes = participations.map((p) => {
    const { erreur_totale_bps } = scoreManche(parParticipation.get(p.id) || new Map(), biens);
    return { participation_id: p.id, joueur_id: p.joueur_id, erreur_totale_bps };
  });
  const classees = attribuerRangs(lignes);

  for (const l of classees) {
    await executer(
      env,
      `INSERT INTO scores (participation_id, erreur_totale_bps, rang) VALUES (?,?,?)
       ON CONFLICT(participation_id) DO UPDATE SET erreur_totale_bps=excluded.erreur_totale_bps,
       rang=excluded.rang`,
      l.participation_id,
      l.erreur_totale_bps,
      l.rang
    );
    await executer(
      env,
      `INSERT INTO classements (saison_id, joueur_id, manches_jouees, erreur_cumulee_bps)
       VALUES (?,?,1,?)
       ON CONFLICT(saison_id, joueur_id) DO UPDATE SET
         manches_jouees = manches_jouees + 1,
         erreur_cumulee_bps = erreur_cumulee_bps + excluded.erreur_cumulee_bps`,
      manche.saison_id,
      l.joueur_id,
      l.erreur_totale_bps
    );
  }

  const saison = await un(env, 'SELECT nb_manches FROM saisons WHERE id = ?', manche.saison_id);
  await executer(
    env,
    'UPDATE classements SET eligible = (manches_jouees >= ?) WHERE saison_id = ?',
    saison.nb_manches,
    manche.saison_id
  );

  for (const bien of biens) {
    await executer(env, "UPDATE biens SET statut = 'brule' WHERE id = ?", bien.id);
  }
  await executer(
    env,
    "UPDATE manches SET statut='revelee', revele_le=?, nb_participants=? WHERE id=?",
    maintenant(),
    classees.length,
    mancheId
  );
  await journaliser(env, 'admin', 'reveler', 'manche', mancheId, { participants: classees.length });
  return { ok: true, participants: classees.length };
}

// ---------------------------------------------------------------- routes

async function routerPublic(requete, env, url) {
  const chemin = url.pathname;
  const joueur = await joueurCourant(requete, env);

  if (chemin === '/') {
    const manche = await mancheCourante(env);
    if (!manche) return reponseHtml(vueJoueur.accueil({ manche: null }));
    const biens = await biensDeManche(env, manche.id);
    const cagnotte = manche.jeu_argent
      ? await cagnotteDe(env, manche.saison_id, manche.reversement_saison_bps)
      : 0;
    const inscrit = joueur
      ? Boolean(await un(env, 'SELECT id FROM participations WHERE manche_id=? AND joueur_id=?',
          manche.id, joueur.id))
      : false;
    return reponseHtml(
      vueJoueur.accueil({
        saison: { libelle: manche.saison_libelle, jeu_argent: manche.jeu_argent },
        manche, biens, cagnotte, participants: manche.nb_participants, inscrit,
      })
    );
  }

  if (chemin === '/rejoindre') {
    if (requete.method === 'GET') return reponseHtml(vueJoueur.inscription(null));
    const form = await requete.formData();
    const pseudo = String(form.get('pseudo') || '').trim().slice(0, 30);
    const courriel = String(form.get('courriel') || '').trim().toLowerCase();
    if (!pseudo || !courriel.includes('@')) {
      return reponseHtml(vueJoueur.inscription('Pseudo et courriel valides requis.'), 400);
    }
    let existant = await un(env, 'SELECT * FROM joueurs WHERE courriel = ?', courriel);
    if (!existant) {
      const jeton = jetonAleatoire();
      await executer(
        env,
        'INSERT INTO joueurs (courriel, pseudo, jeton, cree_le) VALUES (?,?,?,?)',
        courriel, pseudo, jeton, maintenant()
      );
      existant = { jeton };
    } else if (!existant.jeton) {
      const jeton = jetonAleatoire();
      await executer(env, 'UPDATE joueurs SET jeton = ? WHERE id = ?', jeton, existant.id);
      existant = { jeton };
    }
    return redirection('/manche', {
      'Set-Cookie': `joueur=${existant.jeton}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7776000`,
    });
  }

  if (chemin === '/manche') {
    const manche = await mancheCourante(env);
    if (!manche || manche.statut !== 'ouverte') {
      return reponseHtml(vueJoueur.messageSimple('Manche fermée', "Cette manche n'accepte plus d'estimations."));
    }
    if (!joueur) return redirection('/rejoindre');

    let participation = await un(
      env, 'SELECT * FROM participations WHERE manche_id=? AND joueur_id=?', manche.id, joueur.id
    );

    if (requete.method === 'POST') {
      if (!participation) {
        await executer(
          env,
          'INSERT INTO participations (manche_id, joueur_id, montant_cts, statut) VALUES (?,?,?,?)',
          manche.id, joueur.id, manche.prix_entree_cts, 'ouverte'
        );
        participation = await un(
          env, 'SELECT * FROM participations WHERE manche_id=? AND joueur_id=?', manche.id, joueur.id
        );
        await executer(
          env,
          'UPDATE manches SET nb_participants = nb_participants + 1, collecte_cts = collecte_cts + ? WHERE id = ?',
          manche.prix_entree_cts, manche.id
        );
      }
      const form = await requete.formData();
      const biens = await biensDeManche(env, manche.id);
      for (const bien of biens) {
        const brut = form.get(`bien_${bien.id}`);
        if (brut === null || String(brut).trim() === '') continue;
        const francs = Number(brut);
        if (!Number.isFinite(francs) || francs < 0) continue;
        await executer(
          env,
          `INSERT INTO estimations (participation_id, bien_id, valeur_cts, saisi_le)
           VALUES (?,?,?,?)
           ON CONFLICT(participation_id, bien_id) DO UPDATE SET
             valeur_cts = excluded.valeur_cts, saisi_le = excluded.saisi_le`,
          participation.id, bien.id, Math.round(francs * 100), maintenant()
        );
      }
      await executer(
        env, "UPDATE participations SET soumis_le=?, statut='soumise' WHERE id=?",
        maintenant(), participation.id
      );
      return reponseHtml(
        vueJoueur.messageSimple('Estimations enregistrées',
          'Tu peux revenir les corriger jusqu\'à la clôture de la manche.')
      );
    }

    const biens = parse(await biensDeManche(env, manche.id));
    const valeurs = {};
    if (participation) {
      for (const e of await tous(env, 'SELECT * FROM estimations WHERE participation_id = ?', participation.id)) {
        valeurs[e.bien_id] = e.valeur_cts;
      }
    }
    return reponseHtml(
      vueJoueur.formulaireManche({
        manche, biens, schema: JSON.parse(manche.schema_champs), code: manche.code, valeurs,
      })
    );
  }

  const mResultats = chemin.match(/^\/resultats\/(\d+)$/);
  if (mResultats) {
    const id = Number(mResultats[1]);
    const manche = await un(
      env,
      `SELECT m.*, v.code, v.schema_champs FROM manches m
       JOIN saisons s ON s.id=m.saison_id JOIN verticales v ON v.id=s.verticale_id WHERE m.id=?`,
      id
    );
    if (!manche || manche.statut !== 'revelee') {
      return reponseHtml(vueJoueur.messageSimple('Pas encore', 'Les résultats ne sont pas publiés.'), 404);
    }
    const biens = parse(await biensDeManche(env, id));
    const lignes = await tous(
      env,
      `SELECT sc.rang, sc.erreur_totale_bps, j.pseudo, p.joueur_id
       FROM scores sc JOIN participations p ON p.id = sc.participation_id
       JOIN joueurs j ON j.id = p.joueur_id WHERE p.manche_id = ? ORDER BY sc.rang`,
      id
    );
    const estimations = await tous(
      env,
      `SELECT e.bien_id, e.valeur_cts FROM estimations e
       JOIN participations p ON p.id = e.participation_id WHERE p.manche_id = ?`,
      id
    );
    const parBien = new Map();
    for (const e of estimations) {
      if (!parBien.has(e.bien_id)) parBien.set(e.bien_id, []);
      parBien.get(e.bien_id).push(e.valeur_cts);
    }
    const biensParId = new Map(biens.map((b) => [b.id, b]));
    const monScore = joueur ? lignes.find((l) => l.joueur_id === joueur.id) : null;
    return reponseHtml(
      vueJoueur.resultats({
        manche, lignes, monScore,
        debriefLignes: debrief(biens, parBien).filter((d) => d.mediane_cts !== null),
        biensParId, code: manche.code, schema: JSON.parse(manche.schema_champs),
      })
    );
  }

  const mClassement = chemin.match(/^\/classement\/(\d+)$/);
  if (mClassement) {
    const id = Number(mClassement[1]);
    const saison = await un(env, 'SELECT * FROM saisons WHERE id = ?', id);
    if (!saison) return reponseHtml(vueJoueur.messageSimple('Introuvable', 'Saison inconnue.'), 404);
    const lignes = attribuerRangs(
      (await tous(
        env,
        `SELECT c.*, j.pseudo FROM classements c JOIN joueurs j ON j.id = c.joueur_id
         WHERE c.saison_id = ?`,
        id
      )).map((l) => ({ ...l, erreur_totale_bps: l.erreur_cumulee_bps }))
    );
    return reponseHtml(vueJoueur.classement({ saison, lignes }));
  }

  const mVerif = chemin.match(/^\/verification\/(\d+)$/);
  if (mVerif) {
    const id = Number(mVerif[1]);
    const manche = await un(env, 'SELECT * FROM manches WHERE id = ?', id);
    if (!manche) return reponseHtml(vueJoueur.messageSimple('Introuvable', 'Manche inconnue.'), 404);
    let charge = '';
    let valide = false;
    if (manche.revele_le) {
      charge = chargeCanonique(await biensDeManche(env, id));
      valide = await verifier(manche.sel, charge, manche.empreinte);
    }
    return reponseHtml(vueJoueur.verification({ manche, charge, valide }));
  }

  if (chemin === '/entrainement') {
    return reponseHtml(
      vueJoueur.messageSimple('Entraînement',
        'Le mode entraînement libre arrive avec la prochaine version.')
    );
  }

  return null;
}

async function routerPartenaire(requete, env, url) {
  const trouve = url.pathname.match(/^\/partenaire\/([a-f0-9]{32})$/);
  if (!trouve) return null;
  const partenaire = await un(env, 'SELECT * FROM partenaires WHERE jeton = ? AND active = 1', trouve[1]);
  if (!partenaire) return reponseHtml(vueJoueur.messageSimple('Lien invalide', 'Ce lien n\'est plus actif.'), 404);
  const verticale = await un(env, 'SELECT * FROM verticales WHERE id = ?', partenaire.verticale_id);
  const schema = JSON.parse(verticale.schema_champs);
  let message = null;

  if (requete.method === 'POST') {
    const form = await requete.formData();
    const attributs = {};
    for (const c of schema) {
      const v = form.get(c.cle);
      if (v !== null && String(v).trim() !== '') attributs[c.cle] = String(v).trim();
    }
    const prix = Math.round(Number(form.get('prix')) * 100);
    const reference = form.get('reference') ? Math.round(Number(form.get('reference')) * 100) : null;
    const venduLe = String(form.get('vendu_le') || '');
    if (!Number.isFinite(prix) || prix <= 0 || !venduLe) {
      message = 'Prix et date de vente obligatoires.';
    } else {
      try {
        await executer(
          env,
          `INSERT INTO biens (verticale_id, partenaire_id, attributs, prix_reel_cts, vendu_le,
             valeur_reference_cts, ecart_reference_bps, statut, cree_le)
           VALUES (?,?,?,?,?,?,?,'brouillon',?)`,
          partenaire.verticale_id, partenaire.id, JSON.stringify(attributs), prix, venduLe,
          reference, ecartReferenceBps(prix, reference), maintenant()
        );
        message = 'Enregistré. Merci.';
      } catch {
        message = 'Ce bien semble déjà avoir été envoyé.';
      }
    }
  }

  const recents = await tous(
    env,
    'SELECT * FROM biens WHERE partenaire_id = ? ORDER BY id DESC LIMIT 10',
    partenaire.id
  );
  return reponseHtml(vuePartenaire.formulaire({ partenaire, verticale, schema, recents, message }));
}

async function routerAdmin(requete, env, url) {
  const chemin = url.pathname;
  if (!chemin.startsWith('/admin')) return null;

  if (chemin === '/admin/connexion') {
    if (requete.method === 'GET') return reponseHtml(vueAdmin.connexion(null));
    const form = await requete.formData();
    if (String(form.get('code')) === env.CODE_ADMIN) {
      return redirection('/admin', { 'Set-Cookie': cookieAcces(env.CODE_ADMIN) });
    }
    return reponseHtml(vueAdmin.connexion('Code incorrect.'), 401);
  }
  if (!estAdmin(requete, env)) return redirection('/admin/connexion');

  const base = url.origin;

  if (chemin === '/admin') {
    const verticales = await tous(env, 'SELECT * FROM verticales WHERE active = 1');
    const saisons = await tous(
      env,
      `SELECT s.*, v.code FROM saisons s JOIN verticales v ON v.id = s.verticale_id ORDER BY s.id DESC`
    );
    const manches = await tous(
      env,
      `SELECT m.*, s.libelle AS saison_libelle FROM manches m JOIN saisons s ON s.id = m.saison_id
       ORDER BY m.id DESC LIMIT 10`
    );
    const stats = {
      biens_valides: (await un(env, "SELECT COUNT(*) n FROM biens WHERE statut='valide'")).n,
      biens_attente: (await un(env, "SELECT COUNT(*) n FROM biens WHERE statut='brouillon'")).n,
      partenaires: (await un(env, 'SELECT COUNT(*) n FROM partenaires WHERE active=1')).n,
      joueurs: (await un(env, 'SELECT COUNT(*) n FROM joueurs')).n,
    };
    return reponseHtml(vueAdmin.tableauBord({ verticales, saisons, manches, stats }));
  }

  if (chemin === '/admin/biens') {
    const filtre = url.searchParams.get('statut') || 'brouillon';
    const biens = await tous(
      env,
      `SELECT b.*, p.nom AS partenaire_nom, v.code FROM biens b
       JOIN partenaires p ON p.id = b.partenaire_id JOIN verticales v ON v.id = b.verticale_id
       WHERE b.statut = ? ORDER BY b.id DESC LIMIT 200`,
      filtre
    );
    return reponseHtml(vueAdmin.listeBiens({ biens, filtre }));
  }

  const mValider = chemin.match(/^\/admin\/bien\/(\d+)\/valider$/);
  if (mValider) {
    await executer(env, "UPDATE biens SET statut='valide' WHERE id=? AND statut='brouillon'", Number(mValider[1]));
    await journaliser(env, 'admin', 'valider_bien', 'bien', Number(mValider[1]));
    return redirection('/admin/biens?statut=brouillon');
  }

  if (chemin === '/admin/partenaires') {
    if (requete.method === 'POST') {
      const form = await requete.formData();
      await executer(
        env,
        'INSERT INTO partenaires (verticale_id, nom, courriel, type, jeton, cree_le) VALUES (?,?,?,?,?,?)',
        Number(form.get('verticale_id')), String(form.get('nom')), String(form.get('courriel') || ''),
        String(form.get('type')), jetonAleatoire(), maintenant()
      );
      return redirection('/admin/partenaires');
    }
    const partenaires = await tous(
      env,
      `SELECT p.*, (SELECT COUNT(*) FROM biens b WHERE b.partenaire_id = p.id) AS nb_biens
       FROM partenaires p ORDER BY p.nom`
    );
    return reponseHtml(vueAdmin.listePartenaires({ partenaires, base }));
  }

  if (chemin === '/admin/saison/nouvelle') {
    if (requete.method === 'POST') {
      const form = await requete.formData();
      await executer(
        env,
        `INSERT INTO saisons (verticale_id, libelle, genre, jeu_argent, prix_entree_cts, nb_manches, statut, debute_le)
         VALUES (?,?,?,?,?,?, 'ouverte', ?)`,
        Number(form.get('verticale_id')), String(form.get('libelle')), 'gratuite', 0, 0,
        Number(form.get('nb_manches') || 4), maintenant()
      );
      return redirection('/admin');
    }
    return reponseHtml(
      vueAdmin.connexion(null).replace('Back office', 'Nouvelle saison')
    );
  }

  if (chemin === '/admin/manche/nouvelle') {
    const saisons = await tous(env, "SELECT * FROM saisons WHERE statut='ouverte'");
    const verticale = await un(env, 'SELECT * FROM verticales WHERE id = 1');
    const disponibles = await tous(
      env,
      `SELECT b.*, p.nom AS partenaire_nom FROM biens b JOIN partenaires p ON p.id = b.partenaire_id
       WHERE b.statut='valide' ORDER BY b.id DESC LIMIT 100`
    );
    if (requete.method === 'GET') {
      return reponseHtml(
        vueAdmin.constructeur({ verticale, biens: disponibles, selection: [], controle: null, saisons })
      );
    }
    const form = await requete.formData();
    const choisis = form.getAll('bien').map(Number).filter(Number.isInteger);
    const attendus = Number(form.get('attendus') || 0);
    // Charger par identifiant sans filtrer sur le statut : un bien invalide doit
    // être refusé bruyamment, jamais retiré en silence de la sélection.
    const selection = choisis.length
      ? await tous(
          env,
          `SELECT b.*, p.nom AS partenaire_nom FROM biens b
           JOIN partenaires p ON p.id = b.partenaire_id
           WHERE b.id IN (${choisis.map(() => '?').join(',')})`,
          ...choisis
        )
      : [];
    if (selection.length !== choisis.length) {
      return reponseHtml(
        vueAdmin.constructeur({
          verticale, biens: disponibles, selection: choisis, saisons,
          controle: { valide: false, bloquants: ['Un bien sélectionné est introuvable.'], avertissements: [] },
        })
      );
    }
    const controle = controlerManche(selection, { participantsAttendus: attendus });
    if (String(form.get('action')) !== 'sceller' || !controle.valide) {
      return reponseHtml(
        vueAdmin.constructeur({ verticale, biens: disponibles, selection: choisis, controle, saisons })
      );
    }
    const saisonId = Number(form.get('saison_id'));
    const rang = ((await un(env, 'SELECT COALESCE(MAX(rang),0) r FROM manches WHERE saison_id=?', saisonId)).r) + 1;
    const { sel, empreinte } = await sceller(selection);
    await executer(
      env,
      "INSERT INTO manches (saison_id, rang, empreinte, sel, statut) VALUES (?,?,?,?,'scellee')",
      saisonId, rang, empreinte, sel
    );
    const manche = await un(env, 'SELECT * FROM manches WHERE saison_id=? AND rang=?', saisonId, rang);
    let position = 1;
    for (const bien of selection) {
      await executer(
        env, 'INSERT INTO manche_biens (manche_id, bien_id, position) VALUES (?,?,?)',
        manche.id, bien.id, position++
      );
    }
    await journaliser(env, 'admin', 'sceller', 'manche', manche.id, { empreinte, biens: selection.length });
    return redirection(`/admin/manche/${manche.id}`);
  }

  const mAction = chemin.match(/^\/admin\/manche\/(\d+)\/(ouvrir|fermer|reveler)$/);
  if (mAction) {
    const id = Number(mAction[1]);
    if (mAction[2] === 'ouvrir') {
      await executer(env, "UPDATE manches SET statut='ouverte', ouvre_le=? WHERE id=? AND statut='scellee'", maintenant(), id);
      await journaliser(env, 'admin', 'ouvrir', 'manche', id);
    } else if (mAction[2] === 'fermer') {
      await executer(env, "UPDATE manches SET statut='fermee', ferme_le=? WHERE id=? AND statut='ouverte'", maintenant(), id);
      await journaliser(env, 'admin', 'fermer', 'manche', id);
    } else {
      await revelerManche(env, id);
    }
    return redirection(`/admin/manche/${id}`);
  }

  const mDetail = chemin.match(/^\/admin\/manche\/(\d+)$/);
  if (mDetail) {
    const id = Number(mDetail[1]);
    const manche = await un(
      env,
      `SELECT m.*, s.libelle AS saison_libelle FROM manches m JOIN saisons s ON s.id=m.saison_id WHERE m.id=?`,
      id
    );
    if (!manche) return reponseHtml(vueJoueur.messageSimple('Introuvable', 'Manche inconnue.'), 404);
    const biens = await biensDeManche(env, id);
    return reponseHtml(
      vueAdmin.detailManche({ manche, biens, concentration: concentrationPartenaires(biens), base })
    );
  }

  if (chemin === '/admin/stats') {
    const lignes = await tous(
      env,
      `SELECT v.libelle, COUNT(DISTINCT b.id) AS nb,
              CAST(AVG(ABS(b.ecart_reference_bps)) AS INTEGER) AS ecart_moyen_bps
       FROM biens b JOIN verticales v ON v.id = b.verticale_id
       WHERE b.ecart_reference_bps IS NOT NULL GROUP BY v.id`
    );
    return reponseHtml(vueAdmin.statistiques({ lignes }));
  }

  return null;
}

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    if (url.pathname === '/sante') {
      return new Response(JSON.stringify({ version: VERSION, ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      return (
        (await routerAdmin(requete, env, url)) ??
        (await routerPartenaire(requete, env, url)) ??
        (await routerPublic(requete, env, url)) ??
        reponseHtml(vueJoueur.messageSimple('Page inconnue', 'Cette adresse n\'existe pas.'), 404)
      );
    } catch (erreur) {
      return reponseHtml(
        vueJoueur.messageSimple('Erreur', String(erreur && erreur.message ? erreur.message : erreur)),
        500
      );
    }
  },
};

export { revelerManche, PLAFOND_ERREUR_BPS };
