import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {emptyState,demoState,clone,validateState} from '../domain.mjs';
import {initializeWorkspace} from '../collaboration.mjs';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
function extract(name){
 const match=new RegExp('(?:async )?function '+name+'\\(').exec(source);assert.ok(match);
 const tail=source.slice(match.index),next=/\n(?:async )?function /.exec(tail);
 return next?tail.slice(0,next.index):tail;
}
function session({demo=false,load=async()=>emptyState(),save=async()=>{}}={}){
 const urls=[],messages=[],saved=[];
 const real=emptyState();real.inventory.push({id:'mine',name:'Мой брелок',category:'Брелок',qty:7,cost:100,price:300});
 const ctx=createContext({state:demo?demoState():real,isDemo:demo,personalSnapshot:null,busy:false,storageReadOnly:false,saveTimer:null,photoCache:new Map(),demoPhotos:new Map(),clone,validateState,initializeWorkspace,demoState,emptyState,URL,location:{href:'https://example.test/app/?start=abc'+(demo?'&demo=1':'')+'#tgWebAppData=keep'},window:{history:{replaceState:(_,__,url)=>urls.push(url)}},closeSheet(){},navigate(){},toast:t=>messages.push(t),loadState:load,saveState:async s=>{saved.push(clone(s));await save(s);},setTimeout,clearTimeout,search:'old',categoryFilter:'old',inventorySort:'qty-desc',detailPage:{},calcOpen:true,placesTab:'shelves',eventFilter:'all',settingsReturn:{}});
 runInContext(extract('boundedStorage')+'\n'+extract('switchDemo'),ctx);
 return {ctx,urls,messages,saved};
}
test('demo round trip restores personal data without reloading or saving demo edits',async()=>{
 const {ctx,urls,saved}=session();const before=clone(ctx.state);
 await runInContext('switchDemo(true)',ctx);assert.equal(ctx.isDemo,true);assert.equal(saved.length,1);
 ctx.state.inventory[0].qty=999;ctx.demoPhotos.set('demo-photo',{});
 await runInContext('switchDemo(false)',ctx);
 assert.equal(ctx.isDemo,false);assert.deepEqual(ctx.state.inventory,before.inventory);assert.equal(saved.length,1);assert.equal(ctx.demoPhotos.size,0);assert.equal(ctx.busy,false);assert.equal(ctx.search,'');
 assert.ok(urls[0].includes('demo=1'));assert.ok(!urls[1].includes('demo='));assert.ok(urls.every(u=>u.includes('start=abc')&&u.endsWith('#tgWebAppData=keep')));
});
test('direct demo link loads existing personal inventory on exit',async()=>{
 const original=emptyState();original.inventory=[{id:'real',name:'Открытка',category:'Открытка',qty:4,cost:25,price:150}];let loads=0;
 const {ctx,saved}=session({demo:true,load:async()=>{loads++;return clone(original);}});
 await runInContext('switchDemo(false)',ctx);assert.equal(loads,1);assert.equal(ctx.isDemo,false);assert.deepEqual(ctx.state.inventory,original.inventory);assert.equal(saved.length,0);
});
test('failed storage keeps demo open and allows retry, without replacing personal data',async()=>{
 let fail=true;const {ctx,urls}=session({demo:true,load:async()=>{if(fail)throw new Error('storage unavailable');return emptyState();}});
 const before=clone(ctx.state);
 await assert.rejects(runInContext('switchDemo(false)',ctx),/storage unavailable/);
 assert.equal(ctx.isDemo,true);assert.deepEqual(ctx.state,before);assert.equal(ctx.busy,false);assert.equal(urls.length,0);
 fail=false;await runInContext('switchDemo(false)',ctx);assert.equal(ctx.isDemo,false);
});
test('hanging storage times out without leaving demo or showing an empty real inventory',async()=>{
 const {ctx}=session({demo:true,load:()=>new Promise(()=>{})});
 ctx.setTimeout=fn=>setTimeout(fn,1);
 await assert.rejects(runInContext('switchDemo(false)',ctx),/Хранилище не ответило/);
 assert.equal(ctx.isDemo,true);assert.equal(ctx.busy,false);assert.ok(ctx.state.inventory.length>0);
});
test('unsaved personal state cannot be replaced by demo after a failed save',async()=>{
 const {ctx}=session({save:async()=>{throw new Error('disk full');}});const before=clone(ctx.state);
 await assert.rejects(runInContext('switchDemo(true)',ctx),/disk full/);
 assert.equal(ctx.isDemo,false);assert.deepEqual(ctx.state,before);assert.equal(ctx.busy,false);
});
test('three welcome pages expose arrows, short storage notice, then a real demo choice',()=>{
 let html='';const ctx=createContext({isDemo:false,art:(name)=>`<img src="${name}.png">`,icon:()=>'',setSheet:(_,body)=>{html=body;},sheet:{classList:{add(){}},querySelector:()=>({focus(){}})}});
 runInContext(extract('welcome'),ctx);
 runInContext('welcome(0)',ctx);assert.ok(html.includes('Предыдущий слайд" disabled'));assert.ok(html.includes('kei-neutral.png'));assert.equal((html.match(/class="intro-feature"/g)||[]).length,3);
 runInContext('welcome(1)',ctx);assert.ok(html.includes('>Хорошо</button>'));assert.ok(html.includes('data-value="2"'));assert.ok(html.includes('kei-explain.png'));assert.ok(html.includes('резервную копию'));assert.ok(!html.includes('Предыдущий слайд" disabled'));
 runInContext('welcome(2)',ctx);assert.ok(html.includes('data-action="welcome-demo"'));assert.ok(html.includes('Разберусь сам'));assert.ok(html.includes('Страница 3 из 3'));
});
