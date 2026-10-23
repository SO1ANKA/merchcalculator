import {renderShell} from '../render-shell.mjs';
const root=document.querySelector('#fixture'),out=document.querySelector('#results'),checks=[];
const assert=(ok,name)=>{if(!ok)throw Error(name);checks.push('✓ '+name);};
const markup=(view='inventory',dark=false)=>`<div class="stars"><span>✦</span></div><div class="shell"><header><img class="portrait" src="../assets/yuna-portrait.webp"><button aria-expanded="${dark}">${dark?'Свет':'Тень'}</button></header><aside><input name="code"><img class="kei" src="../assets/kei-chibi.webp"></aside><main id="main" data-view="${view}"><input name="qty" value="3"><h2>${view}</h2></main><footer data-view="${view}">Копия</footer></div>`;
try{
 renderShell(root,markup(),'retro');
 const portrait=root.querySelector('.portrait'),kei=root.querySelector('.kei'),star=root.querySelector('.stars span'),code=root.querySelector('[name=code]');
 code.value='CHIIKAWA';root.querySelector('[name=qty]').value='999';
 renderShell(root,markup('calc'),'retro');
 assert(portrait===root.querySelector('.portrait')&&portrait.isConnected,'Портрет не пересоздаётся');
 assert(kei===root.querySelector('.kei'),'Кей не пересоздаётся');
 assert(star===root.querySelector('.stars span'),'Звёзды не перезапускаются');
 assert(root.querySelector('[name=code]')===code&&code.value==='CHIIKAWA','Поле кода и введённый текст сохраняются');
 assert(root.querySelector('[name=qty]').value==='3','Рабочая форма получает актуальные значения');
 assert(root.querySelector('main').dataset.view==='calc'&&root.querySelector('footer').dataset.view==='calc','Раздел и мобильная видимость обновляются');
 renderShell(root,markup('calc',true),'retro');
 assert(root.querySelector('header button').getAttribute('aria-expanded')==='true'&&root.querySelector('header button').textContent==='Свет','Кнопки и доступность обновляются');
 assert(root.querySelector('.portrait')===portrait,'Смена темы сохраняет картинки');
 root.querySelector('[name=qty]').value='111';renderShell(root,markup('calc',true),'retro');
 assert(root.querySelector('[name=qty]').value==='3','Одинаковая разметка тоже сбрасывает устаревшее значение формы');
 renderShell(root,'<main id="main">Классический вид</main>','classic');
 assert(!portrait.isConnected&&root.textContent==='Классический вид','Смена оформления полностью меняет оболочку');
 renderShell(root,markup(),'retro');assert(root.querySelector('.portrait')!==portrait,'Возврат из классического оформления');
 renderShell(root,markup(),'retro:demo');assert(root.querySelector('[name=code]').value==='','При смене режима поле очищается');
 out.textContent=checks.join('\n')+'\nВсе 12 проверок пройдены.';
}catch(error){out.textContent=checks.join('\n')+'\nОШИБКА: '+error.message;throw error;}
