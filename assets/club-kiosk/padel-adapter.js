/* Host adapter only: Padel identity, authenticated transport and navigation.
   Rendering, picker, tally, cancellation and account views come from ClubKiosk. */
(function(){
 if(!globalThis.ClubKiosk?.create){const host=document.getElementById('modeKiosk');if(host){host.textContent='Der Kiosk konnte gerade nicht geladen werden. ';const retry=document.createElement('button');retry.textContent='Erneut laden';retry.onclick=()=>location.reload();host.append(retry);}return;}
 const base='https://hioaqcwqzeqcvvikollq.supabase.co/functions/v1/';
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const profile=()=>typeof currentProfile!=='undefined'?currentProfile:null;
 const isAdmin=()=>!!user()&&['admin','owner'].includes(profile()?.role);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const euro=c=>(c/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
 const dayKey=iso=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(iso));
 const monthName=(key,year=true)=>new Date(key+'-15T12:00:00Z').toLocaleDateString('de-DE',{month:'long',...(year?{year:'numeric'}:{}),timeZone:'Europe/Berlin'});
 let snapshot=null,root=null,component=null,view='kiosk',owner='',generation=0,last=0,loading=null,pending=null,interval=null,selectedAccount=null;
 const state={catalog:null,member:null,lastAdd:null,openTallyRow:null,editMode:false};
 async function request(action,body={}){
  const id=user()?.id,session=id&&typeof sb!=='undefined'?await sb.auth.getSession():null;
  if(id!==user()?.id||session?.data.session?.user?.id&&session.data.session.user.id!==id)throw Error('Die Anmeldung hat sich geändert.');
  const headers={'Content-Type':'application/json'};if(session?.data.session?.access_token)headers.Authorization='Bearer '+session.data.session.access_token;
  const response=await fetch(base+'club-kiosk',{method:'POST',headers,body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(25000)}),value=await response.json();
  if(id!==user()?.id)throw Error('Die Anmeldung hat sich geändert.');
  if(!response.ok)throw Object.assign(Error(value.error||'Kiosk nicht erreichbar.'),{code:value.code});return value;
 }
 const account=(resource,query={},message)=>request('account',{resource,query,...(message?{message}:{})});
 const storageKey=id=>'pb_club_kiosk_pending_'+id;
 function savePending(value){if(value){try{sessionStorage.setItem(storageKey(owner),JSON.stringify(value));}catch{throw Error('Die Buchung konnte nicht sicher zwischengespeichert werden. Bitte den Browser-Speicher prüfen und erneut versuchen.');}pending=value;}else{pending=null;try{sessionStorage.removeItem(storageKey(owner));}catch{}}}
 const rejectedPurchase=new Set(['catalog_changed','product_unavailable','payment_setup_required','tab_limit_reached','account_not_active','account_closing']);
 async function recover(){if(!pending)return;const item=pending,id=owner;try{const confirmed=await request('buy',item);if(confirmed.order?.id!==item.id)throw Error('Die Buchungsbestätigung ist unvollständig. Bitte die Buchung erneut prüfen.');if(id!==owner)return;savePending(null);await refresh(true);const row=snapshot?.history?.find(o=>o.id===item.id);if(!row?.events?.some(e=>e.kind==='cancel'))state.lastAdd={ids:[item.id],until:Date.parse(confirmed.order.created_at)+30000,text:item.quantity+' × '+confirmed.order.product_name};await renderView();toast('Buchung bestätigt',true);}catch(error){if(id!==owner)return;if(rejectedPurchase.has(error.code))savePending(null);await refresh(true);toast(error.message);}}

 const api={centralSync:true,catalog:async()=>snapshot.catalog,publicCatalog:async()=>snapshot.catalog,
  myOpenMonth:async()=>user()?account('open'):{month:dayKey(new Date()).slice(0,7),items:[],totalCents:0},
  myStatements:async()=>[],tally:async()=>user()?account('tally'):[],
  refreshKiosk:async()=>refresh(true),
  purchaseState:()=>({ready:snapshot.ready,blocked:snapshot.paymentBlocked||snapshot.member&&!snapshot.ready||!!pending,needsConsent:!snapshot.member&&!snapshot.ready&&!snapshot.paymentBlocked,message:snapshot.notice||(snapshot.member?'Abrechnung über dein TFB-Konto':'Tägliche Abrechnung über Stripe'),label:snapshot.member?'TFB-Abrechnung noch nicht verfügbar':snapshot.paymentBlocked?'Zahlung zuerst klären':'Stripe-Bierdeckel aktivieren'}),
  preparePayment:async()=>{const id=user()?.id;if(!id)throw Error('Bitte zuerst anmelden.');const headers=await checkoutHeaders(),response=await fetch(base+'create-checkout',{method:'POST',headers,body:JSON.stringify({booking_type:'kiosk_setup',consent_version:'daily-tab-v1',purchaser_email:user().email,full_name:profile()?.full_name||''})}),value=await response.json();if(id!==user()?.id)throw Error('Die Anmeldung hat sich geändert.');if(!response.ok||!value.url)throw Error(value.error||'Stripe-Einrichtung nicht möglich.');redirectToExternalCheckout(value.url);},
  addToTab:async(productId,quantity,expected)=>{const id=owner;if(pending&&(pending.productId!==productId||pending.quantity!==quantity))throw Error('Bitte zuerst die vorherige Buchung prüfen.');const item=pending||{id:crypto.randomUUID(),productId,quantity,revision:snapshot.revision,unitCents:expected.priceCents};if(!pending)savePending(item);try{const confirmed=await request('buy',item);if(confirmed.order?.id!==item.id)throw Error('Die Buchungsbestätigung ist unvollständig. Bitte die Buchung erneut prüfen.');if(id!==(user()?.id||''))throw Error('Die Anmeldung hat sich geändert.');savePending(null);await refresh(true);return[item.id];}catch(error){if(id===(user()?.id||'')&&rejectedPurchase.has(error.code))savePending(null);throw error;}},
  onPurchaseError:async()=>renderView(),
  undo:async ids=>{for(const id of ids)await request('undo',{id});await refresh(true);},
  avatarOriginal:async src=>src
 };
 const context={api,config:{timeZone:'Europe/Berlin',clubName:'Tennisfreunde Bielstein',undoSeconds:30,maxQuantity:24,tallyDays:7},actions:{},views:{}};
 ClubKiosk.installArt(context);
 let toastTimer,bodyScroll=null;
 function closeSheet(){if(!root)return;root.querySelector('#sheet-root').classList.remove('open');root.querySelector('#sheet-root').innerHTML='';if(bodyScroll){document.body.style.overflow=bodyScroll.overflow;if(!bodyScroll.hadNoScroll)document.body.classList.remove('no-scroll');bodyScroll=null;}}
 function openSheet(html){if(!bodyScroll){bodyScroll={overflow:document.body.style.overflow,hadNoScroll:document.body.classList.contains('no-scroll')};document.body.style.overflow='hidden';document.body.classList.add('no-scroll');}const sheet=root.querySelector('#sheet-root'),scroll=sheet.querySelector('.sheet')?.scrollTop||0;sheet.innerHTML='<div class="sheet-backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Schließen">'+icon.close+'</button>'+html+'</div>';sheet.querySelector('.sheet').scrollTop=scroll;requestAnimationFrame(()=>sheet.classList.add('open'));}
 function toast(text,ok){clearTimeout(toastTimer);root.querySelector('#toast-root').innerHTML='<div class="toast"><span>'+esc(text)+'</span></div>';toastTimer=setTimeout(()=>{if(root)root.querySelector('#toast-root').innerHTML='';},3000);}
 const icon={close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',minus:'<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',check:'',tally:'<svg viewBox="0 0 24 24"><path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 16L20 8"/></svg>',receipt:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/></svg>',pencil:'',back:'',chevron:'',up:'',down:''};
 const logo=(part,cls='')=>'<span class="tfb-'+part+' '+cls+'" aria-hidden="true"></span>';
 const viewHead=(title,sub='')=>'<header class="view-head"><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</header>';
 const login=()=>typeof openModal==='function'&&openModal('kiosk');
 function documentScope(){return{querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s),getElementById:id=>root.getElementById(id),createElement:tag=>document.createElement(tag),addEventListener:(...args)=>root.addEventListener(...args),get documentElement(){return document.documentElement;},get body(){return document.body;}};}
 async function renderView(next=view){
  if(!root||!snapshot)return;view=next;root.querySelector('#view').dataset.view=next;const current=++generation,id=user()?.id||'';
  try{const html=!state.member&&next!=='kiosk'?'<button class="btn primary" data-action="login">Anmelden</button>':next==='strichliste'?await component.tallyView():next==='abrechnungen'?await component.statementsView():await component.kioskView();if(current!==generation||id!==(user()?.id||''))return;const accounts=snapshot.accounts||[],selected=accounts.find(a=>a.key===selectedAccount);const accountNav=next==='abrechnungen'&&accounts.length>1?'<section class="card" style="margin-bottom:20px"><nav aria-label="Abrechnungsbereich">'+accounts.map(a=>'<button class="btn small" data-account="'+esc(a.key)+'" aria-pressed="'+(a.key===selectedAccount)+'">'+esc(a.label)+'</button>').join(' ')+'</nav><p class="muted small" style="margin-top:10px">'+esc(selected?.description||'')+' · Frühere Käufe bleiben im damaligen Abrechnungsbereich.</p></section>':'';const transfer=snapshot.history?.some(o=>o.payment_route==='tfb_debit'&&!o.events?.some(e=>e.kind==='cancel'||e.kind==='tfb_posted'))?'<p class="card">Eine erfasste Buchung wird noch an dein TFB-Konto übertragen.</p>':'';root.querySelector('#view').innerHTML=accountNav+transfer+(next!=='kiosk'?'<button class="btn small shared-account-back" data-shared-view="kiosk">Zurück zum Kiosk</button>':'')+(pending?'<p class="card pending-purchase">Eine vorherige Buchung ist noch nicht bestätigt. <button class="btn small" data-recover>Buchung prüfen</button></p>':'')+html;}
  catch(error){if(current===generation)root.querySelector('#view').innerHTML='<section class="card"><p role="alert">'+esc(error.message)+'</p><button class="btn small" data-refresh>Erneut laden</button></section>';}
 }
 function mount(){
  const host=document.getElementById('modeKiosk');if(!host||root)return;
  const box=document.createElement('div');box.id='clubKiosk';host.replaceChildren(box);root=box.attachShadow({mode:'open'});
  if(!document.getElementById('club-kiosk-fonts')){const fonts=document.createElement('link');fonts.id='club-kiosk-fonts';fonts.rel='stylesheet';fonts.href=ClubKiosk.assetBase+'fonts.css';document.head.append(fonts);}
  root.innerHTML='<link rel="stylesheet" href="'+ClubKiosk.assetBase+'standalone.css"><div class="club-kiosk-surface"><section id="view" class="view" data-view="kiosk"></section><div id="sheet-root"></div><div id="toast-root"></div></div>';
  const scoped=documentScope(),navigation={get hash(){return '#'+view;},set hash(v){renderView(v.replace(/^#/,''));}};
  context.directoryCall=async(path,message)=>{const u=new URL(path,'https://kiosk.invalid');if(!u.pathname.startsWith('/app/kiosk/'))throw Error('Diese Ansicht steht in der TFB-App zur Verfügung.');return account(u.pathname.split('/').at(-1),{...Object.fromEntries(u.searchParams),scope:selectedAccount||snapshot?.defaultAccount||(snapshot?.member?'tfb':'padel')},message);};
  const ui={state,api,cfg:context.config,esc,icon,logo,viewHead,partnerSlot:()=>'',openSheet,closeSheet,toast,renderView,currentView:()=>view,isAdmin:()=>false,openLightbox:(src,name)=>{openSheet('<figure><img style="max-width:100%" src="'+esc(src)+'" alt="'+esc(name)+'"></figure>');root.querySelector('.sheet').classList.add('lightbox');},largeImage:x=>x};Object.defineProperty(context,'ui',{get:()=>({...ui,state:{...state,member:state.member?{...state.member,id:snapshot?.accounts?.find(a=>a.key===selectedAccount)?.ownerId||state.member.id}:null}})});
  ClubKiosk.createBilling(context,scoped,navigation);
  component=ClubKiosk.create({...ui,TFB:context,cfg:context.config,api,euro,monthName,nextMonthDebit:()=>'',timeOf:iso=>new Date(iso).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}),dayKey,dayLabel:iso=>new Date(iso).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Berlin'}),visual:p=>context.art(p.art,p.color),strokesWord:n=>n===1?'1 Strich':n+' Striche',same:(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(),showAuth:login,consentMarkup:()=>'',document:scoped,$sheet:root.querySelector('#sheet-root')});
  root.addEventListener('click',async event=>{const el=event.target.closest('[data-action],[data-shared-view],[data-refresh],[data-recover],[data-account],a[href^="#"]');if(!el)return;try{if(el.matches('a[href^="#"]')){event.preventDefault();closeSheet();return renderView(el.getAttribute('href').slice(1));}if(el.hasAttribute('data-account')){if(!snapshot.accounts?.some(a=>a.key===el.dataset.account))return;selectedAccount=el.dataset.account;return renderView('abrechnungen');}if(el.hasAttribute('data-shared-view'))return renderView(el.dataset.sharedView);if(el.hasAttribute('data-refresh'))return refresh(true);if(el.hasAttribute('data-recover'))return recover();if(el.dataset.action==='close-sheet')return closeSheet();if(el.dataset.action==='login')return login();if(await component.handleAction(el,event))return;if(context.actions[el.dataset.action])await context.actions[el.dataset.action](el,event);}catch(error){toast(error.message);}});
  root.addEventListener('keydown',event=>{if(event.key==='Escape')closeSheet();});
  setInterval(()=>component.tickStorno(),250);
 }
 function resetIdentity(){generation++;snapshot=null;pending=null;state.catalog=null;state.member=null;state.lastAdd=null;state.openTallyRow=null;view='kiosk';selectedAccount=null;last=0;owner=user()?.id||'';closeSheet();if(root)root.querySelector('#view').innerHTML='';try{pending=JSON.parse(sessionStorage.getItem(storageKey(owner))||'null');}catch{}}
 async function refresh(force=false){
  mount();if(!root)return;if(owner!==(user()?.id||''))resetIdentity();if(loading&&!force)return loading;
  const id=user()?.id||'',current=++generation;
  const job=(async()=>{try{const next=await request('state');if(current!==generation||id!==(user()?.id||''))return;const membershipChanged=snapshot&&snapshot.member!==next.member;snapshot=next;if(membershipChanged||!next.accounts?.some(a=>a.key===selectedAccount))selectedAccount=next.accounts?.find(a=>a.key===next.defaultAccount)?.key||next.accounts?.[0]?.key||next.defaultAccount;next.catalog.products=next.catalog.products.map(p=>({...p,active:true,archived:false}));state.catalog=next.catalog;const names=(profile()?.full_name||'').split(/\s+/);state.member=id?{id:next.accountId||id,firstName:names.shift()||'',lastName:names.join(' '),hasConsent:true,isAdmin:false,avatar:profile()?.avatar_url}:null;
   if(pending&&next.history?.some(o=>o.id===pending.id))savePending(null);last=Date.now();await renderView();
  }catch(error){if(current===generation){root.querySelector('#view').innerHTML='<section class="card"><p role="alert">'+esc(error.message)+'</p><button class="btn small" data-refresh>Erneut laden</button></section>';last=Date.now();}}finally{if(loading===job)loading=null;}})();loading=job;return job;
 }
 window.PBClubKiosk={request,refresh,renderView,recover,openAccount:async()=>{await refresh();await renderView('abrechnungen');},renderAdmin:()=>window.renderKioskAdmin()};
 // Existing navigation calls these small host entry points; no legacy product store remains.
 window.renderKiosk=()=>refresh(true);window.refreshKioskCatalog=()=>refresh();
 window.renderKioskAdmin=()=>{const host=document.getElementById('adminKiosk');if(!host||!isAdmin())return;host.innerHTML='<section class="admin-section"><h3>Kiosk</h3><p>Das gemeinsame Sortiment wird in der TFB-Produktbibliothek gepflegt.</p><a href="https://joern-kaemper.de/#produktbibliothek" target="_blank" rel="noopener">Produktbibliothek öffnen</a></section>';};
 window.resumePendingKioskCheckout=()=>refresh(true);
 const tick=()=>{mount();if(owner!==(user()?.id||'')){resetIdentity();refresh(true);}else if(root&&!document.hidden&&document.getElementById('modeKiosk')?.style.display!=='none'&&Date.now()-last>55000&&!loading)refresh();};
 if(typeof sb!=='undefined')sb.auth.onAuthStateChange?.(()=>{resetIdentity();setTimeout(()=>refresh(true),0);});setInterval(tick,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;tick();}});tick();
})();
