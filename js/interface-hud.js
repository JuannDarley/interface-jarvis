(() => {
  const editable = target => target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  const modalOpen = () => document.querySelector('dialog[open], .modal-overlay.open');
  let talking = false;
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || editable(event.target) || modalOpen()) return;
    // Space/Enter on a focused control must keep their native activation behavior.
    if (event.key === ' ' && event.target.closest?.('button,a,summary,[role="button"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'm') {
      event.preventDefault();
      location.hash = location.hash === '#mapa' ? '' : 'mapa';
    } else if (key === '/' && location.hash !== '#mapa') {
      event.preventDefault();
      window.faceModeToggle?.(false);
      document.getElementById('text-command-input').focus();
    } else if (event.key === 'Escape' && location.hash === '#mapa') {
      event.preventDefault();
      const details = document.getElementById('flight-details');
      if (!details.hidden) document.getElementById('flight-details-close').click();
      else location.hash = '';
    } else if (event.key === ' ' && location.hash !== '#mapa' && typeof recognition !== 'undefined' && recognition && !isBusy) {
      event.preventDefault();
      if (!listeningRequested) { startListening(); talking = listeningRequested; }
    }
  });
  function release(event) {
    if (event && event.key !== ' ') return;
    if (talking) { stopListening(); talking = false; }
  }
  window.addEventListener('keyup', release);
  window.addEventListener('blur', () => release());
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  // Observe the existing controls rather than adding a second layer state model.
  for (const pill of document.querySelectorAll('.hud-pill')) {
    const toggle = pill.querySelector('input');
    const status = pill.querySelector('[role="status"]');
    const refresh = pill.querySelector('button[id$="refresh"]');
    const update = () => {
      const text = status.textContent;
      pill.dataset.state = toggle.disabled ? 'unavailable' : !toggle.checked ? 'off' :
        /indispon|falh|erro|limite|aguarde|429|chave|não foi|não respondeu/i.test(text) ? 'error' :
        refresh.disabled ? 'loading' : 'on';
      pill.setAttribute('aria-busy', String(pill.dataset.state === 'loading'));
    };
    new MutationObserver(update).observe(pill, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['disabled'] });
    toggle.addEventListener('change', update);
    update();
  }
})();
