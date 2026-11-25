/* The Java API owns schedules and time comparisons. Clients keep drafts and acknowledge reminders explicitly. */
window.JarvisAgenda=(()=>{
  const $=id=>document.getElementById(id),dialog=$('agenda-dialog');
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const localDate=value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const localInput=value=>{const d=new Date(value);return localDate(d)+`T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  const time=value=>new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const full=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  const today=()=>localDate(new Date());
  let owner,device,events=[],month=new Date(new Date().getFullYear(),new Date().getMonth(),1),selected=null,busy=false,editing=null,remote=null,confirmation=null,polling=false,notices=[],nativeInFlight=new Set(),identityBlocked=false;
  const message=text=>{$('agenda-status').textContent=text;};
  const draftKey=()=>`jarvis_agenda_draft:${owner}`;
  const prefKey=()=>`jarvis_agenda_notifications:${owner}`;
  const shownKey=()=>`jarvis_agenda_shown:${owner}`;
  function controls(){
    $('agenda-new').disabled=busy||!owner||identityBlocked;
    for(const id of ['agenda-refresh','agenda-previous','agenda-next','agenda-today','agenda-use-remote'])$(id).disabled=busy;
    for(const field of $('agenda-form').elements)field.disabled=busy||!owner||identityBlocked;
    for(const button of dialog.querySelectorAll('[data-event-action]'))button.disabled=busy||identityBlocked;
  }
  async function request(path,options={}){
    const r=await fetch(window.JARVIS_API_BASE_URL+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...options,headers:{...(owner?{'X-Jarvis-Owner':owner}:{}),...options.headers}});
    if(!r.ok){const b=await r.json().catch(()=>({}));throw Object.assign(new Error(b.error||b.message||(r.status===401?'Sua sessão expirou. Entre novamente no JARVIS.':'Sem conexão. Seu rascunho foi mantido neste dispositivo.')),{status:r.status});}
    return r.status===204?null:r.json();
  }
  function clearPersonal(){
    events=[];notices=[];editing=null;remote=null;identityBlocked=true;
    $('agenda-editor').hidden=true;$('agenda-conflict').hidden=true;$('agenda-reminder-items').replaceChildren();$('agenda-inline-reminder-items').replaceChildren();$('agenda-inline-reminders').hidden=true;$('agenda-reminder-banner').hidden=true;
    $('agenda-form').reset();render();
  }
  async function identity(){
    if(identityBlocked)throw Error('Sua sessão mudou. Feche e abra o JARVIS para continuar com o usuário atual.');
    const account=await request('/api/account/identity');
    if(owner&&owner!==account.owner){clearPersonal();throw Error('Sua sessão mudou. Feche e abra o JARVIS para continuar com o usuário atual.');}
    owner=account.owner;
    let stored=localStorage.getItem(`jarvis_agenda_device:${owner}`);
    if(!stored){stored=crypto.randomUUID();localStorage.setItem(`jarvis_agenda_device:${owner}`,stored);}
    device=stored;notificationSettings();
  }
  function notificationSettings(){
    const native=!!window.JarvisDesktop?.notifyReminder;
    $('agenda-notifications').hidden=!native;
    if(native){const enabled=localStorage.getItem(prefKey())==='true';$('agenda-notifications').textContent=enabled?'DESATIVAR NOTIFICAÇÕES NO MAC':'ATIVAR NOTIFICAÇÕES NO MAC';$('agenda-notification-status').textContent=enabled?'Ativadas neste dispositivo. O macOS pode exigir autorização em Ajustes → Notificações → JARVIS.':'Opcional: mostrar o título e horário do compromisso nas notificações do macOS.';}
  }
  function reminderLabel(minutes){return minutes===null?'Sem lembrete':minutes===0?'Lembrete no horário':minutes===1440?'Lembrete 1 dia antes':`Lembrete ${minutes} min antes`;}
  function action(text,fn){const b=make('button',text);b.type='button';b.dataset.eventAction='';b.addEventListener('click',fn);return b;}
  function onDate(e,date){const end=new Date(new Date(e.endAt).getTime()-1);return localDate(e.startAt)<=date&&localDate(end)>=date;}
  function render(){
    $('agenda-month-title').textContent=month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    const showCancelled=$('agenda-show-cancelled').checked,visible=events.filter(e=>showCancelled||!e.cancelled);
    const cells=[];for(let n=0;n<month.getDay();n++)cells.push(make('span'));
    const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let n=1;n<=days;n++){
      const date=localDate(new Date(month.getFullYear(),month.getMonth(),n)),count=visible.filter(e=>onDate(e,date)).length;
      const b=make('button',String(n));b.type='button';b.dataset.today=String(date===today());b.dataset.events=String(count>0);b.setAttribute('aria-pressed',String(selected===date));b.setAttribute('aria-label',`${n} de ${month.toLocaleDateString('pt-BR',{month:'long'})}, ${count} compromissos`);
      b.addEventListener('click',()=>{selected=date;render();});cells.push(b);
    }
    $('agenda-calendar').replaceChildren(...cells);
    const listed=visible.filter(e=>!selected||onDate(e,selected));
    $('agenda-list-title').textContent=selected?new Date(selected+'T12:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long'}):'Compromissos do mês';
    $('agenda-count').textContent=`${listed.length} ${listed.length===1?'compromisso':'compromissos'}`;
    $('agenda-empty').hidden=listed.length>0;
    $('agenda-events-list').replaceChildren(...listed.map(e=>{
      const card=make('article',undefined,'agenda-event');card.dataset.cancelled=String(e.cancelled);card.dataset.eventId=e.id;
      card.append(make('h4',e.title+(e.cancelled?' · Cancelado':'')),make('p',`${full(e.startAt)} → ${localDate(e.startAt)===localDate(e.endAt)?time(e.endAt):full(e.endAt)}`,'agenda-event-time'));
      const minutes=Math.round((new Date(e.endAt)-new Date(e.startAt))/60000);
      card.append(make('p',`${minutes} min · ${reminderLabel(e.reminderMinutes)}`));
      if(e.location)card.append(make('p',e.location,'agenda-event-location'));if(e.description)card.append(make('p',e.description));
      const actions=make('div',undefined,'agenda-event-actions');actions.append(action('EDITAR',()=>openEditor(e)),action(e.cancelled?'REATIVAR':'CANCELAR',()=>confirmOperation(e.cancelled?'reactivate':'cancel',e)),action('EXCLUIR',()=>confirmOperation('delete',e)));card.append(actions);return card;
    }));controls();
  }
  async function list(){
    const from=new Date(month.getFullYear(),month.getMonth(),1),to=new Date(month.getFullYear(),month.getMonth()+1,1);
    const loaded=await request(`/api/agenda/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);if(identityBlocked)return;events=loaded;render();
  }
  async function load(){
    if(busy)return;busy=true;controls();message('Carregando sua agenda…');
    try{await identity();await list();message('Agenda atualizada. Horários exibidos em '+zone+'.');
      if(!editing){const draft=localStorage.getItem(draftKey());if(draft){openEditor(JSON.parse(draft),true);message('Há um rascunho neste dispositivo. Confira e salve para sincronizar.');}}
      await poll();
    }catch(e){message(e.message);if(e.status===401){clearPersonal();}}
    finally{busy=false;controls();}
  }
  function formValue(){
    const start=$('agenda-start').value,end=$('agenda-end').value;
    const begin=new Date(start),finish=new Date(end);
    if(!start||!end||Number.isNaN(+begin)||Number.isNaN(+finish)||localInput(begin)!==start||localInput(finish)!==end)throw Error('Confira os horários. Este horário pode não existir no fuso do dispositivo.');
    if(finish<=begin)throw Error('O fim precisa ser posterior ao início.');
    const {form,...base}=editing;
    return {...base,title:$('agenda-item-title').value.trim(),description:$('agenda-description').value,location:$('agenda-location').value.trim(),startAt:begin.toISOString(),endAt:finish.toISOString(),zone,reminderMinutes:$('agenda-reminder').value===''?null:Number($('agenda-reminder').value)};
  }
  function storeDraft(){
    if(!owner||!editing)return false;
    try{
      // Preserve partially typed values too, without trying to parse incomplete dates.
      const draft={...editing,form:{title:$('agenda-item-title').value,description:$('agenda-description').value,location:$('agenda-location').value,start:$('agenda-start').value,end:$('agenda-end').value,reminder:$('agenda-reminder').value}};
      localStorage.setItem(draftKey(),JSON.stringify(draft));$('agenda-draft-status').textContent='Rascunho preservado neste dispositivo.';return true;
    }catch(_){$('agenda-draft-status').textContent='Sem espaço para preservar o rascunho. Libere espaço antes de salvar.';return false;}
  }
  function duration(){const minutes=(new Date($('agenda-end').value)-new Date($('agenda-start').value))/60000;$('agenda-duration').textContent=Number.isFinite(minutes)&&minutes>0?`Duração: ${minutes} minutos · ${zone}`:`Horários em ${zone}. O fim precisa ser posterior ao início.`;}
  function openEditor(item,restored=false){
    if(!owner||identityBlocked)return;
    if(editing&&!restored&&editing.id!==item?.id){message('Feche ou descarte o rascunho atual antes de editar outro compromisso.');$('agenda-editor').scrollIntoView({block:'nearest'});return;}
    if(!restored&&!editing){const draft=localStorage.getItem(draftKey());if(draft){openEditor(JSON.parse(draft),true);message('Retome ou descarte o rascunho antes de abrir outro compromisso.');return;}}
    const start=new Date(Math.ceil((Date.now()+3600000)/900000)*900000),end=new Date(start.getTime()+1800000);
    editing=item||{id:crypto.randomUUID(),revision:0,title:'',description:'',location:'',startAt:start.toISOString(),endAt:end.toISOString(),zone,reminderMinutes:15,cancelled:false};
    $('agenda-editor-title').textContent=editing.revision?'Editar compromisso':'Novo compromisso';
    const f=editing.form;
    $('agenda-item-title').value=f?.title??editing.title;$('agenda-description').value=f?.description??editing.description;$('agenda-location').value=f?.location??editing.location;
    $('agenda-start').value=f?.start??localInput(editing.startAt);$('agenda-end').value=f?.end??localInput(editing.endAt);$('agenda-reminder').value=f?.reminder??(editing.reminderMinutes===null?'':String(editing.reminderMinutes));
    $('agenda-editor').hidden=false;$('agenda-confirm').hidden=true;$('agenda-draft-status').textContent=restored?'Rascunho recuperado deste dispositivo.':'As alterações só serão enviadas ao salvar.';duration();controls();
    $('agenda-item-title').focus();$('agenda-editor').scrollIntoView({block:'nearest'});
  }
  function showConflict(saved){
    remote=saved;$('agenda-conflict-preview').replaceChildren(make('p',saved.title),make('p',`${full(saved.startAt)} → ${full(saved.endAt)}${saved.cancelled?' · Cancelado':''}`),make('p',saved.location),make('p',saved.description));$('agenda-conflict').hidden=false;message('O compromisso mudou. Seu rascunho não foi substituído.');
  }
  async function save(){
    if(!editing||busy||identityBlocked)return;
    if(!storeDraft())return;
    let event;try{event=formValue();}catch(e){message(e.message);return;}
    busy=true;controls();
    try{
      await identity();const saved=await request('/api/agenda/events/'+event.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});
      localStorage.removeItem(draftKey());editing=null;remote=null;$('agenda-editor').hidden=true;$('agenda-conflict').hidden=true;
      month=new Date(new Date(saved.startAt).getFullYear(),new Date(saved.startAt).getMonth(),1);selected=localDate(saved.startAt);await list();message('Compromisso salvo. Disponível nos seus dispositivos.');await poll();
    }catch(e){message(e.message);if(e.status===409){try{showConflict(await request('/api/agenda/events/'+event.id));}catch(_){message('Não foi possível carregar a outra versão. Seu rascunho foi mantido.');}}}
    finally{busy=false;controls();}
  }
  function confirmOperation(kind,event){
    if(busy)return;
    confirmation={kind,event};$('agenda-confirm-message').textContent=kind==='delete'?`Excluir “${event.title}” definitivamente? Seus lembretes também serão removidos.`:kind==='cancel'?`Cancelar “${event.title}”? Ele continuará na agenda como cancelado e não gerará novos lembretes.`:`Reativar “${event.title}” e seus lembretes?`;
    $('agenda-confirm').hidden=false;$('agenda-confirm-yes').focus();
  }
  async function confirm(){
    if(!confirmation||busy)return;
    const {kind,event}=confirmation;
    if(kind==='discard'){
      try{localStorage.removeItem(draftKey());editing=null;$('agenda-editor').hidden=true;$('agenda-conflict').hidden=true;$('agenda-confirm').hidden=true;confirmation=null;message('Rascunho descartado.');}catch(_){message('Não foi possível remover o rascunho local.');}return;
    }
    if(editing?.id===event.id){message('Feche ou descarte a edição deste compromisso antes de cancelar ou excluir.');return;}
    busy=true;controls();
    try{
      await identity();
      if(kind==='delete')await request(`/api/agenda/events/${event.id}?revision=${event.revision}`,{method:'DELETE'});
      else await request('/api/agenda/events/'+event.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...event,cancelled:kind==='cancel'})});
      confirmation=null;$('agenda-confirm').hidden=true;await list();await poll();message(kind==='delete'?'Compromisso excluído.':kind==='cancel'?'Compromisso cancelado.':'Compromisso reativado.');
    }catch(e){message(e.message);}
    finally{busy=false;controls();}
  }
  async function acknowledge(event,button){
    button.disabled=true;
    try{await request(`/api/agenda/events/${event.id}/ack?revision=${event.revision}&device=${device}`,{method:'POST'});await poll();}
    catch(e){$('agenda-reminder-status').textContent=e.message;button.disabled=false;}
  }
  async function nativeNotice(event){
    if(!window.JarvisDesktop?.notifyReminder||localStorage.getItem(prefKey())!=='true')return;
    const key=event.id+':'+event.revision;if(nativeInFlight.has(key))return;
    let shown;try{shown=JSON.parse(localStorage.getItem(shownKey())||'[]');if(shown.includes(key))return;}catch(_){return;}
    nativeInFlight.add(key);
    try{const result=await window.JarvisDesktop.notifyReminder({key,title:event.title,body:`${full(event.startAt)}${event.location?' · '+event.location:''}`.slice(0,300)});
      if(result?.shown){const latest=JSON.parse(localStorage.getItem(shownKey())||'[]');localStorage.setItem(shownKey(),JSON.stringify([...new Set([...latest,key])].slice(-500)));}
      else $('agenda-notification-status').textContent='O macOS não confirmou a notificação. O lembrete continua visível no JARVIS.';
    }catch(_){$('agenda-notification-status').textContent='Não foi possível mostrar a notificação no Mac. O lembrete continua no painel.';}
    finally{nativeInFlight.delete(key);}
  }
  function renderNotices(){
    $('agenda-reminder-banner').hidden=!notices.length||dialog.open;
    $('agenda-inline-reminders').hidden=!notices.length;
    $('agenda-reminder-banner').setAttribute('aria-hidden',String(dialog.open));
    $('agenda-reminder-items').replaceChildren();$('agenda-inline-reminder-items').replaceChildren();
    const target=dialog.open?$('agenda-inline-reminder-items'):$('agenda-reminder-items');
    target.replaceChildren(...notices.map(event=>{
      const card=make('article');card.append(make('strong',event.title),make('p',`${full(event.startAt)}${new Date(event.startAt)<new Date()?' · Horário já passou':''}`));
      const dismiss=make('button','MARCAR COMO VISTO');dismiss.type='button';dismiss.addEventListener('click',()=>acknowledge(event,dismiss));
      const view=make('button','ABRIR AGENDA');view.type='button';view.addEventListener('click',()=>{month=new Date(new Date(event.startAt).getFullYear(),new Date(event.startAt).getMonth(),1);selected=localDate(event.startAt);if(!dialog.open)dialog.showModal();renderNotices();void load();});
      card.append(dismiss);if(!dialog.open)card.append(view);return card;
    }));
    if(dialog.open&&notices.length)$('agenda-reminder-status').textContent=`${notices.length} lembrete(s) aguardando confirmação. Feche a agenda para vê-los no painel.`;
  }
  async function poll(){
    if(polling||identityBlocked)return;polling=true;
    try{
      await identity();const due=await request('/api/agenda/reminders?device='+device);if(identityBlocked)return;notices=due;renderNotices();
      $('agenda-reminder-status').textContent=due.length?'Marque como visto após conferir.':'Sem lembretes pendentes.';
      for(const event of due)void nativeNotice(event);
    }catch(e){if(e.status===401){clearPersonal();}else $('agenda-reminder-status').textContent='Sem conexão para atualizar lembretes. Os avisos exibidos podem ter sido alterados em outro dispositivo.';}
    finally{polling=false;}
  }
  $('agenda-zone').textContent='Horários no fuso '+zone;
  $('open-agenda').addEventListener('click',()=>{dialog.showModal();renderNotices();void load();});
  $('agenda-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{renderNotices();$('open-agenda').focus();});
  $('agenda-new').addEventListener('click',()=>openEditor());$('agenda-refresh').addEventListener('click',load);
  $('agenda-previous').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);selected=null;void load();});
  $('agenda-next').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);selected=null;void load();});
  $('agenda-today').addEventListener('click',()=>{month=new Date(new Date().getFullYear(),new Date().getMonth(),1);selected=today();void load();});
  $('agenda-whole-month').addEventListener('click',()=>{selected=null;render();});$('agenda-show-cancelled').addEventListener('change',render);
  $('agenda-form').addEventListener('input',()=>{storeDraft();duration();});$('agenda-form').addEventListener('change',()=>{storeDraft();duration();});
  $('agenda-form').addEventListener('submit',event=>{event.preventDefault();void save();});
  $('agenda-close-editor').addEventListener('click',()=>{if(storeDraft()){$('agenda-editor').hidden=true;editing=null;message('Rascunho mantido. Reabra a agenda para retomá-lo.');}});
  $('agenda-discard-draft').addEventListener('click',()=>{confirmation={kind:'discard'};$('agenda-confirm-message').textContent='Descartar este rascunho do dispositivo? O compromisso salvo no servidor não será alterado.';$('agenda-confirm').hidden=false;});
  $('agenda-confirm-yes').addEventListener('click',confirm);$('agenda-confirm-no').addEventListener('click',()=>{confirmation=null;$('agenda-confirm').hidden=true;});
  $('agenda-keep-draft').addEventListener('click',()=>{$('agenda-conflict').hidden=true;message('Rascunho mantido; salvar não sobrescreverá outra revisão.');});
  $('agenda-use-remote').addEventListener('click',()=>{
    if(!remote||busy)return;
    try{const draft=localStorage.getItem(draftKey());if(draft)localStorage.setItem(`jarvis_agenda_backup:${owner}:${Date.now()}`,draft);localStorage.removeItem(draftKey());const item=remote;editing=null;remote=null;$('agenda-conflict').hidden=true;openEditor(item);message('Versão salva carregada. O rascunho anterior foi copiado neste dispositivo.');}
    catch(_){message('Sem espaço para o backup. Seu rascunho foi preservado.');}
  });
  $('agenda-notifications').addEventListener('click',()=>{try{localStorage.setItem(prefKey(),String(localStorage.getItem(prefKey())!=='true'));notificationSettings();void poll();}catch(_){message('Não foi possível guardar a preferência neste dispositivo.');}});
  window.addEventListener('online',()=>{void poll();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
  window.addEventListener('DOMContentLoaded',()=>{void poll();});const timer=setInterval(()=>{void poll();},30000);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  return {open:()=>{$('open-agenda').click();},checkReminders:poll};
})();
