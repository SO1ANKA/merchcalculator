import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoCache} from '../photo-cache.mjs';

test('concurrent and returning views share one photo read and one object URL',async()=>{
 let reads=0,urls=0;
 const cache=new PhotoCache(async()=>{reads++;return new Blob(['photo']);},{create:()=>`blob:${++urls}`});
 const values=await Promise.all([cache.get('a'),cache.get('a')]);
 cache.trim();assert.equal(await cache.get('a'),values[0]);
 assert.deepEqual(values,['blob:1','blob:1']);assert.equal(reads,1);assert.equal(urls,1);
});
test('LRU releases old photos but keeps visible photos pinned',async()=>{
 const revoked=[],cache=new PhotoCache(async id=>id,{limit:2,create:id=>'blob:'+id,revoke:url=>revoked.push(url)});
 await cache.get('a');await cache.get('b');await cache.get('c');
 cache.trim(new Set(['a','c']));assert.deepEqual(revoked,['blob:b']);
 await cache.get('a');await cache.get('d');cache.trim(new Set(['d']));
 assert.deepEqual(revoked,['blob:b','blob:c']);assert.equal(cache.entries.size,2);
 cache.clear();assert.equal(revoked.length,4);assert.equal(cache.entries.size,0);
});
test('a pending read cannot resurrect a photo after switching demo/workspace',async()=>{
 let finish,created=0;
 const cache=new PhotoCache(()=>new Promise(resolve=>{finish=resolve;}),{create:()=>{created++;return 'blob:stale';}});
 const pending=cache.get('a');await Promise.resolve();cache.clear();finish(new Blob(['old']));
 assert.equal(await pending,null);assert.equal(created,0);assert.equal(cache.entries.size,0);
});
test('unavailable photos do not break hydration of other images',async()=>{
 const cache=new PhotoCache(async id=>{if(id==='bad')throw Error('storage');return id==='missing'?null:id;},{create:id=>id});
 assert.deepEqual(await Promise.all(['bad','missing','ok'].map(id=>cache.get(id))),[null,null,'ok']);
});
