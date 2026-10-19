import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,blankPlan,clone,projection,available,saveEvent,sellEvent,sellShelf,transferShelf,validateState,addStock,shelfReport} from '../domain.mjs';

function setup(){const s=emptyState();s.inventory=[{id:'key',name:'Брелок',category:'Брелок',qty:100,cost:100,price:300},{id:'sticker',name:'Стикер',category:'Стикер',qty:100,cost:20,price:80}];s.draft={...blankPlan(),table:8000,lines:[{itemId:'key',name:'Брелок',category:'Брелок',qty:40,cost:100,price:300}]};return s;}
function shelf(s){s.shelves.push({id:'shelf',name:'Полка',address:'',rent:1000,commission:10,interval:14,nextRent:'2026-11-01',nextCheck:'2026-11-01',stock:{},prices:{},costs:{},targets:{},sales:[],payments:[],movements:[]});return s.shelves[0];}
test('three simple targets count only items taken, not entire inventory',()=>{const s=setup();for(const [goal,target]of [['market',8000],['all',12000],['plus',15000]]){s.draft.goal=goal;const p=projection(s.draft);assert.equal(p.target,target);assert.equal(p.sold,24);assert.equal(p.procurement,4000);assert.ok(p.revenue>=target);assert.ok(p.lines[0].price>=100);assert.equal(p.lines[0].price%10,0);}});
test('cost floor and bundle floor protect simple recommendations',()=>{const s=setup();s.draft.table=1;s.draft.goal='market';let p=projection(s.draft);assert.equal(p.lines[0].price,100);assert.equal(p.floored,true);s.draft.promos=[{id:'pair',name:'Пара',parts:[{itemId:'key',qty:2}],price:50,count:5}];p=projection(s.draft);assert.equal(p.bundles[0].price,200);assert.equal(p.bundles[0].floored,true);assert.equal(p.lines[0].single,14);});
test('pro preserves independent prices even below cost and ignores simple goals for prices',()=>{const s=setup();s.draft.mode='pro';s.draft.lines[0].price=50;const p=projection(s.draft);assert.equal(p.revenue,1200);assert.equal(p.cash,-10800);assert.equal(p.profit,-9200);});
test('rounds sold units down independently and 0% never divides by zero',()=>{const s=setup();s.draft.lines[0].qty=3;s.draft.sellPercent=50;assert.equal(projection(s.draft).sold,1);s.draft.sellPercent=0;const p=projection(s.draft);assert.equal(p.revenue,0);assert.ok(Number.isFinite(p.lines[0].price));assert.equal(p.shortfall,p.target);});
test('mixed overlapping bundles share inventory and cannot double count singles',()=>{const s=setup();s.draft.mode='pro';s.draft.sellPercent=100;s.draft.lines[0].qty=10;s.draft.lines.push({itemId:'sticker',name:'Стикер',category:'Стикер',qty:10,cost:20,price:80});s.draft.promos=[{id:'mixed',name:'Комплект',parts:[{itemId:'key',qty:1},{itemId:'sticker',qty:2}],price:400,count:4},{id:'pair',name:'Пара',parts:[{itemId:'key',qty:2}],price:500,count:4}];const p=projection(s.draft);assert.equal(p.bundles[1].count,3);assert.equal(p.lines[0].single,0);assert.equal(p.lines[1].single,2);assert.equal(p.revenue,4*400+3*500+2*80);});
test('reservations, partial sales, closure and return of remaining stock',()=>{const s=setup();const id=saveEvent(s,s.draft,{name:'Маркет',date:'2026-10-30',address:''});assert.equal(available(s,'key'),60);sellEvent(s,id,{key:18},{},null,false);assert.equal(s.inventory[0].qty,82);assert.equal(available(s,'key'),60);sellEvent(s,id,{}, {},null,true);assert.equal(available(s,'key'),82);assert.equal(s.events[0].status,'completed');validateState(s);});
test('snapshots hold historical procurement and pricing after new purchases',()=>{const s=setup();const id=saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});const snapshot=clone(s.events[0].plan);addStock(s,'key',100,300);assert.equal(s.inventory[0].cost,200);assert.deepEqual(s.events[0].plan,snapshot);});
test('shelves and event reservations share the same free pool',()=>{const s=setup();saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});shelf(s);transferShelf(s,'shelf','key',30);assert.equal(available(s,'key'),30);assert.throws(()=>transferShelf(s,'shelf','key',31));sellShelf(s,'shelf',{key:5});assert.equal(s.inventory[0].qty,95);assert.equal(s.shelves[0].stock.key,25);assert.equal(available(s,'key'),30);transferShelf(s,'shelf','key',10,true);assert.equal(available(s,'key'),40);validateState(s);});
test('overselling a bundle rejects the entire sale before inventory changes',()=>{const s=setup();s.draft.mode='pro';s.draft.promos=[{id:'pair',name:'Пара',parts:[{itemId:'key',qty:2}],price:500,count:1}];const id=saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});assert.throws(()=>sellEvent(s,id,{key:39},{pair:1}));assert.equal(s.inventory[0].qty,100);assert.equal(s.events[0].sales.length,0);});
test('actual revenue override and bundle COGS are independent of forecast',()=>{const s=setup();s.draft.mode='pro';s.draft.promos=[{id:'pair',name:'Пара',parts:[{itemId:'key',qty:2}],price:500,count:1}];const id=saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});sellEvent(s,id,{key:2},{pair:3},1900);const sale=s.events[0].sales[0];assert.equal(sale.counts.key,8);assert.equal(sale.revenue,1900);assert.equal(sale.cogs,800);});
test('monthly shelf report uses dated payments and commission',()=>{const s=setup();const sh=shelf(s);transferShelf(s,'shelf','key',10);sellShelf(s,'shelf',{key:2});sh.sales[0].date='2026-10-19';sh.payments.push({date:'2026-10-01',amount:1000},{date:'2026-11-01',amount:1000});const r=shelfReport(sh,'2026-10');assert.deepEqual(r,{revenue:600,cogs:200,commission:60,rent:1000,profit:-660});});
test('backup validation rejects overbooked stock, foreign sales and NaN',()=>{const s=setup();validateState(s);s.inventory[0].qty=1;saveEvent(s,{...s.draft,lines:[{...s.draft.lines[0],qty:1}]},{name:'Маркет',date:'',address:''});s.events[0].plan.lines[0].qty=2;assert.throws(()=>validateState(s));s.events=[];s.inventory[0].cost=NaN;assert.throws(()=>validateState(s));});
test('zero-cost products get finite recommendations',()=>{const s=setup();s.draft.lines[0].cost=0;const p=projection(s.draft);assert.ok(Number.isFinite(p.lines[0].price));assert.ok(p.revenue>=p.target);});

