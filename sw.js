const SCOPE=new URL(self.registration.scope);
const PREFIX=`solyanka:${SCOPE.pathname}:`;
const CACHE=PREFIX+'unified-14-album-caption';
const FILES=['render-shell.mjs','photo-cache.mjs','list-controls.mjs','easter-egg.mjs','assets/chiikawa/01.jpg','assets/chiikawa/02.jpg','assets/chiikawa/03.jpg','assets/chiikawa/04.jpg','assets/chiikawa/05.jpg','assets/chiikawa/06.jpg','assets/chiikawa/07.jpg','assets/chiikawa/08.jpg','assets/chiikawa/09.jpg','assets/chiikawa/10.jpg','assets/chiikawa/11.jpg','assets/yuna-portrait.webp','assets/yuna-mop.webp','assets/brand-main.webp','assets/brand-alt.webp','assets/wallpaper-portrait.webp','assets/wallpaper-landscape.webp','assets/novel-xp.jpg','assets/kei-explain.webp','assets/kei-folded.webp','assets/kei-neutral.webp','assets/kei-chibi.webp','assets/yuna-notes.webp','assets/neli-computer.webp','assets/leya-bin.webp','assets/yuna-happy.webp','assets/yuna-surprised.webp','assets/team.webp','index.html','styles.css','retro.css','appearance.css','appearance.mjs','app.mjs','domain.mjs','storage.mjs','collaboration.mjs','assets/merch-wordmark.svg','assets/favicon.svg','manifest.webmanifest','assets/kei-think.webp','assets/kei-welcome.webp','assets/backup-art.webp','assets/calculator-art.webp','assets/delete-art.webp','assets/kei-desktop.webp','assets/reference/cinni-wing-left.png','assets/reference/cinni-wing-right.png'];
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
  let key=url.href===SCOPE.href?INDEX:url.href;
  // Keep an already-open tab from the previous PNG release working.
  if(key.endsWith('.png')&&URLS.has(key.replace(/\.png$/,'.webp')))key=key.replace(/\.png$/,'.webp');
  if(!URLS.has(key))return;
  event.respondWith((async()=>{
    // Installed files form one release. Serve them immediately, even if the
    // network is slow; a new worker/cache refreshes the release on update.
    const cache=await caches.open(CACHE),cached=await cache.match(key);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)).catch(()=>{}));}
      return response;
    }catch{
      return Response.error();
    }
  })());
});
