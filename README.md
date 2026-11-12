# blog-en-video

Un skill pour [Claude Code](https://claude.com/claude-code) qui transforme les articles de votre blog en vidéos verticales courtes (TikTok, Instagram Reels, Facebook, YouTube Shorts), les publie, puis ajoute le lien YouTube à l'article.

Il fonctionne avec n'importe quel site : Claude lit l'article depuis sa page publique ou depuis son fichier source.

## Ce qu'il fait

1. **Lit l'article** (URL, fichier Markdown/HTML, ou liste depuis votre flux RSS ou sitemap).
2. **Écrit le scénario** : une accroche, 3 à 5 points clés, une fin qui renvoie vers l'article, et une légende par réseau.
3. **Monte la vidéo** en 1080×1920 avec ffmpeg, à vos couleurs, avec au choix :
   - **votre propre audio** (`--audio ma-voix.mp3`) ;
   - une **voix off automatique** (edge-tts, gratuit) ;
   - une vidéo muette, avec ou sans musique de fond (`--musique`).
4. **Publie** via l'outil de publication relié à votre Claude Code (connecteur MCP ou commande). Sans outil relié, il vous remet la vidéo et les légendes.
5. **Ajoute le lien YouTube** à l'article, selon la méthode propre à votre site.

Claude vous montre toujours le scénario et les légendes, et attend votre accord avant de publier.

## Installation

Copiez ce dossier dans votre projet (ou dans `~/.claude/skills/` pour l'avoir partout) :

```bash
git clone https://github.com/Miracle-Zidouemba/blog-to-video.git .claude/skills/blog-en-video
```

Prérequis :

```bash
# Node.js 20+ et ffmpeg doivent être installés
npm install playwright && npx playwright install chromium
pip install edge-tts        # seulement pour la voix off automatique
```

Ajoutez `.blog-video/` à votre `.gitignore`.

## Utilisation

Dans Claude Code, à la racine de votre projet :

> Convertis cet article en vidéo : https://monsite.com/blog/mon-article/

> Fais une vidéo de mon dernier article avec mon audio `enregistrements/voix.mp3`

> /blog-en-video

Au premier lancement, Claude « connecte » votre site : il crée `blog-video.config.json` à la racine du projet.

```json
{
  "site": "https://monsite.com",
  "flux": "https://monsite.com/rss.xml",
  "marque": "Mon Site",
  "couleur": "#0f766e",
  "voix": "fr-FR-DeniseNeural",
  "lien_affiche": "monsite.com/blog",
  "publication": "Outil relié à Claude pour publier, et réseaux visés",
  "maj_article": "Comment ajouter le lien YouTube à un article de ce site"
}
```

Tous les champs sont facultatifs. N'y mettez aucune clé ni mot de passe.

## Les scripts, sans Claude

```bash
node scripts/lire-article.mjs --url https://monsite.com/blog/mon-article/
# écrivez .blog-video/mon-article/scenario.json (format dans SKILL.md)
node scripts/rendre-video.mjs --nom mon-article --audio ma-voix.mp3
```

## Limites

- Les pages rendues entièrement en JavaScript sont mal extraites par le script : Claude lit alors l'article par un autre moyen.
- Avec un audio fourni, les images sont calées au prorata du texte de chaque scène. Pour un calage exact, donnez une `duree` aux scènes.
- La publication dépend de l'outil relié à votre Claude Code. Le skill n'embarque aucune clé d'API de réseau social.
- La voix off automatique utilise le service de synthèse vocale de Microsoft Edge et demande une connexion internet.