test('mixed free and paid items cover the target across the cost floor',()=>{
  const plan={...blankPlan(),goal:'market',round:1,sellPercent:100,lines:[{itemId:'paid',name:'Платный',qty:2,cost:100,price:0},{itemId:'free',name:'Бесплатный',qty:4,cost:0,price:0}]};
  for(const [target,paid,free] of [[100,100,0],[202,100,1],[204,100,1],[306,150,2]]){
    plan.table=target;const p=projection(plan);
    assert.equal(p.lines[0].price,paid);assert.equal(p.lines[1].price,free);assert.ok(p.revenue>=target);
  }
  plan.sellPercent=0;assert.equal(projection(plan).revenue,0);
  assert.equal(projection(plan).lines[1].price,0);
});

test('stock overview agrees with live reservations, exclusions and completed events',async()=>{
  const {stockLevels}=await import('../domain.mjs');
  const s=setup();const first=saveEvent(s,s.draft,{name:'Первый',date:'',address:''});
  s.draft={...blankPlan(),mode:'pro',lines:[{itemId:'key',name:'Брелок',category:'Брелок',qty:20,cost:100,price:300}]};
  const second=saveEvent(s,s.draft,{name:'Второй',date:'',address:''});
  shelf(s);transferShelf(s,'shelf','key',10);sellEvent(s,first,{key:7},{});
  for(const exclude of [null,first,second])for(const item of s.inventory){
    const level=stockLevels(s,exclude).get(item.id);
    assert.equal(level.free,available(s,item.id,exclude));assert.equal(level.held,item.qty-level.free);
  }
  sellEvent(s,first,{}, {},null,true);
  assert.equal(stockLevels(s).get('key').free,63);
  assert.equal(stockLevels(s,second).get('key').free,83);
});

