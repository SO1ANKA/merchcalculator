import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../domain.mjs';

test('queued saves keep their snapshot and recover after a failed write',async t=>{
  const originals=new Map(['indexedDB','localStorage','Telegram'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const saved=new Map(),mirrors=[];let failWrite=false;
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:undefined});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)??null,setItem(key,value){if(failWrite)throw new Error('quota');saved.set(key,value);}}});
  Object.defineProperty(globalThis,'Telegram',{configurable:true,value:{WebApp:{isVersionAtLeast:()=>true,DeviceStorage:{setItem(key,value,callback){mirrors.push(value);callback();}}}}});
  const {saveState,loadState,setPhoto}=await import('../storage.mjs?fallback-test');
  const state=emptyState();state.updatedAt=1;const first=saveState(state);
  state.updatedAt=2;state.settings.theme='dark';const second=saveState(state);
  state.updatedAt=3;state.settings.theme='light';
  await Promise.all([first,second]);
  assert.equal((await loadState()).updatedAt,2);assert.equal((await loadState()).settings.theme,'dark');
  assert.equal(JSON.parse(mirrors[0]).updatedAt,1);assert.equal(JSON.parse(mirrors.at(-1)).updatedAt,2);
  failWrite=true;await assert.rejects(saveState(state),/Экспортируй копию/);
  failWrite=false;await saveState(state);assert.equal((await loadState()).updatedAt,3);
  await assert.rejects(setPhoto('test',new Blob(['photo'])),/Хранилище фото недоступно/);
});
