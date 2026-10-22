const KEY='tvoy-merch-appearance-v1';
export function readAppearance(storage){try{return (storage??globalThis.localStorage).getItem(KEY)==='classic'?'classic':'retro';}catch{return 'retro';}}
export function saveAppearance(value,storage){const next=value==='classic'?'classic':'retro';try{(storage??globalThis.localStorage).setItem(KEY,next);}catch{}return next;}
export function applyAppearance(value,doc=document){doc.documentElement.dataset.appearance=value;doc.querySelector('#retro-style').media=value==='classic'?'not all':'all';}
