---
name: blog-en-video
description: Convertit un article de blog (page web ou fichier) en vidéo verticale courte pour TikTok, Instagram Reels, Facebook et YouTube Shorts, avec la voix de l'utilisateur (audio fourni) ou une voix off automatique, la publie via le connecteur de réseaux sociaux relié à Claude, puis ajoute le lien YouTube à l'article. À utiliser quand l'utilisateur demande de transformer ou convertir un article en vidéo, de faire un Short / Reel / TikTok d'un article, de publier un article sur les réseaux, ou de connecter son site ou son blog pour en tirer des vidéos.
---

# Article de blog → vidéo → réseaux sociaux → lien YouTube dans l'article

Ce skill marche avec n'importe quel site. Les scripts sont dans le dossier `scripts/` de ce skill : dans les commandes ci-dessous, remplace `<skill>` par le chemin de ce dossier de skill. Lance-les **depuis la racine du projet de l'utilisateur**. Les fichiers de travail vont dans `.blog-video/<nom>/` (à ajouter au `.gitignore` du projet).

```
lire-article.mjs → [toi : scenario.json + legendes.json] → rendre-video.mjs → publication → lien YouTube dans l'article
```

Deux façons de travailler, au choix de l'utilisateur :
- **Tout automatique** : tu écris le scénario et la voix off est générée.
- **Avec son audio** : il fournit un enregistrement (mp3, wav, m4a…), et tu cales les images dessus.

S'il n'a rien précisé, demande-lui une seule fois lequel il veut. S'il a dit de tout gérer, ne demande pas.

## Prérequis

Vérifie-les au premier lancement, et installe ce qui manque avec l'accord de l'utilisateur :
- Node.js 20 ou plus, `ffmpeg` et `ffprobe` dans le PATH.
- Playwright avec Chromium : `npm install playwright && npx playwright install chromium`.
- Voix off automatique : `pip install edge-tts` (gratuit, demande internet). Sans lui, la vidéo sort muette et le script le signale.

## Étape 0 — Connecter le site (une seule fois par projet)

Cherche `blog-video.config.json` à la racine du projet. S'il existe, lis-le et passe à l'étape 1. Sinon, crée-le avec l'utilisateur :

```json
{
  "site": "https://monsite.com",
  "flux": "https://monsite.com/rss.xml",
  "marque": "Nom affiché en haut de la vidéo",
  "couleur": "#0f766e",
  "voix": "fr-FR-DeniseNeural",
  "lien_affiche": "monsite.com/blog",
  "publication": "Outil relié à Claude pour publier (ex. Treg), et réseaux visés",
  "maj_article": "Comment ajouter le lien YouTube à un article de ce site"
}
```

- `flux` : le flux RSS/Atom ou le sitemap. Essaie `/rss.xml`, `/feed`, `/sitemap.xml`, ou cherche `<link rel="alternate">` dans la page d'accueil.
- `couleur` : la couleur principale du site (regarde son CSS ou sa balise `theme-color`).
- `maj_article` : explore le projet pour trouver où vivent les articles, puis écris la méthode en clair. Cas courants :
  - fichiers Markdown/MDX/HTML dans le dépôt : indique le dossier et où insérer le lien ou le lecteur ;
  - CMS ou base de données (WordPress, Supabase, Strapi…) : indique le script, la commande ou le connecteur à utiliser ;
  - aucun accès en écriture : écris « manuel », et tu donneras le lien à l'utilisateur.
- Tous les champs sont facultatifs. Ne mets **jamais** de clé ni de mot de passe dans ce fichier.

## Étape 1 — Choisir et lire l'article

Si l'utilisateur n'a pas donné d'article, liste les derniers :
```bash
node <skill>/scripts/lire-article.mjs --liste            # utilise « flux » de la configuration
node <skill>/scripts/lire-article.mjs --liste <url du flux ou du sitemap>
```
Puis lis l'article, depuis sa page publique ou depuis son fichier source :
```bash
node <skill>/scripts/lire-article.mjs --url https://monsite.com/blog/mon-article/
node <skill>/scripts/lire-article.mjs --fichier contenu/mon-article.md
```
Le script affiche le `nom` du dossier de travail et écrit `.blog-video/<nom>/article.json` : `titre`, `extrait`, `contenu`, `image_url`, `langue`, `url`.

Si le script signale très peu de texte (page rendue en JavaScript), lis l'article autrement (outil de lecture web, fichier source du projet) et complète toi-même `contenu` dans `article.json`.

## Étape 2 — Écrire le scénario et les légendes (ton travail)

Écris `.blog-video/<nom>/scenario.json` :

```json
{
  "scenes": [
    { "type": "accroche", "titre": "≤ 9 mots, une promesse ou une question", "voix": "Phrase dite à l'oral" },
    { "type": "point", "titre": "Idée clé (≤ 6 mots)", "texte": "Précision (≤ 14 mots)", "voix": "Ce que dit la voix off" },
    { "type": "fin", "titre": "L'article complet sur le blog", "voix": "L'article complet est sur le blog, lien en description." }
  ]
}
```

