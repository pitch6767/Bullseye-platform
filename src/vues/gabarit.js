import { VERSION, echapper } from '../socle.js';

export const STYLE = `
:root{--fond:#faf9f7;--carte:#fff;--trait:#e3e0d8;--txt:#26241f;--doux:#6f6c64;
--accent:#b03a1f;--vert:#1d7a56;--radius:10px}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--txt);
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.55}
.enveloppe{max-width:720px;margin:0 auto;padding:16px 16px 72px}
header{display:flex;align-items:center;justify-content:space-between;padding:14px 0;
border-bottom:1px solid var(--trait);margin-bottom:20px}
.marque{font-weight:600;font-size:19px;letter-spacing:-.01em}
.marque span{color:var(--accent)}
.version{font-size:11px;color:var(--doux)}
h1{font-size:22px;font-weight:600;margin:0 0 6px}
h2{font-size:17px;font-weight:600;margin:26px 0 10px}
p{margin:0 0 12px}
.doux{color:var(--doux);font-size:14px}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:var(--radius);
padding:16px;margin-bottom:14px}
.cagnotte{text-align:center;padding:26px 16px}
.cagnotte .montant{font-size:40px;font-weight:600;letter-spacing:-.02em;color:var(--accent)}
.cagnotte .legende{font-size:13px;color:var(--doux);margin-top:4px}
.bouton{display:block;width:100%;padding:14px;border:0;border-radius:var(--radius);
background:var(--accent);color:#fff;font-size:16px;font-weight:500;text-align:center;
text-decoration:none;cursor:pointer;margin:10px 0}
.bouton.pale{background:var(--carte);color:var(--txt);border:1px solid var(--trait)}
.bouton.danger{background:#8a2a12}
.champ{width:100%;padding:12px;border:1px solid var(--trait);border-radius:var(--radius);
font-size:16px;background:var(--carte);color:var(--txt);margin-bottom:10px}
label{display:block;font-size:13px;color:var(--doux);margin-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:9px 6px;border-bottom:1px solid var(--trait)}
th{font-weight:500;color:var(--doux);font-size:12px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.etiquette{display:inline-block;padding:2px 8px;border-radius:20px;font-size:12px;
background:#f0eee8;color:var(--doux)}
.etiquette.ok{background:#e4f2eb;color:var(--vert)}
.etiquette.stop{background:#f7e6e1;color:var(--accent)}
.alerte{border-left:3px solid var(--accent);background:#fdf4f1;padding:12px;
border-radius:0 var(--radius) var(--radius) 0;margin-bottom:12px;font-size:14px}
.alerte.info{border-color:var(--vert);background:#eef6f2}
.grille{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat{font-size:24px;font-weight:600}
.fiche{border:1px solid var(--trait);border-radius:var(--radius);background:var(--carte);
padding:14px;margin-bottom:12px}
.fiche .titre{font-weight:600;font-size:16px;margin-bottom:2px}
.fiche .specs{font-size:13px;color:var(--doux);margin-bottom:10px}
.empreinte{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;
color:var(--doux);word-break:break-all}
nav.onglets{display:flex;gap:6px;overflow-x:auto;margin-bottom:16px;padding-bottom:2px}
nav.onglets a{padding:7px 12px;border:1px solid var(--trait);border-radius:20px;
font-size:13px;text-decoration:none;color:var(--txt);background:var(--carte);white-space:nowrap}
nav.onglets a.actif{background:var(--txt);color:var(--fond);border-color:var(--txt)}
`;

export function page({ titre, corps, entete = 'Bullseye', onglets = '' }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)}</title><style>${STYLE}</style></head><body>
<div class="enveloppe">
<header><div class="marque">${entete === 'Bullseye' ? 'Bulls<span>eye</span>' : echapper(entete)}</div>
<div class="version">v${VERSION}</div></header>
${onglets}
${corps}
</div></body></html>`;
}

export function onglets(liens, actif) {
  return (
    '<nav class="onglets">' +
    liens
      .map(
        ([url, libelle]) =>
          `<a href="${url}"${url === actif ? ' class="actif"' : ''}>${echapper(libelle)}</a>`
      )
      .join('') +
    '</nav>'
  );
}
