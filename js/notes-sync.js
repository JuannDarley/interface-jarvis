/* Sincronização com o mesmo servidor e a mesma sessão do desbloqueio facial. */
window.JarvisNotes = (() => {
  const key = `jarvis_notes_sync:${window.location.origin}`;
  let revision = null, baseline = null, busy = false, ready = false, queued = false, conflict = null;
  let timer;
  const status = () => document.getElementById('notes-sync-status');
  const dialog = () => document.getElementById('notes-sync-conflict');
  const snapshot = () => JSON.stringify(currentNotes);
  const dirty = () => baseline !== null && snapshot() !== baseline;

  function remember() {
    baseline = snapshot();
    localStorage.setItem(key, JSON.stringify({ revision, baseline }));
  }

  async function request(method, body) {
    const response = await fetch(`${window.JARVIS_API_BASE_URL}/api/notes`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Object.assign(new Error('notes-unavailable'), { status: response.status });
    return response.json();
  }

  function apply(document) {
    currentNotes = document.notes;
    revision = document.revision;
    localStorage.setItem('jarvis_notes', snapshot());
    remember();
    updateBrainStats();
    renderGraph();
    status().textContent = 'Notas sincronizadas';
  }

  async function upload() {
    if (!ready || busy || conflict || revision === null) return;
    busy = true;
    queued = false;
    const submitted = snapshot();
    try {
      const result = await request('PUT', { initialized: true, revision, notes: JSON.parse(submitted) });
      revision = result.revision;
      baseline = submitted;
      localStorage.setItem(key, JSON.stringify({ revision, baseline }));
      status().textContent = dirty() ? 'Salvando alterações...' : 'Notas sincronizadas';
    } catch (error) {
      status().textContent = error.status === 409
        ? 'Notas alteradas em outro dispositivo. Sincronize para revisar.'
        : 'Alterações preservadas neste dispositivo';
      if (error.status === 409) ready = false;
    } finally {
      busy = false;
      if (queued && ready) upload();
    }
  }

  async function synchronize() {
    if (busy) return;
    busy = true;
    status().textContent = 'Conectando notas...';
    try {
      const remote = await request('GET');
      if (!Array.isArray(remote.notes) || !Number.isInteger(remote.revision)) throw new Error('invalid-notes');
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      const unchanged = stored ? snapshot() === stored.baseline : snapshot() === JSON.stringify(INITIAL_NOTES);
      revision = remote.revision;
      ready = true;
      if (!remote.initialized) {
        queued = true;
      } else if (snapshot() === JSON.stringify(remote.notes) || unchanged) {
        apply(remote);
      } else if (stored && stored.revision === remote.revision) {
        baseline = stored.baseline;
        queued = true;
      } else {
        conflict = remote;
        status().textContent = 'Escolha quais notas sincronizar';
        dialog().showModal();
      }
    } catch (_) {
      ready = false;
      status().textContent = 'Notas locais · servidor ainda não configurado ou indisponível';
    } finally {
      busy = false;
      if (queued && ready && !conflict) upload();
    }
  }

  function changed() {
    if (!ready) return;
    queued = true;
    clearTimeout(timer);
    timer = setTimeout(upload, 500);
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('notes-sync-button').addEventListener('click', synchronize);
    document.getElementById('notes-use-server').addEventListener('click', () => {
      localStorage.setItem('jarvis_notes_local_backup', snapshot());
      apply(conflict);
      conflict = null;
      dialog().close();
    });
    document.getElementById('notes-use-local').addEventListener('click', () => {
      localStorage.setItem('jarvis_notes_server_backup', JSON.stringify(conflict));
      revision = conflict.revision;
      conflict = null;
      dialog().close();
      upload();
    });
    document.getElementById('notes-cancel-sync').addEventListener('click', () => {
      conflict = null;
      ready = false;
      status().textContent = 'Notas locais preservadas';
      dialog().close();
    });
    dialog().addEventListener('cancel', () => {
      conflict = null;
      ready = false;
      status().textContent = 'Notas locais preservadas';
    });
    setTimeout(synchronize, 0);
  });
  window.addEventListener('focus', () => { if (ready && !dirty() && !conflict) synchronize(); });
  return { changed, synchronize };
})();
