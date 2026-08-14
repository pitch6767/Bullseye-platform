// Scellement des prix réels d'une manche.
// L'empreinte est publiée à l'ouverture, le sel à la révélation.
// N'importe qui recalcule et vérifie que rien n'a bougé.

function hex(tampon) {
  return [...new Uint8Array(tampon)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

// Charge canonique : triée par identifiant de bien, format stable.
export function chargeCanonique(biens) {
  const tries = [...biens].sort((a, b) => a.id - b.id);
  return JSON.stringify(tries.map((b) => ({ id: b.id, prix: b.prix_reel_cts })));
}

export function nouveauSel() {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  return hex(octets.buffer);
}

export async function calculerEmpreinte(sel, charge) {
  const donnees = new TextEncoder().encode(sel + '|' + charge);
  return hex(await crypto.subtle.digest('SHA-256', donnees));
}

export async function sceller(biens) {
  const charge = chargeCanonique(biens);
  const sel = nouveauSel();
  return { sel, charge, empreinte: await calculerEmpreinte(sel, charge) };
}

export async function verifier(sel, charge, empreinte) {
  return (await calculerEmpreinte(sel, charge)) === empreinte;
}
