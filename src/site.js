import './site.css';

// Each game owns a page. Navigation releases its renderer, audio and listeners.
const status = document.querySelector('#offline-status');
const setStatus = (message) => { if (status) status.textContent = message; };
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const updateStatus = () => setStatus(registration.waiting
        ? 'Update ready · close all arcade tabs to apply'
        : 'All four games ready offline');
      await navigator.serviceWorker.ready;
      updateStatus();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', updateStatus);
      });
    } catch {
      setStatus('Offline save unavailable · play online');
    }
  });
} else {
  setStatus(import.meta.env.DEV ? 'Development preview · offline available in production' : 'Play online · offline needs HTTPS');
}

const install = document.querySelector('#install');
let installPrompt;
addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  if (install) install.hidden = false;
});
install?.addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  install.hidden = true;
});
