# Validation — Game #4 expansion, 2026-09-26

Historical game-expansion record. The Captain has since accepted all four games. See [Pages preparation validation](PAGES-VALIDATION.md) for the current deployment status and publication boundary.

Pocket Arcade now contains **VOIDLINE**, **RING RIOT**, **SKYSLICE**, and **BANKSHOT**. The production build contains **23 files / 613,201 bytes** (171,351 bytes when each file is gzip-compressed). The unchanged service-worker generator precaches 22 application files, including all four game pages; `sw.js` is the remaining file. No runtime CDN, texture, font, or API dependency was added.

## BANKSHOT

**One ball. All the angles.** Aim into a compact 3D table of blocks. Rails reflect the ball; consecutive breaks in one shot multiply its score. Each return advances the remaining blocks and adds a fresh row. A block touching the striped launch line ends the run. The ball's return position becomes the next launch position, making the next angle part of the current shot's consequences.

- **Keyboard:** Left/Right or A/D aim; Shift slows aiming for precision. Space/Enter fires, starts, or restarts. P/Esc pauses and resumes.
- **Pointer/touch:** drag on the table to aim, release to fire. Mouse hover also aims. On-screen arrows and FIRE offer a second way to make fine adjustments. Touch cancellation and additional fingers do not fire extra shots.
- **Mastery:** choose between removing a threatening low block and banking into the back of a row for several breaks. The guide ends at the first block or after one rail bank. Aim as long as needed; flight lasts up to six seconds. Pressure is the approaching board, not a score awarded for waiting.
- **Scoring:** each break earns 100 × the shot's chain, capped at ×8, plus 50 per rail contact since the previous hit, capped at three. An armor crack earns 25. Gold blocks take one hit; coral blocks have two visible hit dots. Rows grow from three to four blocks at rack 6 and five at rack 11. Armor appears from rack 6 and becomes more frequent, capped at a 50% chance.
- **Complete loop:** musical synthesized impacts, launch/rail/return sounds, instanced debris, ball trail, contact shadows, advancing rows, brief impact movement, results, immediate restart, persistent best score/rack and mute preference, pause, and automatic focus-loss pause. Reduced-motion settings suppress debris, trails, and camera bumps.

The primary interaction is deliberate aiming and predicting ricochets. It differs from VOIDLINE's continuous flight steering, RING RIOT's free movement and radial combat, and SKYSLICE's placement timing. There is no engine abstraction, progression currency, or upgrade system.

## Collection and preservation

A fourth card joins a simple two-by-two desktop shelf, with the existing narrower layouts retained. BANKSHOT owns its page, renderer/input layer, and small pure simulation. Vite adds one entry and continues to share the existing Three.js bundle. Offline status and manifest copy now describe four games. Arcade return links remain relative.

All **11 original-game source files** captured before the pass remain byte-for-byte unchanged: the three games' HTML, JavaScript, and CSS, including RING RIOT and SKYSLICE model files. Their mechanics, tuning, presentation, and controls are preserved. Source hashes are recorded in the JSON validation report.

The cache generator and worker lifecycle are unchanged: content-versioned precaching, scoped caches, waiting updates while old tabs remain open, activation after closure, and old-cache removal. No external deployment was performed.

## Technical checks

- Production build and `npm test` pass. The three simulation files contain **21 passing individual tests**, including seven new BANKSHOT tests.
- BANKSHOT simulation tests cover legal aiming, guide endpoints, repeated-shot rejection, flight/contact/reflection, exact score outcomes, rail and chain bonuses, two-hit armor, 30/60/120 Hz consistency, six-second automatic return, failure/reset, and **200 independently seeded bounded runs**. Those runs keep positions finite, target counts bounded, and density/armor escalation active.
- Browser validation uses production Chromium with SwiftShader. It selects angles from read-only snapshots, then drives normal keyboard, mouse, and Chrome touch events; it never changes the live simulation through diagnostic hooks.
- BANKSHOT reaches rack 11 at 12,600 points, with 36 breaks, a nine-break best chain and 28 banked breaks. This exercises denser rows and armor, flight pause/resume, blur pause, failure/results, immediate restart, held-Space rejection, fine keyboard aim, and local record/mute persistence.
- Portrait checks exercise touch drag/release, pointer cancellation, multiple contacts, pause/resume, aim/fire buttons, loss/results, restart, and return to the arcade.
- Opening and active-table/control bounds are checked at **1440×900, 1366×768, 1024×600, 390×844, and 375×667**. Screenshots also cover later racks and desktop/mobile pause/results. Opening text groups have explicit non-overlap assertions.
- Representative original-game paths are rerun: VOIDLINE scoring, steering, collision, restart; RING RIOT charge, chain knockouts, later-round pressure, keyboard/pointer/touch, pause, failure, restart; SKYSLICE cuts, perfects, growth, 14 slabs, pause/blur, failure, restart and persistence. All four cabinet navigation paths are exercised.
- **Offline proof:** a fresh browser profile initially visits only Pocket Arcade home. After the service worker installs, both network and HTTP cache are disabled. Home reloads through the worker; all four previously unvisited games launch, score, reload, and return to the arcade. BANKSHOT is played with both pointer and keyboard offline.
- The complete final browser suite passes with **no observed console/page/resource errors and no external runtime requests**.
- A separate loopback server under `/cabinet/` verifies relative paths and worker scope, a waiting replacement worker, activation and cache cleanup after old-tab closure, and updated offline launches including BANKSHOT.

The final browser outcome, renderer samples, error/request checks, source hashes, and build measurements are recorded in [validation-report.json](validation-report.json). The repeatable suite is [tests/browser.mjs](../tests/browser.mjs), with the new game's checks in [tests/bankshot-browser.mjs](../tests/bankshot-browser.mjs). Screenshots are saved in `/tmp/pocket-four-validation/` on this machine.

## Performance and limits

BANKSHOT uses six geometries, shared materials and instanced targets, dots, shadows, particles, and trail. Target mesh capacity is fixed at 49; particles cap at 80 and trail samples at 12. Pixel ratio caps at 1.5×. It uses no textures, post-processing, or shadow-map rendering. The rack-11 sample uses **19 draw calls / 1,456 triangles / six geometries**; these complexity counts are not physical Chromebook frame-rate measurements.

Automated input establishes the playable loop and offline behavior; subjective fun, precision feel, and audio balance still need Captain playtesting. Browser storage can be cleared or evicted, so offline availability requires retained cache data after a successful initial online install. The games require WebGL2. VOIDLINE retains its accepted short-portrait rotation guidance.

The highest-value next step is Captain hands-on playtesting of **BANKSHOT**, preferably on a Chromebook: judge whether the aiming guide makes rail shots legible, whether a strong chain feels satisfying, and whether the approaching rows create another-run appeal. Stop here for that judgment; do not add another cabinet or speculative systems.
