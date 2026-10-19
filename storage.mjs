const KEY='solyanka-state-v1';
let db,opening,queue=Promise.resolve();
const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('solyanka-local',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('photos');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const tg=()=>globalThis.Telegram?.WebApp;
function deviceRead() {return new Promise(resolve=>{const d=tg()?.DeviceStorage;if(!d||!tg()?.isVersionAtLeast?.('9.0'))return resolve(null);const timeout=setTimeout(()=>resolve(null),1800);try{d.getItem(KEY,(err,data)=>{clearTimeout(timeout);resolve(err?null:data);});}catch{clearTimeout(timeout);resolve(null);}});}
function deviceMirror(json){try{if(new Blob([json]).size<4500000&&tg()?.isVersionAtLeast?.('9.0'))tg()?.DeviceStorage?.setItem(KEY,json,()=>{});}catch{}}
async function init(){if(db)return db;if(!opening)opening=openDB().then(database=>{db=database;db.onversionchange=()=>{db.close();db=null;};return db;}).catch(()=>null).finally(()=>{opening=null;});return opening;}
export async function loadState(){const database=await init();let local=null;if(database)local=await new Promise(resolve=>{const r=database.transaction('state').objectStore('state').get(KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);});try{const emergency=JSON.parse(localStorage.getItem(KEY)||'null');if(emergency&&(!local||(emergency.updatedAt||0)>(local.updatedAt||0)))local=emergency;}catch{}if(!local){try{local=JSON.parse(await deviceRead()||'null');}catch{}}return local;}
export function saveState(state){const json=JSON.stringify(state);queue=queue.catch(()=>{}).then(async()=>{const database=await init();if(database)await new Promise((resolve,reject)=>{const tx=database.transaction('state','readwrite');tx.objectStore('state').put(JSON.parse(json),KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Не удалось сохранить данные.'));});else{try{localStorage.setItem(KEY,json);}catch{throw new Error('Не удалось сохранить данные. Экспортируй копию.');}}deviceMirror(json);});return queue;}
export async function setPhoto(id,blob){const database=await init();if(!database)throw new Error('Хранилище фото недоступно.');return new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite');tx.objectStore('photos').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('Не удалось сохранить фото. Возможно, закончилось место.'));});}
export async function getPhoto(id){const database=await init();if(!database)return null;return new Promise(resolve=>{const r=database.transaction('photos').objectStore('photos').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);});}
export async function getPhotos(ids){
  if(!ids.length)return [];
  const database=await init();if(!database)return [];
  return new Promise((resolve,reject)=>{
    const out=[],tx=database.transaction('photos'),store=tx.objectStore('photos');
    for(const id of new Set(ids)){const request=store.get(id);request.onsuccess=()=>{if(request.result)out.push([id,request.result]);};}
    tx.oncomplete=()=>resolve(out);
    tx.onerror=()=>reject(new Error('Не удалось прочитать фото для копии.'));
    tx.onabort=()=>reject(new Error('Чтение фото прервано. Попробуй ещё раз.'));
  });
}
export async function compressPhoto(file){if(!file.type.startsWith('image/'))throw new Error('Выбери изображение.');if(file.size>30*1024*1024)throw new Error('Выбери фото размером до 30 МБ.');const url=URL.createObjectURL(file);try{const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Не удалось открыть фото. Попробуй JPEG или PNG.'));i.src=url;});const scale=Math.min(1,800/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78));if(!blob)throw new Error('Не удалось обработать фото.');return blob;}finally{URL.revokeObjectURL(url);}}
export const blobDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
