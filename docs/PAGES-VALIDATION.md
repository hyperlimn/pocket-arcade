# GitHub Pages preparation — 2026-09-26

This records the local preparation pass before publication was authorized. At that point, no remote was configured, no commit or push had been made, and no GitHub repository or setting had been changed. All four games were accepted by the Captain before this pass. No new game or gameplay change was included.

## Deployment configuration

- `.github/workflows/pages.yml` deploys only the GitHub repository's default branch, with a manual rerun option. It installs the lockfile using `npm ci`, runs simulation tests, builds and validates `dist/`, uploads the Pages artifact, and deploys it through GitHub's supported Actions mechanism.
- The build reads Pages metadata with `configure-pages`. Its `base_path` plus a trailing slash becomes `PAGES_BASE_PATH`; `vite.config.js` uses that value for generated asset URLs and the worker registration. No owner/repository name is hardcoded. The expected project URL is `https://<owner>.github.io/<repo>/`.
- Build permissions are `contents: read` and `pages: read`; only the deployment job has `pages: write` and `id-token: write`. Checkout does not persist credentials. No personal token, secret, custom server, or deployment branch is needed.
- The existing manifest retains relative `id`, `start_url`, `scope`, and icons. Existing arcade/game navigation remains relative. The worker's default scope is its project directory; every precache URL and cache namespace derives from that scope. Updates continue to wait for old tabs to close.
- `scripts/verify-build.mjs` runs on every production build and checks all five HTML pages' references, manifest identity/start/scope, actual 192/512-pixel PNG dimensions, exact precache coverage, content hash, and worker registration base.
- `scripts/test-pages.mjs` and `tests/static-server.mjs` provide a repeatable local release test using only the static artifact. The server serves no application code and returns 404 outside the project or for missing files. `tests/offline-update.mjs` exercises the multi-tab update lifecycle. `tests/browser.mjs` includes Chrome installability and project-scope checks.
- README covers setup, the automatic workflow, local preview, Chromebook installation, offline behavior, and updates. `.gitignore` excludes dependencies, builds, logs, environment secrets, local agent metadata, and test output. No credentials were found in publication candidate files.

## Local validation

- Reproducible `npm ci` succeeds from the existing lockfile; npm reports zero vulnerabilities. All **21 individual simulation tests** pass, including BANKSHOT's 200 seeded bounded runs. Checks run on Node 20.20.2 and Node 22.23.2; the workflow selects Node 22.
- Production build validation passes with portable `./`, root `/`, `/renamed-cabinet/`, and `/pocket-arcade/` bases. The final Pages artifact has **23 files / 613,526 bytes**, with **22 precached application files**. Node 20 and Node 22 produce the same `/pocket-arcade/` cache version: `14caebfd0c7ce845`.
- Default development still launches all four routes and explicitly leaves service-worker registration disabled.
- The full production Chromium suite runs against a strict loopback static host at `/pocket-arcade/`. It exercises VOIDLINE, RING RIOT, SKYSLICE, and BANKSHOT through normal keyboard, pointer, and Chrome touch input, including representative scoring, loss/restart, and every return link. Game deep links and reloads work with query strings.
- Chromium reports **no installability errors**. The manifest URL, resolved app ID, start URL, manifest scope, active worker URL, registration scope, and decoded icons all stay inside `/pocket-arcade/`. No root worker registration is created.
- **Home-only offline proof:** a fresh browser visits only arcade home and waits for precaching. With network and HTTP cache both disabled, home reloads through the worker. All four previously unvisited games launch, score, reload through the worker, and return to the arcade. Installing the PWA is not required for this behavior.
- **Update proof:** two served artifact revisions have distinct cache names and home-page markers. With both an old home tab and game tab open, the new worker waits and reloads retain old content. Closing only home does not activate it; the game still plays. After the last old tab closes, the new worker activates, serves the new home marker offline, and removes only the previous project cache. An unrelated sibling-project cache survives. All four games then score offline under the new worker.
- Layout checks cover **1440×900, 1366×768, 1024×600, 390×844, and 375×667**, plus touch checks at 960×600. The 1024×600 arcade and BANKSHOT captures were visually inspected. There are no observed console, page, or resource errors and no unexpected external runtime requests.
- All **20 existing HTML and `src/` files** remain byte-for-byte unchanged, including every game's model, renderer, styling, shared site behavior, and navigation. Manifest, icons, and offline generator are also unchanged.

The machine-readable result and source hashes are in [pages-validation-report.json](pages-validation-report.json). Browser screenshots are local test output in `/tmp/pocket-pages-validation/`; they are not part of the deployed artifact or source publication.

Repeat the browser validation with an installed Chromium and test-only `puppeteer-core`:

```bash
npm ci
npm test
CHROMIUM=/path/to/chromium npm run test:pages
```

`PUPPETEER_MODULE` may instead point to an external `puppeteer-core` ES module. `PAGES_BASE_PATH` overrides the test's `/pocket-arcade/` default. See README for the production preview commands and optional browser tooling setup.

## Limits and publication boundary

This is local production validation with software-rendered Chromium, not a deployed HTTPS Pages check or a physical Chromebook performance measurement. GitHub workflow execution and the real HTTPS URL must be checked after publication is authorized. Browser storage eviction/clearing can remove offline data; the first successful cache install requires a connection. WebGL2 is required, and managed Chromebooks may restrict installation. VOIDLINE retains its accepted short-portrait rotation guidance.

The publication destination was subsequently authorized as `hyperlimn/pocket-arcade`. No base-path variable needs to be supplied to GitHub: Pages metadata supplies it automatically. After initial setup, default-branch pushes deploy automatically. Live deployment results are recorded below.

## Live publication — 2026-09-27

- Authenticated GitHub identity: `hyperlimn`, with admin and push access to the authorized repository. `hyperlimn/pocket-arcade` already existed as a public, empty repository: no refs, files, or history were present. Its `main` default branch was populated without a force push.
- Initial publication commit: `d250eac0ebd937f3ddceb473467d7ddc0816e393`. Remote: `https://github.com/hyperlimn/pocket-arcade.git`.
- GitHub Pages was enabled with `build_type: workflow`, source branch `main`, and enforced HTTPS. The initial push triggered [Actions run 36287923391](https://github.com/hyperlimn/pocket-arcade/actions/runs/36287923391). Checkout, Node setup, Pages configuration, `npm ci`, simulation tests, production build/artifact validation, artifact upload, and Pages deployment all succeeded.
- The real site at **https://hyperlimn.github.io/pocket-arcade/** returned HTTP 200 over HTTPS. A fresh Chromium browser opened only home online, waited for the worker to control it and precache 22 files, then disabled network and HTTP cache. Home reloaded from the worker; all four previously unvisited game pages launched, scored, reloaded from the worker, and returned to the arcade.
- The live browser suite passed 14 check groups, including keyboard, pointer, and touch gameplay; game restarts and navigation; desktop, Chromebook-sized, and portrait layouts; deep links with query strings; and Chrome installability metadata. Manifest ID, start URL, scope, active worker, registration, and decoded 192/512-pixel icons all resolved under `/pocket-arcade/`. Chrome reported zero installability errors. No page, console, resource, or unexpected external runtime request errors were observed. See [machine-readable live results](pages-live-validation-report.json).
- The suite's two-tab service-worker update lifecycle uses a controlled local static host with two artifact revisions; it passed during this live test run. This portion is not a claim that a second revision was deployed to GitHub Pages. Browser installation UI, physical Chromebook performance, and cache retention under device storage pressure were not directly tested.
