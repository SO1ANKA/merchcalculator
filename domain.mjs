export const uid = () => globalThis.crypto?.randomUUID?.() || `s${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
export const clone = value => JSON.parse(JSON.stringify(value));
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const roundMoney = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const categories = ['Брелок','Стенд','Значок','Стикер','Стикерпак','Открытка','Принт','Другое'];
const sum = values => values.reduce((a,b)=>a+b,0);
const fail = text => { throw new Error(text); };
export function blankPlan() { return {pricingModel:'category-v1',mode:'simple',goal:'all',profit:25,sellPercent:60,round:10,table:0,expenses:[],lines:[],promos:[]}; }
export function emptyState() { return {version:1,updatedAt:Date.now(),settings:{theme:'auto',backupNoticeSeen:false},inventory:[],events:[],shelves:[],draft:blankPlan(),editingId:null,activity:[]}; }
export function soldCounts(event) { const counts={}; for(const sale of event.sales||[]) for(const [id,qty] of Object.entries(sale.counts)) counts[id]=(counts[id]||0)+qty; return counts; }
export function reserved(state,itemId,excludeEvent=null) {
  let qty=0;
  for(const event of state.events) if(event.status!=='completed' && event.id!==excludeEvent) { const line=event.plan.lines.find(l=>l.itemId===itemId); if(line) qty+=line.qty-(soldCounts(event)[itemId]||0); }
  for(const shelf of state.shelves) qty+=shelf.stock[itemId]||0;
  return qty;
}
export function available(state,itemId,excludeEvent=null) { const item=state.inventory.find(i=>i.id===itemId); return item?item.qty-reserved(state,itemId,excludeEvent):0; }
// Build once for a screen or validation pass; never cache across state changes.
export function stockLevels(state,excludeEvent=null) {
  const levels=new Map(state.inventory.map(item=>[item.id,{held:0,free:item.qty}]));
  const hold=(id,qty)=>{const level=levels.get(id);if(level){level.held+=qty;level.free-=qty;}};
  for(const event of state.events) if(event.status!=='completed'&&event.id!==excludeEvent) {
    const sold=soldCounts(event);
    for(const line of event.plan.lines) hold(line.itemId,line.qty-(sold[line.itemId]||0));
  }
  for(const shelf of state.shelves) for(const [id,qty] of Object.entries(shelf.stock)) hold(id,qty);
  return levels;
}
export const eventExpenses = plan => roundMoney(plan.table+sum(plan.expenses.map(e=>e.amount)));
// Product heuristics based on the author's examples, not measured market prices.
const categoryPricing={
  'Стенд':[1000,1750,2000], 'Брелок':[125,375,400], 'Значок':[75,250,350],
  'Стикер':[30,150,200], 'Стикерпак':[55,220,300], 'Открытка':[30,170,200],
  'Принт':[100,350,450], 'Другое':[100,300,500]
};
export function priceGuide(line,step=10){
  const [reference,typical,upper]=categoryPricing[line.category]||categoryPricing['Другое'];
  // Square-root scaling lowers the markup ratio as manufacturing cost grows.
  const scale=Math.sqrt(Math.max(line.cost,reference/4)/reference);
  const floor=roundMoney(Math.ceil((line.cost-1e-8)/step)*step);
  const ceiling=roundMoney(Math.max(floor,Math.floor((upper*scale+1e-8)/step)*step));
  const weight=Math.max(1,typical*scale-floor);
  return {floor,ceiling,weight};
}
export function categoryPrices(lines,needed,step=10){
  const guides=lines.map(l=>priceGuide(l,step));
  const price=(g,t)=>roundMoney(Math.min(g.ceiling,Math.ceil((g.floor+t*g.weight-1e-8)/step)*step));
  const total=t=>lines.reduce((sum,l,i)=>sum+l.single*price(guides[i],t),0);
  let low=0,high=Math.max(0,...guides.map(g=>(g.ceiling-g.floor)/g.weight));
  if(needed<=total(0))high=0;
  else if(needed<=total(high))for(let i=0;i<48;i++){const mid=(low+high)/2;if(total(mid)+1e-7>=needed)high=mid;else low=mid;}
  return guides.map(g=>({...g,price:price(g,high)}));
}
export function projection(plan) {
  const costs=eventExpenses(plan), procurement=roundMoney(sum(plan.lines.map(l=>l.cost*l.qty)));
  const linesById=new Map(plan.lines.map(line=>[line.itemId,line]));
  const capacity=Object.fromEntries(plan.lines.map(l=>[l.itemId,Math.floor(l.qty*plan.sellPercent/100+1e-8)]));
  const used=Object.fromEntries(plan.lines.map(l=>[l.itemId,0]));
  let promoRevenue=0, promoCogs=0, bundleCount=0;
  const bundles=[];
  for(const promo of plan.promos) {
    const max=Math.max(0,Math.min(...promo.parts.map(p=>Math.floor(((capacity[p.itemId]||0)-(used[p.itemId]||0))/p.qty))));
    const count=Math.min(promo.count,Number.isFinite(max)?max:0);
    const bundleCost=sum(promo.parts.map(p=>p.qty*(linesById.get(p.itemId)?.cost||0)));
    const price=plan.mode==='simple'?Math.max(promo.price,bundleCost):promo.price;
    for(const p of promo.parts) used[p.itemId]=(used[p.itemId]||0)+count*p.qty;
    promoRevenue+=count*price; promoCogs+=count*bundleCost; bundleCount+=count;
    bundles.push({...promo,count,max,price,cost:bundleCost,clamped:count!==promo.count,floored:price>promo.price});
  }
  const target=plan.goal==='market'?costs:(costs+procurement)*(plan.goal==='plus'?1+plan.profit/100:1);
  const singles=plan.lines.map(l=>({...l,sold:capacity[l.itemId]||0,single:(capacity[l.itemId]||0)-(used[l.itemId]||0)}));
  let coefficient=0;
  if(plan.mode==='simple'&&plan.pricingModel!=='category-v1') {
    const base=sum(singles.map(line=>line.single*line.cost));
    const zeroCostUnits=sum(singles.filter(line=>line.cost===0).map(line=>line.single));
    const needed=target-promoRevenue;
    // Positive costs share the same floor at coefficient=1. Below it, only
    // zero-cost items grow; above it, every price grows proportionally.
    if(needed>base&&base+zeroCostUnits>0) coefficient=zeroCostUnits>0&&needed<base+zeroCostUnits
      ?(needed-base)/zeroCostUnits:needed/(base+zeroCostUnits||1);
  }
  const step=plan.round||1;
  const guided=plan.mode==='simple'&&plan.pricingModel==='category-v1'?categoryPrices(singles,target-promoRevenue,step):null;
  const lines=singles.map((l,i)=>{
    if(guided){const guide=guided[i];return {...l,price:guide.price,priceCeiling:guide.ceiling,capped:guide.price>=guide.ceiling,floored:l.single>0&&guide.price===guide.floor};}
    const raw=(l.cost||1)*coefficient, recommended=roundMoney(Math.ceil((Math.max(l.cost,raw)-1e-8)/step)*step);
    return {...l,price:plan.mode==='simple'?recommended:l.price,floored:plan.mode==='simple'&&l.single>0&&raw<l.cost-0.001};
  });
  const revenue=roundMoney(promoRevenue+sum(lines.map(l=>l.single*l.price)));
  const cogs=roundMoney(promoCogs+sum(lines.map(l=>l.single*l.cost)));
  return {costs,procurement,target:roundMoney(target),revenue,cogs,cash:roundMoney(revenue-costs-procurement),profit:roundMoney(revenue-costs-cogs),sold:sum(Object.values(capacity)),total:sum(plan.lines.map(l=>l.qty)),lines,bundles,bundleCount,shortfall:roundMoney(Math.max(0,target-revenue)),floored:lines.some(l=>l.floored)||bundles.some(b=>b.floored),priceLimited:!!guided&&revenue+0.01<target};
}
export function validatePlan(state,plan,exclude=null) {
  if(!plan.lines.length) fail('Добавь товар в расчёт.');
  for(const line of plan.lines) { if(line.qty<1 || !Number.isInteger(line.qty)) fail('Количество — целое, от 1.'); if(line.qty>available(state,line.itemId,exclude)) fail(`Для «${line.name}» доступно ${available(state,line.itemId,exclude)} шт. Уменьши количество.`); }
}
export function saveEvent(state,plan,meta) {
  validatePlan(state,plan,state.editingId);
  if(!meta.name.trim()) fail('Укажи название маркета.');
  let event=state.events.find(e=>e.id===state.editingId);
  if(event && (event.status==='completed'||event.sales.length)) fail('После продаж план менять нельзя. Создай новый расчёт.');
  const snapshot=clone(plan), result=projection(plan);
  snapshot.lines=snapshot.lines.map(l=>({...l,price:result.lines.find(x=>x.itemId===l.itemId).price}));
  snapshot.promos=snapshot.promos.map(p=>({...p,price:result.bundles.find(b=>b.id===p.id).price}));
  if(!event) { event={id:uid(),status:'planned',sales:[],checklist:[{id:uid(),text:'Упаковать мерч',done:false},{id:uid(),text:'Подготовить ценники',done:false},{id:uid(),text:'Собрать оформление стола',done:false}],createdAt:Date.now()}; state.events.push(event); }
  Object.assign(event,{name:meta.name.trim(),date:meta.date||'',address:meta.address.trim(),plan:snapshot});
  state.editingId=null; state.draft=blankPlan(); return event.id;
}
export function makeSale(plan,remaining,quantities,bundleQuantities,revenueOverride) {
  const counts={}; let revenue=0,cogs=0,units=0;
  const details=[];
  for(const line of plan.lines) { const qty=quantities[line.itemId]||0; if(!Number.isInteger(qty)||qty<0) fail('Продажи — целое число от 0.'); counts[line.itemId]=qty; revenue+=qty*line.price; if(qty) details.push({name:line.name,qty,price:line.price}); }
  for(const bundle of plan.promos) { const qty=bundleQuantities[bundle.id]||0; if(!Number.isInteger(qty)||qty<0) fail('Наборы — целое число от 0.'); revenue+=qty*bundle.price; if(qty) details.push({name:bundle.name,qty,price:bundle.price}); for(const part of bundle.parts) counts[part.itemId]=(counts[part.itemId]||0)+part.qty*qty; }
  for(const line of plan.lines) { const qty=counts[line.itemId]||0; if(qty>(remaining[line.itemId]||0)) fail(`«${line.name}»: осталось ${remaining[line.itemId]||0} шт. Учти товары внутри наборов.`); cogs+=qty*line.cost; units+=qty; }
  if(!units) fail('Укажи хотя бы одну продажу.');
  if(revenueOverride!==null && revenueOverride!==undefined) { if(!Number.isFinite(revenueOverride)||revenueOverride<0) fail('Проверь сумму выручки.'); revenue=revenueOverride; }
  return {id:uid(),date:today(),at:Date.now(),counts,revenue:roundMoney(revenue),cogs:roundMoney(cogs),details};
}
export function sellEvent(state,id,quantities,bundles,override=null,finish=false) {
  const event=state.events.find(e=>e.id===id); if(!event||event.status==='completed') fail('Маркет уже завершён.');
  const sold=soldCounts(event), remaining=Object.fromEntries(event.plan.lines.map(l=>[l.itemId,l.qty-(sold[l.itemId]||0)]));
  const hasSale=Object.values(quantities).some(n=>n>0)||Object.values(bundles).some(n=>n>0);
  if(!hasSale&&!finish) fail('Укажи количество проданного.');
  if(hasSale) { const sale=makeSale(event.plan,remaining,quantities,bundles,override); for(const [itemId,qty] of Object.entries(sale.counts)) {const item=state.inventory.find(i=>i.id===itemId); if(!item||item.qty<qty) fail('Недостаточно товара в инвентаре.');} for(const [itemId,qty] of Object.entries(sale.counts)) state.inventory.find(i=>i.id===itemId).qty-=qty; event.sales.push(sale); }
  event.status=finish?'completed':'live'; if(finish) event.completedAt=Date.now();
}
export function transferShelf(state,id,itemId,qty,returning=false) {
  const shelf=state.shelves.find(s=>s.id===id), item=state.inventory.find(i=>i.id===itemId);
  if(!shelf||!item||!Number.isInteger(qty)||qty<1) fail('Проверь товар и количество.');
  if(returning) { if(qty>(shelf.stock[itemId]||0)) fail('На полке нет такого количества.'); shelf.stock[itemId]-=qty; }
  else { if(qty>available(state,itemId)) fail(`Доступно ${available(state,itemId)} шт.`); const old=shelf.stock[itemId]||0; shelf.costs[itemId]=roundMoney(((shelf.costs[itemId]||0)*old+item.cost*qty)/(old+qty)); shelf.stock[itemId]=old+qty; shelf.prices[itemId]??=item.price; }
  shelf.movements.push({id:uid(),date:today(),itemId,qty,kind:returning?'return':'supply'});
}
export function sellShelf(state,id,quantities,override=null) {
  const shelf=state.shelves.find(s=>s.id===id); if(!shelf) fail('Полка не найдена.');
  const plan={lines:Object.keys(shelf.stock).map(itemId=>{const item=state.inventory.find(i=>i.id===itemId); return {itemId,name:item.name,cost:shelf.costs[itemId]??item.cost,price:shelf.prices[itemId]??item.price};}),promos:[]};
  const sale=makeSale(plan,shelf.stock,quantities,{},override);
  sale.commission=roundMoney(sale.revenue*shelf.commission/100);
  for(const [itemId,qty] of Object.entries(sale.counts)) { if(state.inventory.find(i=>i.id===itemId).qty<qty) fail('Недостаточно товара.'); }
  for(const [itemId,qty] of Object.entries(sale.counts)) { shelf.stock[itemId]-=qty; state.inventory.find(i=>i.id===itemId).qty-=qty; }
  shelf.sales.push(sale);
}
export function shelfReport(shelf,month=today().slice(0,7)) { const sales=shelf.sales.filter(s=>s.date.startsWith(month)),rent=sum(shelf.payments.filter(p=>p.date.startsWith(month)).map(p=>p.amount)); const revenue=sum(sales.map(s=>s.revenue)),cogs=sum(sales.map(s=>s.cogs)),commission=sum(sales.map(s=>s.commission||0)); return {revenue:roundMoney(revenue),cogs:roundMoney(cogs),commission:roundMoney(commission),rent:roundMoney(rent),profit:roundMoney(revenue-cogs-commission-rent)}; }
export function addStock(state,id,qty,cost) { const item=state.inventory.find(i=>i.id===id); if(!item||!Number.isInteger(qty)||qty<1||!Number.isFinite(cost)||cost<0) fail('Проверь количество и себестоимость.'); item.cost=roundMoney((item.qty*item.cost+qty*cost)/(item.qty+qty)); item.qty+=qty; state.activity.push({id:uid(),date:today(),kind:'purchase',itemId:id,qty,cost}); }
export function validateState(state) {
  if(!state||state.version!==1||!state.settings||!Array.isArray(state.inventory)||!Array.isArray(state.events)||!Array.isArray(state.shelves)||!Array.isArray(state.activity)||!state.draft) fail('Файл не является копией «Твой Мерч» или его версия не поддерживается.');
  const num=(n,max=1e9)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
  const integer=n=>num(n,1e7)&&Number.isInteger(n);
  const string=(s,max=500)=>typeof s==='string'&&s.length<=max;
  const safeId=s=>string(s,100)&&/^[A-Za-z0-9_-]+$/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
  if(!['auto','light','dark'].includes(state.settings.theme))fail('Некорректная настройка темы.');
  const ids=new Set();
  for(const item of state.inventory) { if((item.archived!==undefined&&typeof item.archived!=='boolean')||(item.archived&&item.qty!==0)||!safeId(item.id)||ids.has(item.id)||!string(item.name,120)||!item.name.trim()||!string(item.category,50)||!integer(item.qty)||!num(item.cost)||!num(item.price)||(item.photo&&(!safeId(item.photo)))) fail('Некорректные данные инвентаря.'); ids.add(item.id); }
  const checkPlan=plan=>{ if(!plan||(plan.pricingModel!==undefined&&!['legacy','category-v1'].includes(plan.pricingModel))||!['simple','pro'].includes(plan.mode)||!['market','all','plus'].includes(plan.goal)||!num(plan.sellPercent,100)||!num(plan.profit,10000)||!num(plan.table)||![1,10,50,100].includes(plan.round)||!Array.isArray(plan.expenses)||!Array.isArray(plan.lines)||!Array.isArray(plan.promos)) fail('Некорректный расчёт.');
    const lineIds=new Set(); for(const l of plan.lines) {if(!ids.has(l.itemId)||lineIds.has(l.itemId)||!integer(l.qty)||!num(l.cost)||!num(l.price)||!string(l.name,120)||!string(l.category,50)) fail('Некорректная позиция расчёта.'); lineIds.add(l.itemId);}
    for(const e of plan.expenses) if(!string(e.id,100)||!string(e.name,120)||!num(e.amount)) fail('Некорректные расходы.');
    const promoIds=new Set(); for(const p of plan.promos) {if(!safeId(p.id)||promoIds.has(p.id)||!string(p.name,120)||!p.name.trim()||!num(p.price)||!integer(p.count)||!Array.isArray(p.parts)||!p.parts.length||p.parts.length>10) fail('Некорректная акция.');promoIds.add(p.id);const partIds=new Set();for(const part of p.parts) {if(!lineIds.has(part.itemId)||partIds.has(part.itemId)||!integer(part.qty)||part.qty<1) fail('Некорректный состав набора.');partIds.add(part.itemId);} }
  };
  checkPlan(state.draft);
  const saleCheck=s=>{if(!s||!num(s.revenue)||!num(s.cogs)||!string(s.date,20)||!s.counts||!Array.isArray(s.details)) fail('Некорректная история продаж.');for(const [id,qty]of Object.entries(s.counts))if(!ids.has(id)||!integer(qty)) fail('Некорректные продажи.');for(const d of s.details)if(!string(d.name,120)||!integer(d.qty)||!num(d.price))fail('Некорректные продажи.');};
  const placeIds=new Set();
  for(const event of state.events) {if(!safeId(event.id)||placeIds.has(event.id)||!string(event.name,120)||!event.name.trim()||!string(event.date,20)||!string(event.address)||!['planned','live','completed'].includes(event.status)||!Array.isArray(event.sales)||!Array.isArray(event.checklist))fail('Некорректное мероприятие.');placeIds.add(event.id);checkPlan(event.plan);for(const sale of event.sales)saleCheck(sale);const sold=soldCounts(event);for(const [id,qty]of Object.entries(sold)){const line=event.plan.lines.find(l=>l.itemId===id);if(!line||qty>line.qty)fail('Продажи превышают количество на маркете.');}for(const c of event.checklist)if(!string(c.id,100)||!string(c.text,300)||typeof c.done!=='boolean') fail('Некорректный чеклист.');}
  for(const shelf of state.shelves) {if(!safeId(shelf.id)||placeIds.has(shelf.id)||!string(shelf.name,120)||!shelf.name.trim()||!string(shelf.address)||!num(shelf.rent)||!num(shelf.commission,100)||!integer(shelf.interval)||!string(shelf.nextCheck,20)||!string(shelf.nextRent,20)||!Array.isArray(shelf.sales)||!Array.isArray(shelf.payments)||!Array.isArray(shelf.movements)||!shelf.stock||!shelf.prices||!shelf.costs||!shelf.targets)fail('Некорректная полка.');placeIds.add(shelf.id);for(const [id,q]of Object.entries(shelf.stock))if(!ids.has(id)||!integer(q)||!num(shelf.prices[id])||!num(shelf.costs[id]))fail('Некорректный запас полки.');for(const sale of shelf.sales){saleCheck(sale);if(!num(sale.commission,1e9))fail('Некорректная комиссия.');}for(const p of shelf.payments)if(!num(p.amount)||!string(p.date,20))fail('Некорректная аренда.');for(const target of Object.values(shelf.targets))if(!integer(target))fail('Некорректный целевой запас.');}
  const levels=stockLevels(state);
  for(const item of state.inventory) if(levels.get(item.id).free<0) fail(`«${item.name}»: резерв превышает остаток.`);
  if(state.inventory.length>3000||state.events.length>3000||state.shelves.length>1000)fail('В копии слишком много записей.');
  return true;
}
export function demoState() {
  const state=emptyState(); state.inventory=[{id:'key',name:'Брелок «Звезда»',category:'Брелок',qty:60,cost:120,price:350,photo:false,color:'red'},{id:'sticker',name:'Стикерпак «Всякое»',category:'Стикерпак',qty:100,cost:55,price:180,photo:false,color:'blue'},{id:'stand',name:'Стенд «Это я»',category:'Стенд',qty:30,cost:230,price:650,photo:false,color:'lavender'}];
  state.draft={...blankPlan(),table:8000,expenses:[{id:'road',name:'Дорога',amount:700},{id:'decor',name:'Оформление',amount:1300}],lines:state.inventory.map(i=>({itemId:i.id,name:i.name,category:i.category,cost:i.cost,price:i.price,qty:i.id==='key'?40:i.id==='sticker'?60:20})),promos:[]};
  return state;
}

// Bundle stock and forecast are different limits. Editing keeps the original
// priority; repeated product rows are combined before any division.
export function mergeParts(parts) {
  const quantities=new Map();
  for(const part of parts) quantities.set(part.itemId,(quantities.get(part.itemId)||0)+part.qty);
  return [...quantities].map(([itemId,qty])=>({itemId,qty}));
}
export function bundleLimits(plan,promo) {
  const parts=mergeParts(promo.parts);
  const limit=stock=>parts.length?Math.max(0,Math.min(...parts.map(p=>Number.isInteger(p.qty)&&p.qty>0?Math.floor((stock[p.itemId]||0)/p.qty):0))):0;
  const stock=Object.fromEntries(plan.lines.map(l=>[l.itemId,l.qty]));
  const remaining=Object.fromEntries(plan.lines.map(l=>[l.itemId,Math.floor(l.qty*plan.sellPercent/100+1e-8)]));
  for(const previous of projection(plan).bundles){
    if(previous.id===promo.id)break;
    for(const part of previous.parts)remaining[part.itemId]-=part.qty*previous.count;
  }
  return {stock:limit(stock),forecast:limit(remaining)};
}
export function deleteItem(state,id) {
  const item=state.inventory.find(i=>i.id===id);
  if(!item)fail('Товар не найден.');
  if(reserved(state,id)>0)fail('Сначала освободи товар с маркетов и полок.');
  state.draft.lines=state.draft.lines.filter(l=>l.itemId!==id);
  state.draft.promos=state.draft.promos.filter(p=>!p.parts.some(part=>part.itemId===id));
  state.activity.push({id:uid(),date:today(),kind:'delete',itemId:id,qty:item.qty});
  // Historical sales retain this record for safe backups and undo. The item
  // disappears from inventory, selectors and inventory valuations.
  item.qty=0;item.archived=true;
}
export function deleteEvent(state,id) {
  if(!state.events.some(e=>e.id===id))fail('Маркет не найден.');
  state.events=state.events.filter(e=>e.id!==id);
  if(state.editingId===id){state.editingId=null;state.draft=blankPlan();}
  // Sales already reduced inventory. Deleting an event releases only reserves.
}

export function deleteShelf(state,id) {
  if(!state.shelves.some(s=>s.id===id))fail('Полка не найдена.');
  // Stock includes on-shelf units already. Removing the reservation frees them;
  // recorded sales must never be added back to inventory.
  state.shelves=state.shelves.filter(s=>s.id!==id);
}
export function setPlanQuantity(state,itemId,qty) {
  const item=state.inventory.find(i=>i.id===itemId);
  if(!item||item.archived)fail('Товар не найден.');
  if(!Number.isInteger(qty)||qty<0||qty>available(state,itemId,state.editingId))fail('Проверь доступное количество товара.');
  const line=state.draft.lines.find(l=>l.itemId===itemId);
  if(!qty){
    state.draft.lines=state.draft.lines.filter(l=>l.itemId!==itemId);
    state.draft.promos=state.draft.promos.filter(p=>!p.parts.some(part=>part.itemId===itemId));
  }else if(line)line.qty=qty;
  else state.draft.lines.push({itemId,name:item.name,category:item.category,qty,cost:item.cost,price:item.price,photo:item.photo||false,color:item.color||'red'});
}

export function sortedInventory(items,{search='',category='',sort='name'}={}){
 const names=(a,b)=>a.name.localeCompare(b.name,'ru',{numeric:true});
 const order={name:names,'price-asc':(a,b)=>a.price-b.price||names(a,b),'price-desc':(a,b)=>b.price-a.price||names(a,b),'qty-asc':(a,b)=>a.qty-b.qty||names(a,b),'qty-desc':(a,b)=>b.qty-a.qty||names(a,b),category:(a,b)=>a.category.localeCompare(b.category,'ru')||names(a,b)};
 return items.filter(i=>!i.archived&&(!category||i.category===category)&&i.name.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))).sort(order[sort]||names);
}
export function remainingSales(event,leftovers){
 if(!event||event.status==='completed')fail('Маркет уже завершён.');
 const recorded=soldCounts(event),counts={};
 for(const line of event.plan.lines){
  const left=leftovers[line.itemId],max=line.qty-(recorded[line.itemId]||0);
  if(!Number.isInteger(left)||left<0||left>max)fail(`«${line.name}»: остаток от 0 до ${max}. Если продажа внесена ошибочно, сначала отмени её.`);
  counts[line.itemId]=max-left;
 }
 return counts;
}
export function finishEventByRemaining(state,id,leftovers,revenue=null){
 const event=state.events.find(e=>e.id===id),counts=remainingSales(event,leftovers);
 const hasSales=Object.values(counts).some(q=>q>0);
 if(!hasSales&&revenue!==null&&revenue!==0)fail('Новых продаж нет. Выручка уже записана.');
 sellEvent(state,id,counts,{},revenue,true);
}
