// Pure template/flow checks; these do not emulate a browser or visual layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {demoState,projection,stockLevels} from '../domain.mjs';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
function functionSource(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0);const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end<0?undefined:end);}
const names=['calculator','sectionCover','art','stockCard','stockChoices','forecastControl','goalControl','expenseSection','promoSection','resultPrices','summary','heading','planLine','promoCard','calcNote'];
function context(){const state=demoState();state.draft.promos=[{id:'pair',name:'Пара',price:500,count:5,parts:[{itemId:'key',qty:2}]}];const ctx=createContext({state,calcOpen:true,projection,esc:v=>String(v??''),money:n=>n+' ₽',icon:()=>'',thumb:i=>`<span class="thumb">${i.name}</span>`,freeStock:id=>stockLevels(state).get(id).free});runInContext(source.match(/^const goalNames=.*;$/m)?.[0]+'\n'+names.map(functionSource).join('\n'),ctx);return ctx;}
test('calculator entry offers two modes with no calculation panels',()=>{const ctx=context();ctx.calcOpen=false;const html=runInContext('calculator()',ctx);assert.equal((html.match(/data-action="enter-calc"/g)||[]).length,2);assert.ok(!html.includes('payoff-card'));assert.ok(!html.includes('stock-grid'));});
test('simple wizard shows visual stock, then bundles, then expenses, and only then results',()=>{
 const ctx=context();const expected=['Возьми мерч','Наборы со скидкой','Стоимость места','Цель расчёта'];
 for(let step=0;step<4;step++){ctx.state.draft.uiStep=step;const html=runInContext('calculator()',ctx);assert.ok(html.includes(expected[step]));assert.equal(html.includes('payoff-card'),step===3);assert.equal(html.includes('id="sell-percent"'),step===3);assert.equal(html.includes('data-action="goal"'),step===3);assert.ok(!html.includes('undefined'));assert.ok(!html.includes('NaN'));}
});
test('pro mode keeps graph, manual prices, stock, discounts and expenses together',()=>{const ctx=context();ctx.state.draft.mode='pro';const html=runInContext('calculator()',ctx);for(const text of ['payoff-card','data-change="line-price"','stock-grid','Наборы со скидкой','Стоимость места'])assert.ok(html.includes(text));assert.ok(!html.includes('data-action="goal"'));assert.ok(!html.includes('class="wizard-nav"'));});
test('result uses a coherent revenue minus all investments profit',()=>{const ctx=context();ctx.state.draft.mode='pro';const p=projection(ctx.state.draft);const html=runInContext('summary(projection(state.draft))',ctx);for(const amount of [p.costs+p.procurement,p.revenue,p.cash])assert.ok(html.includes(amount+' ₽'));assert.equal((html.match(/<strong/g)||[]).length,3);});
test('stock tile reflects no availability and selected quantity accessibly',()=>{const ctx=context();const html=runInContext('stockCard(state.inventory[0],0,0)',ctx);assert.ok(html.includes('aria-pressed="false"'));assert.ok(html.includes('max="0"'));assert.equal((html.match(/disabled/g)||[]).length,3);const selected=runInContext('stockCard(state.inventory[0],5,11)',ctx);assert.ok(selected.includes('aria-pressed="true"'));assert.ok(selected.includes('value="5"'));});

test('simple result exposes only break-even and growth goals',()=>{const ctx=context();ctx.state.draft.uiStep=3;const html=runInContext('calculator()',ctx);assert.equal((html.match(/data-action="goal"/g)||[]).length,2);assert.ok(html.includes('Выйти в ноль'));assert.ok(html.includes('Получить прибыль'));assert.ok(!html.includes('data-value="market"'));});
