(() => {
  const fallback = { app:'Zentrid End User', workspace:'end-user', release:'v1.9', version:'1.9.0' };
  window.ZentridRelease = fallback;
  void fetch((window.location.pathname.includes('/pages/') ? '../' : '') + 'assets/release-manifest.json', { cache:'no-store' })
    .then(response => response.ok ? response.json() : fallback)
    .then(manifest => { window.ZentridRelease = manifest; document.documentElement.dataset.zentridRelease = manifest.release || 'v1.9'; })
    .catch(() => { document.documentElement.dataset.zentridRelease = fallback.release; });
})();
