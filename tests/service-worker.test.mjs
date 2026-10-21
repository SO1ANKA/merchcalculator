import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function setup(){
  const listeners=new Map(),buckets=new Map(),deleted=[];
  const caches={
    async open(name){if(!buckets.has(name))buckets.set(name,new Map());const entries=buckets.get(name);return {
      async addAll(urls){for(const url of urls)entries.set(url,new Response('cached:'+new URL(url).pathname));},
      async put(url,response){entries.set(url,response);},
      async match(url){return entries.get(url)?.clone();}
    };},
    async keys(){return [...buckets.keys()];},
    async delete(name){deleted.push(name);return buckets.delete(name);}
  };
  const self={registration:{scope:'https://artist.github.io/solyanka/'},addEventListener(name,handler){listeners.set(name,handler);},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  runInNewContext(source,{self,caches,URL,Response,fetch:async()=>{throw new TypeError('offline');}});
  async function lifecycle(name){let done;listeners.get(name)({waitUntil(promise){done=promise;}});await done;}
  async function request(path){let response;const waits=[];listeners.get('fetch')({request:new Request(new URL(path,self.registration.scope)),respondWith(promise){response=promise;},waitUntil(promise){waits.push(promise);}});const result=await response;await Promise.all(waits);return result;}
  return {buckets,deleted,lifecycle,request};
}

test('offline Telegram launch URLs reuse the same cached app',async()=>{
  const sw=setup();await sw.lifecycle('install');
  const first=await sw.request('./?tgWebAppStartParam=one');
  const second=await sw.request('./?tgWebAppStartParam=two');
  assert.equal(await first.text(),'cached:/solyanka/index.html');
  assert.equal(await second.text(),'cached:/solyanka/index.html');
  const bucket=[...sw.buckets.values()][0];assert.equal(bucket.size,18);
  assert.ok([...bucket.keys()].every(url=>!url.includes('?')));
});

test('resource cleanup leaves other GitHub Pages projects untouched',async()=>{
  const sw=setup();sw.buckets.set('tvoy-merch-retro:/solyanka/:old',new Map());sw.buckets.set('solyanka:/another-app/:v1',new Map());sw.buckets.set('another-cache',new Map());sw.buckets.set('solyanka:/solyanka/:v13',new Map());
  await sw.lifecycle('install');await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted,['tvoy-merch-retro:/solyanka/:old']);
  assert.ok(sw.buckets.has('solyanka:/another-app/:v1'));assert.ok(sw.buckets.has('another-cache'));assert.ok(sw.buckets.has('solyanka:/solyanka/:v13'));
});

test('offline assets stay available and unrelated files bypass the worker',async()=>{
  const sw=setup();await sw.lifecycle('install');
  assert.equal(await (await sw.request('app.mjs?version=7')).text(),'cached:/solyanka/app.mjs');
  assert.equal(await sw.request('my-backup.json'),undefined);
  assert.equal(await sw.request('https://telegram.org/js/telegram-web-app.js'),undefined);
});
