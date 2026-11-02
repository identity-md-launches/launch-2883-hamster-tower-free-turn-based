// Browser flow injected by scripts/e2e.js. Clicks through the real UI against the real server.
(async function(){
  const seen=[],errs=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+e.lineno));
  window.addEventListener('unhandledrejection',e=>errs.push('REJ '+(e.reason&&e.reason.message||e.reason)));
  const nap=ms=>new Promise(r=>setTimeout(r,ms));
  const qs=s=>document.querySelector(s);
  const idle=async()=>{let g=0;while(UI.busy&&g++<200)await nap(25);};
  const click=async(sel,ms)=>{await idle();const el=qs(sel);if(!el)throw new Error('Not found: '+sel+' on '+UI.view);el.click();await nap(ms===undefined?40:ms);await idle();};
  const skip=async ms=>{const b=qs('[data-act=spin-skip]');if(b)b.click();await nap(ms||150);};
  const until=async(fn,max)=>{const t=Date.now();while(!fn()&&Date.now()-t<(max||15000))await nap(40);return fn();};
  async function fight(maxRounds){
    let g=0;
    while(UI.view==='battle'&&g++<(maxRounds||300)){
      if(!BT||BT.playing){await nap(60);continue;}
      for(const u of alive(BT.B,'p')){const b=[2,1,0].map(i=>qs('#sk-'+u.id+'-'+i)).find(x=>x&&!x.disabled);if(b)b.click();}
      await nap(750);
      if(BT&&!BT.playing&&qs('#fight')&&!qs('#fight').disabled)qs('#fight').click();
      await nap(60);
    }
    await until(()=>UI.view!=='battle'||!BT,8000);
    return UI.view;
  }
  try{
    PREF.speed=3;
    if(UI.view!=='login'){await ACT.logout();await nap(300);}
    seen.push('login view='+UI.view+' guest button='+!!qs('[data-act=guest]')+' wallet button='+!!qs('[data-act=wallet]'));
    const noWallet=()=>Object.assign(new Error('no'),{code:4001});
    dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'t1',rdns:'test.one',name:'Test <b>One</b>',icon:'javascript:alert(1)'},provider:{request:async()=>{throw noWallet();}}}}));
    await click('[data-act=wallet]');seen.push('wallet list rows='+document.querySelectorAll('.wrow').length+' name escaped='+(qs('.wtx b').textContent==='Test <b>One</b>')+' bad icon refused='+!qs('.wrow img'));
    await click('.wrow',200);seen.push('wallet refused keeps the list='+(UI.sheet&&UI.sheet.type)+' toast='+(qs('.toast')&&qs('.toast').textContent));
    await click('.sheet [data-act=close]');
    await click('[data-act=guest]',600);await until(()=>UI.view==='tower');
    seen.push('tower floors='+FLOORS.length+' rows='+document.querySelectorAll('.floor').length+' top='+G.top);
    await click('.hero .btn.big');seen.push('floor sheet='+(UI.sheet&&UI.sheet.type)+' map preview='+!!qs('canvas[data-map]'));
    await click('[data-act=enter]',400);await until(()=>UI.view==='battle');
    seen.push('battle units='+document.querySelectorAll('.unit').length+' plan rows='+document.querySelectorAll('.plan-row').length+' order='+document.querySelectorAll('.ord').length+' token='+!!BT.token);
    for(let f=1;f<=6;f++){
      const v=await fight();
      seen.push('floor '+f+' done view='+v+' win='+(UI.result&&UI.result.win)+' top='+G.top+' team='+G.team.length+' coins='+G.coins+' chests='+chestTotal(G)+' err='+(UI.result&&UI.result.error));
      if(UI.view!=='result')throw new Error('Battle did not end on floor '+f);
      if(!UI.result.win){await click('[data-act=enter]',400);continue;}
      if(f===6)break;
      await click('.res .btn.big',400);await until(()=>UI.view==='battle');
    }
    seen.push('client and server disagreed '+UI.mismatch+' times');
    await click('[data-act=nav][data-v=tower]');
    await click('.hero .btn.big');await click('[data-act=enter]',500);await until(()=>UI.view==='battle');
    seen.push('3 pet battle rows='+document.querySelectorAll('.plan-row').length+' skill buttons='+document.querySelectorAll('.sk').length);
    tipShow('u:e0',qs('#u-e0'));seen.push('enemy tooltip has moves='+qs('#tip').innerHTML.includes('tip-mv'));tipHide();
    const v2=await fight();seen.push('floor 7 '+v2);
    await click('[data-act=nav][data-v=tower]');
    const had=chestTotal(G);await click('[data-act=sweep]',300);seen.push('sweep sheet='+(UI.sheet&&UI.sheet.type)+' chests '+had+' to '+chestTotal(G));
    await click('.sheet [data-act=close]');
    await click('[data-act=nav][data-v=ranks]',300);await until(()=>UI.ranks);seen.push('leaderboard view='+UI.view+' podium='+document.querySelectorAll('.pod').length+' my rank='+(qs('.my-no b')&&qs('.my-no b').textContent)+' me highlighted='+!!qs('.pod.me,.rank li.me'));
    await click('[data-act=sheet][data-type=trial]');await click('[data-act=tr-coins]',200);await click('[data-act=tr-coins]',200);await click('[data-act=tr-chests]',200);await click('.sheet [data-act=close]');
    seen.push('after test panel coins='+G.coins+' chests='+chestTotal(G));
    await click('[data-act=nav][data-v=shop]');seen.push('shop cards='+document.querySelectorAll('.shop-card').length+' blind bag='+!!qs('[data-act=bag]'));
    const fid=lowestTeamPet(),c9=G.coins;
    await click('[data-act=foodbag][data-t="0"][data-n="1"]',200);await until(()=>SP);seen.push('food spin reel='+!!qs('.reel')+' coins spent='+(c9-G.coins)+' foods='+foodTotal());
    await skip(200);seen.push('food spin done='+(SP&&SP.done)+' card='+!!qs('.big-res'));await click('[data-act=spin-close]');
    await click('[data-act=foodbag][data-t="0"][data-n="10"]',200);await until(()=>SP);seen.push('food spin 10 minis='+document.querySelectorAll('.mini').length);await skip(300);seen.push('food spin 10 done='+(SP&&SP.done)+' cards='+document.querySelectorAll('#spbody .rv').length);
    await click('[data-act=spin-feed]',200);seen.push('feed opens sheet='+(UI.sheet&&UI.sheet.type)+' pet='+(UI.sheet&&UI.sheet.id===fid)+' tiles='+document.querySelectorAll('.sheet .ftile').length);
    const fo=G.owned[fid],lv0=fo.lv,xp0=fo.xp;
    const ft=qs('.sheet button.ftile');if(ft){const f0=fo.full;await click('.sheet button.ftile',200);if(UI.feedAsk)await click('.sheet button.ftile',200);seen.push('tap food fullness '+f0+' to '+G.owned[fid].full);}
    await action('foodbag',{tier:0,n:20});render();await nap(40);
    if(qs('.sheet [data-act=feed-auto]'))await click('.sheet [data-act=feed-auto]',200);
    seen.push('fullness '+G.owned[fid].full+' of '+stomach(G.owned[fid].lv)+' run button='+!!qs('[data-act=run-wheel]'));
    await click('.sheet [data-act=run-wheel]',300);await until(()=>SP&&SP.wheel);seen.push('wheel stage='+!!qs('.wr-stage')+' spinning='+!!(qs('#wrw')&&qs('#wrw').getAnimations().length));
    await skip(200);seen.push('wheel done='+(SP&&SP.done)+' luck='+(qs('.wr-luck')&&qs('.wr-luck').textContent)+' level '+lv0+' to '+G.owned[fid].lv+', xp '+xp0+' to '+G.owned[fid].xp+' fullness='+G.owned[fid].full);
    if(qs('[data-act=wr-again]')){const xp1=G.owned[fid].xp+G.owned[fid].lv*1e6;await click('[data-act=wr-again]',300);await until(()=>SP&&SP.wheel);seen.push('feed and run again wheel='+!!qs('.wr-stage')+' changed='+(G.owned[fid].xp+G.owned[fid].lv*1e6!==xp1));await skip(200);}else seen.push('no food left to run again');
    await click('[data-act=spin-close]');
    await dev('food');render();
    const lv1=G.owned[fid].lv;await click('.sheet [data-act=run-all]',60);seen.push('use all asks first='+(UI.allAsk===fid));await click('.sheet [data-act=run-all]',300);await until(()=>SP&&SP.wheel);seen.push('use all level '+lv1+' to '+G.owned[fid].lv+' foods left='+foodTotal());await click('[data-act=spin-close]');
    PREF.fastRun=true;await dev('food');render();const b5=qs('.sheet [data-act=feed-auto]:not([disabled])');if(b5)await click('.sheet [data-act=feed-auto]',200);if(qs('.sheet [data-act=run-wheel]')){const xp5=G.owned[fid].xp,lv5=G.owned[fid].lv;await click('.sheet [data-act=run-wheel]',300);seen.push('skip animation overlay='+!!qs('#overlay .wr')+' changed='+(G.owned[fid].xp!==xp5||G.owned[fid].lv!==lv5));}PREF.fastRun=false;
    await click('.sheet [data-act=close]');
    await click('[data-act=nav][data-v=shop]');await click('[data-act=to-pantry]');seen.push('shop to pantry='+UI.invTab+' on '+UI.view);
    await click('[data-act=nav][data-v=shop]');await click('[data-act=to-food-odds]');seen.push('shop to odds='+UI.tab+' on '+UI.view+' rows='+document.querySelectorAll('.food-tbl tbody tr').length);
    await click('[data-act=nav][data-v=shop]');await click('[data-act=bag][data-n="1"]',200);await until(()=>SP);seen.push('spin 1 reel='+!!qs('.reel'));
    await skip(200);seen.push('spin 1 done='+(SP&&SP.done)+' buttons='+document.querySelectorAll('#spbtns .btn').length);
    await click('[data-act=spin-again]',200);await until(()=>SP&&!SP.done||SP&&SP.done);await skip(200);await click('[data-act=spin-close]');
    await click('[data-act=bag][data-n="10"]',200);await until(()=>SP);seen.push('spin 10 minis='+document.querySelectorAll('.mini').length);
    await skip(300);seen.push('spin 10 done='+(SP&&SP.done)+' cards='+document.querySelectorAll('#spbody .rv').length);await click('[data-act=spin-close]');
    seen.push('items='+G.items.length+' pets='+Object.keys(G.owned).length+' bags='+G.bags+' pityE='+G.pityE);
    await click('[data-act=nav][data-v=items]');await click('[data-act=inv][data-k=chest]');seen.push('chests='+chestTotal(G)+' cards='+document.querySelectorAll('.chest-card').length);
    await click('[data-act=chest][data-t="0"][data-n="1"]',200);await until(()=>SP);await skip(200);await click('[data-act=spin-close]');
    const c0=G.coins;await click('[data-act=chest-all]',200);await until(()=>SP&&SP.done,3000);seen.push('open all done='+(SP&&SP.done)+' left='+chestTotal(G)+' coins +'+(G.coins-c0));await click('[data-act=spin-close]');
    await click('[data-act=inv][data-k=food]');seen.push('pantry tiles='+document.querySelectorAll('.fgrid .ftile').length);
    await click('[data-act=nav][data-v=team]');seen.push('team meters='+document.querySelectorAll('.mini-m').length);await click('.pcard');
    await click('.sheet .gslot');seen.push('gear sheet='+UI.sheet.type);
    if(qs('.pick-row')){await click('.pick-row',200);seen.push('equipped='+Object.keys(G.owned[UI.sheet.id].gear).length);}else await click('.sheet [data-act=pet]');
    await click('.sheet [data-act=close]');
    await click('[data-act=nav][data-v=items]');await click('[data-act=inv][data-k=gear]');seen.push('item grid='+document.querySelectorAll('.item').length);
    const groups={};G.items.forEach(i=>{const k=i.set+i.slot+i.rar;(groups[k]=groups[k]||[]).push(i);});
    const g3=Object.values(groups).find(a=>a.length>=3&&a.some(x=>!ownerOf(x.uid)));
    if(g3){const it=g3.find(x=>!ownerOf(x.uid));openSheet({type:'item',uid:it.uid});await nap(40);seen.push('merge button='+!!qs('[data-act=forge]:not([disabled])'));await click('[data-act=forge]',200);seen.push('forge='+!!qs('.fg-stage'));await until(()=>SP&&SP.done,3000);seen.push('forge done='+(SP&&SP.done));await click('[data-act=spin-close]');}
    else seen.push('no 3 matching items this run');
    await click('[data-act=sell-t][data-r=r]');
    if(qs('[data-act=sell-ask]:not([disabled])')){const c1=G.coins,n1=G.items.length;await click('[data-act=sell-ask]');await click('[data-act=sell-do]',300);seen.push('sold coins '+c1+' to '+G.coins+', items '+n1+' to '+G.items.length);}
    await click('[data-act=nav][data-v=codex]');
    for(const t of ['pet','mon','boss','react','rule','food','wx','gear']){await click('[data-act=tab][data-k='+t+']');seen.push(t+' text='+document.querySelector('.main').textContent.length);}
    await click('[data-act=tab][data-k=boss]');await click('[data-act=try]',300);await until(()=>UI.view==='battle');seen.push('practice view='+UI.view+' sandbox='+(BT&&BT.sandbox));await click('[data-act=leave]');
    await click('[data-act=sheet][data-type=trial]');await click('[data-act=tr-pets]',300);await click('[data-act=tr-jump][data-n="99"]',400);seen.push('jump top='+G.top+' pets='+Object.keys(G.owned).length);
    for(const id of BOSS_LIST.map(b=>b.id).concat(['popcorn','fake_contract','swollen_battery','walking_cage','sniper_bot','fud_cloud'])){
      await enterBattle(sandboxNode(id),{sandbox:true,salt:'t'});
      const v3=await fight(40);
      seen.push(id+': '+v3);
      if(UI.view==='battle'){await click('[data-act=leave]');if(UI.view==='battle')await click('[data-act=leave]');}
    }
    const cv=document.createElement('canvas');let mapOk=0;for(let t=0;t<MAP_NAMES.length;t++)for(let k=0;k<TONE_NAMES.length;k++){drawMap(cv,{hash:'0xmap'+t+k,map:{t,tone:k}},.25);mapOk++;}seen.push('maps drawn='+mapOk);
    const peaks=[];for(const n of SND.names()){const c=new OfflineAudioContext(1,44100*3,44100);SND.renderInto(c,n,n==='cast'?'spark':undefined);const d=(await c.startRendering()).getChannelData(0);let p=0;for(let i=0;i<d.length;i++)p=Math.max(p,Math.abs(d[i]));peaks.push([n,p]);}
    seen.push('sounds='+peaks.length+' silent='+JSON.stringify(peaks.filter(x=>x[1]<.006).map(x=>x[0]))+' too loud='+JSON.stringify(peaks.filter(x=>x[1]>.7).map(x=>x[0])));
    const fxNames=[...new Set(PETS_LIST.flatMap(p=>p.skills.map(s=>s.fx)).concat(MONS_LIST.concat(BOSS_LIST).flatMap(m=>m.moves.map(x=>autoFx(x,m.el)))))];
    seen.push('skill effects='+fxNames.length+' missing='+JSON.stringify(fxNames.filter(n=>!FX.names().includes(n))));
    UI.view='tower';UI.result=null;render();
    const broken=[...document.querySelectorAll('img')].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src);seen.push('broken images='+broken.length+(broken[0]?' '+broken[0]:''));
    const bgs=await Promise.all(['bg_login','bg_login_tall','bg_night','bg_night_tall'].map(n=>fetch('art/'+n+'.webp').then(r=>r.ok)));seen.push('backgrounds found='+bgs.filter(Boolean).length+' of 4, showing '+document.documentElement.dataset.bg);
    const w=document.documentElement.scrollWidth,cw=document.documentElement.clientWidth;seen.push('horizontal overflow='+(w>cw));
    seen.push('client and server disagreed '+UI.mismatch+' times');
    return {ok:true,seen,errs};
  }catch(e){return {ok:false,error:e.message,seen,errs};}
})()
