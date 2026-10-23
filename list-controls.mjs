const pages=new Map(),bindings=new WeakMap();
export const pageWindow=(count,page=0,size=6)=>{const total=Math.max(1,Math.ceil(count/size)),index=Math.max(0,Math.min(total-1,Math.trunc(Number(page)||0)));return {page:index,total,start:index*size,end:Math.min(count,(index+1)*size)};};
export const clampQuantity=(value,min=0,max=10000000)=>Math.min(max,Math.max(min,Math.trunc(Number(value)||0)));
export function resetListPages(scope){for(const key of pages.keys())if(key.startsWith(scope+':'))pages.delete(key);}
export function paginateLists(root,scope=''){
 if(!root)return;
 // Group consecutive merchandise rows in reports without moving unrelated totals.
 for(const first of [...root.querySelectorAll('.detail-row')]){
  if(!first.querySelector('.thumb')||first.parentElement.matches('.paged-merch-rows'))continue;
  const rows=[];let row=first;
  while(row?.matches('.detail-row')&&row.querySelector('.thumb')){rows.push(row);row=row.nextElementSibling;}
  if(rows.length>6){const group=document.createElement('div');group.className='paged-merch-rows';first.before(group);group.append(...rows);}
 }
 const lists=root.querySelectorAll('.inventory-grid,.stock-grid,.plan-lines,.result-prices,.bundle-grid,.place-list,.paged-merch-rows');
 lists.forEach((list,i)=>{
  const key=scope+':'+(list.id||list.className.split(' ')[0])+':'+i,items=[...list.children];
  let binding=bindings.get(list);
  if(binding?.items.length===items.length&&binding.items.every((item,j)=>item===items[j]))return;
  binding?.nav.remove();
  const nav=document.createElement('nav');nav.className='list-pagination';nav.setAttribute('aria-label','Страницы списка');
  const previous=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');
  for(const b of [previous,next]){b.type='button';b.className='button secondary';}
  previous.textContent='←';previous.setAttribute('aria-label','Предыдущая страница списка');next.textContent='→';next.setAttribute('aria-label','Следующая страница списка');label.setAttribute('role','status');label.setAttribute('aria-live','polite');
  nav.append(previous,label,next);list.after(nav);
  let page=scope?(pages.get(key)||0):0;
  const draw=()=>{const range=pageWindow(items.length,page);page=range.page;if(scope)pages.set(key,page);items.forEach((item,j)=>item.hidden=j<range.start||j>=range.end);nav.hidden=items.length<=6;previous.disabled=page===0;next.disabled=page===range.total-1;label.textContent=`${page+1} / ${range.total}`;};
  const select=delta=>{page+=delta;draw();list.dispatchEvent(new Event('list-page-change',{bubbles:true}));const top=list.getBoundingClientRect().top;if(top<0)list.scrollIntoView({block:'start',behavior:'instant'});};
  previous.onclick=()=>select(-1);next.onclick=()=>select(1);bindings.set(list,{items,nav});draw();
 });
}
export function prepareQuantityInputs(root){
 for(const input of root.querySelectorAll('input[type=number]')){
  if(input.closest('.quantity-dialog'))continue;
  const name=input.name||'';
  if(input.closest('.stock-choice')||/^(qty|count|target|pick-.+|qty-.+|part-.+|move-.+|left-.+)$/.test(name)){
   input.readOnly=true;input.dataset.quantityInput='1';input.setAttribute('aria-haspopup','dialog');
  }
 }
}
export function showQuantityInput(input){
 if(input.disabled||document.querySelector('.quantity-dialog'))return;
 const min=Number(input.min)||0,max=input.max===''?10000000:Number(input.max),dialog=document.createElement('dialog');
 const title=input.closest('.stock-choice')?.querySelector('h3')?.textContent||input.getAttribute('aria-label')||input.closest('label')?.querySelector('span')?.textContent||'Количество';
 dialog.className='quantity-dialog';dialog.setAttribute('aria-labelledby','quantity-dialog-title');
 dialog.innerHTML='<div class="sheet-header"><h2 id="quantity-dialog-title"></h2><button type="button" class="icon-btn quantity-cancel" aria-label="Закрыть выбор количества">×</button></div><div class="sheet-body"><p class="sheet-description quantity-limit"></p><form><div class="quantity-picker"><button type="button" data-step="-10" aria-label="Уменьшить на 10">−10</button><button type="button" data-step="-1" aria-label="Уменьшить на 1">−1</button><input name="quantity" type="number" inputmode="numeric" step="1" required aria-label="Количество"><button type="button" data-step="1" aria-label="Увеличить на 1">+1</button><button type="button" data-step="10" aria-label="Увеличить на 10">+10</button></div><div class="sheet-footer"><button type="button" class="button secondary quantity-cancel">Отмена</button><button type="submit" class="button">Готово</button></div></form></div>';
 dialog.querySelector('h2').textContent=title;dialog.querySelector('.quantity-limit').textContent=`От ${min} до ${max} шт.`;
 const field=dialog.querySelector('input');field.min=min;field.max=max;field.value=clampQuantity(input.value,min,max);
 const refresh=()=>{for(const b of dialog.querySelectorAll('[data-step]'))b.disabled=Number(b.dataset.step)<0?Number(field.value)<=min:Number(field.value)>=max;};
 dialog.addEventListener('click',e=>{const step=e.target.closest('[data-step]');if(step){field.value=clampQuantity(Number(field.value)+Number(step.dataset.step),min,max);refresh();}if(e.target.closest('.quantity-cancel'))dialog.close();});
 field.addEventListener('input',refresh);
 dialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();if(!field.reportValidity())return;input.value=field.value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();});
 dialog.addEventListener('close',()=>{dialog.remove();if(input.isConnected)input.focus({preventScroll:true});},{once:true});
 document.body.append(dialog);refresh();dialog.showModal();dialog.querySelector('[type=submit]').focus({preventScroll:true});
}
if(typeof document!=='undefined')document.addEventListener('click',e=>{const input=e.target.closest('[data-quantity-input]');if(input){e.preventDefault();e.stopImmediatePropagation();showQuantityInput(input);}},true);
if(typeof document!=='undefined')document.addEventListener('keydown',e=>{if(e.target.matches('[data-quantity-input]')&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();showQuantityInput(e.target);}},true);
