// Retired URL compatibility loader. Both apps use the common TFB kiosk module.
(async()=>{
 const base='https://joern-kaemper.de/assets/shared-kiosk/20261109-shared-1/';
 for(const src of['asset-base.js','art.js','kiosk.js','billing.js'].map(name=>base+name).concat('assets/club-kiosk/padel-adapter.js?v=20261109-shared-1b','assets/club-kiosk/mis.js?v=20261109-shared-1b'))await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});
})();
