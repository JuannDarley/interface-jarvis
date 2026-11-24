/* Planning stays local until explicit save; revision checks protect other devices. */
window.JarvisPlanning = (() => {
  const $=id=>document.getElementById(id);
  const dialog=$('planning-dialog');
  const priorities={high:'Alta',normal:'Normal',low:'Baixa'};
  const states={todo:'A fazer',doing:'Em andamento',done:'Concluída'};
  let owner,plan,dirty=false,busy=false,goalFilter=null,editing=null,remote=null,deletion=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const key=()=>`jarvis_planning_draft:${owner}`;
  const message=text=>{$('planning-status').textContent=text;};
  const dateLabel=date=>date?date.split('-').reverse().join('/'):'';
  const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  function controls(){
    $('planning-save').disabled=busy||!plan||!dirty||!!editing;
    $('planning-refresh').disabled=busy||!!editing;
    $('planning-new-task').disabled=busy||!plan;
    $('planning-new-goal').disabled=busy||!plan;
    $('planning-use-server').disabled=busy;
    for(const node of $('planning-form').elements)node.disabled=busy;
    for(const node of dialog.querySelectorAll('[data-mutate]'))node.disabled=busy;
  }
  async function request(path,options={}) {
    const response=await fetch(window.JARVIS_API_BASE_URL+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...options});
    if(!response.ok){const body=await response.json().catch(()=>({}));throw Object.assign(new Error(body.error||body.message||(response.status===401?'Sua sessão expirou. Entre novamente para continuar.':'Sem conexão. Seu rascunho foi preservado neste dispositivo.')),{status:response.status});}
    return response.json();
  }
  function persist(next){
    // Store before changing the visible plan. A full disk must not silently discard a draft.
    localStorage.setItem(key(),JSON.stringify(next));
    plan=next;dirty=true;render();message('Rascunho guardado neste dispositivo. Salve para sincronizar com o Mac e o celular.');
  }
  function change(mutator){
    if(busy||!plan)return false;
    try{const next=clone(plan);mutator(next);persist(next);return true;}
    catch(_){render();message('Não foi possível guardar o rascunho. Libere espaço neste dispositivo antes de continuar.');return false;}
  }
  function action(text,fn){const button=make('button',text);button.type='button';button.dataset.mutate='';button.addEventListener('click',fn);return button;}
  function render(){
    if(!plan){
      for(const id of ['planning-summary','planning-goals-list','planning-tasks-list','planning-remote'])$(id).replaceChildren();
      $('planning-conflict').hidden=true;$('planning-editor').hidden=true;editing=null;
      $('planning-empty').hidden=false;$('planning-empty').textContent='Entre na sua sessão para carregar tarefas e metas.';
      controls();return;
    }
    const completed=plan.tasks.filter(t=>t.status==='done').length;
    const overdue=plan.tasks.filter(t=>t.status!=='done'&&t.dueDate&&t.dueDate<today()).length;
    $('planning-summary').replaceChildren(...[[plan.tasks.length-completed,'Em aberto'],[completed,'Concluídas'],[overdue,'Prazo vencido']].map(([count,label])=>{
      const item=make('article');item.append(make('strong',String(count)),make('span',label));return item;
    }));
    if(goalFilter&&!plan.goals.some(g=>g.id===goalFilter))goalFilter=null;
    $('planning-all-goals').setAttribute('aria-pressed',String(!goalFilter));
    $('planning-goals-list').replaceChildren(...plan.goals.map(goal=>{
      const tasks=plan.tasks.filter(t=>t.goalId===goal.id),done=tasks.filter(t=>t.status==='done').length;
      const percent=tasks.length?Math.round(done/tasks.length*100):0;
      const card=make('article',undefined,'planning-goal'+(goalFilter===goal.id?' selected':''));
      const select=action(goal.title,()=>{goalFilter=goal.id;render();});select.className='planning-goal-select';select.setAttribute('aria-pressed',String(goalFilter===goal.id));
      const progress=make('progress');progress.max=100;progress.value=percent;progress.setAttribute('aria-label',`Progresso de ${goal.title}: ${percent}%`);
      card.append(select,make('p',tasks.length?`${done} de ${tasks.length} tarefas · ${percent}%`:'Adicione tarefas para acompanhar o progresso.'),progress);
      if(goal.description)card.append(make('p',goal.description));
      if(goal.dueDate)card.append(make('p','Prazo: '+dateLabel(goal.dueDate)));
      const actions=make('div',undefined,'planning-goal-actions');actions.append(action('Editar',()=>edit('goal',goal)),action('Excluir',()=>askDelete('goal',goal)));card.append(actions);return card;
    }));
    if(!plan.goals.length)$('planning-goals-list').append(make('p','Crie sua primeira meta e divida-a em tarefas.','planning-empty'));
    const filter=$('planning-filter').value,priority=$('planning-priority-filter').value;
    const tasks=plan.tasks.filter(t=>(!goalFilter||t.goalId===goalFilter)&&(filter==='all'||(filter==='done'?t.status==='done':t.status!=='done'))&&(priority==='all'||t.priority===priority));
    tasks.sort((a,b)=>(a.status==='done')-(b.status==='done')||({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority])||(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.title.localeCompare(b.title,'pt-BR'));
    $('planning-list-title').textContent=goalFilter?plan.goals.find(g=>g.id===goalFilter).title:'Próximos passos';
    $('planning-empty').hidden=tasks.length>0;
    $('planning-empty').textContent=plan.tasks.length?'Nenhuma tarefa neste filtro.':'Comece com uma tarefa pequena. Um passo de cada vez.';
    $('planning-tasks-list').replaceChildren(...tasks.map(task=>{
      const card=make('article',undefined,'planning-task');card.dataset.priority=task.priority;card.dataset.status=task.status;
      card.append(make('h4',task.title));if(task.description)card.append(make('p',task.description));
      const goal=plan.goals.find(g=>g.id===task.goalId);
      card.append(make('p',`Prioridade ${priorities[task.priority]}${goal?' · '+goal.title:''}`,'planning-task-meta'));
      if(task.dueDate)card.append(make('p',(task.status!=='done'&&task.dueDate<today()?'Prazo vencido: ':'Prazo: ')+dateLabel(task.dueDate),task.status!=='done'&&task.dueDate<today()?'planning-overdue':'planning-task-meta'));
      const actions=make('div',undefined,'planning-task-actions'),select=make('select');select.dataset.mutate='';select.setAttribute('aria-label','Situação de '+task.title);
      Object.entries(states).forEach(([value,label])=>{const option=make('option',label);option.value=value;select.append(option);});select.value=task.status;
      select.addEventListener('change',()=>change(next=>{next.tasks.find(t=>t.id===task.id).status=select.value;}));
      actions.append(select,action(task.status==='done'?'REABRIR':'CONCLUIR',()=>change(next=>{next.tasks.find(t=>t.id===task.id).status=task.status==='done'?'todo':'done';})),action('Editar',()=>edit('task',task)),action('Excluir',()=>askDelete('task',task)));
      card.append(actions);return card;
    }));controls();
  }
  function edit(kind,item){
    if(!plan||busy)return;
    editing={kind,id:item?.id||null};
    $('planning-editor-title').textContent=(item?'Editar ':'Nova ')+(kind==='goal'?'meta':'tarefa');
    $('planning-item-title').value=item?.title||'';$('planning-item-description').value=item?.description||'';$('planning-item-date').value=item?.dueDate||'';
    for(const id of ['planning-priority-label','planning-goal-label','planning-state-label'])$(id).hidden=kind==='goal';
    $('planning-item-priority').value=item?.priority||'normal';$('planning-item-state').value=item?.status||'todo';
    const select=$('planning-item-goal');select.replaceChildren();const empty=make('option','Sem meta');empty.value='';select.append(empty);
    plan.goals.forEach(g=>{const option=make('option',g.title);option.value=g.id;select.append(option);});select.value=item?.goalId||goalFilter||'';
    $('planning-editor').hidden=false;$('planning-delete-confirm').hidden=true;controls();
    $('planning-item-title').focus();$('planning-editor').scrollIntoView({block:'nearest'});
  }
  function askDelete(kind,item){
    editing=null;controls();deletion={kind,id:item.id};$('planning-delete-message').textContent=kind==='goal'?`Excluir a meta “${item.title}”? As tarefas serão mantidas, sem vínculo com a meta.`:`Excluir a tarefa “${item.title}”? A mudança só será enviada ao salvar.`;
    $('planning-delete-confirm').hidden=false;$('planning-editor').hidden=true;$('planning-delete-yes').focus();
  }
  function showConflict(server){
    remote=server;const nodes=[];
    for(const goal of server.goals)nodes.push(make('p','Meta: '+goal.title,'planning-remote-item'));
    for(const task of server.tasks)nodes.push(make('p',`${states[task.status]} · ${task.title}${task.dueDate?' · '+dateLabel(task.dueDate):''}${task.description?'\n'+task.description:''}`,'planning-remote-item'));
    if(!nodes.length)nodes.push(make('p','Nenhuma tarefa ou meta no servidor.'));
    $('planning-remote').replaceChildren(...nodes);$('planning-conflict').hidden=false;
    message('Outra versão foi encontrada. Revise as diferenças antes de continuar. Seu rascunho não foi substituído.');
  }
  function same(a,b){return JSON.stringify({goals:a.goals,tasks:a.tasks})===JSON.stringify({goals:b.goals,tasks:b.tasks});}
  async function load(){
    if(busy||editing)return;busy=true;controls();message('Carregando tarefas e metas…');
    try {
      const identity=await request('/api/account/identity');
      if(owner&&owner!==identity.owner){plan=null;dirty=false;throw Error('Sua sessão mudou. Feche e abra o aplicativo para continuar com o usuário atual.');}
      owner=identity.owner;
      const saved=localStorage.getItem(key());
      if(saved){plan=JSON.parse(saved);dirty=true;}
      const server=await request('/api/planning');
      if(dirty&&plan&&!same(plan,server)){showConflict(server);}
      else {
        if(saved)localStorage.removeItem(key());
        plan=server;dirty=false;remote=null;$('planning-conflict').hidden=true;
        message('Tarefas sincronizadas. Crie uma meta ou escolha seu próximo passo.');
      }
    }catch(error){message(error.message);}
    finally{busy=false;render();}
  }
  async function save(){
    if(!plan||!dirty||busy||editing)return;
    busy=true;controls();message('Salvando suas alterações…');
    try {
      const server=await request('/api/planning',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(plan)});
      localStorage.removeItem(key());plan=server;dirty=false;remote=null;$('planning-conflict').hidden=true;message('Tarefas e metas salvas. Disponíveis nos seus dispositivos.');
    }catch(error){
      message(error.message);
      if(error.status===409){try{showConflict(await request('/api/planning'));}catch(_){message('Não foi possível carregar a outra versão. Seu rascunho foi preservado.');}}
    }finally{busy=false;render();}
  }
  $('open-planning').addEventListener('click',()=>{dialog.showModal();void load();});
  $('planning-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{$('open-planning').focus();});
  $('planning-save').addEventListener('click',save);$('planning-refresh').addEventListener('click',load);
  $('planning-all-goals').addEventListener('click',()=>{goalFilter=null;render();});
  for(const id of ['planning-filter','planning-priority-filter'])$(id).addEventListener('change',render);
  $('planning-new-task').addEventListener('click',()=>edit('task'));
  $('planning-new-goal').addEventListener('click',()=>edit('goal'));
  $('planning-cancel-edit').addEventListener('click',()=>{$('planning-editor').hidden=true;editing=null;controls();});
  $('planning-form').addEventListener('submit',event=>{
    event.preventDefault();if(!editing||busy||!plan)return;
    const title=$('planning-item-title').value.trim();if(!title){$('planning-item-title').focus();return;}
    const item={id:editing.id||crypto.randomUUID(),title,description:$('planning-item-description').value,dueDate:$('planning-item-date').value||null};
    const kind=editing.kind,list=kind==='goal'?'goals':'tasks';
    if(kind==='task')Object.assign(item,{priority:$('planning-item-priority').value,status:$('planning-item-state').value,goalId:$('planning-item-goal').value||null});
    if(!editing.id&&plan[list].length>=(kind==='goal'?100:500)){message('Limite atingido: 100 metas e 500 tarefas. Organize os itens existentes antes de adicionar mais.');return;}
    if(change(next=>{const index=next[list].findIndex(x=>x.id===item.id);if(index<0)next[list].push(item);else next[list][index]=item;})){$('planning-editor').hidden=true;editing=null;controls();}
  });
  $('planning-delete-no').addEventListener('click',()=>{$('planning-delete-confirm').hidden=true;deletion=null;});
  $('planning-delete-yes').addEventListener('click',()=>{
    if(!deletion||busy)return;const {kind,id}=deletion;
    if(change(next=>{if(kind==='goal'){next.goals=next.goals.filter(g=>g.id!==id);next.tasks.forEach(t=>{if(t.goalId===id)t.goalId=null;});}else next.tasks=next.tasks.filter(t=>t.id!==id);})){deletion=null;$('planning-delete-confirm').hidden=true;}
  });
  $('planning-use-server').addEventListener('click',()=>{
    if(!remote||busy)return;
    try{if(dirty)localStorage.setItem(`jarvis_planning_backup:${owner}:${Date.now()}`,JSON.stringify(plan));localStorage.removeItem(key());plan=remote;remote=null;dirty=false;$('planning-conflict').hidden=true;$('planning-editor').hidden=true;editing=null;render();message('Versão do servidor carregada. Uma cópia do rascunho foi guardada neste dispositivo.');}
    catch(_){message('Sem espaço para o backup. Seu rascunho foi mantido; nenhuma versão foi substituída.');}
  });
  $('planning-keep-draft').addEventListener('click',()=>{$('planning-conflict').hidden=true;message('Rascunho mantido. A outra versão não será sobrescrita ao salvar.');});
  return {open:()=>{$('open-planning').click();}};
})();
