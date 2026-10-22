import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {emptyState} from '../domain.mjs';
const source=await readFile(new URL('../storage.mjs',import.meta.url),'utf8');
test('merged release loads the existing published inventory and retains the original storage namespace',async()=>{
 const original=emptyState();original.inventory=[{id:'real',name:'Личный запас',category:'Брелок',qty:7,cost:100,price:300}];
 const stable=JSON.stringify(original),saved=new Map([['solyanka-state-v1',stable]]),device=new Map([['solyanka-state-v1',stable]]),databaseNames=[];
 const ctx={Blob,JSON,Promise,setTimeout,clearTimeout,indexedDB:{open(name){databaseNames.push(name);throw new Error('test localStorage fallback');}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},Telegram:{WebApp:{isVersionAtLeast:()=>true,DeviceStorage:{getItem:(k,cb)=>cb(null,device.get(k)||null),setItem:(k,v,cb)=>{device.set(k,v);cb();}}}}};
 runInNewContext(source.replaceAll('export ','')+'\nglobalThis.api={loadState,saveState};',ctx);
 assert.equal((await ctx.api.loadState()).inventory[0].name,'Личный запас');
 const experiment=emptyState();experiment.settings.theme='dark';await ctx.api.saveState(experiment);
 assert.equal((await ctx.api.loadState()).settings.theme,'dark');
 assert.equal(JSON.parse(saved.get('solyanka-state-v1')).settings.theme,'dark');assert.equal(JSON.parse(device.get('solyanka-state-v1')).settings.theme,'dark');
 assert.ok(!saved.has('tvoy-merch-retro-state-v1'));assert.ok(!device.has('tvoy-merch-retro-state-v1'));
 assert.ok(databaseNames.every(name=>name==='solyanka-local'));
});