Règles :
- 1 `accroche`, puis 3 à 5 `point`, puis 1 `fin`. Durée visée : **30 à 60 s**, soit 110 à 150 mots de voix off. Au-delà de 3 min, ce n'est plus un Short.
- Reste fidèle à l'article : aucun chiffre, prix ou promesse absent du texte.
- Écris dans la langue de l'article. La voix off est de l'oral simple et direct. Le texte à l'écran complète la voix, il ne la répète pas mot pour mot.
- L'accroche a l'image de l'article en fond. Les autres scènes ont un dégradé de la couleur du site.
- Champs facultatifs à la racine, qui priment sur la configuration : `marque`, `couleur`, `voix`, `lien_affiche`.
- Choisis une voix dans la langue de l'article : `python3 -m edge_tts --list-voices` (ex. `fr-FR-DeniseNeural`, `fr-FR-HenriNeural`, `en-US-AriaNeural`).

**Si l'utilisateur fournit son audio** :
- Demande-lui ce qu'il y dit (texte ou plan), ou transcris-le si un outil de transcription est disponible (`whisper`). Découpe les scènes pour suivre son audio : `voix` contient alors ce qu'il dit pendant la scène.
- La durée de l'audio est répartie entre les scènes selon la longueur de leur `voix`. Pour caler une scène précisément, donne-lui `"duree": <secondes>`.

Écris ensuite `.blog-video/<nom>/legendes.json`, avec un texte par réseau visé :

```json
{
  "youtube":   { "titre": "≤ 100 caractères, avec le mot-clé et #Shorts", "texte": "2-3 phrases + lien de l'article + hashtags" },
  "tiktok":    { "texte": "Accroche + 3 à 5 hashtags. « Lien en bio » : TikTok ne rend pas les liens cliquables" },
  "instagram": { "texte": "Accroche + résumé + « lien en bio » + 5 à 10 hashtags" },
  "facebook":  { "texte": "2-3 phrases + lien complet de l'article" }
}
```

**Montre le scénario et les légendes à l'utilisateur et attends son accord avant de publier (étape 4).** Tu peux monter la vidéo sans attendre.

## Étape 3 — Monter la vidéo

```bash
node <skill>/scripts/rendre-video.mjs --nom <nom>                       # voix off automatique
node <skill>/scripts/rendre-video.mjs --nom <nom> --audio ma-voix.mp3   # audio de l'utilisateur
node <skill>/scripts/rendre-video.mjs --nom <nom> --sans-voix           # muette
```
Options : `--voix <nom de voix>`, `--musique fond.mp3` (fond sonore discret, mis en boucle ; l'utilisateur doit en avoir les droits).

Sortie : `video.mp4` (1080×1920, H.264/AAC, 30 i/s), `sous-titres.srt` et `diapos/*.png`.

Vérifie le résultat avant de le montrer : extrais 2 ou 3 images et regarde-les.
`ffmpeg -ss 5 -i .blog-video/<nom>/video.mp4 -frames:v 1 -vf scale=360:-1 apercu.png`

Si un texte déborde, raccourcis-le dans `scenario.json` et relance. Si la voix off n'a pas pu être générée, dis-le à l'utilisateur au lieu de livrer une vidéo muette sans prévenir.

## Étape 4 — Publier (action publique : accord explicite requis)

Ne publie qu'après un « oui » clair de l'utilisateur sur la vidéo et les légendes.

1. Cherche l'outil de publication relié à Claude : celui nommé dans `publication` de la configuration, sinon un connecteur MCP ou une commande de publication sur les réseaux sociaux (Treg, ou un autre). Lis sa description avant de l'appeler.
2. Publie `video.mp4` sur chaque réseau avec le texte de `legendes.json`. Pour YouTube : titre, description, format Short.
3. Récupère le lien de chaque publication et écris `.blog-video/<nom>/publication.json` : `{ "liens": { "youtube": "...", "tiktok": "...", "instagram": "...", "facebook": "..." } }`.

Si aucun outil de publication n'est relié, ne tente pas autre chose : donne à l'utilisateur le chemin de `video.mp4` et les légendes à copier, et demande-lui le lien YouTube une fois la vidéo en ligne.

Ne relance jamais une publication déjà réussie : cela crée des doublons. Ne relance que les réseaux en échec.

## Étape 5 — Ajouter le lien YouTube à l'article

Suis `maj_article` de la configuration. Montre d'abord le changement à l'utilisateur (aperçu ou diff), puis applique-le. Si le site a des règles sur les liens vidéo acceptés, respecte-les.

Sans configuration, cherche l'article dans le projet (fichier source) et insère le lien sous le titre, dans le format que le site utilise déjà pour ses vidéos. Si tu n'as aucun moyen sûr de modifier l'article, donne le lien à l'utilisateur.

## Compte rendu final

- Les liens publiés par réseau, avec les échecs clairement signalés.
- L'article mis à jour, ou ce qui reste à faire à la main.
- La durée de la vidéo et sa bande son : audio fourni, voix automatique ou muette.
