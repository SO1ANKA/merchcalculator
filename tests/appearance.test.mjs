import test from 'node:test';
import assert from 'node:assert/strict';
import {readAppearance,saveAppearance,applyAppearance} from '../appearance.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {demoState} from '../domain.mjs';
test('appearance persists independently of personal data, backup and demo state',()=>{
 const personal=JSON.stringify(demoState()),values=new Map([['solyanka-state-v1',personal],['tvoy-merch-retro-state-v1',personal]]);
 const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(readAppearance(storage),'retro');
 saveAppearance('classic',storage);assert.equal(readAppearance(storage),'classic');
 saveAppearance('retro',storage);assert.equal(readAppearance(storage),'retro');
 assert.equal(values.get('solyanka-state-v1'),personal);assert.equal(values.get('tvoy-merch-retro-state-v1'),personal);
});
test('unavailable preference storage still allows changing appearance',()=>{
 const storage={getItem(){throw Error('unavailable')},setItem(){throw Error('unavailable')}};
 assert.equal(readAppearance(storage),'retro');assert.equal(saveAppearance('classic',storage),'classic');
});
test('classic disables retro stylesheet and returning enables it',()=>{
 const link={},doc={documentElement:{dataset:{}},querySelector:()=>link};
 applyAppearance('classic',doc);assert.equal(link.media,'not all');assert.equal(doc.documentElement.dataset.appearance,'classic');
 applyAppearance('retro',doc);assert.equal(link.media,'all');
});
test('both shells render the same inventory data and calculator draft',async()=>{
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function classicShell()'),end=source.indexOf('\nfunction summary',start);
 const state=demoState(),before=JSON.stringify(state);
 const ctx={state,view:'inventory',isDemo:false,icon:()=>'',profileHeader:()=>'',utilityBar:()=>'',siteFooter:()=>'',document:{documentElement:{dataset:{theme:'light'}}},inventory:()=>JSON.stringify(state.inventory),calculator:()=>JSON.stringify(state.draft)};
 runInNewContext(source.slice(start,end)+'\nglobalThis.renderClassic=classicShell;',ctx);
 assert.ok(ctx.renderClassic().includes(JSON.stringify(state.inventory)));
 ctx.view='calc';assert.ok(ctx.renderClassic().includes(JSON.stringify(state.draft)));
 assert.equal(JSON.stringify(state),before);
});
