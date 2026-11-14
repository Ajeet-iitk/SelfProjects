# Thumbnails

Drop project screenshots in this folder. The site finds them automatically — no code changes.

## Naming

Use the repo name in any of these forms (`.jpg`, `.png`, `.webp` or `.gif`):

| Repo | Accepted filenames |
| --- | --- |
| `Ajeet-iitk/IndianParliament` | `indian-parliament.jpg`, `IndianParliament.jpg`, `indianparliament.jpg` |
| `Ajeet-iitk/OneWishWillow` | `one-wish-willow.jpg`, `OneWishWillow.jpg`, `onewishwillow.jpg` |
| `Ajeet-iitk/F1.1` | `f1-1.jpg`, `F1.1.jpg`, `f1.1.jpg` |
| `Ajeet-iitk/movie-theme1` | `movie-theme1.jpg` |

The kebab-case form is preferred, and `.jpg` loads fastest.

## Recommended specs

- **Size:** 1280 × 800 px (16:10)
- **Format:** JPEG, quality ~85
- **Weight:** under 250 KB
- **Content:** the title screen or the most recognisable gameplay moment

The card crops to 16:10 anchored at the top, so keep the important content in the upper
two-thirds. Clicking a card opens the full image in a lightbox.

## Fallbacks

If a file is missing, the site tries GitHub's generated repo preview image, then shows a
gradient tile with the project initials. Nothing looks broken while you collect screenshots.

## Auto-capture

From the `portfolio/` folder:

```powershell
powershell -ExecutionPolicy Bypass -File tools/make-thumbnail.ps1 `
  -Url "https://ajeet-iitk.github.io/MyNewGame/" -Name "my-new-game"
```

Writes `thumbnails/my-new-game.jpg` at 1280 × 800 using headless Chrome or Edge.

## Automatic screenshots

You do not have to copy screenshots here. Every hour a GitHub Action
(`.github/workflows/sync-repos.yml`) looks inside each public repository for a
screenshot and saves the result in `assets/data/thumbs.json`. It checks, in order:

1. images used in the repo's `README.md` (screenshot-style names win over badges and logos)
2. image files in the repo, favouring folders like `screenshots/`, `docs/`, `images/`, `assets/`
   and names like `screenshot`, `preview`, `demo`, `cover`, `banner`

A file in this `thumbnails/` folder named after the repo still wins over the automatic one.
