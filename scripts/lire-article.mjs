// Lit un article (page web publique ou fichier local) et écrit .blog-video/<nom>/article.json.
//   node <skill>/scripts/lire-article.mjs --url https://monsite.com/blog/mon-article/ [--nom mon-article]
//   node <skill>/scripts/lire-article.mjs --fichier contenu/mon-article.md [--nom mon-article]
//   node <skill>/scripts/lire-article.mjs --liste [https://monsite.com/rss.xml]   (flux RSS/Atom ou sitemap)
//
// Aucune dépendance : fetch + extraction simple (balises meta, JSON-LD, <article>/<main>).
import fs from "node:fs";
import path from "node:path";
import { option, drapeau, arreter, lireConfig, slugifier, dossierTravail } from "./commun.mjs";

const AGENT = "blog-en-video/1.0 (+skill Claude Code)";
const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ugrave: "ù", ocirc: "ô", icirc: "î" };
const decoder = (s) =>
  String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITES[n.toLowerCase()] ?? m);

async function telecharger(url) {
  let rep;
  try {
    rep = await fetch(url, { headers: { "User-Agent": AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, redirect: "follow" });
  } catch (e) {
    arreter(`Impossible de joindre ${url} : ${e.cause?.message || e.message}`, 2);
  }
  if (!rep.ok) arreter(`${url} → HTTP ${rep.status}`, 2);
  return { texte: await rep.text(), url: rep.url };
}

const meta = (html, cle) => {
  const balises = html.match(/<meta\b[^>]*>/gi) || [];
  for (const b of balises) {
    if (new RegExp(`(?:property|name)\\s*=\\s*["']${cle}["']`, "i").test(b)) {
      const c = b.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i);
      if (c) return decoder(c[1] ?? c[2]).trim();
    }
  }
  return "";
};

/** Article/BlogPosting du JSON-LD, s'il existe. */
function jsonLd(html) {
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const racine = JSON.parse(m[1]);
      const noeuds = [racine, ...(racine["@graph"] || []), ...(Array.isArray(racine) ? racine : [])];
      const a = noeuds.find((n) => /Article|BlogPosting/i.test([].concat(n?.["@type"] || []).join(" ")));
      if (a) return a;
    } catch { /* JSON-LD invalide : ignoré */ }
  }
  return {};
}

/** HTML → texte lisible (titres « ## », listes « - »). */
function versTexte(html) {
  let h = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const b of ["script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form", "iframe", "button", "figure"])
    h = h.replace(new RegExp(`<${b}\\b[\\s\\S]*?<\\/${b}>`, "gi"), " ");
  const bloc = h.match(/<article\b[\s\S]*<\/article>/i) || h.match(/<main\b[\s\S]*<\/main>/i) || h.match(/<body\b[\s\S]*<\/body>/i);
  h = bloc ? bloc[0] : h;
  h = h
    .replace(/<h1\b[^>]*>/gi, "\n\n# ")
    .replace(/<h2\b[^>]*>/gi, "\n\n## ")
    .replace(/<h[3-6]\b[^>]*>/gi, "\n\n### ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/blockquote|\/section)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decoder(h).replace(/[ \t\r]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Liste des articles (RSS, Atom ou sitemap) ─────────────────────────
if (drapeau("--liste")) {
  const conf = lireConfig();
  const flux = option("--liste", conf.flux);
  if (!flux) arreter("Indiquez l'adresse du flux RSS ou du sitemap : --liste <url> (ou « flux » dans blog-video.config.json).");
  const { texte } = await telecharger(flux);
  const items = [...texte.matchAll(/<(item|entry|url)\b[\s\S]*?<\/\1>/gi)].map((m) => {
    const b = m[0];
    const lien = (b.match(/<link>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i) || b.match(/<link[^>]*href\s*=\s*["']([^"']+)/i) || b.match(/<loc>\s*([^<\s]+)/i) || [])[1];
    const titre = decoder((b.match(/<title[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/i) || [])[1] || "").trim();
    const date = (b.match(/<(?:pubDate|published|updated|lastmod)>\s*([^<]+)/i) || [])[1] || "";
    return { lien: decoder(lien || ""), titre, date: date.trim() };
  }).filter((i) => i.lien);
  if (!items.length) arreter("Aucun article trouvé dans ce flux.");
  for (const i of items.slice(0, Number(option("--max", 15)))) console.log(`${i.lien}${i.date ? `  (${i.date.slice(0, 16)})` : ""}${i.titre ? `\n   ${i.titre}` : ""}`);
  process.exit(0);
}

// ── Lecture d'un article ──────────────────────────────────────────────
const url = option("--url");
const fichier = option("--fichier");
if (!url && !fichier) arreter("Indiquez --url <adresse de l'article>, --fichier <chemin> ou --liste.");

let article;
if (url) {
  const { texte: html, url: finale } = await telecharger(url);
  const ld = jsonLd(html);
  const image = [].concat(ld.image || [])[0];
  const contenuHtml = versTexte(html);
  const contenu = typeof ld.articleBody === "string" && ld.articleBody.length > contenuHtml.length / 2 ? ld.articleBody : contenuHtml;
  article = {
    url: (html.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)/i) || [])[1] || finale,
    titre: decoder(ld.headline || "") || meta(html, "og:title") || decoder((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim(),
    extrait: decoder(ld.description || "") || meta(html, "og:description") || meta(html, "description"),
    image_url: (typeof image === "string" ? image : image?.url) || meta(html, "og:image") || null,
    langue: (html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)/i) || [])[1] || ld.inLanguage || "",
    contenu,
  };
  if (article.image_url) article.image_url = new URL(article.image_url, finale).href;
} else {
  if (!fs.existsSync(fichier)) arreter(`Fichier introuvable : ${fichier}`);
  const brut = fs.readFileSync(fichier, "utf8").replace(/\r\n/g, "\n");
  const estHtml = /\.html?$/i.test(fichier);
  const contenu = estHtml ? versTexte(brut) : brut;
  const lire = (cle) => (brut.match(new RegExp(`^\\s*"?${cle}"?\\s*[:=]\\s*"?(.+?)"?,?\\s*$`, "mi")) || [])[1] || "";
  article = {
    url: lire("url") || lire("canonical") || null,
    titre: lire("title") || lire("titre") || (contenu.match(/^#\s+(.+)$/m) || [])[1] || path.basename(fichier).replace(/\.[^.]+$/, ""),
    extrait: lire("description") || lire("extrait") || "",
    image_url: /^https?:/.test(lire("image")) ? lire("image") : null,
    langue: lire("lang") || lire("langue") || "",
    contenu,
    fichier: path.resolve(fichier),
  };
}

const mots = article.contenu.split(/\s+/).filter(Boolean).length;
const nom = slugifier(option("--nom") || (url ? new URL(article.url || url).pathname.split("/").filter(Boolean).pop() : path.basename(fichier).replace(/\.[^.]+$/, "")) || article.titre);
if (!nom) arreter("Impossible de déduire un nom : ajoutez --nom <nom>.");
const sortie = path.join(dossierTravail(nom), "article.json");
fs.writeFileSync(sortie, JSON.stringify({ nom, ...article }, null, 2));
console.log(`✓ ${article.titre || "(sans titre)"}\n  ${mots} mots · image : ${article.image_url ? "oui" : "non"} · langue : ${article.langue || "?"}\n  nom : ${nom}\n  → ${sortie}`);
if (mots < 120) console.warn("⚠ Très peu de texte extrait : la page est peut-être rendue en JavaScript. Lisez-la autrement (WebFetch, fichier source) et complétez article.json.");
