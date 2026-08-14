export const VERSION = 1;

export const maintenant = () => new Date().toISOString();

export const chf = (cts) =>
  (cts / 100).toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const pourcent = (bps) => (bps / 100).toFixed(1) + ' %';

export const echapper = (valeur) =>
  String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export async function tous(env, sql, ...params) {
  const r = await env.DB.prepare(sql).bind(...params).all();
  return r.results ?? [];
}

export async function un(env, sql, ...params) {
  return await env.DB.prepare(sql).bind(...params).first();
}

export async function executer(env, sql, ...params) {
  return await env.DB.prepare(sql).bind(...params).run();
}

export async function journaliser(env, acteur, action, objetType, objetId, charge) {
  await executer(
    env,
    'INSERT INTO journal (le, acteur, action, objet_type, objet_id, charge) VALUES (?,?,?,?,?,?)',
    maintenant(),
    acteur,
    action,
    objetType ?? null,
    objetId ?? null,
    charge ? JSON.stringify(charge) : null
  );
}

// Garde administrateur. Le code d'accès est une variable Workers, jamais dans le dépôt.
export function estAdmin(requete, env) {
  const cookie = requete.headers.get('Cookie') || '';
  const trouve = cookie.match(/(?:^|;\s*)acces=([^;]+)/);
  return Boolean(env.CODE_ADMIN) && trouve && trouve[1] === env.CODE_ADMIN;
}

export function cookieAcces(code) {
  return `acces=${code}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
}

// Les prix réels ne sortent JAMAIS avant la révélation.
// Filtre appliqué au sérialiseur, pas seulement au contrôleur.
export function bienPublic(bien, revele) {
  const base = {
    id: bien.id,
    position: bien.position,
    attributs: JSON.parse(bien.attributs),
    photos: JSON.parse(bien.photos || '[]'),
  };
  if (!revele) return base;
  return {
    ...base,
    prix_reel_cts: bien.prix_reel_cts,
    partenaire: bien.partenaire_nom,
    flux_stock: bien.flux_stock,
  };
}

export function reponseHtml(corps, statut = 200, entetes = {}) {
  return new Response(corps, {
    status: statut,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...entetes },
  });
}

export function redirection(vers, entetes = {}) {
  return new Response(null, { status: 302, headers: { Location: vers, ...entetes } });
}
