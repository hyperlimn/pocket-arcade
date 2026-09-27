# Pocket Arcade: portable offline edition

This folder contains all four games (VOIDLINE, RING RIOT, SKYSLICE, BANKSHOT),
their fonts/styles/scripts/icons, and the offline service worker. It needs no
internet connection or CDN. Keep `site/` and `launch.py` together when copying
the folder to a USB drive or giving it to IT.

## Launch on a computer with Python 3 already installed

Open a terminal in this folder and run:

| System | Command |
| --- | --- |
| Windows | `py -3 launch.py` (or `python launch.py`) |
| macOS / Linux | `python3 launch.py` |

The launcher serves only this folder's `site/` on `127.0.0.1:8765` and opens
`http://127.0.0.1:8765/` in a browser. It uses Python's standard library;
there is nothing to download. Keep the terminal open while playing. Press
Ctrl+C to stop. If the browser does not open automatically, type that local URL.
You can also hand `site/` to IT for hosting on an approved HTTPS static server.

Do not double-click `site/index.html`: the games use JavaScript modules, which
Chrome does not reliably load from `file://`. A `file://` page also cannot use
the offline service worker or PWA installation. The localhost launcher works
without internet; the site files are already on the drive. On first localhost
load, wait for “All four games ready offline” if you want browser caching too.
The USB copy itself remains playable offline whenever the local server runs.

## Managed Chromebook

ChromeOS normally lets users see compatible USB drives in Files. A school can
disable external storage access. Running `launch.py` directly is possible only
if the school permits the Linux development environment and Python 3 is present
there; Linux is usually restricted on managed devices. Sharing the USB folder
with Linux may also require permission. Ask school IT to confirm these policies.
IT can instead host `site/` on an approved HTTPS static host or approved local
server. A different computer's LAN address over plain HTTP does not qualify for
PWA installation/offline precaching; use HTTPS or the Chromebook's own localhost
for those browser features. The school's URL, app installation, WebGL, and external
storage policies still apply. Do not change device management settings to run it.

## Updates

Copy a newly generated package over the old one. With the launcher, close all
Pocket Arcade tabs/windows and reopen the local URL to let a new service worker
activate. Existing browser storage may also be cleared by school policy.
For an IT-hosted copy, ask IT to serve `sw.js` with `Cache-Control: no-cache`.

The canonical source and GitHub Pages deployment remain in the Pocket Arcade
repository. Regenerate this edition there with `npm run package:offline`.
