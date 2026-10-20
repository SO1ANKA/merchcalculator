const SCOPE=new URL(self.registration.scope);
const PREFIX=`solyanka:${SCOPE.pathname}:`;
const CACHE=PREFIX+'v12';
const FILES=['index.html','styles.css','app.mjs','domain.mjs','storage.mjs','collaboration.mjs','assets/logo.png','assets/favicon.svg','manifest.webmanifest','assets/hero-thinking.png','assets/hero-welcome.png','assets/backup-art.png','assets/calculator-art.png','assets/delete-art.png'];
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
