/* Sincronização com o mesmo servidor e a mesma sessão do desbloqueio facial. */
window.JarvisNotes = (() => {
  let key = `jarvis_notes_sync:${window.location.origin}`;
  const scoped=base=>window.JarvisNotesIdentity?window.JarvisNotesIdentity.key(base):base;
  let revision = null, baseline = null, busy = false, ready = false, queued = false, conflict = null;
  let timer;
  const status = () => document.getElementById('notes-sync-status');
  const dialog = () => document.getElementById('notes-sync-conflict');
  const snapshot = () => JSON.stringify(currentNotes);
  const dirty = () => baseline !== null && snapshot() !== baseline;

  // Device-local, immutable first snapshot plus a short history. Never sent to logs or telemetry.
  function backup(reason, notes = currentNotes) {
    try {
    const entry = { createdAt: new Date().toISOString(), reason, origin: window.location.origin,
      revision, notes: JSON.parse(JSON.stringify(notes)) };
    if (!localStorage.getItem(scoped('jarvis_notes_before_database_sync'))) {
      localStorage.setItem(scoped('jarvis_notes_before_database_sync'), JSON.stringify(entry));
    }
    const archiveKey = scoped('jarvis_notes_backups_v1');
    let archive;
    try { archive = JSON.parse(localStorage.getItem(archiveKey) || '[]'); } catch (_) { archive = []; }
    if (!Array.isArray(archive)) archive = [];
    if (JSON.stringify(archive.at(-1)?.notes) !== JSON.stringify(entry.notes)) {
      localStorage.setItem(archiveKey, JSON.stringify([...archive.slice(-19), entry]));
    }
    } catch (_) { throw Object.assign(new Error('backup-unavailable'), { code: 'backup-unavailable' }); }
  }

  function remember() {
    baseline = snapshot();
    localStorage.setItem(key, JSON.stringify({ revision, baseline }));
  }

  async function request(method, body) {
    const response = await fetch(`${window.JARVIS_API_BASE_URL}/api/notes`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: {...(window.JarvisNotesIdentity?.owner?{'X-Jarvis-Owner':window.JarvisNotesIdentity.owner}:{}),...(body?{'Content-Type':'application/json'}:{})},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Object.assign(new Error('notes-unavailable'), { status: response.status });
    return response.json();
  }

  function apply(document) {
    backup('before-server-apply');
    currentNotes = document.notes;
    revision = document.revision;
    localStorage.setItem(scoped('jarvis_notes'), snapshot());
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
      backup('before-upload', JSON.parse(submitted));
      const result = await request('PUT', { initialized: true, revision, notes: JSON.parse(submitted) });
      revision = result.revision;
      baseline = submitted;
      localStorage.setItem(key, JSON.stringify({ revision, baseline }));
      status().textContent = dirty() ? 'Salvando alterações...' : 'Notas sincronizadas';
    } catch (error) {
      status().textContent = error.code === 'backup-unavailable'
        ? 'Backup local indisponível · libere espaço antes de sincronizar'
        : error.status === 409
        ? 'Notas alteradas em outro dispositivo. Sincronize para revisar.'
        : error.status === 503 ? 'Banco/servidor indisponível · alterações preservadas neste dispositivo'
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
    if(window.JarvisNotesIdentity){await window.JarvisNotesIdentity.ready;if(!window.JarvisNotesIdentity.owner){busy=false;ready=false;status().textContent="Entre novamente para acessar suas notas. As cópias locais foram preservadas.";return;}key=window.JarvisNotesIdentity.key("jarvis_notes_sync");}
    try {
      backup('before-synchronize');
      const remote = await request('GET');
      if (!Array.isArray(remote.notes) || !Number.isInteger(remote.revision)) throw new Error('invalid-notes');
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      const unchanged = stored ? snapshot() === stored.baseline : (snapshot() === JSON.stringify(INITIAL_NOTES) || snapshot() === "[]");
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
    } catch (error) {
      ready = false;
      status().textContent = error.code === 'backup-unavailable'
        ? 'Backup local indisponível · notas mantidas, sincronização suspensa'
        : 'Notas locais · servidor ainda não configurado ou indisponível';
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
      localStorage.setItem(scoped('jarvis_notes_local_backup'), snapshot());
      apply(conflict);
      conflict = null;
      dialog().close();
    });
    document.getElementById('notes-use-local').addEventListener('click', () => {
      backup('server-conflict-version', conflict.notes);
      localStorage.setItem(scoped('jarvis_notes_server_backup'), JSON.stringify(conflict));
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
