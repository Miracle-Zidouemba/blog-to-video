// Monte la vidéo verticale (1080×1920) d'un article à partir de son scénario.
//   node <skill>/scripts/rendre-video.mjs --nom <nom>                      voix off automatique (edge-tts)
//   node <skill>/scripts/rendre-video.mjs --nom <nom> --audio ma-voix.mp3  audio fourni par l'utilisateur
//   node <skill>/scripts/rendre-video.mjs --nom <nom> --sans-voix          vidéo muette
//   Options : --voix fr-FR-HenriNeural · --musique fond.mp3 (fond sonore discret)
//
// Entrée  : .blog-video/<nom>/scenario.json (écrit par Claude, format dans SKILL.md)
//           .blog-video/<nom>/article.json  (lire-article.mjs, pour l'image de couverture)
// Sortie  : .blog-video/<nom>/video.mp4 + sous-titres.srt + diapos/*.png
//
// Diapositives : HTML rendu par Chromium (Playwright). Montage : ffmpeg.
// Avec --audio, la durée de l'audio est répartie entre les scènes selon la
// longueur de leur texte (ou selon « duree », en secondes, si la scène en a une).
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { option, drapeau, arreter, dossierTravail, lireConfig, RACINE } from "./commun.mjs";

const L = 1080, H = 1920, FPS = 30;
const nom = option("--nom") || arreter("Indiquez --nom <nom> (le nom affiché par lire-article.mjs).");
const dossier = dossierTravail(nom);
const conf = lireConfig();
const lireJson = (f) => {
  const p = path.join(dossier, f);
  if (!fs.existsSync(p)) arreter(`${f} manquant dans ${dossier}.`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
};
const scenario = lireJson("scenario.json");
const article = fs.existsSync(path.join(dossier, "article.json")) ? lireJson("article.json") : {};
const scenes = scenario.scenes || [];
if (scenes.length < 2) arreter("Le scénario doit contenir au moins 2 scènes.");
const voixNom = option("--voix", scenario.voix || conf.voix || "fr-FR-DeniseNeural");
const audioFourni = option("--audio", scenario.audio);
const musique = option("--musique", scenario.musique || conf.musique);
for (const f of [audioFourni, musique]) if (f && !fs.existsSync(f)) arreter(`Fichier audio introuvable : ${f}`);
const hote = (() => { try { return new URL(article.url || conf.site).hostname.replace(/^www\./, ""); } catch { return ""; } })();

for (const outil of ["ffmpeg", "ffprobe"])
  if (spawnSync(outil, ["-version"]).status !== 0) arreter(`${outil} est introuvable : installez ffmpeg.`);

const echapper = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const couleur = /^#[0-9a-f]{3,8}$/i.test(scenario.couleur || conf.couleur || "") ? scenario.couleur || conf.couleur : "#0f766e";

function htmlScene(s, i) {
  const fond = s.type === "accroche" && article.image_url
    ? `background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.85)),url("${echapper(article.image_url)}") center/cover,linear-gradient(160deg,${couleur},#0b1220);`
    : `background:linear-gradient(160deg,${couleur},#0b1220);`;
  const numero = s.type === "point" ? `<div class="num">${scenes.slice(0, i + 1).filter((x) => x.type === "point").length}</div>` : "";
  const lien = scenario.lien_affiche || conf.lien_affiche || hote;
  const pied = s.type === "fin" && lien ? `<div class="lien">${echapper(lien)}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box}
    body{width:${L}px;height:${H}px;${fond}font-family:"Inter","Segoe UI",Roboto,Arial,sans-serif;color:#fff;
      display:flex;flex-direction:column;justify-content:${s.type === "accroche" ? "flex-end" : "center"};padding:140px 90px 260px}
    .num{width:120px;height:120px;border-radius:50%;background:#fff;color:${couleur};font-size:68px;font-weight:800;
      display:flex;align-items:center;justify-content:center;margin-bottom:60px}
    h1{font-size:${s.type === "accroche" ? 92 : 80}px;line-height:1.08;font-weight:800;letter-spacing:-1px;text-wrap:balance}
    p{font-size:52px;line-height:1.3;margin-top:44px;opacity:.92;text-wrap:pretty}
    .lien{margin-top:70px;display:inline-block;align-self:flex-start;background:#fff;color:${couleur};font-size:46px;font-weight:700;padding:26px 44px;border-radius:999px}
    .marque{position:absolute;top:80px;left:90px;font-size:38px;font-weight:700;opacity:.85}
  </style></head><body><div class="marque">${echapper(scenario.marque || conf.marque || hote)}</div>
  ${numero}<h1>${echapper(s.titre)}</h1>${s.texte ? `<p>${echapper(s.texte)}</p>` : ""}${pied}</body></html>`;
}

// 1. Diapositives
const dDiapos = path.join(dossier, "diapos");
fs.rmSync(dDiapos, { recursive: true, force: true });
fs.mkdirSync(dDiapos, { recursive: true });
let chromium;
for (const base of [import.meta.url, path.join(RACINE, "package.json")]) {
  try {
    ({ chromium } = createRequire(base)("playwright"));
    break;
  } catch { /* essai suivant */ }
}
if (!chromium) arreter("Playwright est introuvable : lancez « npm install playwright && npx playwright install chromium » dans le projet.");
const navigateur = await chromium.launch().catch((e) => arreter(`Chromium ne démarre pas (${e.message.split("\n")[0]}). Lancez « npx playwright install chromium ».`));
const page = await navigateur.newPage({ viewport: { width: L, height: H }, deviceScaleFactor: 1 });
for (const [i, s] of scenes.entries()) {
  await page.setContent(htmlScene(s, i), { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(dDiapos, `${String(i).padStart(2, "0")}.png`) });
}
await navigateur.close();
console.log(`✓ ${scenes.length} diapositives`);

// 2. Voix off (une piste par scène) et durées
const duree = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
let avecVoix = !drapeau("--sans-voix") && !audioFourni;
const pistes = [];
for (const [i, s] of scenes.entries()) {
  const texte = s.voix || [s.titre, s.texte].filter(Boolean).join(". ");
  const mp3 = path.join(dDiapos, `${String(i).padStart(2, "0")}.mp3`);
  if (avecVoix) {
    const r = spawnSync("python3", ["-m", "edge_tts", "--voice", voixNom, "--text", texte, "--write-media", mp3], { encoding: "utf8" });
    if (r.status !== 0 || !fs.existsSync(mp3) || fs.statSync(mp3).size === 0) {
      console.warn(`⚠ Voix off indisponible (edge-tts : ${(r.stderr || "").trim().split("\n").pop()}). Vidéo muette.`);
      fs.rmSync(mp3, { force: true });
      avecVoix = false;
    }
  }
  const mots = texte.split(/\s+/).length;
  const d = avecVoix ? duree(mp3) + 0.5 : Math.max(2.8, mots / 2.6);
  pistes.push({ texte, mots, fixe: Number(s.duree) > 0 ? Number(s.duree) : 0, mp3: avecVoix ? mp3 : null, d });
}
if (!avecVoix) pistes.forEach((p) => (p.mp3 = null));

// Audio fourni : sa durée est répartie entre les scènes (« duree » imposée, sinon au prorata des mots).
if (audioFourni) {
  const total = duree(audioFourni);
  const fixe = pistes.reduce((n, p) => n + p.fixe, 0);
  const libres = pistes.filter((p) => !p.fixe);
  const motsLibres = libres.reduce((n, p) => n + p.mots, 0) || 1;
  const reste = total - fixe;
  if (reste < libres.length * 1.2) arreter(`Audio trop court (${total.toFixed(1)} s) pour ${pistes.length} scènes : réduisez les scènes ou leurs « duree ».`);
  for (const p of pistes) p.d = p.fixe || (reste * p.mots) / motsLibres;
} else if (!avecVoix) {
  for (const p of pistes) if (p.fixe) p.d = p.fixe;
}

// 3. Segments puis concaténation
const segments = [];
for (const [i, p] of pistes.entries()) {
  const seg = path.join(dDiapos, `seg-${String(i).padStart(2, "0")}.mp4`);
  const images = Math.round(p.d * FPS);
  const entrees = ["-loop", "1", "-framerate", String(FPS), "-i", path.join(dDiapos, `${String(i).padStart(2, "0")}.png`)];
  entrees.push(...(p.mp3 ? ["-i", p.mp3] : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...entrees,
    "-vf", `scale=${L * 2}:${H * 2},zoompan=z='min(1+0.0006*on,1.06)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${images}:s=${L}x${H}:fps=${FPS},format=yuv420p`,
    "-af", "apad", "-t", p.d.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", seg]);
  segments.push(seg);
}
const liste = path.join(dDiapos, "segments.txt");
fs.writeFileSync(liste, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n"));
const video = path.join(dossier, "video.mp4");
const brut = path.join(dDiapos, "montage.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", brut]);

// Bande son finale : audio fourni ou voix off, avec un fond musical discret si demandé.
const son = ["-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2"];
const fin = ["-c:v", "copy", ...son, "-t", duree(brut).toFixed(2), "-movflags", "+faststart", video];
const principal = audioFourni ? ["-i", audioFourni] : [];
const voie = audioFourni ? "1:a" : "0:a";
if (musique) {
  const iM = audioFourni ? 2 : 1;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", brut, ...principal, "-stream_loop", "-1", "-i", musique,
    "-filter_complex", `[${voie}]apad[v];[${iM}:a]volume=${avecVoix || audioFourni ? 0.12 : 0.6}[m];[v][m]amix=inputs=2:duration=first:normalize=0[a]`,
    "-map", "0:v", "-map", "[a]", ...fin]);
} else if (audioFourni) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", brut, ...principal, "-map", "0:v", "-map", "1:a", "-af", "apad", ...fin]);
} else {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", brut, "-c", "copy", "-movflags", "+faststart", video]);
}

// 4. Sous-titres (pour YouTube / Facebook)
const t = (s) => new Date(s * 1000).toISOString().slice(11, 23).replace(".", ",");
let debut = 0;
const srt = pistes.map((p, i) => {
  const bloc = `${i + 1}\n${t(debut)} --> ${t(debut + p.d - 0.2)}\n${p.texte}\n`;
  debut += p.d;
  return bloc;
});
fs.writeFileSync(path.join(dossier, "sous-titres.srt"), srt.join("\n"));

const total = duree(video);
console.log(`✓ ${video}\n  ${total.toFixed(1)} s · ${audioFourni ? `audio fourni (${path.basename(audioFourni)})` : avecVoix ? `voix ${voixNom}` : "muette"}${musique ? " + musique" : ""} · ${(fs.statSync(video).size / 1e6).toFixed(1)} Mo`);
if (total > 180) console.warn("⚠ Plus de 3 min : YouTube la publiera comme vidéo classique et non comme Short ; TikTok et Instagram Reels risquent de la refuser.");