test('simple rounded prices reach the target and share bundle stock in varied plans',()=>{
  let seed=47031;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
  for(let n=0;n<500;n++){
    const plan={...blankPlan(),table:random(50000),goal:['market','all','plus'][random(3)],profit:random(100),round:[1,10,50,100][random(4)],sellPercent:random(100)+1,lines:Array.from({length:5},(_,i)=>({itemId:'i'+i,name:'Товар '+i,qty:random(100)+1,cost:random(3)?random(20000)/100:0,price:0}))};
    plan.promos=[{id:'pair',name:'Пара',parts:[{itemId:'i0',qty:2}],count:random(20),price:random(1000)}];
    const p=projection(plan);
    for(const line of p.lines){assert.ok(line.price>=line.cost);assert.ok(line.single>=0);assert.ok(line.sold<=line.qty);}
    if(p.lines.some(line=>line.single>0))assert.ok(p.revenue+0.01>=p.target,'target in scenario '+n);
    assert.equal(p.sold,p.lines.reduce((sum,line)=>sum+line.single,0)+p.bundles[0].count*2);
  }
});

test('bundle limits show stock separately from sell-through, including duplicate rows',async()=>{
 const {bundleLimits,mergeParts}=await import('../domain.mjs');const s=setup();s.draft.lines[0].qty=11;
 const pair={id:'pair',parts:[{itemId:'key',qty:1},{itemId:'key',qty:1}]};
 assert.deepEqual(mergeParts(pair.parts),[{itemId:'key',qty:2}]);
 assert.deepEqual(bundleLimits(s.draft,pair),{stock:5,forecast:3});
 s.draft.sellPercent=100;assert.deepEqual(bundleLimits(s.draft,pair),{stock:5,forecast:5});
 s.draft.sellPercent=0;assert.deepEqual(bundleLimits(s.draft,pair),{stock:5,forecast:0});
});
test('editing a bundle excludes itself and later promotions from its available count',async()=>{
 const {bundleLimits}=await import('../domain.mjs');const s=setup();s.draft.lines[0].qty=11;s.draft.sellPercent=100;
 const first={id:'first',name:'Первый',parts:[{itemId:'key',qty:2}],count:4,price:500};
 const second={id:'second',name:'Второй',parts:[{itemId:'key',qty:2}],count:1,price:500};s.draft.promos=[first,second];
 assert.equal(bundleLimits(s.draft,first).forecast,5);assert.equal(bundleLimits(s.draft,second).forecast,1);
 assert.equal(bundleLimits(s.draft,{id:'new',parts:first.parts}).forecast,0);
});
test('deleting completed markets never returns sold units to inventory',async()=>{
 const {deleteEvent}=await import('../domain.mjs');const s=setup();const id=saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});sellEvent(s,id,{key:11},{},null,true);
 deleteEvent(s,id);assert.equal(s.inventory[0].qty,89);assert.equal(available(s,'key'),89);assert.equal(s.events.length,0);validateState(s);
});
test('deleting active markets releases reservations and clears only their edited draft',async()=>{
 const {deleteEvent}=await import('../domain.mjs');const s=setup();const id=saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});sellEvent(s,id,{key:5},{});s.editingId=id;s.draft=clone(s.events[0].plan);
 deleteEvent(s,id);assert.equal(s.inventory[0].qty,95);assert.equal(available(s,'key'),95);assert.equal(s.editingId,null);assert.equal(s.draft.lines.length,0);validateState(s);
});
test('item deletion protects reservations and preserves history and backup validity',async()=>{
 const {deleteItem}=await import('../domain.mjs');const s=setup();const id=saveEvent(s,s.draft,{name:'Маркет',date:'',address:''});assert.throws(()=>deleteItem(s,'key'));
 sellEvent(s,id,{key:5},{},null,true);const history=clone(s.events[0]);s.draft=clone(history.plan);
 deleteItem(s,'key');assert.equal(s.inventory[0].archived,true);assert.equal(s.inventory[0].qty,0);assert.equal(s.draft.lines.length,0);assert.deepEqual(s.events[0],history);validateState(s);
});
