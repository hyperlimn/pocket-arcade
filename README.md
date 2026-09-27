# Pocket Arcade

Four small 3D browser games. No accounts, no runtime CDN, no game framework. Built with Three.js and Vite.

- **01 · VOIDLINE:** thread accelerating neon gates, skim their edges to build FLOW, and collect risky shards.
- **02 · RING RIOT:** roll around a floating sumo arena, gather pursuing rivals, and release a charged radial pulse to throw them over the edge. Fast crowd clears build knockout chains up to ×8. Charging slows movement; heavy rivals resist blasts, rewarding positioning near the rim. Fall off and the run ends. Restart immediately.
- **03 · SKYSLICE:** place sliding slabs on a sunlit tower with one button. Each landing alternates between two axes. Overhangs tumble away and narrow the next landing; flush placements build a bonus streak, and three consecutive perfects recover some width. The tower rises, the slabs speed up, and a missed landing ends the run.

- **04 · BANKSHOT:** aim one ball into a compact billiard-like table of blocks. Ricochet off the rails to reach behind rows and chain breaks in one shot. The ball returns where it lands; each shot advances the surviving blocks and adds a row. Keep them off your striped launch line.

## Run

Use Node.js **22 LTS** (Node 20.19+ also works). From the repository directory:

```bash
npm ci
npm run dev
```

Open the URL Vite prints. The home screen launches all four games; **← ARCADE** returns home. Development does not register a service worker.

## Controls

| Game | Keyboard | Mouse / touch |
| --- | --- | --- |
| VOIDLINE | WASD / arrows to steer. Space / Enter to start or restart. | Move pointer / touch to steer. Tap launch or restart. |
| RING RIOT | WASD / arrows to roll. **Hold Space, release to blast.** Enter / Space to start or restart. P / Esc to pause or resume. | Move mouse to roll; hold primary click to charge, release to blast. On touch, **drag to roll and charge, lift to blast**. |
| SKYSLICE | **Space / Enter** to start, place a slab, or restart. P / Esc to pause or resume. | **Click / tap** the scene or PLACE SLAB. Tap the start / restart button. |
| BANKSHOT | **← → / A D** aim. Hold **Shift** for fine aim. **Space / Enter** fires, starts, or restarts. P / Esc pauses. | **Drag on the table to aim, release to fire.** Mouse hover also aims. Aim-arrow and FIRE buttons support small adjustments. |

RING RIOT has a sound toggle and automatically pauses when the tab loses focus. Pink, banded heavy rivals join from round 2 (18 seconds). A full pulse takes 0.8 seconds to charge, followed by a short cooldown. Normal ring-outs award 100 × chain; heavies award 200 × chain. Keep knockouts within two seconds to grow the chain. RING RIOT's best score and sound preference persist locally. VOIDLINE keeps its original session-best scoring.

SKYSLICE is about timing, footprint management, and recovering from small mistakes. It has no steering or combat. Each slab earns 100 points plus 10 per ten slabs of height. Perfect landings add 50 × streak (bonus capped at ×5). Every third consecutive perfect grows both top dimensions by 0.28 units, up to the original width. Speed rises from 3.2 to a cap of 7.8 units/second. The perfect window narrows with very small tops. Sound and best score/height persist locally; losing focus pauses the run. Placement fires on press, with a brief settling interval to prevent accidental double input.

BANKSHOT rewards angle selection and board management, with no aiming time limit. Each shot lasts up to six seconds or until the ball drains. Breaking blocks earns 100 × the current shot’s chain (capped at ×8), plus 50 per rail contact since the previous hit (capped at three). Cracking a two-hit block earns 25. Rows grow from three to four blocks at rack 6, then five at rack 11. Two-hit blocks appear from rack 6 and gradually become more common. The guide shows the first block contact or one rail bank; later ricochets are yours to read. The return position becomes the next launch position. Best score, best rack, and mute preference persist locally. Losing focus pauses, including during ball flight.

## Production build

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

Open the preview URL (normally `http://127.0.0.1:4173`). Wait for **All four games ready offline** on the home screen. The first successful production load caches **all four games**, even before you open them. They can then reload and launch with the network disabled.

The **contents of `dist/`** are the entire static site. No Node process, API, runtime CDN, or server-side routing is needed on the host. The build generates and checks the full precache, page links, manifest, scope, and icon sizes. `dist/` and dependencies stay out of Git; commit the source and `package-lock.json`.

## GitHub Pages deployment

