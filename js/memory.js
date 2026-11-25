window.JarvisMemory=(()=>{
 const $=id=>document.getElementById(id),dialog=$('memory-dialog');
 let owner,selected={profile:false,noteIds:[]},proposal,busy=false,generation=0;
 const msg=text=>{$('memory-status').textContent=text;};
 const resetHistory=()=>{generation++;sessionHistory.length=0;$('context-sources').textContent='Contexto alterado: histórico desta sessão reiniciado. Conversas salvas continuam no perfil.';};
 async function request(path,options={}){const r=await fetch(window.JARVIS_API_BASE_URL+path,{credentials:'same-origin',cache:'no-store',...options,headers:{...(owner?{'X-Jarvis-Owner':owner}:{}),...options.headers}});if(!r.ok){const b=await r.json().catch(()=>({}));throw Error(b.error||b.message||'Não foi possível consultar suas memórias. Nenhum envio foi autorizado.');}return r.json();}
 function value(){return {profile:$('memory-profile').checked,noteIds:[...$('memory-notes').querySelectorAll('input:checked')].map(e=>e.value)};}
 function revoke(){selected={profile:false,noteIds:[]};contextConsent.checked=false;resetHistory();}
 async function load(){
  if(busy)return;busy=true;msg('Carregando memórias salvas…');$('memory-apply').disabled=true;
  try{const catalog=await request('/api/memory/catalog');if(owner&&owner!==catalog.owner){revoke();throw Error('Sua sessão mudou. Reabra o JARVIS.');}owner=catalog.owner;
   $('memory-profile').disabled=!catalog.profileAvailable;$('memory-profile').checked=selected.profile&&catalog.profileAvailable;
   const nodes=catalog.notes.map(note=>{const row=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=note.id;check.checked=selected.noteIds.includes(note.id);label.append(check,document.createTextNode(note.title));const edit=document.createElement('button');edit.type='button';edit.textContent='EDITAR';edit.addEventListener('click',async()=>{await window.JarvisNotes?.synchronize();if(!currentNotes.some(n=>n.id===note.id)){msg('A nota não está disponível neste dispositivo. Confira a sincronização.');return;}dialog.close();window.openNoteEditor(note.id);});row.append(label,edit);return row;});
   $('memory-notes').replaceChildren(...nodes);$('memory-content').hidden=true;$('memory-apply').disabled=false;msg('Escolha as fontes. Nenhuma informação foi enviada à IA.');
  }catch(e){msg(e.message);}finally{busy=false;}
 }
 async function preview(){const payload=value();return request('/api/memory/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}
 $('open-memory').addEventListener('click',()=>{dialog.showModal();void load();});$('memory-close').addEventListener('click',()=>dialog.close());
 $('memory-preview').addEventListener('click',async()=>{try{const p=await preview();$('memory-content').textContent=p.context?JSON.parse(p.context).map(item=>item.source==='perfil'?'MEU PERFIL\nNome: '+item.name+'\nSobre você: '+item.bio:'NOTA: '+item.title+'\n'+item.text).join('\n\n'):'Nenhuma fonte selecionada.';$('memory-content').hidden=false;msg(`${p.sources.length} fonte(s) selecionada(s). Esta prévia não chama a Groq.`);}catch(e){msg(e.message);}});
 $('memory-apply').addEventListener('click',async()=>{try{await preview();selected=value();contextConsent.checked=selected.profile||selected.noteIds.length>0;resetHistory();dialog.close();}catch(e){msg(e.message);}});
 $('memory-off').addEventListener('click',()=>{revoke();dialog.close();});
 contextConsent.addEventListener('change',()=>{resetHistory();if(contextConsent.checked&&!selected.profile&&!selected.noteIds.length){contextConsent.checked=false;dialog.showModal();void load();}});
 $('memory-edit-profile').addEventListener('click',()=>{dialog.close();$('open-account').click();});
 $('memory-dismiss-suggestion').addEventListener('click',()=>{proposal=null;$('memory-suggestion').hidden=true;});
 $('memory-review-suggestion').addEventListener('click',()=>{if(!proposal)return;dialog.close();btnAddNote.click();modalInputTitle.value=proposal.title;modalTextareaBody.value=proposal.body;modalSelectArea.value=AREA[proposal.area]?proposal.area:'meta';proposal=null;$('memory-suggestion').hidden=true;});
 return {
  payload:async()=>{if(!contextConsent.checked)return {memory:{profile:false,noteIds:[]}};const identity=await request('/api/account/identity');if(identity.owner!==owner){revoke();throw Error('Sua sessão mudou. Selecione as memórias novamente.');}return {memory:{profile:selected.profile,noteIds:[...selected.noteIds]}};},
  version:()=>generation,
  headers:()=>owner?{'X-Jarvis-Owner':owner}:{},
  used:sources=>{$('context-sources').textContent=sources?.length?'Contexto enviado: '+sources.map(s=>s.title).join(' · '):'Resposta sem perfil ou notas como contexto adicional.';},
  suggest:(area,title,body)=>{proposal={area,title,body};$('memory-suggestion-text').textContent=title+'\n'+body;$('memory-suggestion').hidden=false;dialog.showModal();void load();}
 };
})();
