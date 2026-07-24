(() => {
  function show(message: string): void {
    if (document.getElementById('endUserRuntimeError')) return;
    const banner = document.createElement('div'); banner.id = 'endUserRuntimeError'; banner.className = 'end-user-error-banner';
    banner.innerHTML = `<strong>A frontend error was detected.</strong><small>${message}</small>`; document.body.appendChild(banner);
  }
  window.addEventListener('error', event => show(event.message || 'Unexpected error.'));
  window.addEventListener('unhandledrejection', event => show(event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unexpected promise error.')));
})();
