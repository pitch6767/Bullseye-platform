import './faux.js';
import { sceller, verifier as verifierSceau, chargeCanonique, calculerEmpreinte } from '../src/scellement.js';
import { verifier, bilan } from './faux.js';

const biens = [
  { id: 7, prix_reel_cts: 3150000 },
  { id: 2, prix_reel_cts: 1520000 },
  { id: 5, prix_reel_cts: 3380000 },
];

const charge = chargeCanonique(biens);
verifier(charge === chargeCanonique([...biens].reverse()), 'charge canonique independante de l ordre');
verifier(charge.indexOf('"id":2') < charge.indexOf('"id":5'), 'charge triee par identifiant');

const sceau = await sceller(biens);
verifier(sceau.empreinte.length === 64, 'empreinte SHA-256 sur 64 hex');
verifier(sceau.sel.length === 64, 'sel sur 32 octets');
verifier(await verifierSceau(sceau.sel, sceau.charge, sceau.empreinte), 'verification nominale');

const falsifies = biens.map((b) => (b.id === 7 ? { ...b, prix_reel_cts: 3000000 } : b));
verifier(
  !(await verifierSceau(sceau.sel, chargeCanonique(falsifies), sceau.empreinte)),
  'un prix modifie casse la verification'
);
verifier(
  !(await verifierSceau('0'.repeat(64), sceau.charge, sceau.empreinte)),
  'un mauvais sel casse la verification'
);

const a = await sceller(biens);
const b = await sceller(biens);
verifier(a.empreinte !== b.empreinte, 'deux scellements du meme lot different par le sel');

const e1 = await calculerEmpreinte('sel', 'charge');
const e2 = await calculerEmpreinte('sel', 'charge');
verifier(e1 === e2, 'empreinte deterministe');

bilan('scellement');
