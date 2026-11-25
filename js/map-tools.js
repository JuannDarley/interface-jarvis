window.JarvisMapTools=(()=>{
 const $=id=>document.getElementById(id);let map,owner,state,dirty=false,busy=false,selected,following=false,remote,lastFollow=0;
 const positions=new Map();
 const msg=text=>{$('map-tools-status').textContent=text;};
 const key=()=>`jarvis_map_draft:${owner}`;
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function controls(){for(const id of ['map-place-add','map-aircraft-filter'])$(id).disabled=busy||!state;$('map-preferences-save').disabled=busy||!dirty||!state;$('map-preferences-reload').disabled=busy;$('map-follow').disabled=!selected||!map;$('map-favorite-add').disabled=busy||!selected||!state;}
 async function request(path,options={}){const r=await fetch(window.JARVIS_API_BASE_URL+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...options,headers:{...(owner?{'X-Jarvis-Owner':owner}:{}),...options.headers}});if(!r.ok){const data=await r.json().catch(()=>({}));throw Object.assign(new Error(data.error||'Não foi possível sincronizar o mapa. Rascunho preservado.'),{status:r.status});}return r.json();}
 function applyFilter(){if(map?.getLayer('flights'))map.setFilter('flights',state?.category==='all'||!state?null:['==',['get','icon'],state.category]);}
 function button(text,fn){const b=make('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 function render(){
  $('map-place-list').replaceChildren(...(state?.places||[]).map(p=>{const row=make('div');row.append(button(p.name,()=>{following=false;map?.jumpTo({center:[p.longitude,p.latitude],zoom:p.zoom});renderFollow();}),button('REMOVER',()=>change(s=>{s.places=s.places.filter(x=>x.id!==p.id);})));return row;}));
  $('map-favorite-list').replaceChildren(...(state?.favorites||[]).map(f=>{const row=make('div');row.append(button((f.kind==='flight'?'✈ ':'⚓ ')+f.name,()=>{const fresh=positions.get(f.kind+':'+f.id);choose(fresh||{...f,coordinates:[f.longitude,f.latitude],observedAt:null});map?.jumpTo({center:selected.coordinates,zoom:Math.max(map.getZoom(),5)});msg(fresh?'Alvo recebido nesta consulta. Acompanhe para atualizar a centralização.':'Última posição salva. Atualize a camada para receber novas posições.');}),button('REMOVER',()=>change(s=>{s.favorites=s.favorites.filter(x=>x.kind!==f.kind||x.id!==f.id);})));return row;}));
  $('map-aircraft-filter').value=state?.category||'all';applyFilter();renderFollow();controls();
 }
 function renderFollow(){$('map-follow').textContent=following?'PARAR ACOMPANHAMENTO':'ACOMPANHAR';$('map-selected-name').textContent=selected?selected.name+(following?' · acompanhando':' · selecionado'):'Clique em um avião ou navio.';}
 function change(fn){if(!state||busy)return;try{const next=JSON.parse(JSON.stringify(state));fn(next);if(next.places.length>50||next.favorites.length>100)throw Error('Limite: 50 regiões e 100 favoritos.');localStorage.setItem(key(),JSON.stringify(next));state=next;dirty=true;render();msg('Rascunho local. Salve as alterações para sincronizar.');}catch(e){msg(e.message||'Não foi possível preservar o rascunho.');render();}}
 function choose(item){if(!item||!['flight','vessel'].includes(item.kind)||!Array.isArray(item.coordinates)||item.coordinates.length!==2||!item.coordinates.every(Number.isFinite))return;selected=item;following=false;renderFollow();controls();}
 function conflict(value){remote=value;$('map-preferences-remote').textContent=[...value.places.map(p=>'Região: '+p.name),...value.favorites.map(f=>'Favorito: '+f.name)].join(' · ')||'Nenhuma região ou favorito no servidor.';$('map-preferences-conflict').hidden=false;msg('Existe outra versão salva. O rascunho local não foi substituído.');}
 function same(a,b){return JSON.stringify([a.places,a.favorites,a.category])===JSON.stringify([b.places,b.favorites,b.category]);}
 async function load(){if(busy)return;busy=true;controls();try{const identity=await request('/api/account/identity');if(owner&&identity.owner!==owner){state=null;dirty=false;selected=null;following=false;positions.clear();$('map-place-name').value='';render();}owner=identity.owner;const draft=localStorage.getItem(key());if(draft){state=JSON.parse(draft);dirty=true;}const saved=await request('/api/map/preferences');if(dirty&&state&&!same(state,saved))conflict(saved);else{state=saved;dirty=false;localStorage.removeItem(key());$('map-preferences-conflict').hidden=true;msg('Regiões, favoritos e filtro sincronizados.');}}catch(e){msg(e.message);}finally{busy=false;render();}}
 async function save(){if(busy||!state||!dirty)return;busy=true;controls();try{state=await request('/api/map/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});localStorage.removeItem(key());dirty=false;$('map-preferences-conflict').hidden=true;msg('Organização do mapa salva.');}catch(e){msg(e.message);if(e.status===409)try{conflict(await request('/api/map/preferences'));}catch(_){} }finally{busy=false;render();}}
 function updates({kind,features}){
  if(!map||!Array.isArray(features))return;
  for(const feature of features){const p=feature.properties||{},id=kind==='flight'?p.id:String(p.mmsi),coordinates=feature.geometry?.coordinates;if(!Array.isArray(coordinates)||!coordinates.every(Number.isFinite))continue;
   positions.set(kind+':'+id,{kind,id,name:kind==='flight'?(p.callsign||p.registration||id):(p.name||id),coordinates,observedAt:kind==='flight'?p.positionTime:Date.parse(p.receivedAt)});
  }
  while(positions.size>2500)positions.delete(positions.keys().next().value);
  if(!following||selected?.kind!==kind)return;
  const latest=features.find(f=>String(kind==='flight'?f.properties.id:f.properties.mmsi)===selected.id);
  if(!latest){following=false;renderFollow();msg('O alvo não veio na consulta atual. Acompanhamento pausado; a última posição foi mantida.');return;}
  const fresh=positions.get(kind+':'+selected.id);if(!fresh)return;selected=fresh;
  if(Number.isFinite(fresh.observedAt)&&Date.now()-fresh.observedAt>300000){following=false;renderFollow();msg('A posição recebida está antiga. Acompanhamento pausado.');return;}
  const center=map.getCenter();if(Date.now()-lastFollow>60000&&(Math.abs(center.lng-fresh.coordinates[0])>.03||Math.abs(center.lat-fresh.coordinates[1])>.03)){lastFollow=Date.now();map.jumpTo({center:fresh.coordinates});}
 }
 $('map-place-add').addEventListener('click',()=>{const name=$('map-place-name').value.trim();if(!name||!map)return;const c=map.getCenter();change(s=>s.places.push({id:crypto.randomUUID(),name,longitude:((c.lng+180)%360+360)%360-180,latitude:c.lat,zoom:map.getZoom()}));});
 $('map-aircraft-filter').addEventListener('change',()=>{const category=$('map-aircraft-filter').value;change(s=>{s.category=category;});});
 $('map-favorite-add').addEventListener('click',()=>{if(!selected)return;change(s=>{if(s.favorites.some(f=>f.kind===selected.kind&&f.id===selected.id))throw Error('Este alvo já está nos favoritos.');s.favorites.push({kind:selected.kind,id:selected.id,name:selected.name,longitude:selected.coordinates[0],latitude:selected.coordinates[1]});});});
 $('map-follow').addEventListener('click',()=>{if(!selected||!map)return;if(!following&&!$(selected.kind==='flight'?'flights-toggle':'vessels-toggle').checked){msg('Ative a camada do alvo antes de acompanhar.');return;}following=!following;lastFollow=0;if(following)map.jumpTo({center:selected.coordinates,zoom:Math.max(map.getZoom(),5)});renderFollow();msg(following?'Acompanhamento ativado; aguardando as próximas consultas da camada.':'Acompanhamento encerrado.');});
 $('map-preferences-save').addEventListener('click',save);$('map-preferences-reload').addEventListener('click',load);
 $('map-preferences-use-remote').addEventListener('click',()=>{if(!remote||busy)return;try{localStorage.setItem(`jarvis_map_backup:${owner}:${Date.now()}`,JSON.stringify(state));localStorage.removeItem(key());state=remote;remote=null;dirty=false;$('map-preferences-conflict').hidden=true;render();msg('Versão do servidor carregada. Rascunho anterior copiado neste dispositivo.');}catch(_){msg('Sem espaço para o backup. Rascunho preservado.');}});
 function attach(value){map=value;state=null;dirty=false;$('map-place-list').replaceChildren();$('map-favorite-list').replaceChildren();map.on('dragstart',()=>{following=false;renderFollow();});void load();}
 document.addEventListener('jarvis:map-ready',event=>attach(event.detail));
 document.addEventListener('jarvis:map-close',()=>{map=null;selected=null;following=false;positions.clear();renderFollow();controls();});
 document.addEventListener('jarvis:entity-selected',event=>choose(event.detail));document.addEventListener('jarvis:entities-updated',event=>updates(event.detail));
 for(const [id,kind] of [['flights-toggle','flight'],['vessels-toggle','vessel']])$(id).addEventListener('change',()=>{if(!$(id).checked&&selected?.kind===kind){following=false;renderFollow();msg('Camada desligada. Acompanhamento pausado.');}});
 const timer=setInterval(()=>{if(following&&selected?.kind==='vessel'&&map&&!document.hidden){const refresh=$('vessels-refresh');if(!refresh.disabled)refresh.click();}},90000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 return {attach,get following(){return following;}};
})();
