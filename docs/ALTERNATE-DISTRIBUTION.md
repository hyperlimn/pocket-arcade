# Alternate distribution plan

Checked 27 September 2026. The [GitHub repository](https://github.com/hyperlimn/pocket-arcade)
and [GitHub Pages site](https://hyperlimn.github.io/pocket-arcade/) remain the canonical
source and deployment. These are additional, ordinary distribution locations. Ask
school IT to approve the chosen URL or offline method under its normal policies.

## Public custom domain

Recommended address: **`pockarcade.com`**. It uses the familiar `.com` ending
and still reads like Pocket Arcade. **`pockarc.com`** is the shortest verified
option if typing length matters most. Live RDAP registry lookups returned HTTP
404 (no registered domain record) for all five candidates
below on the date above. That is a current registration check, **not** a sale
reservation or a quote for a particular name. Registries can reserve names or
mark them premium. Recheck availability and the full first-year/renewal totals
in a registrar's checkout immediately before Captain approves registration.

| Candidate | Typing length | Registry check | Published standard first year | Published standard renewal |
| --- | ---: | --- | ---: | ---: |
| `pockarc.com` | 11 | [No record](https://rdap.org/domain/pockarc.com) | $11.08 | $11.08/year |
| `pockarcade.com` | 14 | [No record](https://rdap.org/domain/pockarcade.com) | $11.08 | $11.08/year |
| `playpock.com` | 12 | [No record](https://rdap.org/domain/playpock.com) | $11.08 | $11.08/year |
| `pockarcade.fun` | 14 | [No record](https://rdap.org/domain/pockarcade.fun) | $2.57 | $31.41/year |
| `pocketarcade.fun` | 16 | [No record](https://rdap.org/domain/pocketarcade.fun) | $2.57 | $31.41/year |

Typing length includes the dot and extension. Prices are USD, from Porkbun's
current [`.com`](https://porkbun.com/tld/com) and
[`.fun`](https://porkbun.com/tld/fun) public standard TLD pages. They are
illustrative until the exact name is quoted; promotions and prices can change.
`pocketarcade.com` and `pocketarcade.games` already had registry records, so
they are excluded.

### Simplest hosting arrangement

1. After Captain selects and approves a name and its checkout price, register
   that one domain. Use a free **Cloudflare Pages Direct Upload** project for the
   site. Run `npm run package:static-host`, then drag the generated
   `release/pocket-arcade-static-host/` folder to Pages. Its root contains the
   site plus a `_headers` rule that revalidates `sw.js`. Do not upload the
   portable handoff folder as the public root.
   [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
   accepts a folder or ZIP and does not need a GitHub integration. Its default
   `*.pages.dev` address can be used for a free test if authorized, but should
   not be mistaken for the final custom address.
2. Add the custom **apex** domain (for example `pockarcade.com`) in the Pages
   project's Custom domains screen. Cloudflare requires that apex to be a zone
   in the same account, with the domain's nameservers pointed to Cloudflare;
   Pages then sets the record and HTTPS certificate. Follow its
   [custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/).
   This is the shortest URL: `https://pockarcade.com/`.
3. On every approved release, rerun `npm run package:static-host` and upload
   the new folder to the **same** Pages project. Avoid a
   GitHub-connected build for this alternate URL, so access to GitHub is not
   required for visitors or for manual deployment. The source and Pages workflow
   still remain canonical.

Cloudflare's [Free plan limits](https://developers.cloudflare.com/pages/platform/limits/)
include Direct Upload static sites and custom domains; the domain registration
is the recurring cost. A second simple choice is
[Netlify Drop](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/):
upload `release/pocket-arcade-static-host/`, attach a custom domain and HTTPS on its
[Free plan](https://www.netlify.com/pricing/). Netlify's current Free plan has
300 monthly credits and pauses sites that reach the limit. A third choice is
an existing **school-approved HTTPS static host**: IT can serve the same
`dist/` contents under an approved domain with no app server. The chosen host
must serve JavaScript and manifest files with appropriate MIME types, retain
unknown-file 404s, and avoid long caching of `sw.js` (prefer
`Cache-Control: no-cache`). Cloudflare Pages and Netlify both use the
[`_headers` format](https://developers.cloudflare.com/pages/configuration/headers/)
in the prepared host folder. Their static host must serve the site at `/`.

### Build and release checks

```bash
npm ci
npm test
npm run build
```

The default build has relative links, five HTML pages (home plus four games),
relative manifest scope/icons, and a service worker whose cache is scoped to
its deployment path. `npm run build` checks that all emitted files are in the
precache. Serve `dist/` at `/` over HTTPS; do not add a pathname prefix or
rewrite missing assets to `index.html`. Test the home page, each game, install
prompt/Chrome install option, offline reload after “All four games ready
offline,” and the update flow: publish a newer build, close all old arcade
tabs/windows, reopen. A new custom-domain origin gets its own PWA install and
cache; an installation from GitHub Pages does not move to it automatically.
School filtering may still block any public host or domain. Have IT verify the
approved URL; do not rotate hosts or names to evade a block.

## USB / IT handoff

Run `npm run package:offline`. The command forces the relative static build,
validates it, and creates both `release/pocket-arcade-offline/` and
`release/pocket-arcade-offline.zip`. The generated handoff includes a README,
the optional Python 3 localhost launcher, and `site/` with all four games and
every runtime asset. It is separate from `dist/` and is ignored by Git so it can
be regenerated. The ZIP can be copied to USB or given to IT. Follow its own
README for Chromebook limitations and launch methods.

No account, paid resource, domain, or alternate deployment is created by these
commands. Captain approval is the next step for registration or a new external
hosting account/project.

## Validation completed 27 September 2026

- `npm test` passed; the unchanged Pages workflow shape passed
  `PAGES_BASE_PATH=/pocket-arcade/ npm run build`.
- Both new package commands passed the production artifact checker: home plus
  four game pages, install metadata and icon sizes, and all 23 local files in
  the versioned precache. The host folder is byte-for-byte equal to the default
  `dist/` except for its `_headers` deployment rule. The portable `site/` is
  byte-for-byte equal to `dist/`.
- The portable ZIP passed an integrity check and extraction reproduced the
  packaged folder exactly. Its site ran through the Python localhost launcher.
- The final Chromium suite passed 15 checks against the Pages-path build;
  an earlier root-path run passed all four games against the portable copy:
  Chrome installability, first-load precaching, offline home/game reloads and
  scoring in all four games with network and HTTP cache disabled, relative
  navigation, real input, safe worker update/activation, a recovery dialog on
  every page when scripts are missing, and no external runtime requests or
  page/resource errors. The host folder and portable `site/` are identical to
  the root-path build, apart from the host's `_headers` rule.

No school-managed Chromebook or live alternate host was available for a device
policy or public HTTPS check. Google documents that
[USB access can be controlled by school policy](https://support.google.com/chrome/a/answer/2657289),
[Linux may be unavailable on managed Chromebooks](https://support.google.com/chromebook/answer/9145439),
and [local JavaScript modules require a server](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).
