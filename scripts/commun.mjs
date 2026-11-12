// Outils partagés par les scripts du skill blog-en-video.
// Aucun réglage propre à un site ici : tout vient de blog-video.config.json
// (à la racine du projet où le skill est lancé) ou des options de la commande.
import fs from "node:fs";
import path from "node:path";

/** Racine du projet : le dossier depuis lequel la commande est lancée. */
export const RACINE = process.cwd();

export function option(nom, defaut) {
  const args = process.argv.slice(2);
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith("--") ? args[i + 1] : defaut;
}
export const drapeau = (nom) => process.argv.slice(2).includes(nom);

export function arreter(message, code = 1) {
  console.error(`✗ ${message}`);
  process.exit(code);
}

/** Réglages du site (facultatifs) : blog-video.config.json à la racine du projet. */
export function lireConfig() {
  const f = path.join(RACINE, "blog-video.config.json");
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    arreter(`blog-video.config.json illisible : ${e.message}`);
  }
}

/** Nom de dossier sûr : minuscules, sans accents, tirets. */
export function slugifier(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Dossier de travail d'une vidéo : .blog-video/<nom>/ dans le projet. */
export function dossierTravail(nom) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(nom || "")) arreter("Nom invalide (minuscules, chiffres et tirets).");
  const d = path.join(RACINE, ".blog-video", nom);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