Repository: **[hyperlimn/pocket-arcade](https://github.com/hyperlimn/pocket-arcade)**. Pages URL: **https://hyperlimn.github.io/pocket-arcade/**.

The default-branch workflow in `.github/workflows/pages.yml` tests, builds, and deploys the site through GitHub Actions. Repository administrators can select **Settings → Pages → Build and deployment → Source: GitHub Actions** if needed. Future default-branch pushes automatically deploy.

The workflow uses Node 22, `npm ci`, simulation tests, production build checks, `upload-pages-artifact`, and `deploy-pages`. The build job can read source and Pages metadata; only the deployment job has Pages write and OIDC permissions. It uses GitHub's automatic token and needs no personal token or repository secret. An existing deployment finishes before the next one starts. Feature branches cannot publish.

`configure-pages` supplies the actual site's `base_path`. The workflow appends `/` and passes **`PAGES_BASE_PATH`** to Vite: `/repo/` for a project site, `/` for an owner site or a root custom domain. No game-source edits or manually maintained repository-name variable are needed. The manifest's relative `id`, `start_url`, `scope`, and icon URLs resolve inside the project. The worker registers from the build base; its default scope and every precache URL stay within that project. Cache cleanup only touches that arcade scope, preserving other sites on the owner's domain.

To build/preview the Pages shape locally:

```bash
PAGES_BASE_PATH=/pocket-arcade/ npm run build
PAGES_BASE_PATH=/pocket-arcade/ npm run preview -- --host 127.0.0.1
```

Open **`http://127.0.0.1:4173/pocket-arcade/`**. Include leading and trailing slashes in the base path. Without the variable, builds retain portable `./` URLs and development behavior stays the same. Set the variable on both build and preview commands. Do not pass `--base` to the npm build script: its post-build checker uses `PAGES_BASE_PATH` too.

The workflow follows [GitHub's supported Pages Actions deployment](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite's project-site base guidance](https://vite.dev/guide/static-deploy#github-pages). Other static HTTPS hosts can also serve `dist/`; serve the correct MIME types and do not rewrite missing assets to HTML. Prefer revalidation of `sw.js` where the host permits cache-header configuration.

## Chromebook installation and offline play

On a Chromebook, open the HTTPS Pages URL in Chrome. Use **Install Arcade** when available, or Chrome's install option in the address bar/menu. Wait for **All four games ready offline** before disconnecting: the home page precaches every game even if you have never opened it. Installation is optional; the ordinary browser tab also works offline after caching. School/work device policies can restrict installation. The initial visit needs a connection; browsers can evict cached data if storage is cleared or constrained. `file://` is not supported.

Builds precache local assets into a content-versioned cache. New workers wait while an older arcade tab is open, keeping a running game on its current code. Close **all tabs/windows for this arcade**, then reopen to activate an available update. Old caches are removed on activation. To inspect a development change, use Vite's separate development port; to completely reset production caching, use Chrome DevTools → Application → Service Workers / Storage for that origin.

## Small by design

- `index.html` + `src/arcade.js`: four game cards in one small registration list.
- `voidline.html` + `src/main.js`: the preserved original game, with an arcade link and local fonts.
- `ring-riot.html` + `src/ring-riot/`: an independent renderer/input layer and a fixed-step physics model.
- `skyslice.html` + `src/skyslice/`: a separate renderer/input layer and small stacking model.
- `bankshot.html` + `src/bankshot/`: its own aiming, ricochet model, instanced table renderer, and controls.
- `src/site.js`: shared install/offline status and arcade-link styles.
- `vite.config.js`: five page entries; Vite shares the Three.js bundle.
- `scripts/build-offline.mjs`: inventories the complete build and generates `dist/sw.js`; the manifest and icons live in `public/`.
- `scripts/verify-build.mjs`: validates the deployable artifact on every build.
- `.github/workflows/pages.yml`: builds and deploys default-branch pushes after Pages is enabled.

Navigation loads a new document, releasing the previous game's renderer, audio, and event listeners. RING RIOT uses low-poly shared meshes, fake contact shadows, capped enemies/particles, and a 1.5× pixel-ratio cap. SKYSLICE shares box geometry and a fixed material palette, retains at most 48 rendered slabs / 10 falling slices / 60 particles, and also caps pixel ratio at 1.5×. BANKSHOT batches blocks, hit markers, shadows, trail, and debris into instanced meshes, limits particles to 80 and trail samples to 12, uses six shared geometries, and caps pixel ratio at 1.5×. There are no texture downloads, post-processing passes, or runtime network services. All four games require a browser with WebGL2. Actual Chromebook performance and subjective game feel still need device playtesting.

## Checks

```bash
npm test
npm run build
```

`npm test` checks the RING RIOT simulation's input tradeoff, pulse/cooldown, real opening sequence, range, heavy resistance, scoring, chain expiry, death, and bounded long-run behavior.

Seven additional SKYSLICE simulation tests cover timed landings, axis alternation, exact cuts, growth/streaks, settling, terminal misses, escalating difficulty, and bounded long-run state.

Seven BANKSHOT simulation tests cover legal aiming, input rejection, collision/reflection, rail/chain scoring, armor, frame-rate consistency, automatic return, terminal failure/reset, escalating density, and 200 bounded runs.

An optional Chromium integration suite exercises all four games, input/restart/navigation, viewport sizes, installability, first-load offline caching, project scope, and safe service-worker updates. Provide `puppeteer-core` (test-only) and a local Chromium executable:

```bash
npm install --no-save --package-lock=false puppeteer-core
CHROMIUM="/path/to/chromium" npm run test:pages
```

`test:pages` builds at `/pocket-arcade/` (override with `PAGES_BASE_PATH`), starts a strict temporary static server serving **only `dist/`**, runs the browser suite, and stops the server. No preview server is required. The default executable is `/snap/bin/chromium`. `PUPPETEER_MODULE` can point to an external `puppeteer-core` ES module, avoiding any project dependency change. `ARCADE_REPORT` overrides the default `/tmp/pocket-arcade-validation` screenshots/report directory. To test a separately running production preview, use `ARCADE_URL=http://127.0.0.1:4173/pocket-arcade/ node tests/browser.mjs`.

GitHub Actions runs simulation tests and artifact checks; the longer real-input browser suite is a release check. See [Pages validation](docs/PAGES-VALIDATION.md) for preparation and live deployment evidence and [game validation](docs/VALIDATION.md) for the earlier four-game pass.
