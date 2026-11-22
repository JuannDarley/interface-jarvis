/* Authenticated profile, note images and retryable conversation persistence. */
window.JarvisAccount = (() => {
  const $ = id => document.getElementById(id);
  let owner, profile, busy=false, opening=false;
  let flushing=false;
  const base=()=>window.JARVIS_API_BASE_URL;
  const text=message=>{ $('account-status').textContent=message; };
  async function request(path,options={}) {
    const response=await fetch(base()+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...options});
    if(!response.ok){const body=await response.json().catch(()=>({}));throw Object.assign(new Error(body.message||body.error||'Servidor indisponível. Seus dados locais foram mantidos.'),{status:response.status});}
    return response.status===204?null:response.json();
  }
  const draftKey=()=>`jarvis_profile_draft:${owner}`;
  const queueKey=()=>`jarvis_history_outbox:${owner}`;
  function applyMotion(value){document.documentElement.classList.toggle('jarvis-reduced-motion',value==='true');}
  function formValue(){return {revision:profile.revision,displayName:$('account-name').value,bio:$('account-bio').value,preferences:{reduceMotion:String($('account-motion').checked)},avatarId:profile.avatarId};}
  function backupDraft(){if(owner&&profile)localStorage.setItem(draftKey(),JSON.stringify(formValue()));}
  function renderProfile(p){
    $('account-name').value=p.displayName||'';$('account-bio').value=p.bio||'';$('account-motion').checked=p.preferences?.reduceMotion==='true';
    $('account-avatar').hidden=!p.avatarId;if(p.avatarId)$('account-avatar').src=base()+`/api/images/${p.avatarId}/content`;
    applyMotion(p.preferences?.reduceMotion);
  }
  async function loadProfile(useDraft=true){
    const account=await request('/api/profile');
    if(owner&&owner!==account.owner)throw new Error('Sua sessão mudou. Reabra o Jarvis para preservar a separação dos usuários.');
    owner=account.owner;profile=account.profile;
    const draft=useDraft?JSON.parse(localStorage.getItem(draftKey())||'null'):null;
    if(draft){profile=draft;renderProfile(draft);text('Rascunho local preservado. Salve para sincronizar; versões divergentes serão sinalizadas.');}
    else{renderProfile(profile);text('Perfil pronto para sincronizar.');}
    for(const id of ['account-photo','account-name','account-bio','account-motion','account-save'])$(id).disabled=false;
  }
  async function upload(file,noteId){
    if(!file||file.size>5242880||!['image/png','image/jpeg'].includes(file.type))throw new Error('Escolha PNG/JPEG de até 5 MB.');
    // The browser applies phone EXIF orientation before drawing; originals stay on the device.
    const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    let body=file;
    try {
      let scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      for(let i=0;i<8;i++) {
        canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        body=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        if(body&&body.size<=3145728)break;
        scale*=0.8;
      }
      if(!body||body.size>3145728)throw new Error('Reduza a imagem e tente novamente.');
    }finally{bitmap.close();}
    return request('/api/images'+(noteId?'?noteId='+encodeURIComponent(noteId):''),{method:'POST',headers:{'Content-Type':'image/png'},body});
  }
  function imageCard(info,afterDelete){
    const card=document.createElement('div');card.className='account-image-card';
    const img=document.createElement('img');img.src=base()+`/api/images/${info.id}/content`;img.alt=info.noteId?'Imagem anexada à nota':'Imagem do perfil';img.loading='lazy';
    const label=document.createElement('small');label.textContent=info.noteId?'Nota: '+(currentNotes.find(n=>n.id===info.noteId)?.title||'nota removida'):'Imagem de perfil';
    const remove=document.createElement('button');remove.type='button';remove.textContent='EXCLUIR IMAGEM';
    remove.addEventListener('click',async()=>{
      if(!confirm('Excluir esta imagem do banco? Esta ação não pode ser desfeita.'))return;
      remove.disabled=true;
      try{await request('/api/images/'+info.id,{method:'DELETE'});card.remove();await afterDelete?.(info.id);}catch(error){if($('modal-note').classList.contains('open'))$('note-images-status').textContent=error.message;else text(error.message);remove.disabled=false;}
    });
    card.append(img,label,remove);return card;
  }
  async function gallery(){
    const images=await request('/api/images');$('account-images').replaceChildren(...images.map(info=>imageCard(info,async id=>{
      if(profile?.avatarId===id){profile.avatarId=null;$('account-avatar').hidden=true;backupDraft();text('Imagem excluída. Recarregue o perfil se ele foi alterado em outro dispositivo.');}
    })));
    if(!images.length)$('account-images').textContent='Nenhuma imagem salva.';
  }
  async function history(){
    const turns=await request('/api/history');
    const nodes=turns.map(turn=>{
      const item=document.createElement('article');const time=document.createElement('time');time.textContent='Salvo em '+new Date(turn.createdAt).toLocaleString('pt-BR');
      const user=document.createElement('p');user.textContent='VOCÊ: '+turn.message;const reply=document.createElement('p');reply.textContent='JARVIS: '+turn.reply;
      item.append(time,user,reply);return item;
    });
    $('account-history').replaceChildren(...nodes);if(!nodes.length)$('account-history').textContent='Nenhuma conversa salva ainda.';
    // Viewing saved conversations does not automatically send old conversations to the AI.
  }
  async function flush(){
    if(!owner||flushing)return;flushing=true;
    try{
      let queue=JSON.parse(localStorage.getItem(queueKey())||'[]');
      while(queue.length){const item=queue[0];await request('/api/history/'+item.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});queue=JSON.parse(localStorage.getItem(queueKey())||'[]').filter(t=>t.id!==item.id);localStorage.setItem(queueKey(),JSON.stringify(queue));}
    }catch(_){text('Conversas pendentes preservadas neste dispositivo; tente novamente ao reconectar.');}
    finally{flushing=false;}
  }
  const ready = new Promise(resolve=>window.addEventListener('DOMContentLoaded',async()=>{
    try{owner=(await request('/api/account/identity')).owner;await loadProfile();await flush();await history();}
    catch(_){text('Banco indisponível; dados locais preservados.');}
    finally{resolve();}
  }));
  async function recordTurn(message,reply){
    await ready;if(!reply?.trim())return;
    if(!owner){text('Não foi possível identificar a sessão; a conversa continua no histórico desta sessão.');return;}
    try{
      const queue=JSON.parse(localStorage.getItem(queueKey())||'[]');
      queue.push({id:crypto.randomUUID(),message,reply,createdAt:null});localStorage.setItem(queueKey(),JSON.stringify(queue));await flush();
    }catch(_){text('Não foi possível guardar o histórico local. Libere espaço no dispositivo.');}
  }
  async function noteImages(){
    const id=$('modal-note-id').value;
    $('note-image-file').disabled=!id;$('note-image-upload').disabled=!id;
    $('note-images').replaceChildren();$('note-images-status').textContent=id?'Imagens desta nota · salve e sincronize alterações antes de anexar.':'Salve e sincronize a nota para anexar imagens.';
    if(!id)return;
    try{const images=await request('/api/images?noteId='+encodeURIComponent(id));if($('modal-note-id').value===id)$('note-images').replaceChildren(...images.map(info=>imageCard(info)));}
    catch(_){if($('modal-note-id').value===id)$('note-images-status').textContent='Imagens indisponíveis; o texto da nota continua preservado.';}
  }
  window.addEventListener('DOMContentLoaded',()=>{
    $('open-account').addEventListener('click',async()=>{
      if(opening)return;opening=true;$('account-dialog').showModal();
      try{await ready;await loadProfile();await gallery();await flush();await history();}catch(error){text(error.message);}finally{opening=false;}
    });
    $('account-close').addEventListener('click',()=>{$('account-dialog').close();});
    $('account-form').addEventListener('input',()=>{try{backupDraft();}catch(_){text('Não foi possível preservar o rascunho local.');}});
    $('account-form').addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!profile)return;busy=true;$('account-save').disabled=true;
      try{backupDraft();const submitted=formValue();const saved=await request('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(submitted)});
        // Never discard edits made while the request was in flight.
        if(JSON.stringify(formValue())===JSON.stringify(submitted)){profile=saved;localStorage.removeItem(draftKey());renderProfile(saved);text('Perfil salvo.');}
        else{profile={...formValue(),revision:saved.revision};backupDraft();text('Perfil salvo; há novas alterações no rascunho.');}
      }catch(error){text(error.status===409?'O perfil mudou em outro dispositivo. Seu rascunho foi mantido; recarregue para revisar.':error.message);}
      finally{busy=false;$('account-save').disabled=!profile;}
    });
    $('account-reload').addEventListener('click',async()=>{
      if(owner&&localStorage.getItem(draftKey())&&!confirm('Recarregar o perfil do servidor? Uma cópia do seu rascunho será preservada.'))return;
      try{if(owner&&localStorage.getItem(draftKey())){localStorage.setItem(draftKey()+':backup',localStorage.getItem(draftKey()));localStorage.removeItem(draftKey());}await loadProfile(false);}catch(error){text(error.message);}
    });
    $('account-photo').addEventListener('change',async()=>{
      try{if(!profile)throw new Error('Aguarde o perfil conectar.');const image=await upload($('account-photo').files[0]);profile.avatarId=image.id;backupDraft();$('account-avatar').src=base()+`/api/images/${image.id}/content`;$('account-avatar').hidden=false;text('Foto enviada. Clique em SALVAR PERFIL para usá-la.');await gallery();}
      catch(error){text(error.message);}finally{$('account-photo').value='';}
    });
    $('account-motion').addEventListener('change',()=>applyMotion(String($('account-motion').checked)));
    $('account-history-refresh').addEventListener('click',async()=>{try{await flush();await history();}catch(error){text(error.message);}});
    $('note-image-upload').addEventListener('click',async()=>{
      const button=$('note-image-upload');const id=$('modal-note-id').value;if(!id)return;button.disabled=true;
      try{await upload($('note-image-file').files[0],id);$('note-image-file').value='';if($('modal-note-id').value===id)await noteImages();}
      catch(error){$('note-images-status').textContent=error.message;}finally{button.disabled=!$('modal-note-id').value;}
    });
    new MutationObserver(()=>{if($('modal-note').classList.contains('open'))noteImages();}).observe($('modal-note'),{attributes:true,attributeFilter:['class']});
  });
  window.addEventListener('online',flush);window.addEventListener('focus',flush);
  return {recordTurn};
})();
