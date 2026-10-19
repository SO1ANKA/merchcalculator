import {uid,clone} from './domain.mjs';

// Local groundwork only. Telegram display data never grants access to a workspace.
const collections=['inventory','events','shelves','activity'];
export function telegramProfile(webApp){
 const user=webApp?.initDataUnsafe?.user;
 if(!webApp?.initData||!user||typeof user.first_name!=='string')return null;
 const name=[user.first_name,user.last_name].filter(v=>typeof v==='string').join(' ').slice(0,160).trim();
 let photo='';try{const url=new URL(user.photo_url);if(url.protocol==='https:')photo=url.href;}catch{}
 return {name:name||'Мой профиль',photo,initial:name.slice(0,1).toLocaleUpperCase('ru-RU')||'Я'};
}
export function initializeWorkspace(state,{fresh=false}={}){
 if(!fresh&&state.collaboration){validateWorkspace(state.collaboration);return state.collaboration;}
 const meta={version:1,workspaceId:uid(),revision:0,records:{},deleted:{}};
 for(const collection of collections)for(const record of state[collection])meta.records[collection+':'+record.id]={revision:0,changedAt:state.updatedAt};
 state.collaboration=meta;return meta;
}
export function validateWorkspace(meta){
 const safe=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
 if(!meta||meta.version!==1||!safe(meta.workspaceId)||!Number.isSafeInteger(meta.revision)||meta.revision<0)throw new Error('Некорректная версия рабочего пространства.');
 for(const map of [meta.records,meta.deleted]){
  if(!map||typeof map!=='object'||Array.isArray(map))throw new Error('Некорректные версии записей.');
  for(const [key,value] of Object.entries(map)){
   const [collection,id,...tail]=key.split(':');
   if(tail.length||!collections.includes(collection)||!safe(id)||!value||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>meta.revision||!Number.isFinite(value.changedAt)||value.changedAt<0)throw new Error('Некорректная версия записи.');
  }
 }
}
export function recordWorkspaceChanges(before,after){
 initializeWorkspace(after);const meta=after.collaboration,changed=[],deleted=[];
 for(const collection of collections){
  const prior=new Map(before[collection].map(record=>[record.id,record]));
  for(const record of after[collection]){if(JSON.stringify(record)!==JSON.stringify(prior.get(record.id)))changed.push(collection+':'+record.id);prior.delete(record.id);}
  for(const id of prior.keys())deleted.push(collection+':'+id);
 }
 if(!changed.length&&!deleted.length)return;
 const stamp={revision:++meta.revision,changedAt:Date.now()};
 for(const key of changed){meta.records[key]={...stamp};delete meta.deleted[key];}
 for(const key of deleted){delete meta.records[key];meta.deleted[key]={...stamp};}
}
// Initial upload boundary for a future authenticated transport; excludes local
// UI settings, draft, Telegram launch credentials and profile display data.
// This snapshot is NOT an operation log and must never be merged last-write-wins.
export function workspaceSnapshot(state){
 initializeWorkspace(state);
 return clone({protocol:1,workspace:state.collaboration,...Object.fromEntries(collections.map(key=>[key,state[key]]))});
}
