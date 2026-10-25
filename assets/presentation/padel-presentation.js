/* Board presentation. All actions below operate on an account-scoped local copy.
   The only remote reads are the owner's existing bookings and dashboard at start.
   There is intentionally no mail builder, mail transport, checkout or PIN API. */
(function(root){
 'use strict';
 const D=root.PBMeetDemoDomain;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clone=v=>JSON.parse(JSON.stringify(v));
 const uid=()=>crypto.randomUUID();
 let state=null,owner=null,busy=false,dialog=null;
 function viewer(){try{return currentUser?.id&&isAdmin()?{id:currentUser.id,email:D.email(currentProfile?.email||currentUser.email),name:currentProfile?.full_name||currentUser.email}:null;}catch{return null;}}
 function active(){const u=viewer();return !!(u&&state&&owner===u.id&&state.enabled);}
 const key=id=>'pb-board-presentation-v1:'+id;
 function persist(){if(!state||!owner)return;try{localStorage.setItem(key(owner),JSON.stringify(state));}catch{toast('Die Vorführung konnte auf diesem Gerät nicht gespeichert werden.');}}
 function toast(text){document.getElementById('pbDemoToast')?.remove();const e=document.createElement('div');e.id='pbDemoToast';e.className='pb-demo-toast';e.setAttribute('role','status');e.textContent=text;document.body.append(e);setTimeout(()=>e.remove(),4500);}
 function date(iso){return new Date(iso+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});}
 const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
 const terms=g=>`${date(g.day)} · ${clock(g.start)}–${clock(g.start+g.minutes)} Uhr · Court #${g.court}`;
 const fullName=e=>e.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\p{L}/gu,c=>c.toUpperCase());
 const person=e=>({email:D.email(e),name:fullName(e)});
 function createGame(source,host,own=true){return D.reconcile({id:uid(),sourceId:source.id,day:source.day,start:source.start,minutes:source.minutes,court:source.court,price:source.price||0,sourceLabel:source.label||'Einzelbuchung',hostEmail:host.email,hostName:host.name,hostPlays:true,own,sequence:0,invitees:[],tickets:null});}
 function seed(user,sources,groups){
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'});
  if(!sources.length)sources=[{id:'demo-source',day,start:1080,minutes:90,court:1,price:0,label:'Beispieltermin · keine echte Buchung'}];
  const games=sources.map(s=>createGame(s,user));
  ['Michael','Anne','Nina'].forEach((name,i)=>{
   const g=createGame({...sources[0],id:'demo-invite-'+i,start:1080+i*30,court:i%2+1,label:'Beispieleinladung'}, {email:`gastgeber${i+1}@example.invalid`,name:`${name} · Vorführung`},false);
   const others=Array.from({length:i===2?3:1},(_,j)=>({email:`beispiel${i}-${j}@example.invalid`,name:`Mitspieler ${j+1}`}));
   D.addInvitees(g,[...others,user]);others.forEach(p=>D.respond(g,p.email,'yes'));games.push(g);
  });
  return {version:1,owner:user.id,enabled:true,pool:false,groups:groups.length?groups:[{id:uid(),name:'Herren 55 Training · Beispiel',emails:Array.from({length:12},(_,i)=>`spieler${i+1}@example.invalid`)}],games,selected:games.find(g=>!g.own).id,playId:games[0].id,sourceWarning:!sources.some(s=>s.id!=='demo-source')};
 }
 async function readOwn(user){
  const sources=[],groups=[];
  try{
   const rows=await loadUpcomingBookings();
   if(viewer()?.id!==user.id)return {sources,groups};
   for(const b of rows||[]){if(!['paid','active'].includes(b.status))continue;const t=bookingReadTime(b);if(bookingDateAt(b).getTime()+t.minutes*60000<=Date.now())continue;sources.push({id:b.id,day:b.date,start:t.start,minutes:t.minutes,court:b.court,price:b.price_paid_cents||0,label:'Einzelbuchung'});}
   if(typeof loadActiveAbos==='function') {
    const abos=await loadActiveAbos();const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'});
    for(const b of abos||[]){if(b.status!=='active')continue;const t=bookingReadTime(b);let day=null;for(let offset=0;offset<32;offset++){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()+offset);const iso=localISODate(d);if(d.getDay()!==Number(b.weekday)||b.starts_on&&iso<b.starts_on||b.ends_on&&iso>=b.ends_on)continue;if(bookingDateAt({...b,date:iso}).getTime()+t.minutes*60000<=Date.now())continue;day=iso;break;}if(day)sources.push({id:b.id+':'+day,day,start:t.start,minutes:t.minutes,court:b.court,price:0,label:'Jahresabo · nächster Termin'});}
   }
   sources.sort((a,b)=>(a.day+clock(a.start)).localeCompare(b.day+clock(b.start)));sources.splice(8);
  }catch{toast('Eigene Termine konnten nicht übernommen werden. Die Vorführung nutzt einen Beispieltermin.');}
  try{
   const headers=await authHeaders();headers['Content-Type']='application/json';
   const r=await fetch(SUPABASE_URL+'/functions/v1/manage-meetup',{method:'POST',headers,body:JSON.stringify({action:'dashboard'})});
   if(r.ok){const data=await r.json();for(const g of data.groups||[])groups.push({id:String(g.id),name:String(g.name),emails:D.unique(g.emails||[])});}
  }catch{toast('Vorhandene Gruppen konnten nicht übernommen werden. Du kannst lokale Gruppen für die Vorführung anlegen.');}
  return {sources,groups};
 }
 async function start(){
  const u=viewer();if(!u||busy)return;busy=true;syncControls();
  try{if(!state){const {sources,groups}=await readOwn(u);if(viewer()?.id!==u.id)return;owner=u.id;state=seed(u,sources,groups);}state.enabled=true;persist();if(typeof clearLockboxAccess==='function')clearLockboxAccess(true);apply();go('verabredungen');}
  finally{busy=false;syncControls();}
 }
 function stop(){if(!state)return;state.enabled=false;persist();dialog?.close();apply();if(typeof renderPlaySection==='function')renderPlaySection();if(typeof refreshVerabredungenFrame==='function')refreshVerabredungenFrame();toast('Vorführung beendet. Die normale App ist wieder aktiv.');}
 function sync(){
  const u=viewer();if(!u){owner=null;state=null;dialog?.close();apply();return;}
  if(owner!==u.id){owner=u.id;state=null;try{const s=JSON.parse(localStorage.getItem(key(u.id))||'null');if(s?.version===1&&s.owner===u.id&&Array.isArray(s.games)&&Array.isArray(s.groups)&&s.games.length<=40){state=s;state.games.forEach(D.reconcile);}}catch{state=null;}}
  apply();
 }
 function syncControls(){
  document.getElementById('pbDemoControls')?.remove();document.getElementById('pbDemoLauncher')?.remove();const u=viewer(),account=document.getElementById('appbarUser');if(!u||!account)return;
  const n=active()?state.games.filter(g=>!g.own&&g.invitees.some(p=>p.email===u.email&&!p.answer)).length:0;
  if(active()){
   const e=document.createElement('div');e.id='pbDemoControls';e.className='pb-demo-controls';e.innerHTML=`<button type="button" class="pb-demo-bell" data-pbd="inbox" aria-label="Einladungen${n?', '+n+' offen':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>${n?`<b>${n}</b>`:''}</button>`;account.before(e);
  }else{
   const e=document.createElement('div');e.id='pbDemoLauncher';e.className='pb-demo pb-demo-launchbar';e.innerHTML=`<button type="button" data-pbd="start" ${busy?'disabled':''}>${busy?'Vorführung wird vorbereitet …':'Vorführung'}</button>`;document.getElementById('mainTabs')?.after(e);
  }
 }

 function apply(){
  const on=active();document.body.classList.toggle('pb-presentation-active',on);syncControls();
  document.getElementById('pbDemoBanner')?.remove();
  if(!on){document.querySelectorAll('[data-pb-demo-root]').forEach(e=>e.remove());return;}
  const banner=document.createElement('div');banner.id='pbDemoBanner';banner.className='pb-demo-banner';banner.innerHTML=`<strong>Vorführung</strong><span>Keine E-Mails · keine echten Zutrittscodes · Änderungen nur auf diesem Gerät</span><button type="button" data-pbd="pool">Freibad: ${state.pool?'geöffnet':'geschlossen'}</button><button type="button" data-pbd="reset">Neu starten</button><button type="button" data-pbd="stop">Vorführung beenden</button>`;document.getElementById('mainTabs')?.after(banner);
  renderMode(typeof curMode==='string'?curMode:'book');
 }
 function beforeMode(mode){if(active()&&!['book','play','verabredungen'].includes(mode)){toast('Bitte zuerst die Vorführung beenden, um diesen Bereich zu öffnen.');return false;}return true;}
 function go(mode){if(typeof setMode==='function')setMode(mode);else renderMode(mode);}
 function hostFor(mode){const parent=document.getElementById(mode==='play'?'modePlay':mode==='book'?'modeBook':'modeVerabredungen');if(!parent)return null;let e=parent.querySelector('[data-pb-demo-root]');if(!e){e=document.createElement('section');e.className='pb-demo';e.dataset.pbDemoRoot=mode;parent.append(e);}return e;}
 function selected(){return state.games.find(g=>g.id===state.selected)||state.games[0];}
 function renderMode(mode){if(!active())return;if(mode==='play')renderPlay();else if(mode==='book')renderBook();else if(mode==='verabredungen')renderMeet();}
 const option=(v,text,chosen)=>`<option value="${esc(v)}" ${chosen?'selected':''}>${esc(text)}</option>`;
 function renderBook(){const e=hostFor('book');if(!e)return;e.innerHTML=`<h1>Dein Termin für die Vorführung</h1><p>Wähle eine Kopie deiner Buchung. Es wird nichts neu gebucht oder bezahlt.</p><div class="pb-demo-list">${state.games.filter(g=>g.own).map(g=>`<article class="pb-demo-card pb-warm"><div class="pb-demo-kicker">${esc(g.sourceLabel)}</div><h2>${esc(terms(g))}</h2><div class="pb-demo-row"><span>${g.price?`Gebuchter Preis ${(g.price/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}`:'Beispieltermin'}</span><button type="button" class="pb-primary" data-pbd="select" data-id="${g.id}">Mitspieler einladen</button><button type="button" data-pbd="play" data-id="${g.id}">Zugang ansehen</button></div></article>`).join('')}</div>`;}
 function gameCard(g){const L=D.lineup(g),me=g.invitees.find(p=>p.email===viewer().email);const status=g.own?`${L.players.length}/4 dabei`:me?.answer==='yes'?(L.waiting.includes(me)?'Ersatzbank':'Du bist dabei'):me?.answer==='no'?'Abgesagt':'Neue Einladung';return `<button type="button" class="pb-demo-item" style="text-align:left;width:100%;${g.id===state.selected?'border-color:#D95736;':''}" data-pbd="select" data-id="${g.id}"><strong>${g.own?esc(g.sourceLabel):esc(g.hostName)}</strong><small>${esc(terms(g))}</small><span class="pb-demo-pill">${status}</span></button>`;}
 function roster(g){const L=D.lineup(g);return `<h3>Wer spielt?</h3><div class="pb-demo-list">${L.players.map((p,i)=>`<div class="pb-demo-item pb-demo-row"><div class="pb-demo-person"><span class="pb-demo-avatar">${i+1}</span><strong>${esc(p.name)}</strong></div><span class="pb-demo-pill">Dabei${p.host?' · Gastgeber':''}</span></div>`).join('')}${Array.from({length:4-L.players.length},()=>'<div class="pb-demo-item"><span class="pb-demo-note">Platz frei</span></div>').join('')}</div>${L.waiting.length?`<h3 style="margin-top:18px">Ersatzbank</h3><div class="pb-demo-list">${L.waiting.map((p,i)=>`<div class="pb-demo-item"><strong>${i+1}. ${esc(p.name)}</strong></div>`).join('')}</div>`:''}`;}
 function renderMeet(){
  const e=hostFor('verabredungen');if(!e)return;const g=selected(),L=D.lineup(g),u=viewer(),mine=g.invitees.find(p=>p.email===u.email);
  const pending=L.pending.length;const detail=g.own?`<label><input type="checkbox" id="pbDemoHost" ${g.hostPlays?'checked':''}> Ich spiele selbst mit</label><div class="pb-demo-status">${g.hostPlays?'Du bist dabei · ':''}${4-L.players.length} Plätze frei</div><form id="pbDemoInviteForm"><fieldset><legend>Einladung an</legend><label class="pb-label" for="pbDemoGroup">Meine Gruppe</label><div class="pb-demo-row"><select id="pbDemoGroup" name="group">${state.groups.map(x=>option(x.id,`${x.name} · ${x.emails.length} Personen`,g.groupId===x.id)).join('')}</select><button type="button" data-pbd="group-new">Gruppe anlegen</button><button type="button" data-pbd="group-edit">Gruppe bearbeiten</button></div></fieldset><label class="pb-label" for="pbDemoExtra">Oder einzelne Personen</label><input id="pbDemoExtra" name="extra" placeholder="Name &lt;E-Mail&gt; oder E-Mail, mehrere mit Semikolon" list="pbDemoKnown"><datalist id="pbDemoKnown">${D.unique(state.groups.flatMap(x=>x.emails)).map(x=>option(x,fullName(x),false)).join('')}</datalist><p class="pb-demo-note">Die Gruppe ist ein Verteiler. Die ersten ${g.hostPlays?'drei':'vier'} Zusagen bekommen einen Platz.</p><button type="submit" class="pb-primary" style="margin-top:12px">Einladen · ohne E-Mail</button></form>`:`<p>${esc(g.hostName)} lädt dich zum Padel ein. ${4-L.players.length} Plätze sind noch frei.</p><div class="pb-demo-row"><button type="button" class="pb-primary" data-pbd="answer" data-answer="yes">${mine?.answer==='yes'?(L.waiting.includes(mine)?'Auf der Ersatzbank':'Du bist dabei'):'Mitspielen'}</button><button type="button" data-pbd="answer" data-answer="no">Absagen</button></div>${mine?.answer==='yes'&&L.waiting.includes(mine)?'<p class="pb-demo-note">Die Runde ist voll. Bei einer Absage rückst du nach. Du erhältst bis dahin keine Zugangskarte.</p>':''}`;
  e.innerHTML=`<h1>Verabreden · Dating 2.0</h1><p>Viele einladen. Vier spielen. Die ersten Zusagen zählen.</p><div class="pb-demo-grid"><div class="pb-demo-stack"><article class="pb-demo-card"><h2>Einladungen für dich</h2><div class="pb-demo-list">${state.games.filter(g=>!g.own).map(gameCard).join('')}</div></article><article class="pb-demo-card"><h2>Deine Buchungen</h2><div class="pb-demo-list">${state.games.filter(g=>g.own).map(gameCard).join('')}</div></article></div><div class="pb-demo-stack"><article class="pb-demo-card pb-warm"><div class="pb-demo-kicker">${g.own?'Deine Runde':'Einladung an dich · Beispieldaten'}</div><h2>${esc(terms(g))}</h2>${detail}</article><article class="pb-demo-card">${roster(g)}<p class="pb-demo-note">${pending} offen · ${L.declined.length} abgesagt</p>${g.own&&g.invitees.length?`<h3 style="margin-top:20px">Antworten vorführen</h3><p class="pb-demo-note">Du simulierst hier Antworten deiner Eingeladenen. Niemand wird benachrichtigt.</p><div class="pb-demo-list">${g.invitees.map(p=>`<div class="pb-demo-item"><strong>${esc(p.name)}</strong><small>${esc(p.email)} · ${p.answer==='no'?'abgesagt':p.answer==='yes'?(L.waiting.includes(p)?'Ersatz':'dabei'):'offen'}</small><div class="pb-demo-row" style="margin-top:8px"><button type="button" data-pbd="simulate" data-email="${esc(p.email)}" data-answer="yes">Zusage</button><button type="button" data-pbd="simulate" data-email="${esc(p.email)}" data-answer="no">Absage</button>${D.ticketFor(g,p.email)?`<button type="button" data-pbd="ticket" data-email="${esc(p.email)}">Ticket ansehen</button>`:''}</div></div>`).join('')}</div>`:''}<button type="button" data-pbd="play" data-id="${g.id}" style="margin-top:18px">Zugang unter Jetzt spielen ansehen</button></article></div></div>`;
 }
 function qr(game,t){const code=qrcode(0,'M');code.addData(`DEMO-PADEL:${game.id}:${t.number}:${t.version}`);code.make();const n=code.getModuleCount(),m=4;let cells='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(code.isDark(y,x))cells+=`M${x+m} ${y+m}h1v1h-1z`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+8} ${n+8}" role="img" aria-label="Demo-QR-Code, kein gültiges Freibadticket" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#E6F5FC"/><path d="${cells}" fill="#000"/></svg>`;}
 function ticketHtml(game,address,large=false){const t=D.ticketFor(game,address);if(!t)return '<div class="pb-demo-no-ticket">Kein Ticket: Nur bestätigte Spieler erhalten eines der vier Eintrittsrechte.</div>';const p=D.lineup(game).players.find(p=>p.email===address);return `<div class="pb-demo-ticket"><img class="pb-fb-logo" src="assets/access/freibad-bielstein-logo.png" alt="Freibad Bielstein"><div class="pb-ticket-title">Eintrittskarte</div><div class="pb-ticket-name">${esc(p?.name||address)}</div><small>Freibad Bielstein · Ticket ${t.number} von 4</small><div class="pb-qr">${qr(game,t)}</div><small>${esc(date(game.day))} · 1 Person</small><small><strong>VORFÜHRUNG · kein gültiger Eintritt</strong></small>${!large?`<button type="button" data-pbd="ticket" data-email="${esc(address)}" data-game="${game.id}">Ticket groß ansehen</button>`:''}</div>`;}
 function renderPlay(){
  if(!active())return;const e=hostFor('play');if(!e)return;const u=viewer(),games=state.games.filter(g=>g.own||D.lineup(g).players.some(p=>p.email===u.email));const g=games.find(g=>g.id===state.playId)||games[0];
  if(!g){e.innerHTML='<h1>Deine Spiele</h1><p>Noch keine bestätigte Teilnahme in der Vorführung.</p>';return;}
  const confirmed=D.lineup(g).players.some(p=>p.email===u.email),side=state.pool?'F':'P',name=state.pool?'Freibadseite':'Parkplatzseite';
  e.innerHTML=`<h1>Deine Spiele</h1><p>Termine und Zugang in der Vorführung – keine Änderung deiner echten Buchungen.</p><label class="pb-label" for="pbDemoPlaySelect">Termin</label><select id="pbDemoPlaySelect" style="margin-bottom:20px">${games.map(x=>option(x.id,terms(x)+(x.own?' · deine Buchung':''),x.id===g.id)).join('')}</select><div class="play-today-layout"><article class="play-today-booking"><div class="play-today-booking-head"><div><div class="play-today-kind">${esc(g.own?g.sourceLabel:'Bestätigte Einladung')}</div><h2>Court #${g.court}</h2><div class="play-today-time">${esc(date(g.day))} · ${clock(g.start)}–${clock(g.start+g.minutes)} Uhr</div></div></div>${!confirmed?'<p>Du organisierst diese Runde und spielst selbst nicht mit. Für dich ist kein persönliches Freibadticket reserviert.</p>':''}<div class="pb-demo-row"><div><div class="pb-demo-kicker">Dein Platzzugang</div><h2>${name} <small>· Box/Schlüssel ${side}</small></h2></div><button type="button" data-pbd="photo" style="border:0;padding:0"><img class="pb-demo-photo" src="assets/access/lockbox-example.jpg" alt="Schlüsselbox groß ansehen"></button></div><div class="pb-demo-code"><small>Beispiel-Zugangscode · öffnet keine Box</small><span class="pb-demo-pin">DEMO-${side}</span></div><p>Zutritt ab <strong>${clock(g.start-5)} Uhr</strong> für deine Buchung um ${clock(g.start)} Uhr.</p><div class="pb-demo-instructions"><p><strong>Code eingeben</strong>, danach <strong>Schloss-Taste unten rechts drücken</strong>.</p><p>Schlüssel ${side} entnehmen, Tür öffnen, Schlüssel sofort zurücklegen und Box wieder schließen.</p><p>Nach Spielende einfach nur die Tür wieder zuziehen.</p></div></article><aside class="play-route-card"><div class="play-route-kicker">Zugang zur Padel-Anlage</div><h2>Dein Weg zum Court</h2><p>${state.pool?'Dein persönliches Freibadticket wird zuerst am Freibadeingang gescannt. Danach öffnest du die Schlüsselbox F am Zugang zu den Courts.':'Das Freibad ist in dieser Vorführung geschlossen. Nutze die Parkplatzseite und Box P.'}</p><p>Teile den Zugangscode mit deinen Mitspielern, damit ihr gemeinsam auf den Platz kommt.</p><div class="play-route-address"><div><strong>Padel Bielstein</strong><span>Jahnstraße 13<br>51674 Wiehl-Bielstein</span></div><a href="https://www.google.com/maps/dir/?api=1&destination=Jahnstra%C3%9Fe%2013%2C%2051674%20Wiehl-Bielstein" target="_blank" rel="noopener">Route planen</a></div></aside></div>${state.pool?`<article class="pb-demo-card" style="margin-top:22px"><h2>Dein Freibadticket</h2><p>Jeder bestätigte Spieler erhält ein eigenes Ticket. Der Boxcode ist für die Runde gemeinsam.</p><div style="max-width:350px">${ticketHtml(g,u.email)}</div><p class="pb-demo-note">${D.lineup(g).players.length} von 4 Ticketplätzen belegt. Demo-QR-Codes werden vom Freibad-Lesegerät nicht als Eintritt anerkannt.</p></article>`:''}<div class="pb-demo-list">${state.games.filter(x=>!x.own&&D.lineup(x).waiting.some(p=>p.email===u.email)).map(x=>`<div class="pb-demo-item"><strong>Ersatzbank · ${esc(terms(x))}</strong><small>Noch kein Zugangscode oder Freibadticket.</small></div>`).join('')}</div>`;
 }
 function openDialog(html){dialog?.remove();dialog=document.createElement('dialog');dialog.className='pb-demo pb-demo-dialog';dialog.innerHTML=`<div class="pb-demo-row"><span class="pb-demo-kicker">Vorführung · kein E-Mail-Versand</span><button type="button" data-pbd="close" aria-label="Schließen">×</button></div>`+html;document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.showModal();return dialog;}
 function groupDialog(edit=false){const selectedGroup=document.getElementById('pbDemoGroup')?.value;const group=edit?state.groups.find(g=>g.id===selectedGroup):null;if(edit&&!group)return;openDialog(`<h2>${group?'Gruppe bearbeiten':'Gruppe anlegen'}</h2><p>Du bearbeitest nur die lokale Kopie für deine Präsentation.</p><form id="pbDemoGroupForm" data-id="${group?.id||''}"><label class="pb-label" for="pbDemoGroupName">Name</label><input id="pbDemoGroupName" name="name" required value="${esc(group?.name||'')}"><label class="pb-label" for="pbDemoGroupPeople" style="margin-top:14px">E-Mail-Adressen</label><textarea id="pbDemoGroupPeople" name="emails" required placeholder="Eine Adresse pro Zeile oder mit Semikolon getrennt">${esc((group?.emails||[]).join('\n'))}</textarea><button type="submit" class="pb-primary" style="margin-top:14px">Gruppe speichern · nur Vorführung</button></form>`);}
 function changed(){persist();syncControls();renderMeet();if(document.querySelector('[data-pb-demo-root="play"]'))renderPlay();}
 document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-pbd]');if(!b)return;const action=b.dataset.pbd;if(action==='start'){await start();return;}if(!active())return;
  try{
   const g=selected();
   if(action==='stop')stop();
   else if(action==='pool'){state.pool=!state.pool;persist();apply();}
   else if(action==='reset'){if(confirm('Nur die lokale Vorführung zurücksetzen? Deine echten Daten bleiben unverändert.')){const u=viewer();state=null;localStorage.removeItem(key(u.id));await start();}}
   else if(action==='inbox'){go('verabredungen');const next=state.games.find(g=>!g.own&&g.invitees.some(p=>p.email===viewer().email&&!p.answer));if(next)state.selected=next.id;changed();}
   else if(action==='select'){state.selected=b.dataset.id;persist();go('verabredungen');}
   else if(action==='play'){state.playId=b.dataset.id;persist();go('play');}
   else if(action==='group-new')groupDialog();else if(action==='group-edit')groupDialog(true);
   else if(action==='close')dialog?.close();
   else if(action==='photo')openAvatarLightbox('https://padel-bielstein.de/assets/access/lockbox-example.jpg','Schlüsselbox · Vorführung','https://padel-bielstein.de/assets/access/lockbox-example.jpg','lockbox');
   else if(action==='answer'||action==='simulate'){
    const address=action==='answer'?viewer().email:b.dataset.email;const after=D.respond(g,address,b.dataset.answer);state.playId=g.id;changed();const p=g.invitees.find(p=>p.email===address);
    toast(b.dataset.answer==='no'?'Absage vorgemerkt. Der nächste Ersatzspieler rückt nach.':after.waiting.includes(p)?'Auf der Ersatzbank · noch keine Zugangskarte.':'Du bist dabei · Zugang in Jetzt spielen. Keine E-Mail versendet.');
   }else if(action==='ticket'){const game=state.games.find(g=>g.id===b.dataset.game)||g;openDialog('<h2>Persönliches Freibadticket</h2>'+ticketHtml(game,b.dataset.email,true));}
  }catch(error){toast(error.message||'Die Vorführung konnte nicht aktualisiert werden.');}
 });
 document.addEventListener('change',e=>{if(!active())return;try{if(e.target.id==='pbDemoHost'){D.setHost(selected(),e.target.checked);changed();}else if(e.target.id==='pbDemoPlaySelect'){state.playId=e.target.value;persist();renderPlay();}}catch(error){toast(error.message);renderMeet();}});
 document.addEventListener('submit',e=>{
  if(!active())return;
  if(e.target.id==='pbDemoInviteForm'){e.preventDefault();const g=selected(),f=new FormData(e.target),extra=String(f.get('extra')||'').trim();const group=state.groups.find(x=>x.id===f.get('group'));const addresses=extra?extra.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean):(group?.emails||[]);const people=addresses.map(value=>{const m=value.match(/^(.+?)\s*<([^>]+)>$/);return m?{name:m[1].trim(),email:D.email(m[2])}:person(value);});if(!people.length||people.some(p=>!/^\S+@\S+\.\S+$/.test(p.email))){toast('Bitte eine Gruppe oder gültige E-Mail-Adressen auswählen.');return;}g.groupId=group?.id;D.addInvitees(g,people);changed();toast(`${people.length} Personen in der Vorführung eingeladen. Es wurden keine E-Mails erzeugt oder versendet.`);}
  else if(e.target.id==='pbDemoGroupForm'){e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')||'').trim(),emails=D.unique(String(f.get('emails')||'').split(/[;,\s]+/));if(!name||!emails.length||emails.some(x=>!/^\S+@\S+\.\S+$/.test(x))){toast('Bitte Gruppenname und gültige E-Mail-Adressen eintragen.');return;}const id=e.target.dataset.id||uid();const i=state.groups.findIndex(x=>x.id===id),g={id,name,emails};if(i>=0)state.groups[i]=g;else state.groups.push(g);selected().groupId=id;dialog.close();changed();toast('Gruppe für die Vorführung gespeichert. Niemand wurde benachrichtigt.');}
 });
 root.PBPresentation=Object.freeze({active,sync,start,stop,blockLiveInvites:()=>!!viewer(),beforeMode,renderMode,renderPlay,renderMeet,go,snapshot:()=>active()?clone(state):null});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})(window);
