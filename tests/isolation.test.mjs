import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {emptyState} from '../domain.mjs';
const source=await readFile(new URL('../storage.mjs',import.meta.url),'utf8');
test('experimental storage never reads or overwrites the stable app state or Telegram mirror',async()=>{
 const original=emptyState();original.inventory=[{id:'real',name:'Личный запас',category:'Брелок',qty:7,cost:100,price:300}];
 const stable=JSON.stringify(original),saved=new Map([['solyanka-state-v1',stable]]),device=new Map([['solyanka-state-v1',stable]]),databaseNames=[];
 const ctx={Blob,JSON,Promise,setTimeout,clearTimeout,indexedDB:{open(name){databaseNames.push(name);throw new Error('test localStorage fallback');}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},Telegram:{WebApp:{isVersionAtLeast:()=>true,DeviceStorage:{getItem:(k,cb)=>cb(null,device.get(k)||null),setItem:(k,v,cb)=>{device.set(k,v);cb();}}}}};
 runInNewContext(source.replaceAll('export ','')+'\nglobalThis.api={loadState,saveState};',ctx);
 assert.equal(await ctx.api.loadState(),null);
 const experiment=emptyState();experiment.settings.theme='dark';await ctx.api.saveState(experiment);
 assert.equal((await ctx.api.loadState()).settings.theme,'dark');
 assert.equal(saved.get('solyanka-state-v1'),stable);assert.equal(device.get('solyanka-state-v1'),stable);
 assert.ok(saved.has('tvoy-merch-retro-state-v1'));assert.ok(device.has('tvoy-merch-retro-state-v1'));
 assert.ok(databaseNames.every(name=>name==='tvoy-merch-retro-local'));
});
