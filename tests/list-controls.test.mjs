import test from 'node:test';
import assert from 'node:assert/strict';
import {pageWindow,clampQuantity} from '../list-controls.mjs';
test('all stock positions appear exactly once across pages, including the last incomplete page',()=>{
 for(const count of [0,1,6,7,14,61]){
  const seen=[];const total=pageWindow(count).total;
  for(let page=0;page<total;page++){
   const range=pageWindow(count,page);assert.ok(range.end-range.start<=6);
   for(let i=range.start;i<range.end;i++)seen.push(i);
  }
  assert.deepEqual(seen,Array.from({length:count},(_,i)=>i));
 }
});
test('a smaller filtered list clamps a previously selected page',()=>{
 assert.deepEqual(pageWindow(1,5),{page:0,total:1,start:0,end:1});
 assert.equal(pageWindow(14,-1).page,0);
});
test('quantity steps stop at available stock, preserve a minimum of one for purchases, and use integers',()=>{
 assert.equal(clampQuantity(18+10,0,25),25);
 assert.equal(clampQuantity(4-10,0,25),0);
 assert.equal(clampQuantity(4-10,1,100),1);
 assert.equal(clampQuantity(6.7,0,25),6);
 assert.equal(clampQuantity(10,0,0),0);
});
