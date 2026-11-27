/* Bind local notes to a server-confirmed identity before reading any device cache. */
window.JarvisNotesIdentity=(()=>{
 let owner=null,legacy=false;
 const key=base=>owner?`${base}:${window.location.origin}:${owner}`:null;
 const ready=(async()=>{try{const r=await fetch(window.JARVIS_API_BASE_URL+'/api/account/identity',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const a=await r.json();if(!/^[a-f0-9]{64}$/.test(a.owner))throw Error();owner=a.owner;legacy=a.legacyNotesAllowed==='true';
  // Preserve old files/keys; only the configured legacy owner may adopt them.
  if(legacy&&localStorage.getItem(key('jarvis_notes'))===null){const old=localStorage.getItem('jarvis_notes');if(old!==null){localStorage.setItem(key('jarvis_notes'),old);const baseline=localStorage.getItem('jarvis_notes_sync:'+window.location.origin);if(baseline!==null)localStorage.setItem(key('jarvis_notes_sync'),baseline);}}
  return true;
 }catch(_){owner=null;return false;}})();
 return {ready,key,get owner(){return owner;},get allowLegacy(){return legacy;}};
})();
