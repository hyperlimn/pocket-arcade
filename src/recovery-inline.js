(() => {
  // This runs from each HTML document, independently of the game's modules.
  const ready = () => document.body?.dataset.arcadeReady === 'true';
  let help;
  function show() {
    if (ready() || help || !document.body) return;
    help = document.createElement('aside');
    help.id = 'arcade-load-help';
    help.setAttribute('role', 'alertdialog');
    help.setAttribute('aria-labelledby', 'arcade-load-title');
    help.setAttribute('aria-describedby', 'arcade-load-description');
    help.innerHTML = `<div><h2 id="arcade-load-title">Pocket Arcade could not finish loading</h2>
      <p id="arcade-load-description">Connect to the internet, close every Pocket Arcade window, then reopen it. If it is still stuck, try a full reload: <strong>Ctrl + Shift + R</strong> on Windows, Linux or Chromebook; <strong>Cmd + Shift + R</strong> on Mac.</p>
      <p class="detail">If that does not work, repair the saved game files below. Your scores stay on this device. This needs an internet connection.</p>
      <button type="button">Repair saved copy</button><p class="detail" id="arcade-repair-status" role="status"></p></div>`;
    document.body.append(help);
    help.querySelector('button').addEventListener('click', repair);
    help.querySelector('button').focus();
  }
  async function repair() {
    const button = help.querySelector('button');
    const status = help.querySelector('#arcade-repair-status');
    button.disabled = true;
    status.textContent = 'Checking the connection…';
    try {
      const scope = new URL('./', location.href).href;
      const check = await fetch(new URL(`sw.js?repair=${Date.now()}`, scope), { cache: 'no-store' });
      if (!check.ok) throw new Error('Pocket Arcade is not reachable');
      const registration = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration(scope);
      if (registration?.scope === scope) await registration.unregister();
      if ('caches' in window) {
        const prefix = `pocket-arcade-${scope}|`;
        for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key);
      }
      status.textContent = 'Reloading Pocket Arcade…';
      location.replace(new URL(`?repaired=${Date.now()}`, scope));
    } catch {
      status.textContent = 'Could not reach Pocket Arcade. Reconnect to the internet, then try again.';
      button.disabled = false;
    }
  }
  addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement || event.target === window) show();
  }, true);
  addEventListener('DOMContentLoaded', () => setTimeout(show, 8000));
})();
