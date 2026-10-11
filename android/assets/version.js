/* The App version, in one place. Loaded first: fills every [data-app-version] element (footer,
   About, setup page) before the pixel font draws them, and the diagnostics read it too.
   tests/version-sync.cjs checks it matches package.json, so a bump that misses it fails. */
window.APP_VERSION='0.11.1-dev.55';
for(const n of document.querySelectorAll('[data-app-version]'))n.textContent=n.dataset.appVersion+window.APP_VERSION;
