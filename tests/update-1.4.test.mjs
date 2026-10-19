import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,blankPlan,clone,saveEvent,sellEvent,soldCounts,available,validateState,remainingSales,finishEventByRemaining,sortedInventory,deleteEvent} from '../domain.mjs';
import {telegramProfile,initializeWorkspace,recordWorkspaceChanges,workspaceSnapshot,validateWorkspace} from '../collaboration.mjs';
function setup(){const state=emptyState();state.inventory=[{id:'key',name:'Брелок',category:'Брелок',qty:11,cost:100,price:350}];state.draft={...blankPlan(),mode:'pro',lines:[{itemId:'key',name:'Брелок',category:'Брелок',qty:11,cost:100,price:350}],promos:[{id:'pair',name:'Пара',parts:[{itemId:'key',qty:2}],price:600,count:2}]};const id=saveEvent(state,state.draft,{name:'Маркет',date:'',address:''});return {state,id};}
test('close from leftovers accounts for recorded bundles without double deduction',()=>{
 const {state,id}=setup();sellEvent(state,id,{key:1},{pair:2},1500);
 assert.equal(state.inventory[0].qty,6);
 assert.deepEqual(remainingSales(state.events[0],{key:3}),{key:3});
 finishEventByRemaining(state,id,{key:3},900);
 assert.equal(state.inventory[0].qty,3);assert.equal(available(state,'key'),3);
 assert.deepEqual(soldCounts(state.events[0]),{key:8});
 assert.equal(state.events[0].sales.reduce((n,s)=>n+s.revenue,0),2400);validateState(state);
 assert.throws(()=>finishEventByRemaining(state,id,{key:3},900));assert.equal(state.inventory[0].qty,3);
});
test('closing without new sales does not duplicate revenue or inventory; all/no sales also work',()=>{
 const {state,id}=setup();sellEvent(state,id,{key:5},{},1400);
 finishEventByRemaining(state,id,{key:6});assert.equal(state.events[0].sales.length,1);assert.equal(state.inventory[0].qty,6);
 for(const remaining of [0,11]){const {state,id}=setup();finishEventByRemaining(state,id,{key:remaining});assert.equal(state.inventory[0].qty,remaining);assert.equal(available(state,'key'),remaining);validateState(state);}
});
test('invalid or missing leftovers fail before changing state',()=>{
 const {state,id}=setup();sellEvent(state,id,{key:5},{},1400);const before=clone(state);
 for(const leftovers of [{key:7},{key:-1},{key:2.5},{key:NaN},{}]){assert.throws(()=>finishEventByRemaining(state,id,leftovers));assert.deepEqual(state,before);}
 assert.throws(()=>finishEventByRemaining(state,id,{key:6},300));assert.deepEqual(state,before);
});
test('filter and sort compose without changing inventory order',()=>{
 const items=[{id:'a',name:'Кот 10',category:'Брелок',price:400,qty:2},{id:'b',name:'Кот 2',category:'Брелок',price:300,qty:10},{id:'c',name:'Принт',category:'Принт',price:500,qty:5},{id:'d',name:'Кот 1',category:'Брелок',price:1,qty:0,archived:true}];
 const before=clone(items);const ids=options=>sortedInventory(items,options).map(i=>i.id);
 assert.deepEqual(ids({search:' КОТ ',category:'Брелок',sort:'price-desc'}),['a','b']);
 assert.deepEqual(ids({sort:'qty-desc'}),['b','c','a']);assert.deepEqual(ids({sort:'qty-asc'}),['a','c','b']);assert.deepEqual(ids({sort:'price-asc'}),['b','a','c']);assert.deepEqual(ids({sort:'name'}),['b','a','c']);assert.deepEqual(items,before);
});
test('old backups gain stable local identity without changing business data',()=>{
 const {state}=setup(),before=clone(state);initializeWorkspace(state);const workspaceId=state.collaboration.workspaceId;
 initializeWorkspace(state);assert.equal(state.collaboration.workspaceId,workspaceId);
 const {collaboration,...business}=state;assert.deepEqual(business,before);validateWorkspace(collaboration);validateState(state);
 const restored=clone(state);initializeWorkspace(restored,{fresh:true});assert.notEqual(restored.collaboration.workspaceId,workspaceId);
});
test('one local revision covers a sale and its inventory mutation; deletion is retained',()=>{
 const {state,id}=setup();initializeWorkspace(state);const after=clone(state);sellEvent(after,id,{key:2},{},600);recordWorkspaceChanges(state,after);
 assert.equal(after.collaboration.revision,1);assert.equal(after.collaboration.records['inventory:key'].revision,1);assert.equal(after.collaboration.records['events:'+id].revision,1);
 const removed=clone(after);deleteEvent(removed,id);recordWorkspaceChanges(after,removed);assert.equal(removed.collaboration.revision,2);assert.equal(removed.collaboration.deleted['events:'+id].revision,2);assert.equal(removed.collaboration.records['events:'+id],undefined);validateWorkspace(removed.collaboration);
 const unchanged=clone(removed);unchanged.draft.table=900;unchanged.settings.theme='dark';recordWorkspaceChanges(removed,unchanged);assert.equal(unchanged.collaboration.revision,2);
});
test('future upload excludes local UI data and is isolated from live state',()=>{
 const {state}=setup();initializeWorkspace(state);const packet=workspaceSnapshot(state);
 assert.equal(packet.settings,undefined);assert.equal(packet.draft,undefined);assert.equal(packet.initData,undefined);
 packet.inventory[0].qty=0;assert.equal(state.inventory[0].qty,11);
 const broken=clone(state.collaboration);broken.revision=-1;assert.throws(()=>validateWorkspace(broken));
});
test('Telegram profile is optional display data and rejects unsafe avatar schemes',()=>{
 assert.equal(telegramProfile({initDataUnsafe:{user:{first_name:'Подмена'}}}),null);
 const p=telegramProfile({initData:'launch',initDataUnsafe:{user:{id:123,first_name:'Анна',last_name:'Кот',photo_url:'https://cdn.example/avatar.jpg'}}});
 assert.deepEqual(p,{name:'Анна Кот',photo:'https://cdn.example/avatar.jpg',initial:'А'});assert.equal(p.id,undefined);
 for(const url of ['javascript:alert(1)','data:image/svg+xml,hi','http://example.test/a'])assert.equal(telegramProfile({initData:'launch',initDataUnsafe:{user:{first_name:'Я',photo_url:url}}}).photo,'');
});
