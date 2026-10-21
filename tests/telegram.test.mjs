import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=source.indexOf('function initTelegram()');
const init=source.slice(start,source.indexOf('\ntry{const loaded=',start));
function launch({modern=true,fullscreen=false,fail=false,browser=false}={}){
 const calls=[],events={},styles={};
 const tg={initData:'signed-launch-data',isFullscreen:fullscreen,safeAreaInset:{top:44,bottom:34},contentSafeAreaInset:{top:46,bottom:0},isVersionAtLeast:()=>modern,ready:()=>calls.push('ready'),expand:()=>calls.push('expand'),onEvent:(name,fn)=>events[name]=fn,requestFullscreen:()=>{calls.push('fullscreen');if(fail)throw Error('unsupported');}};
 const ctx=createContext({Telegram:browser?undefined:{WebApp:tg},state:{},applyTheme:()=>calls.push('theme'),document:{documentElement:{style:{setProperty:(k,v)=>styles[k]=v}}}});
 runInContext(init+'\ninitTelegram();',ctx);return{calls,events,styles,tg};
}
test('Telegram launch requests fullscreen and updates insets after the transition',()=>{
 const {calls,events,styles,tg}=launch();assert.deepEqual(calls,['ready','expand','fullscreen','theme']);
 assert.ok(styles['--safe-top'].includes('44px) + 46px'));
 tg.contentSafeAreaInset.top=58;events.fullscreenChanged();assert.ok(styles['--safe-top'].endsWith('+ 58px)'));
 assert.equal(typeof events.safeAreaChanged,'function');assert.equal(typeof events.contentSafeAreaChanged,'function');
});
test('old Telegram clients stay expanded without requesting unsupported fullscreen',()=>{assert.deepEqual(launch({modern:false}).calls,['ready','expand','theme']);});
test('rejected fullscreen and already-fullscreen launches still initialize normally',()=>{
 assert.deepEqual(launch({fail:true}).calls,['ready','expand','fullscreen','theme']);
 assert.deepEqual(launch({fullscreen:true}).calls,['ready','expand','theme']);
});
test('ordinary browser launch does not request Telegram fullscreen',()=>{assert.deepEqual(launch({browser:true}).calls,[]);});
