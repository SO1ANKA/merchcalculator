const SCOPE=new URL(self.registration.scope);
const PREFIX=`solyanka:${SCOPE.pathname}:`;
const CACHE=PREFIX+'unified-10-mobile-code';
const FILES=['easter-egg.mjs','assets/chiikawa/01.jpg','assets/chiikawa/02.jpg','assets/chiikawa/03.jpg','assets/chiikawa/04.jpg','assets/chiikawa/05.jpg','assets/chiikawa/06.jpg','assets/chiikawa/07.jpg','assets/chiikawa/08.jpg','assets/chiikawa/09.jpg','assets/chiikawa/10.jpg','assets/chiikawa/11.jpg','assets/yuna-portrait.png','assets/yuna-mop.png','assets/brand-main.png','assets/brand-alt.png','assets/wallpaper-portrait.png','assets/wallpaper-landscape.png','assets/novel-xp.jpg','assets/kei-explain.png','assets/kei-folded.png','assets/kei-neutral.png','assets/kei-chibi.png','assets/yuna-notes.png','assets/neli-computer.png','assets/leya-bin.png','assets/yuna-happy.png','assets/yuna-surprised.png','assets/team.png','index.html','styles.css','retro.css','appearance.css','appearance.mjs','app.mjs','domain.mjs','storage.mjs','collaboration.mjs','assets/merch-wordmark.svg','assets/favicon.svg','manifest.webmanifest','assets/kei-think.png','assets/kei-welcome.png','assets/backup-art.png','assets/calculator-art.png','assets/delete-art.png','assets/kei-desktop.png','assets/reference/cinni-wing-left.png','assets/reference/cinni-wing-right.png'];
const URLS=new Set(FILES.map(file=>new URL(file,SCOPE).href));
const INDEX=new URL('index.html',SCOPE).href;
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...URLS])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==SCOPE.origin)return;
  // Keep a single cache entry per static file, including Telegram launch URLs.
  url.search='';url.hash='';
  const key=url.href===SCOPE.href?INDEX:url.href;
  if(!URLS.has(key))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(request);
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)).catch(()=>{}));}
      return response;
    }catch{
      const cache=await caches.open(CACHE);
      return await cache.match(key)||Response.error();
    }
  })());
});
