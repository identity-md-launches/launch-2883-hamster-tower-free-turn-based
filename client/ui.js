/* USER INTERFACE */
(function(){const l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap';document.head.appendChild(l);})();
let FLOORS=[],CFG={},PLAYER=null,ROUNDS={rounds:[],cores:[],frontier:0,readAt:0};
const PREF_KEY='hamster-tower-prefs';
let PREF={};
try{PREF=JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch(e){}
const savePref=()=>{try{localStorage.setItem(PREF_KEY,JSON.stringify(PREF));}catch(e){}};
const artUri=id=>'art/'+id+'.webp';
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pic=(id,alt,cls)=>`<img src="${artUri(id)}" alt="${alt||''}" decoding="async"${cls?` class="${cls}"`:''}>`;
const picL=(id,alt,cls)=>`<img src="${artUri(id)}" alt="${alt||''}" decoding="async" loading="lazy"${cls?` class="${cls}"`:''}>`;
const artOf=id=>(MONS[id].boss?'boss_':'mon_')+id;
const gearArt=it=>'g_'+it.slot+'_'+it.set;
const coin='<i class="coin" aria-hidden="true"></i>';
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
const roundOne=v=>Math.round(v*10)/10;
const dec=v=>String(roundOne(v));
const pct=v=>Math.round(v*100)+'%';
const TRAITS={fly:'Flying, 15% dodge',hidden:'Hides its moves',boom:'Explodes on death',first:'Always acts first',thorns:'Thorns',taunt:'Starts with Taunt',regen:'Regenerates',revive:'Revives once'};
const TIME_STR=t=>new Date(t*1000).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'});
let G=null,BT=null,SP=null;
const UI={tryN:0,view:'login',sheet:null,sheetIn:false,block:null,tab:'pet',invTab:'chest',filter:'all',limit:120,sell:{n:true,r:false,e:false,l:false},sellAsk:false,result:null,wipeAsk:false,lastTry:null,busy:false,mismatch:0};
/* SERVER CALLS */
const newReqId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
/* empty when the site and the API share an address. The static copy hosted on IPFS calls the API elsewhere, so it keeps a signed ticket instead of a cookie */
const API_BASE=__API_BASE__,TICKET_KEY='hamster-tower-ticket';
let TICKET=null;
if(API_BASE){try{TICKET=localStorage.getItem(TICKET_KEY);}catch(e){}}
const setTicket=t=>{TICKET=t;try{if(t)localStorage.setItem(TICKET_KEY,t);else localStorage.removeItem(TICKET_KEY);}catch(e){}};
async function api(path,body){
  /* public data goes out without the ticket so the CDN can answer it */
  const headers=Object.assign(body===undefined?{}:{'content-type':'application/json'},TICKET&&!/^\/api\/(rounds|leaderboard|config)$/.test(path)?{authorization:'Bearer '+TICKET}:{});
  const init=Object.assign({credentials:API_BASE?'omit':'same-origin',headers},body===undefined?{}:{method:'POST',body:JSON.stringify(body)});
  let last;
  for(let i=0;i<3;i++){
    try{
      const r=await fetch(API_BASE+path,init);
      const j=await r.json().catch(()=>({}));
      if(r.ok){if(j.session)setTicket(j.session);return j;}
      const e=new Error(j.error||'Something went wrong, please try again');e.status=r.status;e.data=j;
      if(r.status<500)throw e;
      last=e;
    }catch(e){if(e.status&&e.status<500)throw e;last=e;}
    await new Promise(r=>setTimeout(r,400*(i+1)));
  }
  throw last.status?last:Object.assign(new Error('Lost connection to the server'),{status:0});
}
function applyState(st){
  if(!G)G={};
  for(const k of ['coins','top','team','chests','pityE','pityL','bags','sweepDay','gifts','battles','wins'])if(st[k]!==undefined)G[k]=st[k];
  if(st.owned)G.owned=st.owned;
  if(st.items)G.items=st.items.map(a=>({uid:a[0],set:a[1],slot:a[2],rar:a[3],plus:a[4]}));
  if(st.foods)G.foods=st.foods;
}
async function action(type,args){
  const j=await api('/api/action',Object.assign({type,requestId:newReqId()},args||{}));
  if(j.state)applyState(j.state);
  return j;
}
async function dev(op,args){
  const j=await api('/api/dev',Object.assign({op},args||{}));
  if(j.state)applyState(j.state);
  return j;
}
function fail(e){
  if(e&&e.data&&e.data.state)applyState(e.data.state);
  if(e&&e.status===401){setTicket(null);PLAYER=null;G=null;BT=null;UI.sheet=null;UI.view='login';render();}
  toast((e&&e.message)||'Something went wrong, please try again');
}
function toast(text){const old=$('.toast');if(old)old.remove();const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=text;document.body.appendChild(d);setTimeout(()=>d.remove(),2200);}
const ownerOf=uid=>{for(const id of Object.keys(G.owned)){const g=G.owned[id].gear;for(const s of Object.keys(g))if(g[s]===uid)return id;}return null;};
const curFloor=()=>Math.min(G.top+1,FLOORS.length);
const allClear=()=>G.top>=FLOORS.length;
const sweepBase=()=>{let b=0;for(let f=1;f<=G.top;f++)b+=baseCoin(f,FLOORS[f-1].boss)*.25;return Math.round(b);};
const timeToReset=()=>{const n=new Date();const next=Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1);const m=Math.ceil((next-n.getTime())/60000);return Math.floor(m/60)+'h '+(m%60)+'m';};

/* SHARED FRAME */
function topBar(){
  return `<header class="top gut"><div class="top-in wrap">
    <button class="brand" data-act="nav" data-v="tower" aria-label="Back to the tower">${pic('pet_squeektoshi','')}<span>Hamster Tower</span></button>
    <div class="grow"></div>
    <span class="pill num" title="Coins">${coin}${fmt(G.coins)}</span>
    <span class="pill num">Floor ${G.top}</span>
    ${PLAYER&&PLAYER.trial?'<button class="trial-btn" data-act="sheet" data-type="trial">Test<span class="wide"> panel</span></button>':''}${PLAYER&&PLAYER.wallet?`<span class="who"><button class="who-addr num" data-act="copy" data-t="${PLAYER.name}" title="Copy ${PLAYER.name}" aria-label="Copy wallet address ${PLAYER.name}">${shortAddr(PLAYER.name)}</button><button class="who-out" data-act="logout">Sign out</button></span>`:'<button class="trial-btn" data-act="logout">Sign out</button>'}
  </div></header>`;
}
const shortAddr=a=>a.slice(0,6)+'...'+a.slice(-4);
function navBar(){
  const eq=equippedUids(G);
  const merge=G.items.some(it=>!eq.has(it.uid)&&canMerge(G,it));
  const tabs=[['tower','Tower','nav_tower',canSweep(G,Date.now())],['team','Team','nav_team',G.team.some(id=>{const o=G.owned[id];return isFull(o)||feedPlan(G.foods,o.full,stomach(o.lv)).fills;})],['shop','Shop','nav_shop',G.coins>=BAG_COST||(!foodTotal()&&G.coins>=FOOD_BAGS[0].cost*3)],['items','Inventory','nav_items',merge||chestTotal(G)>0],['ranks','Ranks','nav_rank',false],['codex','Codex','nav_codex',false]];
  return `<nav class="nav gut" aria-label="Screens"><div class="nav-in">${tabs.map(([v,l,a,d])=>`<button data-act="nav" data-v="${v}" class="${UI.view===v?'on':''}"${UI.view===v?' aria-current="page"':''}>${pic(a,'')}${l}${d?'<i class="dot" aria-hidden="true"></i>':''}</button>`).join('')}</div></nav>`;
}
/* x, y, seconds, drift x, drift y: a few fireflies over the picture, opacity and transform only */
const FLIES=[[8,62,5,40,-34],[17,78,7,-30,-46],[26,54,6,34,30],[33,84,8,46,-28],[44,70,5.5,-36,-40],[56,86,7.5,30,-52],[64,60,6.5,-44,26],[72,80,5,38,-30],[81,56,8,-30,-44],[90,74,6,-42,34],[12,40,9,30,24],[86,34,8.5,-26,30]];
/* WALLET LIST: each installed wallet announces its own name and icon (EIP-6963). Older wallets only set window.ethereum.
   Names and icons come from outside the game, so they are escaped and an icon must be an image data address */
const WALLETS=new Map();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
addEventListener('eip6963:announceProvider',e=>{
  const d=e.detail;
  if(!d||!d.info||!d.provider||typeof d.provider.request!=='function')return;
  WALLETS.set(d.info.rdns||d.info.uuid||d.info.name,d);
  if(UI.sheet&&UI.sheet.type==='wallets')render();
});
const askWallets=()=>dispatchEvent(new Event('eip6963:requestProvider'));
askWallets();
const legacyName=p=>p.isRabby?'Rabby':p.isBraveWallet?'Brave Wallet':p.isCoinbaseWallet?'Coinbase Wallet':p.isTrust||p.isTrustWallet?'Trust Wallet':p.isOkxWallet||p.isOKExWallet?'OKX Wallet':p.isMetaMask?'MetaMask':'Browser wallet';
function walletList(){
  if(WALLETS.size)return [...WALLETS.values()];
  const eth=window.ethereum;
  if(!eth)return [];
  return (Array.isArray(eth.providers)&&eth.providers.length?eth.providers:[eth]).map(p=>({info:{name:legacyName(p)},provider:p}));
}
function sheetWallets(){
  const list=walletList();
  if(!list.length)return `<h2>Connect a wallet</h2><p>No wallet found in this browser.</p>
    <p class="note">Install a browser wallet such as <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">MetaMask</a> or <a href="https://rabby.io/" target="_blank" rel="noopener noreferrer">Rabby</a>, then reload this page. On a phone, open this page in your wallet app's browser.</p>`;
  return `<h2>Connect a wallet</h2>
    <div class="wlist">${list.map((w,i)=>{
      const name=w.info.name||'Wallet',ok=/^data:image\/(svg\+xml|png|webp|jpeg|gif)[;,]/i.test(w.info.icon||'');
      return `<button class="wrow" data-act="wallet-pick" data-i="${i}">${ok?`<img src="${esc(w.info.icon)}" alt="">`:`<i class="wlet" aria-hidden="true">${esc(String(name)[0])}</i>`}<span class="wtx"><b>${esc(name)}</b><small>${UI.walletWait===i?'Check your wallet...':'Installed'}</small></span></button>`;
    }).join('')}</div>
    <p class="note">You only sign a message. It costs nothing and sends no transaction.</p>`;
}
/* a wallet may never answer, so this does not lock the page: picking another wallet or closing the list drops the attempt */
async function pickWallet(i){
  const w=walletList()[i];if(!w)return;
  const eth=w.provider,run=UI.walletRun=(UI.walletRun||0)+1;
  const live=()=>run===UI.walletRun&&UI.sheet&&UI.sheet.type==='wallets';
  UI.walletWait=i;render();
  try{
    const accounts=await eth.request({method:'eth_requestAccounts'}),address=accounts&&accounts[0];
    if(!live())return;
    if(!address)throw new Error('This wallet did not share an account');
    const n=await api('/api/auth/nonce',{address});
    if(!live())return;
    /* the wallet only ever signs our own sign in text for this address, whatever the server sends */
    if(!n.message.startsWith('Sign in to Hamster Tower\n')||!n.message.includes('Wallet: '+address.toLowerCase()+'\n')||!n.message.endsWith('This signature costs nothing and sends no transaction.'))throw new Error('The sign in message looks wrong, nothing was signed.');
    const hex='0x'+[...new TextEncoder().encode(n.message)].map(b=>b.toString(16).padStart(2,'0')).join('');
    const signature=await eth.request({method:'personal_sign',params:[hex,address]});
    if(!live())return;
    await api('/api/auth/verify',{ticket:n.ticket,signature});
    if(!live())return;
    UI.sheet=null;UI.walletWait=null;
    await afterLogin();
  }catch(e){
    if(!live())return;
    UI.walletWait=null;render();
    toast(e&&e.code===4001?'Cancelled in your wallet':e&&e.code===-32002?'Your wallet already has a request waiting. Open it to answer.':(e&&e.message)||'The wallet could not sign in');
  }
}
function viewLogin(){
  return `<main class="login gut">${FLIES.map(([x,y,d,a,b])=>`<i class="fly" style="--x:${x}%;--y:${y}%;--d:${d}s;--dx:${a}px;--dy:${b}px" aria-hidden="true"></i>`).join('')}<div class="login-box">
    ${pic('wheel_big','Squeektoshi on the wheel')}
    <h1>Hamster Tower</h1>
    <p>A real hamster runs on the WHEELY9000 wheel, and every round with work becomes a floor. Climb the tower with your team of pets.</p>
    <div class="btns"><button class="btn big" data-act="wallet">Sign in with wallet</button>${CFG.guest?'<button class="btn ghost" data-act="guest">Play as guest</button>':''}</div>
    <p class="note">You only sign a message. It costs nothing and sends no transaction.</p>
  </div></main>`;
}
const setBg=m=>{document.documentElement.dataset.bg=m;};
function render(){
  tipHide();
  setBg(UI.view==='login'?'login':'night');
  if(UI.view==='login'){
    $('#app').innerHTML=viewLogin()+(UI.sheet?sheetHTML():'');
    const ls=$('.sheet');
    if(ls&&UI.sheetIn){ls.classList.add('in');UI.sheetIn=false;const x=$('.x',ls);if(x)x.focus({preventScroll:true});}
    return;
  }
  const st=$('.sheet')?$('.sheet').scrollTop:0;
  const V={tower:viewTower,team:viewTeam,shop:viewShop,items:viewInv,ranks:viewRanks,codex:viewCodex,result:viewResult}[UI.view];
  $('#app').innerHTML=topBar()+`<main class="main gut"><div class="wrap stack">${V()}</div></main>`+(UI.view==='result'?'':navBar())+(UI.sheet?sheetHTML():'');
  const sh=$('.sheet');
  if(sh){if(UI.sheetIn){sh.classList.add('in');UI.sheetIn=false;const x=$('.x',sh);if(x)x.focus({preventScroll:true});}else sh.scrollTop=st;}
  $$('canvas[data-map]').forEach(c=>{const n=FLOORS[+c.dataset.map-1];if(n)drawMap(c,n,.5);});
}
function openSheet(s){UI.sheet=s;UI.sheetIn=true;UI.feedAsk=null;UI.allAsk=null;render();}
function closeSheet(){UI.sheet=null;UI.wipeAsk=false;UI.feedAsk=null;UI.allAsk=null;render();}
function sheetHTML(){
  const s=UI.sheet;
  const inner={floor:sheetFloor,pet:sheetPet,gear:sheetGear,item:sheetItem,sweep:sheetSweep,trial:sheetTrial,wallets:sheetWallets}[s.type](s);
  return `<div class="sheet-wrap" data-act="close-bg"><div class="sheet s-${s.type}" role="dialog" aria-modal="true"><button class="x" data-act="close" aria-label="Close">×</button>${inner}</div></div>`;
}

/* TOWER SCREEN */
function viewTower(){
  const cur=curFloor(),can=canSweep(G,Date.now()),maxEnd=Math.ceil(FLOORS.length/10)*10;
  const end=UI.block||Math.min(maxEnd,Math.ceil(cur/10)*10),a=end-9,b=Math.min(end,FLOORS.length);
  const rows=[];
  for(let f=b;f>=a;f--){
    rows.push(floorRow(f));
    const n=FLOORS[f-1];
    if(n.nap&&f>1)rows.push(`<div class="nap">${pic('chest_4','')}<span>The hamster slept ${dec(n.gap/6)} hours before floor ${f}. Clearing floor ${f-1} for the first time gives a treasure chest.</span></div>`);
  }
  const atTop=b===FLOORS.length;
  return `<section class="hero">
      ${pic('scene','','scene')}<div class="hero-shade"></div>
      <div class="hero-tx">
        <p class="eyebrow">A real hamster on the WHEELY9000 wheel</p>
        <h1>The hamster runs, the tower grows</h1>
        <p>Every round with work on Squeekchain is a floor with its own map and weather. Fast runs become Zoomies floors, lazy runs become Easy floors, and long naps leave treasure chests behind.</p>
        <div class="btns">${allClear()?`<span class="pill">All ${FLOORS.length} floors cleared</span>`:`<button class="btn big" data-act="sheet" data-type="floor" data-f="${cur}">Climb floor ${cur}</button>`}<small class="num">Cleared ${G.top} of ${FLOORS.length} floors</small></div>
      </div>
      ${pic('wheel_big','Squeektoshi on the wheel','hero-pet')}
    </section>
    <section class="sweep">
      ${pic(can?'chest_3':'chest_1','')}
      <div><h2>Daily Sweep</h2><p>${G.top===0?'Clear the first floor to unlock Sweep.':can?`Collect rewards from ${G.top} cleared floors right now: about ${fmt(sweepBase())} coins and a batch of chests. Once per day.`:`Already collected today. Available again in ${timeToReset()}. Replay cleared floors for more.`}</p></div>
      <button class="btn${can?'':' ghost'}" data-act="sweep"${can?'':' disabled'}>${can?'Collect':G.top===0?'Locked':'Collected'}</button>
    </section>
    <section class="tower-wrap" aria-label="Tower">
      ${atTop?'<div class="roof" aria-hidden="true"></div>':''}
      <div class="tower">
        ${atTop?`<div class="top-note">Read up to round ${ROUNDS.frontier}. New floors appear when the hamster runs again.</div>`:''}
        <div class="tower-head"><h2>Floors ${a} to ${b}</h2>
          <button class="btn ghost sm" data-act="block" data-e="${end+10}"${end>=maxEnd?' disabled':''}>Up</button>
          <button class="btn ghost sm" data-act="block" data-e="${end-10}"${a<=1?' disabled':''}>Down</button>
        </div>
        ${rows.join('')}
      </div>
    </section>`;
}
function floorTags(n){
  const t=[];
  if(n.boss)t.push('<span class="tag t-boss">Boss</span>');
  if(!n.boss||n.type!=='normal')t.push(`<span class="tag t-${n.type}">${TYPE_NAME[n.type]}</span>`);
  if(n.rule&&n.rule!=='clear'){const w=RULES.find(r=>r.id===n.rule);t.push(`<span class="tag t-rule" data-tip="w:${n.rule}">${w.n}</span>`);}
  return t.join('');
}
function floorRow(f){
  const n=FLOORS[f-1],st=f<=G.top?'passed':f===G.top+1?'current':'locked';
  return `<button class="floor t-${n.type}${n.boss?' is-boss':''} ${st}" data-act="sheet" data-type="floor" data-f="${f}">
    <span class="f-num">${f}</span>
    <span class="f-en">${n.enemies.map(id=>pic(artOf(id),MONS[id].n)).join('')}</span>
    <span class="f-mid"><span class="f-tags">${floorTags(n)}</span><span class="f-work"><i style="width:${Math.min(100,n.work/7)}%"></i></span><small class="num">Round ${n.round}, ${n.work} work</small></span>
    <span class="f-st">${st==='passed'?'Replay':st==='current'?'Climb':'Locked'}</span>
  </button>`;
}
function enemyCard(id,extra){
  const m=MONS[id],tr=Object.keys(TRAITS).filter(k=>m[k]);
  return `<div class="en-card">
    <span class="en-pic" style="background:${ELS[m.el].stage}">${picL(artOf(id),m.n)}</span>
    <div class="en-tx">
      <div class="en-head"><b>${m.n}</b><span class="tag el" style="--c:${ELS[m.el].c}">${picL('el_'+m.el,'')}${ELS[m.el].n}</span>${m.boss?'<span class="tag t-boss">Boss</span>':''}</div>
      <p>${m.boss?m.mech:m.ai}</p>
      <div class="mv">${m.moves.map((x,i)=>`<span data-tip="mv:${id}:${i}" tabindex="0">${x.n}</span>`).join('')}${tr.map(k=>`<span class="tr">${TRAITS[k]}</span>`).join('')}</div>
      ${extra||''}
    </div></div>`;
}
const chestLine=(f,plus)=>{const r=bandRates(f),m={};r.forEach((p,i)=>{if(p>0){const k=Math.min(4,i+plus);m[k]=(m[k]||0)+p;}});return Object.keys(m).map(k=>CHESTS[k].n.replace(' Chest','')+' '+dec(m[k])+'%').join(', ');};
function sheetFloor(s){
  const f=+s.f,n=FLOORS[f-1],first=f>G.top,open=f<=G.top+1,b=baseCoin(f,n.boss),plus=(n.type==='zoomies'?1:0)+(n.boss?1:0);
  const nx=FLOORS[f],els=[...new Set(n.enemies.map(id=>MONS[id].el))],w=RULES.find(r=>r.id===n.rule);
  const nFirst=2+(n.boss?1:0)+(n.type==='zoomies'?1:0);
  const team=G.team.map(id=>{const p=PETS[id],good=els.some(e=>matchup(p.el,e)>0),bad=els.some(e=>matchup(p.el,e)<0);return `<span class="mini-pet">${pic('pet_'+id,p.n)}<span>${p.n}<br>${good?'<span class="good">Advantage</span>':bad?'<span class="bad">Weak against</span>':'<small>Neutral</small>'}</span></span>`;}).join('');
  const res=teamResonance(G.team);
  return `<h2>Floor ${f}</h2>
    <div class="map-box"><canvas class="map-thumb" data-map="${f}" aria-label="Map preview"></canvas><span class="map-name">${MAP_NAMES[n.map.t]}, ${TONE_NAMES[n.map.tone]}</span></div>
    <div class="info-row">${floorTags(n)}<small class="num">Round ${n.round}, ${n.work} work, ${dec(n.blocks)} blocks, ran at ${TIME_STR(n.t)}</small></div>
    ${n.type==='zoomies'?'<p class="hint">The hamster ran hard this round: stronger enemies, chests one tier higher.</p>':n.type==='sleepy'?'<p class="hint">The hamster was lazy this round: weaker enemies.</p>':''}
    <p class="hint">Weather, ${w.n}: ${w.d}</p>
    <div class="sec-t">Enemies on this floor (hover a move for details)</div>
    <div class="stack" style="gap:8px">${n.enemies.map(id=>enemyCard(id)).join('')}</div>
    <div class="sec-t">Rewards</div>
    <dl class="kv"><dt>First clear</dt><dd>${fmt(b)} coins and ${nFirst} chests${plus?` (${plus} tier${plus>1?'s':''} higher)`:''}</dd>
    <dt>Replay</dt><dd>${fmt(b*.5)} coins and 1 to 2 chests</dd>
    <dt>Chest odds</dt><dd>${chestLine(f,plus)}</dd>
    ${nx&&nx.nap?`<dt>Treasure</dt><dd>The first clear gives an extra chest because the hamster slept ${dec(nx.gap/6)} hours after this floor</dd>`:''}
    ${GIFTS.map(([gf,gid])=>f===gf&&!G.gifts[gid]?`<dt>Gift</dt><dd>${PETS[gid].n} joins the team from floor ${gf+1}</dd>`:'').join('')}</dl>
    <div class="sec-t">Your team</div>
    <div class="mini-team">${team}</div>
    ${res.length?`<div class="res-chips">${res.map(r=>`<span class="res-chip"><b>${r.n}.</b> ${r.d}</span>`).join('')}</div>`:''}
    <div class="btns"><button class="btn big" data-act="enter" data-f="${f}"${open?'':' disabled'}>${!open?`Clear floor ${G.top+1} first`:first?'Enter battle':'Replay'}</button><button class="btn ghost" data-act="nav" data-v="team">Edit team</button></div>`;
}
function sheetSweep(s){
  const r=s.r,list=r.counts.map((c,i)=>c?`<div class="rw" style="animation-delay:${i*60}ms">${pic('chest_'+(i+1),CHESTS[i].n)}<b>${CHESTS[i].n}</b><small class="num">${c} chest${c>1?'s':''}</small></div>`:'').join('');
  return `<h2>Sweep collected</h2>
    <div class="big-coin num">${coin}+${fmt(r.coins)}</div>
    <p>${r.floors} cleared floors.${list?' The chests are in your inventory.':' No chests this time.'}</p>
    ${list?`<div class="rewards">${list}</div>`:''}
    <div class="btns">${list?'<button class="btn" data-act="to-chests">Open chests</button>':''}<button class="btn ghost" data-act="close">Later</button></div>`;
}

/* BATTLE */
const POS={p:{1:[[33,56]],2:[[35,42],[13,72]],3:[[34,54],[12.5,29],[12.5,78]]},e:{1:[[67,56]],2:[[65,42],[87,72]],3:[[66,54],[87.5,29],[87.5,78]]}};
const speed=()=>PREF.speed||1;
const wait=ms=>new Promise(r=>setTimeout(r,(RM?ms*.4:ms)/speed()));
const snapU=id=>BT?BT.snap.us.find(u=>u.id===id):null;
const nameOf=id=>uById(BT.B,id).n;
const artU=s=>s.side==='p'?'pet_'+s.ref:artOf(s.ref);
async function enterBattle(node,opts){
  opts=opts||{};
  let token=null;
  if(!opts.sandbox){const j=await api('/api/battle/start',{floor:node.floor,b:G.battles});token=j.token;opts=Object.assign({},opts,{seed:j.seed});}
  const r=startBattle(G,node,FLOORS,opts);
  BT={B:r.B,node,sandbox:!!opts.sandbox,snap:r.init,playing:false,log:[],active:null,melee:false,plan:{},focus:null,lastT:{},token,plans:[],reqId:newReqId()};
  UI.view='battle';UI.sheet=null;
  tipHide();renderBattle();window.scrollTo(0,0);
  if(G.battles<4)logLine('Pick a skill for each pet, tap an enemy to choose a target, then press Fight.');
  startPlan();
}
function unitHTML(s){
  return `<div class="unit ${s.side}${s.boss?' boss':''}" id="u-${s.id}" data-tip="u:${s.id}" data-act="${s.side==='e'?'target':'focus'}" data-id="${s.id}" role="button" tabindex="0" aria-label="${s.side==='e'?'Target '+s.n:'Pick a skill for '+s.n}">
    <div class="intent"></div>
    <div class="uname">${pic('el_'+s.el,ELS[s.el].n)}<span>${s.n}</span></div>
    <div class="bar hp"><i></i><em></em></div>
    ${s.side==='p'?'<div class="bar nrg"><i></i></div>':''}
    <div class="sprite">${pic(artU(s),s.n)}<span class="ordn"></span><span class="mark"></span><span class="aim"></span></div>
    <div class="chips"></div>
  </div>`;
}
function renderBattle(){
  const B=BT.B,n=BT.node,w=B.rule||RULES[0];
  const lv=FX.Q.level;
  setBg('none');
  $('#app').innerHTML=`<div class="bt">
    <header class="bt-top gut"><div class="bt-top-in">
      <h1>${BT.sandbox?'Practice':'Floor '+B.node.floor}</h1>
      <div class="bt-tags">${BT.sandbox?'<span class="tag">No rewards</span>':floorTags(n)}<small class="num" id="rnd"></small></div>
      <div class="bt-order" id="order" aria-label="Turn order by Speed"></div>
      <div class="bt-ctl"><button class="btn ghost sm" data-act="quality" id="qbtn" title="Effect quality">${lv===2?'High':lv===1?'Medium':'Low'}</button><button class="btn ghost sm" data-act="speed" id="spd">x${speed()}</button><button class="btn ghost sm" data-act="leave">Leave</button></div>
    </div></header>
    <section class="stage t-${n.type}${n.boss?' is-boss':''} w-${w.w}" id="stage">
      <canvas class="map" id="mapc" aria-hidden="true"></canvas><div class="wx-tint"></div>
      <div class="gut"><div class="field" id="field">${B.units.map(unitHTML).join('')}<div class="flash" id="flash"></div></div></div>
      <canvas class="wx" id="wxc" aria-hidden="true"></canvas><div class="wx-flash" id="wxflash"></div>
    </section>
    <div class="ticker gut"><div class="ticker-in" id="log" aria-live="polite"></div></div>
    <section class="panel gut"><div class="panel-in" id="panel"></div></section>
  </div>`;
  drawMap($('#mapc'),n);
  WX.start($('#wxc'),$('#wxflash'),w.w);
  applySnap(BT.snap);
}
function chipsHTML(u){
  const out=[];
  if(u.sh>0)out.push(`<span class="chip" style="--c:${STS.shield.c}" data-tip="s:${u.id}:shield">Shield ${fmt(u.sh)}</span>`);
  u.st.forEach(s=>{const c=STS[s.k];const txt=s.k==='static'?c.short+' '+s.v:c.short+(s.t&&s.t<9?' '+s.t:'');out.push(`<span class="chip" style="--c:${c.c}" data-tip="s:${u.id}:${s.k}">${txt}</span>`);});
  return out.join('');
}
function syncUnit(u){
  const el=$('#u-'+u.id);if(!el)return;
  $('.hp i',el).style.transform=`scaleX(${Math.max(0,u.hp/u.hpMax)})`;
  $('.hp em',el).style.transform=`scaleX(${Math.min(1,u.sh/u.hpMax)})`;
  if(u.id[0]==='p'){$('.nrg i',el).style.transform=`scaleX(${u.nrg/100})`;el.classList.toggle('full',u.nrg>=100&&u.alive);}
  el.classList.toggle('dead',!u.alive);
  el.classList.toggle('charging',!!u.charging);
  const chips=chipsHTML(u),box=$('.chips',el);if(box.dataset.h!==chips){box.innerHTML=chips;box.dataset.h=chips;}
  const mk=$('.mark',el),mv=u.mark||'';if(mk.dataset.m!==mv){mk.dataset.m=mv;mk.innerHTML=u.mark?`<img src="${artUri('el_'+u.mark)}" alt="${ELS[u.mark].n} mark" data-tip="k:${u.mark}">`:'';}
}
function layoutUnits(){
  for(const side of ['p','e']){
    const al=BT.snap.us.filter(u=>u.id[0]===side&&u.alive);
    al.forEach((u,i)=>{const el=$('#u-'+u.id),[x,y]=POS[side][Math.min(3,al.length)][i];if(!el)return;el.style.left=x+'%';el.style.top=y+'%';el.style.zIndex=i===0?2:1;el.classList.toggle('front',i===0);});
    BT.snap.us.filter(u=>u.id[0]===side&&!u.alive).forEach(u=>{const el=$('#u-'+u.id);if(el&&!el.style.left){const[x,y]=POS[side][3][0];el.style.left=x+'%';el.style.top=y+'%';}});
  }
}
function renderOrder(){
  const box=$('#order');if(!box)return;
  const o=BT.snap.order||[];
  box.innerHTML=o.map(id=>{const s=uById(BT.B,id);return `<img class="ord ${s.side}" src="${artUri(artU(s))}" alt="${s.n}" decoding="async" data-tip="u:${id}" style="background:${ELS[s.el].stage}">`;}).join('');
  BT.B.units.forEach(s=>{const el=$('#u-'+s.id+' .ordn');if(!el)return;const i=o.indexOf(s.id);el.textContent=i>=0?i+1:'';});
  const r=$('#rnd');if(r)r.textContent=`Turn ${BT.snap.round||1}${BT.sandbox?'':`, round ${BT.node.round}, ${BT.node.work} work, ${dec(BT.node.blocks)} blocks`}`;
}
function applySnap(s){BT.snap=s;s.us.forEach(syncUnit);layoutUnits();renderOrder();markSel();}
function markSel(){
  const act=BT.playing?BT.active:BT.focus;
  $$('.unit.p').forEach(el=>el.classList.toggle('active',el.id==='u-'+act));
  $$('.unit.e').forEach(el=>el.classList.toggle('acting',BT.playing&&el.id==='u-'+BT.active));
}
function startPlan(){
  const B=BT.B,al=alive(B,'p');BT.plan={};
  al.forEach(u=>{const last=BT.lastT[u.id],t=last&&uById(B,last);BT.plan[u.id]={i:0,target:t&&t.alive?last:null};});
  BT.focus=al[0]?al[0].id:null;BT.playing=false;BT.active=null;
  applySnap(snapshot(B));renderIntents();renderAim();renderPanel();
}
function renderAim(){
  const B=BT.B,map={};let sel=null;
  if(!BT.playing){alive(B,'p').forEach(u=>{const pl=BT.plan[u.id];if(!pl)return;const ids=previewPetAim(B,u.id,pl.i,pl.target);if(ids){ids.forEach(t=>{(map[t]=map[t]||[]).push(u);});if(u.id===BT.focus&&ids.length===1)sel=ids[0];}});}
  B.units.filter(u=>u.side==='e').forEach(e=>{
    const box=$('#u-'+e.id);if(!box)return;
    $('.aim',box).innerHTML=(map[e.id]||[]).map(u=>`<img src="${artUri('pet_'+u.ref)}" alt="${u.n} is aiming here" class="${u.id===BT.focus?'f':''}">`).join('');
    box.classList.toggle('sel',e.id===sel);
  });
}
function renderIntents(){
  BT.B.units.filter(u=>u.side==='e').forEach(u=>{
    const el=$('#u-'+u.id+' .intent');if(!el)return;
    if(!u.alive){el.textContent='';return;}
    const m=peekMove(BT.B,u);
    if(!m){el.className='intent';el.textContent='Unpredictable';return;}
    const aim=previewAim(BT.B,u,m);
    const face=aim&&aim.length===1?`<img src="${artUri(artU(uById(BT.B,aim[0])))}" alt="">`:aim&&aim.length>1?' all':'';
    el.className='intent'+(u.charging?' charge':'');
    el.innerHTML=`${u.charging?'Unleashing':'Next'}: ${m.n}${face}`;
  });
}
function clearIntents(){$$('.intent').forEach(el=>{if(!el.classList.contains('charge'))el.textContent='';});}
function logLine(t){
  if(!BT)return;BT.log.push(t);if(BT.log.length>4)BT.log.shift();
  const b=$('#log');if(b)b.innerHTML=BT.log.map(x=>`<span>${x}</span>`).join('');
}
function hintText(){
  const B=BT.B;if(BT.playing)return 'Fighting in Speed order.';
  const id=BT.focus;if(!id||!BT.plan[id])return '';
  const u=uById(B,id),pl=BT.plan[id],sk=PETS[u.ref].skills[pl.i],out=[`<b>${u.n}, ${sk.n}:</b> ${skillDesc(sk)}`];
  const aim=previewPetAim(B,id,pl.i,pl.target);
  if(aim&&aim.length===1&&sk.ops.some(o=>o[0]==='dmg'||o[0]==='wheelHit'||o[0]==='execute')){
    const t=uById(B,aim[0]),m=matchup(u.el,t.el),mk=snapU(t.id).mark;
    if(m>0)out.push(`${ELS[u.el].n} beats ${ELS[t.el].n}: 40% stronger.`);
    if(m<0)out.push(`${ELS[t.el].n} beats ${ELS[u.el].n}: 25% weaker.`);
    if(B.noReactP)out.push('A mono element team has no reactions.');
    else if(mk&&mk!==u.el){const r=REACT[rk(u.el,mk)];out.push(`Hitting ${t.n} triggers ${r.n}: ${r.d}`);}
    else if(!mk)out.push(`Hitting ${t.n} leaves a ${ELS[u.el].n} mark.`);
  }else if(sk.tgt==='foe')out.push('Tap an enemy to choose the target.');
  return out.join(' ');
}
function planRow(u){
  const B=BT.B,su=snapU(u.id),p=PETS[u.ref];
  if(!su.alive)return `<div class="plan-row dead"><div class="pl-head">${pic('pet_'+u.ref,p.n)}<span><b>${p.n}</b><small>Fallen</small></span></div></div>`;
  const pl=BT.plan[u.id];
  const skills=p.skills.map((s,i)=>{
    const cd=u.cds[s.n]||0,ok=!BT.playing&&canPick(B,u.id,i),on=pl&&pl.i===i;
    const state=s.kind==='ult'?(u.nrg>=100?'Full Rage':`Rage ${u.nrg}%`):(s.kind==='skill'&&u.st.silence?'Silenced':cd>0?`Wait ${cd}`:s.kind==='basic'?'Basic':'Ready');
    return `<button class="sk${s.kind==='ult'?' ult':''}${on?' on':''}" data-act="pick" data-u="${u.id}" data-i="${i}" data-tip="sk:${u.id}:${i}"${ok?'':' disabled'} id="sk-${u.id}-${i}"><b>${s.n}</b><em>${state}</em></button>`;
  }).join('');
  return `<div class="plan-row${!BT.playing&&BT.focus===u.id?' focus':''}"><button class="pl-head" data-act="focus" data-id="${u.id}" data-tip="u:${u.id}">${pic('pet_'+u.ref,p.n)}<span><b>${p.n}</b><small class="num">Speed ${su.spd}<i class="hp-t" style="font-style:normal">, HP ${fmt(su.hp)}</i></small></span></button><div class="pl-skills">${skills}</div></div>`;
}
function renderPanel(){
  const box=$('#panel');if(!box)return;
  const B=BT.B;
  box.innerHTML=`<div class="plan-rows">${B.units.filter(u=>u.side==='p').map(planRow).join('')}</div>
    <div class="plan-foot"><div class="hint" id="hint">${hintText()}</div><button class="btn big fight" data-act="fight" id="fight"${BT.playing||B.over?' disabled':''}>${BT.playing?'Fighting':'Fight'}</button></div>`;
}
function refreshPlan(){renderAim();renderPanel();markSel();}
function nextFocus(){const al=alive(BT.B,'p');if(!al.length)return;const i=al.findIndex(u=>u.id===BT.focus);BT.focus=al[(i+1)%al.length].id;}
/* effects */
function spr(id){return $('#u-'+id+' .sprite');}
function fieldCenter(id){const f=$('#field').getBoundingClientRect(),el=spr(id);if(!el)return {x:f.width/2,y:f.height/2};const r=el.getBoundingClientRect();return {x:r.left-f.left+r.width/2,y:r.top-f.top+r.height/2};}
function vpCenter(id){const el=spr(id);if(!el)return {x:innerWidth/2,y:innerHeight/2};const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}
const clampX=(x,f)=>Math.max(30,Math.min(f.clientWidth-30,x));
function floatAt(id,text,cls,color){
  const f=$('#field');if(!f)return;
  const c=fieldCenter(id),d=document.createElement('span');
  d.className='flo '+(cls||'');d.textContent=text;
  d.style.left=clampX(c.x+(Math.random()*32-16),f)+'px';d.style.top=(c.y-14+(Math.random()*18-9))+'px';
  if(color)d.style.color=color;
  f.appendChild(d);setTimeout(()=>d.remove(),1050);
}
function say(id,text,cls){
  const el=spr(id);if(!el)return;
  const old=$('.say',el);if(old)old.remove();
  const d=document.createElement('div');d.className='say '+(cls||'');d.textContent=text;
  el.appendChild(d);setTimeout(()=>d.remove(),(cls==='phase'?1300:760)/speed());
}
function anim(el,frames,ms,ease){if(!el||RM||!el.animate)return;try{el.animate(frames,{duration:ms/speed(),easing:ease||'ease-out'});}catch(e){}}
function lunge(id,toId){
  const el=spr(id);if(!el)return;
  let dx=id[0]==='p'?54:-54,dy=0;
  if(toId&&spr(toId)&&toId[0]!==id[0]){const a=fieldCenter(id),b=fieldCenter(toId);dx=(b.x-a.x)*.62;dy=(b.y-a.y)*.62;}
  const unit=$('#u-'+id),z=unit.style.zIndex;unit.style.zIndex=5;setTimeout(()=>{unit.style.zIndex=z;},420/speed());
  anim(el,[{transform:'translate(0,0)'},{transform:`translate(${dx}px,${dy}px) scale(1.08)`,offset:.45},{transform:'translate(0,0)'}],400);
}
function cast(id){const el=spr(id);const d=id[0]==='p'?-12:12;anim(el,[{transform:'translateX(0) scale(1)'},{transform:`translateX(${d}px) scale(1.08)`,offset:.4},{transform:'translateX(0) scale(1)'}],300);}
function pulse(id){anim(spr(id),[{transform:'scale(1)'},{transform:'scale(1.13)',offset:.4},{transform:'scale(1)'}],340);}
function flash(c,o,ms){const el=$('#flash');if(!el)return;el.style.background=c;anim(el,[{opacity:o||.42},{opacity:0}],ms||340);}
function shakeStage(){anim($('#field'),[{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(-4px)'},{transform:'translateX(0)'}],300);}
function setHp(id,hp,sh){const u=snapU(id);if(!u)return;u.hp=Math.max(0,hp);if(sh!==undefined)u.sh=sh;syncUnit(u);}
FX.hooks({
  bounce:t=>{if(!BT)return [];return BT.B.units.filter(u=>u.side==='e'&&u.alive).map(u=>vpCenter(u.id)).filter(q=>Math.abs(q.x-t.x)>2||Math.abs(q.y-t.y)>2).slice(0,2);},
  dim:o=>flash('#0A0820',o,420),
  flash:(c,o,ms)=>flash(c,o,ms),
});
async function fxUse(e){
  logLine(`${nameOf(e.who)} uses ${e.name}`);
  BT.active=e.who;markSel();
  BT.melee=!!e.melee;
  say(e.who,e.name);
  if(e.kind==='ult'){
    const s=uById(BT.B,e.who),f=$('#field');
    if(f){const b=document.createElement('div');b.className='ultb';b.innerHTML=`${pic('pet_'+s.ref,'')}<strong>${e.name}</strong>`;f.appendChild(b);setTimeout(()=>b.remove(),560/speed());}
    flash(ELS[e.el].c,.28);
    await wait(500);
    if(!BT)return;
  }
  const tg=[...new Set((e.targets||[]).filter(x=>spr(x)))];
  if(e.melee&&tg[0]&&tg[0]!==e.who)lunge(e.who,tg[0]);else if(e.self)pulse(e.who);else cast(e.who);
  const A=vpCenter(e.who),T=tg.map(vpCenter);
  const d=FX.play(e.fx,A,T,ELS[e.el].c);
  await wait(d);
}
async function fxDmg(e){
  const el=spr(e.to);
  anim(el,[{transform:'translateX(0)',opacity:.45},{transform:'translateX(-6px)',opacity:1},{transform:'translateX(6px)'},{transform:'translateX(0)'}],240);
  setHp(e.to,e.hp,e.sh);
  let cls='',color=null,text=fmt(e.val);
  if(e.key){cls='small';color=(STS[e.key]&&STS[e.key].c)||null;text=(STS[e.key]?STS[e.key].short+' ':'')+text;}
  else if(e.lost===0){cls='shield';}
  else if(e.crit){cls='crit';text+='!';}
  else if(e.eff>0)cls='eff';
  else if(e.eff<0)cls='weak';
  floatAt(e.to,text,cls,color);
  if(!e.key&&spr(e.to))FX.hit(vpCenter(e.to),e.el?ELS[e.el].c:'#fff');
  await wait(e.key?110:130);
}
async function fxReact(e){
  const r=REACT[rk(e.a,e.b)],f=$('#field');
  if(f){
    const b=document.createElement('div');b.className='react'+(e.side==='e'?' foe':'');
    b.innerHTML=`<div class="re-ic">${pic('el_'+e.a,ELS[e.a].n)}<span>+</span>${pic('el_'+e.b,ELS[e.b].n)}</div><strong>${r.n}</strong><small>${r.d}</small>`;
    f.appendChild(b);setTimeout(()=>b.remove(),1200/speed());
  }
  flash(ELS[e.b].c,.4);shakeStage();
  if(spr(e.to)){const c=vpCenter(e.to);FX.ring(c,ELS[e.a].c,10,90,8,420);FX.ring(c,ELS[e.b].c,10,70,6,380,60);FX.burst(c.x,c.y,ELS[e.b].c,10,260,'spark',8,420);}
  logLine(`Reaction ${r.n}. ${r.d}`);
  await wait(520);
}
const STEP={
  use:fxUse,dmg:fxDmg,react:fxReact,
  round:e=>{logLine(`Turn ${e.n}`);return null;},
  turn:e=>{BT.active=e.who;markSel();return null;},
  snap:e=>{applySnap(e);return null;},
  miss:e=>{floatAt(e.to,e.why||'Dodge','small','#E6EEFF');return wait(170);},
  heal:e=>{setHp(e.to,e.hp);floatAt(e.to,'+'+fmt(e.val),'heal');return wait(110);},
  st:e=>{const u=snapU(e.to);if(e.key==='shield'){if(u&&e.sh!==undefined){u.sh=e.sh;syncUnit(u);}floatAt(e.to,'Shield','small','#BFD0FF');return wait(80);}
    if(u&&!u.st.find(x=>x.k===e.key)&&STS[e.key]){u.st.push({k:e.key,v:1,t:0});syncUnit(u);}
    if(STS[e.key])floatAt(e.to,STS[e.key].n,'small',STS[e.key].c);return wait(90);},
  dead:e=>{const u=snapU(e.who);if(u){u.alive=false;u.hp=0;syncUnit(u);}logLine(`${nameOf(e.who)} has fallen`);if(spr(e.who)){const c=vpCenter(e.who);FX.burst(c.x,c.y,'#C9C3DE',8,130,'dot',6,520,-40);}return wait(300);},
  revive:e=>{const u=snapU(e.who);if(u){u.alive=true;u.hp=e.hp;u.st=[];u.mark=null;syncUnit(u);layoutUnits();}floatAt(e.who,e.name,'small','#8FE8B0');logLine(`${nameOf(e.who)}: ${e.name}`);return wait(400);},
  charge:e=>{say(e.who,e.name);const u=snapU(e.who);if(u){u.charging=e.next;syncUnit(u);}const el=$('#u-'+e.who+' .intent');if(el){el.className='intent charge';el.textContent='Unleashing: '+e.next;}if(spr(e.who))FX.ring(vpCenter(e.who),'#F0506E',70,10,5,440);logLine(`${nameOf(e.who)}: ${e.name}. Next it unleashes ${e.next}`);return wait(440);},
  phase:e=>{say(e.who,e.text,'phase');shakeStage();flash('#F0506E',.3);logLine(`${nameOf(e.who)}: ${e.text}`);return wait(860);},
  skip:e=>{floatAt(e.who,e.why,'small','#FFE27A');logLine(`${nameOf(e.who)} loses its action: ${e.why}`);return wait(340);},
  note:e=>{logLine(e.text);return wait(200);},
  push:e=>{floatAt(e.to,'Pushed back','small','#8FC8FF');return wait(80);},
  discharge:e=>{floatAt(e.to,'Discharge!','small','#FFC94D');if(spr(e.to)){const c=vpCenter(e.to);FX.bolt({x:c.x,y:c.y-120},c,'#FFE27A',6,240);}return wait(140);},
  boom:e=>{if(spr(e.to)){const c=vpCenter(e.to);FX.ring(c,'#F8A838',10,90,10,360,0,1);FX.burst(c.x,c.y,'#F8A838',12,280,'dot',6,460);}return wait(140);},
  swap:()=>wait(100),
  nrg:e=>{if(BT.snap)BT.snap.us.filter(u=>u.id[0]===e.side).forEach(u=>floatAt(u.id,'+Rage','small','#FFC94D'));return wait(110);},
};
async function play(evs){
  const me=BT;me.playing=true;markSel();clearIntents();renderAim();renderPanel();
  for(const e of evs){
    if(BT!==me)return;
    const f=STEP[e.t];
    if(f){const r=f(e);if(r)await r;}
  }
  if(BT!==me)return;
  me.playing=false;
  if(me.B.over){await wait(450);if(BT===me)await endBattle();return;}
  startPlan();
}
function leaveBattle(){WX.stop();FX.clear();BT=null;}
/* the battle runs on this device for instant feedback; the server replays it and its result is the real one */
async function endBattle(){
  const b=BT,B=b.B;
  const out={win:B.over==='win',res:null,floor:B.node.floor,boss:B.node.boss,sandbox:b.sandbox,node:b.node,localOver:B.over};
  if(!b.sandbox){
    logLine('Saving the result...');
    out.finish={token:b.token,plans:b.plans,requestId:b.reqId};
    await saveResult(out);
  }
  if(BT!==b)return;
  UI.result=out;leaveBattle();UI.view='result';UI.block=null;render();window.scrollTo(0,0);
}
async function saveResult(out){
  try{
    const j=await api('/api/battle/finish',out.finish);
    if(j.state)applyState(j.state);
    if(j.over)out.win=j.over==='win';
    out.res=j.res||null;out.saved=true;out.dup=!!j.dup;out.error=null;
    if(j.over&&j.over!==out.localOver)UI.mismatch++;
  }catch(e){
    if(e.data&&e.data.state)applyState(e.data.state);
    out.error=e.message||'The result could not be saved';out.saved=e.status>=400&&e.status<500;
  }
}
function chestCards(list,startDelay){
  const m=[0,0,0,0,0];list.forEach(t=>{m[t]++;});
  return m.map((c,t)=>c?`<div class="rw" style="animation-delay:${(startDelay||0)+t*70}ms">${pic('chest_'+(t+1),CHESTS[t].n)}<b>${CHESTS[t].n}</b><small class="num">x${c}</small></div>`:'').join('');
}
function viewResult(){
  const r=UI.result;
  if(!r)return '';
  if(r.error)return `<section class="res">${pic('hurt_pet','')}<h1>This battle was not saved</h1><p>${r.error}</p><div class="btns">${r.saved?'':'<button class="btn big" data-act="res-retry">Try saving again</button>'}<button class="btn ghost" data-act="nav" data-v="tower">Back to the tower</button></div></section>`;
  if(r.sandbox)return `<section class="res ${r.win?'win':''}">${pic(r.win?'win_pet':'hurt_pet','')}<h1>${r.win?'Practice won':'Practice lost'}</h1><p>Practice battles give no rewards.</p><div class="btns"><button class="btn" data-act="try-again">Fight again</button><button class="btn ghost" data-act="nav" data-v="codex">Back to the Codex</button></div></section>`;
  if(r.win&&!r.res)return `<section class="res win">${pic('win_pet','')}<h1>Battle saved</h1><p>This battle was already recorded.</p><div class="btns"><button class="btn big" data-act="nav" data-v="tower">Back to the tower</button></div></section>`;
  if(!r.win){
    const need=[...new Set(r.node.enemies.map(id=>MONS[id].el))].map(e=>Object.keys(ELS).find(k=>ELS[k].beats===e));
    return `<section class="res">${pic('hurt_pet','')}<h1>Floor ${r.floor} not cleared</h1>
      <p>You lose nothing. Cleared floors stay cleared and you can try again anytime.</p>
      <ul class="tips"><li>Enemies here are weak against ${[...new Set(need)].map(e=>ELS[e].n).join(', ')}.</li>
      <li>Open chests, feed your hamsters and run the wheel for levels, or merge your gear.</li>
      ${G.top>0?'<li>Replay cleared floors for more coins and chests.</li>':''}</ul>
      <div class="btns"><button class="btn big" data-act="enter" data-f="${r.floor}">Try again</button><button class="btn ghost" data-act="nav" data-v="team">Edit team</button><button class="btn ghost" data-act="nav" data-v="tower">Back to the tower</button></div></section>`;
  }
  const w=r.res;
  const all=w.chests.slice();if(w.treasure)all.push(w.treasure.tier);
  const cards=[chestCards(all)];
  if(w.gift)cards.push(`<div class="rw gift" style="animation-delay:240ms">${pic('pet_'+w.gift,PETS[w.gift].n)}<b>${w.giftStar?PETS[w.gift].n+' gains a star!':PETS[w.gift].n+' joins the team!'}</b><small>Gift for reaching floor ${r.floor+1}</small></div>`);
  const nextF=r.floor+1,hasNext=w.first&&nextF<=FLOORS.length;
  return `<section class="res win">${pic('win_pet','')}<h1>${w.first?`Floor ${r.floor} cleared!`:`Floor ${r.floor} won again`}</h1>
    <div class="big-coin num">${coin}+${fmt(w.coins)}</div>
    <p class="num">${all.length} chest${all.length>1?'s':''} added to your inventory${w.treasure?`, including a treasure chest because the hamster slept ${dec(w.treasure.hours)} hours`:''}.</p>
    <div class="rewards">${cards.join('')}</div>
    ${w.first&&G.top===FLOORS.length?'<p>You cleared every floor so far. New floors appear when the hamster runs again.</p>':''}
    ${G.top<10&&G.coins>=FOOD_BAGS[0].cost*3?`<p class="note">Your coins can buy food in the Shop. Feed a hamster to 100%, then run the wheel for XP. The floor 10 boss needs a stronger team.</p>`:''}
    <div class="btns">${hasNext?`<button class="btn big" data-act="enter" data-f="${nextF}">Climb floor ${nextF}</button>`:`<button class="btn big" data-act="enter" data-f="${r.floor}">Replay floor ${r.floor}</button>`}<button class="btn" data-act="to-chests">Open chests</button><button class="btn ghost" data-act="nav" data-v="team">Team</button><button class="btn ghost" data-act="nav" data-v="tower">Back to the tower</button></div></section>`;
}

/* DETAILS ON HOVER, LONG PRESS ON PHONES */
function statusLine(k,v,t,u,B){
  let s=STS[k].d;
  switch(k){
    case 'poison':case 'burn':s=`${u.n} loses ${fmt(v)} HP at the start of each action, ignoring shields.`;break;
    case 'bleed':s=`Loses ${fmt(v)} extra HP every time it is hit.`;break;
    case 'regen':s=`Heals ${fmt(v)} HP at the start of each action.`;break;
    case 'thorns':s=`Attackers take ${fmt(v)} damage back.`;break;
    case 'atkUp':s=`+${v}% Bite.`;break;
    case 'defUp':s=`+${v}% Armor.`;break;
    case 'defDown':s=`-${v}% Armor.`;break;
    case 'spdUp':s=`+${v}% Speed, acts earlier next turn.`;break;
    case 'slow':s=`-${v}% Speed, acts later next turn.`;break;
    case 'critUp':s=`+${v}% crit chance.`;break;
    case 'vamp':s=`${v}% of damage dealt becomes HP.`;break;
    case 'static':s=`${v} of 5 stacks. At 5 it discharges: loses HP and is Stunned.`;break;
    case 'bomb':s=`Explodes for ${fmt(v)} damage after ${t} of ${u.n}'s actions.`;break;
    case 'drowsy':s=`${Math.round((B?B.drowsyP:.3)*100)}% chance to doze off and lose its action.`;break;
    case 'shield':s=`Absorbs ${fmt(v)} more damage before HP is lost.`;break;
  }
  return s+(t&&t<9&&k!=='bomb'?` ${t} action${t>1?'s':''} left.`:'');
}
function tipStatusList(su,u,B){
  const rows=su.st.map(s=>`<li><span class="chip" style="--c:${STS[s.k].c}">${STS[s.k].n}</span>${statusLine(s.k,s.v,s.t,u,B)}</li>`);
  if(su.sh>0)rows.unshift(`<li><span class="chip" style="--c:${STS.shield.c}">Shield</span>${statusLine('shield',su.sh,0,u,B)}</li>`);
  if(su.mark)rows.push(`<li>${pic('el_'+su.mark,'')} ${ELS[su.mark].n} mark: a hit from another element triggers a reaction.</li>`);
  return rows.length?`<ul class="tip-st">${rows.join('')}</ul>`:'';
}
function tipHTML(key){
  const [a,b,c]=key.split(':');
  if(a==='w'){const w=RULES.find(r=>r.id===b);return w?`<b>${w.n}</b><p>${w.d}</p>`:'';}
  if(a==='k'){return `<b>${ELS[b].n} mark</b><p>A hit from another element on this target triggers a reaction.</p>`;}
  if(a==='mv'){const m=MONS[b].moves[+c];return `<b>${m.n}</b><p>${moveDesc(m)}</p>${m.charge?`<small>Charges for one action first (${m.charge}).</small>`:''}${m.cd?`<small>${m.cd} turn cooldown.</small>`:''}`;}
  if(a==='fd'){const f=FOODS[b];return `<b>${f.n}</b><small>${RARS[f.rar].n}, ${fmt(f.fill)} fullness</small><p>In real life: ${f.d}</p>`;}
  if(!BT)return '';
  const B=BT.B;
  if(a==='u'){
    const u=uById(B,b),su=snapU(b);if(!u||!su)return '';
    const stats=`<dl class="tip-stats"><dt>HP</dt><dd>${fmt(su.hp)}/${fmt(su.hpMax)}</dd><dt>Bite</dt><dd>${fmt(atkOf(u))}</dd><dt>Armor</dt><dd>${fmt(defOf(u))}</dd><dt>Speed</dt><dd>${su.spd}</dd><dt>Crit</dt><dd>${dec(u.crit)}%</dd>${u.side==='p'?`<dt>Rage</dt><dd>${su.nrg}%</dd>`:''}</dl>`;
    if(u.side==='p'){
      const p=PETS[u.ref];
      return `<b>${u.n}</b><small>${ROLES[p.role].n}, ${ELS[p.el].n}</small>${stats}${tipStatusList(su,u,B)}`;
    }
    const m=MONS[u.ref],tr=Object.keys(TRAITS).filter(k=>m[k]).map(k=>TRAITS[k]).join(', ');
    return `<b>${u.n}</b><small>${m.boss?'Boss, ':''}${ELS[m.el].n}${tr?'. '+tr:''}</small>${stats}<p>${m.boss?m.mech:m.ai}</p>${m.hidden?'<small>This enemy hides its moves, so they cannot be predicted.</small>':''}<ul class="tip-mv">${m.moves.map(x=>`<li><b>${x.n}.</b> ${moveDesc(x)}${x.cd?` ${u.cds[x.n]>0?u.cds[x.n]+' turns left':x.cd+' turn cooldown'}.`:''}</li>`).join('')}</ul>${tipStatusList(su,u,B)}`;
  }
  if(a==='s'){
    const u=uById(B,b),su=snapU(b);if(!u||!su)return '';
    if(c==='shield')return `<b>Shield on ${u.n}</b><p>${statusLine('shield',su.sh,0,u,B)}</p>`;
    const s=su.st.find(x=>x.k===c);if(!s)return '';
    return `<b>${STS[c].n} on ${u.n}</b><p>${statusLine(c,s.v,s.t,u,B)}</p>`;
  }
  if(a==='sk'){
    const u=uById(B,b),sk=PETS[u.ref].skills[+c],cd=u.cds[sk.n]||0;
    return `<b>${sk.n}</b><p>${skillDesc(sk)}</p><small>${sk.kind==='basic'?'Basic attack, gains 22 Rage':sk.kind==='skill'?`Skill, ${sk.cd} turn cooldown, gains 14 Rage${cd>0?`. ${cd} turn${cd>1?'s':''} left`:''}`:`Rage skill, needs full Rage (now ${u.nrg}%)`}</small>`;
  }
  return '';
}
const TIP={cur:null,long:false,timer:0,hide:0};
function tipShow(key,anchor){
  const html=tipHTML(key);if(!html){tipHide();return;}
  const t=$('#tip');t.innerHTML=html;t.hidden=false;
  const r=anchor.getBoundingClientRect(),tw=t.offsetWidth,th=t.offsetHeight;
  let x=r.left+r.width/2-tw/2,y=r.top-th-8;
  if(y<8)y=r.bottom+8;
  if(y+th>innerHeight-8)y=Math.max(8,innerHeight-th-8);
  x=Math.max(8,Math.min(innerWidth-tw-8,x));
  t.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
}
function tipHide(){const t=$('#tip');if(t)t.hidden=true;TIP.cur=null;}
document.addEventListener('pointerover',e=>{
  if(e.pointerType!=='mouse')return;
  const a=e.target.closest&&e.target.closest('[data-tip]');
  if(a===TIP.cur)return;
  TIP.cur=a||null;
  if(a)tipShow(a.dataset.tip,a);else tipHide();
},{passive:true});
document.addEventListener('focusin',e=>{const a=e.target.closest&&e.target.closest('[data-tip]');if(a&&e.target.matches(':focus-visible'))tipShow(a.dataset.tip,a);});
document.addEventListener('focusout',()=>{if(!TIP.cur)tipHide();});
document.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse')return;
  clearTimeout(TIP.timer);TIP.long=false;
  const a=e.target.closest&&e.target.closest('[data-tip]');if(!a)return;
  TIP.timer=setTimeout(()=>{TIP.long=true;tipShow(a.dataset.tip,a);clearTimeout(TIP.hide);TIP.hide=setTimeout(tipHide,3200);},380);
},{passive:true});
['pointerup','pointercancel'].forEach(n=>document.addEventListener(n,()=>clearTimeout(TIP.timer),{passive:true}));
addEventListener('scroll',tipHide,{passive:true,capture:true});

/* TEAM SCREEN */
function viewTeam(){
  const res=teamResonance(G.team);
  const ids=Object.keys(G.owned).sort((a,b)=>{const ia=G.team.indexOf(a),ib=G.team.indexOf(b);if(ia>=0||ib>=0)return (ia<0?9:ia)-(ib<0?9:ib);return petPower(petStats(G,b))-petPower(petStats(G,a));});
  const slots=[0,1,2].map(i=>{
    const id=G.team[i];
    if(!id)return `<div class="slot empty">${i===0?'Front':'Back'}<br>Empty. ${G.top<4?'You get pets when you reach floors 3 and 5.':'Tap a pet below.'}</div>`;
    const p=PETS[id],o=G.owned[id],st=petStats(G,id);
    return `<div class="slot r-${p.rar}${i===0?' front':''}">
      <small>${i===0?'Front':'Back'}</small>
      <button class="slot-pic" data-act="pet" data-id="${id}" style="background:${ELS[p.el].stage}" aria-label="View ${p.n}">${pic('pet_'+id,p.n)}</button>
      <b>${p.n}</b><small class="num">Level ${o.lv}, Speed ${st.spd}</small>
      ${miniMeters(o)}
      ${isFull(o)?`<button class="btn sm" data-act="run-wheel" data-id="${id}">Run the wheel</button>`:`<button class="btn ghost sm" data-act="pet" data-id="${id}">Feed</button>`}
      ${i>0?`<button class="btn ghost sm" data-act="team-front" data-id="${id}">Move front</button>`:'<small>Front row attacks aim here</small>'}
    </div>`;
  }).join('');
  return `<div class="head-row"><h1>Team</h1><span class="pill num">Power ${fmt(G.team.reduce((a,id)=>a+petPower(petStats(G,id)),0))}</span></div>
    <div class="slots">${slots}</div>
    ${res.length?`<div class="res-chips">${res.map(r=>`<span class="res-chip"><b>${r.n}.</b> ${r.d}</span>`).join('')}</div>`:'<p class="note">Teams with 3 different elements, or with both a Tank and a Support, get bonuses.</p>'}
    <div class="sec-t">Your pets (${ids.length} of ${PETS_LIST.length})</div>
    <div class="pgrid">${ids.map(id=>petCard(id,true)).join('')}</div>`;
}
function petCard(id,owned){
  const p=PETS[id],o=G.owned[id];
  const inTeam=G.team.indexOf(id)>=0;
  return `<button class="pcard r-${p.rar}${o?'':' none'}" data-act="pet" data-id="${id}">
    ${inTeam&&owned?'<span class="in-team">Team</span>':''}
    <span class="corner">${picL('el_'+p.el,ELS[p.el].n)}${picL('role_'+p.role,ROLES[p.role].n)}</span>
    <span class="pstage" style="background:${ELS[p.el].stage}">${picL('pet_'+id,p.n,'pp')}</span>
    <b>${p.n}</b>
    ${o?`<small class="num">Level ${o.lv}</small><span class="stars" aria-label="${o.star} stars">${stars(o.star)}</span>${miniMeters(o)}`:`<small>${RARS[p.rar].n}, not owned</small>`}
  </button>`;
}
/* FULLNESS AND XP */
const isFull=o=>o.full>=stomach(o.lv);
const fullRatio=o=>Math.min(1,o.full/stomach(o.lv));
const foodTotal=()=>Object.values(G.foods).reduce((a,b)=>a+b,0);
const lowestTeamPet=()=>G.team.reduce((a,b)=>G.owned[b].lv<G.owned[a].lv?b:a);
function miniMeters(o){
  return `<span class="mini-m${isFull(o)?' ready':''}" aria-label="Fullness ${Math.floor(fullRatio(o)*100)}%, XP ${fmt(o.xp)} of ${fmt(xpNeed(o.lv))}"><i class="mf"><u style="transform:scaleX(${fullRatio(o)})"></u></i><i class="mx"><u style="transform:scaleX(${Math.min(1,o.xp/xpNeed(o.lv))})"></u></i></span>`;
}
function foodTile(id,f,o){
  const cap=stomach(o.lv),need=cap-o.full,waste=f.fill-Math.min(f.fill,need),heavy=f.fill-need>Math.max(cap,f.fill)/2;
  return `<button class="ftile r-${f.rar}${heavy?' over':''}" data-act="feed" data-id="${id}" data-food="${f.id}" data-tip="fd:${f.id}"${need<=0?' disabled':''}><span class="i-pic">${picL('food_'+f.id,f.n)}<em>${fmt(G.foods[f.id])}</em></span><b>${f.n}</b><small class="num">${UI.feedAsk===f.id?`Tap again, wastes ${Math.round(waste/f.fill*100)}%`:`+${Math.max(1,Math.round(Math.min(f.fill,need>0?need:cap)/cap*100))}%`}</small></button>`;
}
function careHTML(id,o){
  const cap=stomach(o.lv),need=xpNeed(o.lv),full=isFull(o),plan=feedPlan(G.foods,o.full,cap);
  const list=FOODS_LIST.filter(f=>G.foods[f.id]>0).sort((a,b)=>a.fill-b.fill);
  const canAll=full||plan.fills;
  return `<div class="care">
      <div class="meter"><div class="meter-t"><span>Fullness</span><b class="num">${Math.floor(fullRatio(o)*100)}%<small class="num"> ${fmt(o.full)} of ${fmt(cap)}</small></b></div><div class="bar mf" id="fullbar"><i style="transform:scaleX(${fullRatio(o)})"></i></div></div>
      <div class="meter"><div class="meter-t"><span>XP to level ${o.lv+1}</span><b class="num">${fmt(o.xp)} of ${fmt(need)}</b></div><div class="bar mx"><i style="transform:scaleX(${Math.min(1,o.xp/need)})"></i></div></div>
      <div class="btns">
        ${full?`<button class="btn big pulse" data-act="run-wheel" data-id="${id}">Run the wheel</button>`:`<button class="btn" data-act="feed-auto" data-id="${id}"${plan.count?'':' disabled'}>${plan.fills?`Feed to 100%: ${fmt(plan.count)} food${plan.count>1?'s':''}`:plan.count?`Feed what fits: ${fmt(plan.count)} food${plan.count>1?'s':''}`:'No food that fits'}</button>`}
        <button class="btn ${UI.allAsk===id?'warn':'ghost'}" data-act="run-all" data-id="${id}"${canAll?'':' disabled'}>${UI.allAsk===id?`Tap again: feed all food to ${PETS[id].n}`:'Use all food'}</button>
        <button class="chipb${PREF.fastRun?' on':''}" data-act="fast-run" aria-pressed="${!!PREF.fastRun}">${PREF.fastRun?'Wheel animation off':'Skip wheel animation'}</button>
      </div>
      <p class="note">A full hamster can run the wheel for random XP. Each level adds ${pct(TUNE.lvGrow)} of base stats. Food never spoils and fullness never drops on its own.</p>
    </div>
    <div class="sec-t">Feed ${PETS[id].n} (tap a food)</div>
    ${list.length?`<div class="fgrid">${list.map(f=>foodTile(id,f,o)).join('')}</div>`:`<div class="empty-note">Your pantry is empty. <button class="btn sm" data-act="nav" data-v="shop">Buy food in the Shop</button></div>`}`;
}
function sheetPet(s){
  const id=s.id,p=PETS[id],o=G.owned[id],skills=`<div class="sk-list">${p.skills.map(k=>`<div class="sk-row${k.kind==='ult'?' ult':''}"><b>${k.n}</b>${skillDesc(k)} <small>${k.kind==='basic'?'Basic attack':k.kind==='skill'?'Skill, '+k.cd+' turn cooldown':'Rage skill'}.</small></div>`).join('')}</div>`;
  const head=(stats)=>`<div class="p-head"><span class="p-pic r-${p.rar}" style="background:${ELS[p.el].stage}">${pic('pet_'+id,p.n)}</span><div class="p-info">
    <div class="info-row"><span class="tag" style="background:var(--rc)">${RARS[p.rar].n}</span><span class="tag el" style="--c:${ELS[p.el].c}">${pic('el_'+p.el,'')}${ELS[p.el].n}</span><span class="tag">${pic('role_'+p.role,'')}${ROLES[p.role].n}</span></div>${stats}</div></div>`;
  if(!o)return `<div class="r-${p.rar}" style="display:contents"><h2>${p.n}</h2>${head(`<p class="note">Not owned yet. Open blind bags or high tier chests for a chance to get this pet.</p>`)}<div class="sec-t">Skills</div>${skills}</div>`;
  const st=petStats(G,id),inTeam=G.team.indexOf(id)>=0,c=setCounts(G,o);
  const setLines=Object.keys(c).filter(k=>c[k]>=2).map(k=>`<div class="note"><b>${SETS[k].n} x${c[k]}:</b> ${SETS[k].p2}${c[k]>=4?' '+SETS[k].p4:''}</div>`).join('');
  const brs=BRANCHES[p.role].map(([bid,n,d])=>`<button class="bopt${o.branch===bid?' on':''}" data-act="branch" data-id="${id}" data-b="${bid}"${o.star<3?' disabled':''}><b>${n}</b>${d}</button>`).join('');
  let teamBtns;
  if(inTeam)teamBtns=G.team.length>1?`<button class="btn ghost sm" data-act="team-out" data-id="${id}">Remove from team</button>`:'<small>The team needs at least 1 pet.</small>';
  else if(G.team.length<3)teamBtns=`<button class="btn sm" data-act="team-in" data-id="${id}">Add to team</button>`;
  else teamBtns=G.team.map(t=>`<button class="btn ghost sm" data-act="team-swap" data-id="${id}" data-out="${t}">Replace ${PETS[t].n}</button>`).join('');
  return `<div class="r-${p.rar}" style="display:contents"><h2>${p.n}</h2>
    ${head(`<div class="info-row"><span class="stars" style="font-size:16px" aria-label="${o.star} stars">${stars(o.star)}</span><span class="num">Level ${o.lv}</span><span class="pill num">Power ${fmt(petPower(st))}</span></div>
    <div class="p-stats"><div><span>HP</span><b>${fmt(st.hp)}</b></div><div><span>Bite</span><b>${fmt(st.atk)}</b></div><div><span>Armor</span><b>${fmt(st.def)}</b></div><div><span>Speed</span><b>${st.spd}</b></div><div><span>Crit</span><b>${dec(st.crit)}%</b></div></div>
    <div class="btns">${teamBtns}</div>`)}
    ${careHTML(id,o)}
    <p class="note">Duplicate pets from blind bags add a star, up to 5. Each star adds 12% stats.</p>
    <div class="sec-t">Skills</div>${skills}
    <div class="sec-t">Gear</div>
    <div class="slots4">${Object.keys(SLOTS).map(k=>{const it=itemByUid(G,o.gear[k]);return it?`<button class="gslot r-${it.rar}" data-act="gear" data-id="${id}" data-slot="${k}"><span class="i-pic">${pic(gearArt(it),itemName(it))}${it.plus?`<em>+${it.plus}</em>`:''}</span>${SETS[it.set].n}</button>`:`<button class="gslot" data-act="gear" data-id="${id}" data-slot="${k}"><span class="ph" aria-hidden="true">+</span>${SLOTS[k].n}</button>`;}).join('')}</div>
    ${setLines}
    <div class="sec-t">3-star branch${o.star<3?` (needs 3 stars, has ${o.star})`:''}</div>
    <div class="branch">${brs}</div></div>`;
}
function itemEffect(it){
  const v=itemVal(it);
  if(it.slot==='charm')return `+${dec(v*.5)}% crit, +${dec(v*.2)} Speed`;
  return `+${dec(v)}% ${{weapon:'Bite',armor:'HP',hat:'Armor'}[it.slot]}`;
}
function sheetGear(s){
  const id=s.id,k=s.slot,p=PETS[id],o=G.owned[id],cur=o.gear[k];
  const list=G.items.filter(i=>i.slot===k).sort((a,b)=>itemVal(b)-itemVal(a)).slice(0,60);
  return `<h2>${SLOTS[k].n} for ${p.n}</h2>
    ${cur?`<button class="btn ghost sm" data-act="unequip" data-id="${id}" data-slot="${k}">Take off current item</button>`:''}
    ${list.length?`<div class="stack" style="gap:6px">${list.map(it=>{const own=ownerOf(it.uid);return `<button class="pick-row r-${it.rar}" data-act="equip" data-id="${id}" data-uid="${it.uid}"><span class="i-pic">${picL(gearArt(it),itemName(it))}${it.plus?`<em>+${it.plus}</em>`:''}</span><span><b>${itemName(it)}</b><small>${RARS[it.rar].n}. ${itemEffect(it)}</small><small>${SETS[it.set].n} set: ${SETS[it.set].p2}</small></span><span class="tag ${own===id?'t-first':''}">${own?(own===id?'Equipped':PETS[own].n):'Equip'}</span></button>`;}).join('')}</div>`:`<div class="empty-note">No ${SLOTS[k].n.toLowerCase()} yet. Open chests or blind bags to get gear.</div>`}
    <button class="btn ghost" data-act="pet" data-id="${id}">Back to ${p.n}</button>`;
}
/* a small float on the pet picture in the sheet: fullness gained, XP, or a new level */
function petFloat(text,gold){
  const box=$('.sheet .p-pic');if(!box)return null;
  const r=box.getBoundingClientRect(),c={x:r.left+r.width/2,y:r.top+r.height/2};
  const d=document.createElement('span');d.className='lv-float '+(gold?'ok':'no');d.textContent=text;box.appendChild(d);setTimeout(()=>d.remove(),1000);
  return c;
}
function levelBurst(c,box){
  FX.ring(c,'#FFC94D',10,96,8,480);FX.rise(c,'up',{n:7,c:'#FFC94D',size:9,w:46});FX.burst(c.x,c.y,'#FFE27A',12,240,'spark',8,520);
  if(box)anim(box,[{transform:'scale(1)'},{transform:'scale(1.08)',offset:.4},{transform:'scale(1)'}],340);
}
function feedFx(id,before){
  const o=G.owned[id],now=fullRatio(o),bar=$('#fullbar i');
  if(bar&&bar.animate&&!RM)bar.animate([{transform:`scaleX(${before})`},{transform:`scaleX(${now})`}],{duration:280,easing:'ease-out'});
  const c=petFloat(now>=1?'Full!':`+${Math.max(1,Math.round((now-before)*100))}%`,now>=1);
  if(c){if(now>=1)FX.ring(c,'#8FE8B0',10,80,7,420);FX.burst(c.x,c.y,'#8FE8B0',now>=1?12:5,now>=1?220:120,'dot',5,420,120);}
}

/* THE WHEEL: the server rolls the XP first, the animation only shows it */
async function wheelRun(id){
  const o=G.owned[id],b={lv:o.lv,xp:o.xp,power:petPower(petStats(G,id))};
  const r=(await action('run',{id})).r;if(!r)return;
  if(PREF.fastRun||RM){
    render();
    const up=r.lv>r.lv0,c=petFloat(up?`Level ${r.lv}!`:`+${fmt(r.xp)} XP`,up);
    if(c&&up)levelBurst(c,$('.sheet .p-pic'));
    toast(`${RUN_LUCK[r.luck].n}: +${fmt(r.xp)} XP${up?`, now level ${r.lv}`:''}`);
    return;
  }
  wheelShow(id,r,b);
}
function wheelShow(id,r,b){
  const p=PETS[id],L=RUN_LUCK[r.luck],hot=L.x>=2.2;
  $('#overlay').innerHTML=`<div class="spin wr" role="dialog" aria-modal="true"><h2>${p.n} runs the wheel</h2>
    <div class="wr-stage${hot?' hot':''}" id="wrs"><i class="wr-glow" aria-hidden="true"></i><img class="wr-part" src="${artUri('run_stand')}" alt=""><img class="wr-wheel" id="wrw" src="${artUri('run_wheel')}" alt=""><img class="wr-pet" id="wrp" src="${artUri('pet_'+id)}" alt="${p.n}"><b class="wr-xp num" id="wrx">+0 XP</b></div>
    <div class="meter wr-meter"><div class="meter-t"><span id="wrl">Level ${b.lv}</span><b class="num" id="wrn"></b></div><div class="bar mx"><i id="wri"></i></div></div>
    <div id="wrres" class="wr-res" aria-live="polite"></div>
    <div class="btns" id="spbtns"><button class="btn ghost" data-act="spin-skip">Skip</button></div></div>`;
  const run={wheel:true,done:false,anims:[],fin:()=>wheelDone(id,r,b,run)};
  SP=run;
  const wheel=$('#wrw'),pet=$('#wrp'),dur=2200+Math.min(1400,L.x*420);
  if(wheel.animate)run.anims.push(wheel.animate([{transform:'rotate(0deg)'},{transform:`rotate(${Math.round((3+L.x*5)*360)}deg)`}],{duration:dur,easing:'cubic-bezier(.32,.08,.2,1)',fill:'forwards'}));
  if(pet.animate)run.anims.push(pet.animate([{transform:'translateY(0) rotate(-4deg)'},{transform:'translateY(-9%) rotate(4deg)'},{transform:'translateY(0) rotate(-4deg)'}],{duration:Math.round(330/Math.sqrt(L.x)),iterations:Infinity}));
  /* XP climbs with the run, each level passed bursts on the spot */
  const t0=performance.now();let lv=b.lv,xp=b.xp,prev=0,dust=0;
  const paint=now=>{
    if(SP!==run||run.done)return;
    const k=Math.min(1,Math.max(0,now-t0)/dur),got=r.xp*(1-Math.pow(1-k,2.2));
    xp+=got-prev;prev=got;
    while(xp>=xpNeed(lv)){xp-=xpNeed(lv);lv++;$('#wrl').textContent=`Level ${lv}`;const q=wheel.getBoundingClientRect();levelBurst({x:q.left+q.width/2,y:q.top+q.height/2});}
    $('#wrx').textContent=`+${fmt(got)} XP`;
    $('#wrn').textContent=`${fmt(xp)} of ${fmt(xpNeed(lv))}`;
    $('#wri').style.transform=`scaleX(${Math.min(1,xp/xpNeed(lv))})`;
    if(now-dust>190){dust=now;const q=pet.getBoundingClientRect();FX.burst(q.left+q.width*.42,q.bottom-q.height*.08,hot?'#FF9A3C':'#D8C8A8',hot?4:2,hot?190:100,hot?'spark':'dot',hot?7:4,380,160);}
    if(k<1)requestAnimationFrame(paint);else run.fin();
  };
  requestAnimationFrame(paint);
  setTimeout(()=>{if(SP===run&&!run.done)run.fin();},dur+500);
}
function wheelDone(id,r,b,run){
  if(!run||run.done)return;run.done=true;
  run.anims.forEach(a=>{try{a.cancel();}catch(e){}});
  const p=PETS[id],L=RUN_LUCK[r.luck],o=G.owned[id],up=r.lv>r.lv0,box=$('#wrres');
  const wheel=$('#wrw');if(wheel)wheel.style.transform=`rotate(${Math.round((3+L.x*5)*360)}deg)`;
  $('#wrx').textContent=`+${fmt(r.xp)} XP`;$('#wrl').textContent=`Level ${o.lv}`;
  $('#wrn').textContent=`${fmt(o.xp)} of ${fmt(xpNeed(o.lv))}`;$('#wri').style.transform=`scaleX(${Math.min(1,o.xp/xpNeed(o.lv))})`;
  box.innerHTML=`<p class="wr-luck l${r.luck}">${L.n}</p><p class="note">${p.n} ${L.d}.</p>${up?`<p class="fg-ok num">Level ${r.lv0} to ${r.lv}!</p><p class="note num">Power ${fmt(b.power)} to ${fmt(petPower(petStats(G,id)))}</p>`:''}`;
  const q=$('#wrs').getBoundingClientRect(),c={x:q.left+q.width/2,y:q.top+q.height/2};
  if(up)levelBurst(c);else if(L.x>=1.4)FX.burst(c.x,c.y,'#FFE27A',12,240,'spark',7,520);
  const plan=feedPlan(G.foods,o.full,stomach(o.lv));
  $('#spbtns').innerHTML=`${plan.fills?`<button class="btn" data-act="wr-again" data-id="${id}">Feed and run again</button>`:`<button class="btn" data-act="wr-shop">Buy more food</button>`}<button class="btn ghost" data-act="spin-close">Done</button>`;
}
async function trainRun(id){
  const b={lv:G.owned[id].lv,power:petPower(petStats(G,id))};
  const r=(await action('run',{id,all:true})).r;if(!r)return;
  const up=r.lv>r.lv0;
  $('#overlay').innerHTML=`<div class="spin wr" role="dialog" aria-modal="true"><h2>${PETS[id].n} trained hard</h2>
    <div class="wr-stage still"><img class="wr-part" src="${artUri('run_stand')}" alt=""><img class="wr-wheel" src="${artUri('run_wheel')}" alt=""><img class="wr-pet" src="${artUri('pet_'+id)}" alt="${PETS[id].n}"></div>
    <p class="big-coin num">+${fmt(r.xp)} XP</p>
    <p class="num">${fmt(r.foods)} food${r.foods===1?'':'s'} eaten, ${fmt(r.runs)} run${r.runs===1?'':'s'}. Best run: ${RUN_LUCK[r.best].n}.</p>
    ${up?`<p class="fg-ok num">Level ${r.lv0} to ${r.lv}!</p><p class="note num">Power ${fmt(b.power)} to ${fmt(petPower(petStats(G,id)))}</p>`:''}
    <div class="btns" id="spbtns"><button class="btn" data-act="spin-close">Done</button></div></div>`;
  SP={wheel:true,done:true,anims:[]};
  const q=$('.wr-stage').getBoundingClientRect(),c={x:q.left+q.width/2,y:q.top+q.height/2};
  if(up)levelBurst(c);else FX.burst(c.x,c.y,'#FFE27A',12,240,'spark',7,520);
}

/* LEADERBOARD */
async function loadRanks(){
  const [l,me]=await Promise.all([api('/api/leaderboard'),api('/api/rank')]);
  UI.ranks={l,me};
  if(UI.view==='ranks')render();
}
const isWallet=n=>/^0x[0-9a-fA-F]{40}$/.test(n);
function agoText(t){
  if(!t)return '';
  const s=Math.max(0,Date.now()/1000-t);
  if(s<90)return 'just now';
  if(s<3600)return Math.round(s/60)+' min ago';
  if(s<86400)return Math.round(s/3600)+' h ago';
  const d=Math.round(s/86400);return d+(d===1?' day ago':' days ago');
}
function rankName(r,i){
  const me=PLAYER&&r.name===PLAYER.name;
  return `<span class="rk-name"><span class="addr" id="rk-${i}">${r.name}</span>${me?'<span class="tag t-first">You</span>':''}${isWallet(r.name)?`<button class="rk-copy" data-act="copy" data-t="${r.name}" data-el="rk-${i}" aria-label="Copy address ${r.name}">Copy</button>`:''}</span>`;
}
function viewRanks(){
  const d=UI.ranks,head=n=>`<div class="head-row"><h1>Leaderboard</h1>${n?`<span class="pill num">${fmt(n)} climber${n===1?'':'s'}</span>`:''}</div>`;
  if(!d)return head(0)+'<div class="empty-note">Loading the leaderboard...</div>';
  const rows=d.l.top||[],rank=d.me&&d.me.rank,above=rank&&rank>1?rows[rank-2]:null;
  const gap=above?Math.max(1,above.top-G.top+1):0;
  const mine=rank?`<section class="my-rank"><div class="my-no num"><small>Your rank</small><b>${fmt(rank)}</b></div>
      <div class="my-tx"><b class="num">Floor ${fmt(G.top)} of ${fmt(FLOORS.length)}</b><p>${rank===1?'You are leading the climb. Hold on to it.':above?`Clear ${fmt(gap)} more floor${gap===1?'':'s'} to pass the climber above you.`:'Keep climbing to reach the top 100.'}</p></div>
      ${allClear()?'':`<button class="btn" data-act="sheet" data-type="floor" data-f="${curFloor()}">Climb floor ${curFloor()}</button>`}</section>`
    :`<section class="my-rank"><div class="my-tx"><b>You are not ranked yet</b><p>Clear floor 1 to enter the leaderboard.</p></div><button class="btn" data-act="sheet" data-type="floor" data-f="1">Climb floor 1</button></section>`;
  const pods=rows.slice(0,3).map((r,i)=>`<div class="pod p${i+1}${PLAYER&&r.name===PLAYER.name?' me':''}">${pic('medal_'+(i+1),'Rank '+(i+1))}<strong class="num">Floor ${fmt(r.top)}</strong>${rankName(r,i)}<small>${agoText(r.at)}</small></div>`).join('');
  const rest=rows.slice(3).map((r,k)=>{const i=k+3;return `<li class="${PLAYER&&r.name===PLAYER.name?'me':''}"><b class="num">${i+1}</b>${rankName(r,i)}<span class="rk-floor num">Floor ${fmt(r.top)}<small>${agoText(r.at)}</small></span></li>`;}).join('');
  return `${head(d.l.total)}${mine}
    ${rows.length?`<div class="pods">${pods}</div>${rest?`<ol class="rank">${rest}</ol>`:''}`:'<div class="empty-note">Nobody has cleared a floor yet. Be the first.</div>'}
    <p class="note">Ranked by the highest floor cleared. On a tie, whoever got there first stands higher. Shows the top ${fmt(Math.min(100,rows.length))} of ${fmt(d.l.total)} and refreshes about every 30 seconds.</p>`;
}

/* SHOP: food bags and blind bags */
function foodBagCard(t,low){
  const b=FOOD_BAGS[t],n50=Math.min(50,Math.floor(G.coins/b.cost)),fits=low>=b.a&&(!b.b||low<b.b);
  return `<section class="shop-card${fits?' fits':''}">
    ${fits?'<span class="tag t-first shop-tag">Suits your team</span>':''}
    ${pic('fbag_'+b.id,b.n)}
    <h3>${b.n}</h3>
    <div class="price num">${coin}${fmt(b.cost)}</div>
    <small>${b.b?`Levels ${b.a} to ${b.b}`:`Level ${b.a} and up`}</small>
    <ul class="bag-odds">${RAR_ORDER.map((r,i)=>b.rars[i]?`<li class="r-${r}"><span>${RARS[r].n}</span><b class="num">${dec(b.rars[i])}%</b></li>`:'').join('')}</ul>
    <div class="btns"><button class="btn sm" data-act="foodbag" data-t="${t}" data-n="1"${G.coins<b.cost?' disabled':''}>Buy 1</button><button class="btn ghost sm" data-act="foodbag" data-t="${t}" data-n="10"${G.coins<b.cost*10?' disabled':''}>x10</button><button class="btn ghost sm" data-act="foodbag" data-t="${t}" data-n="${Math.max(n50,2)}"${n50<2?' disabled':''}>x${n50>=2?n50:50}</button></div>
  </section>`;
}
function viewShop(){
  const leftE=Math.max(0,PITY_E-G.pityE),leftL=Math.max(0,PITY_L-G.pityL),n50=Math.min(50,Math.floor(G.coins/BAG_COST));
  const epic=BAG_RATES.filter(r=>r[1]==='e'||r[1]==='l').reduce((a,r)=>a+r[2],0),leg=BAG_RATES.filter(r=>r[1]==='l').reduce((a,r)=>a+r[2],0);
  const low=G.owned[lowestTeamPet()].lv,foods=foodTotal();
  return `<div class="head-row"><h1>Shop</h1>${fastToggle()}</div>
    <section class="box"><div class="head-row"><h2 style="flex:1 1 auto">Food bags</h2><button class="chipb" data-act="to-pantry">Pantry: ${fmt(foods)} food${foods===1?'':'s'}</button></div>
      <p class="note">Each bag opens into one food. Feed a hamster to 100% and it can run the wheel for XP. Bigger hamsters need more food, so buy the bag that suits their level.</p>
      <div class="shop-grid">${FOOD_BAGS.map((b,t)=>foodBagCard(t,low)).join('')}</div>
      <button class="chipb" data-act="to-food-odds" style="align-self:flex-start">See every food and its exact odds</button>
    </section>
    <section class="bag-hero">${pic('bag','Blind bag')}
      <div class="bag-tx"><h2 class="bag-t">Blind Bag</h2><p>${BAG_COST} coins per bag. Contains gear of any rarity, or a pet.${G.bags===0?' Your first bag always gives a new pet.':''}</p>
      <div class="btns"><button class="btn big" data-act="bag" data-n="1"${G.coins<BAG_COST?' disabled':''}>Open 1 bag</button><button class="btn" data-act="bag" data-n="10"${G.coins<BAG_COST*10?' disabled':''}>Open 10</button><button class="btn" data-act="bag" data-n="${Math.max(n50,2)}"${n50<2?' disabled':''}>Quick open ${n50>=2?n50:50}</button></div>
      <div class="pity"><span class="num">${leftE} bags until a guaranteed Epic or better</span><div class="bar"><i style="width:${(G.pityE/PITY_E)*100}%"></i></div>
      <span class="num">${leftL} bags until a guaranteed Legendary</span><div class="bar leg"><i style="width:${(G.pityL/PITY_L)*100}%"></i></div></div>
      ${G.coins<BAG_COST?`<p class="note">You need ${fmt(BAG_COST-G.coins)} more coins. Open chests in your inventory or replay old floors.</p>`:''}</div></section>
    <div class="two"><section class="box"><h2>Blind Bag odds</h2>
      ${BAG_RATES.map(([kind,rar,p])=>`<div class="rate r-${rar}"><span>${RARS[rar].n} ${kind==='pet'?'pet':'gear'}</span><b>${dec(p)}%</b></div>`).join('')}
      <p class="note">${dec(epic)}% total for Epic or better, about one every ${Math.round(100/epic)} bags. Legendary alone is ${dec(leg)}%.</p>
    </section>
    <section class="box"><h2>Coin rules</h2>
      <ul class="stack" style="gap:6px;font-size:13.5px;color:var(--soft)"><li>Coins exist only in the game. No top-ups, no tokens or NFTs, no trading.</li>
      <li>A duplicate pet gains 1 star. At 5 stars it converts to 1,000 coins.</li>
      <li>You opened ${G.bags} bags. After ${PITY_E} bags without an Epic, the next one is guaranteed Epic. After ${PITY_L} without a Legendary, the next one is guaranteed Legendary.</li></ul>
    </section></div>`;
}
function fastToggle(){return `<button class="chipb${PREF.fastOpen?' on':''}" data-act="fast" aria-pressed="${!!PREF.fastOpen}">${PREF.fastOpen?'Spin animation off':'Skip spin animation'}</button>`;}

/* SPIN FOR CHESTS AND BLIND BAGS */
const randOf=a=>a[Math.floor(Math.random()*a.length)];
const SET_KEYS=Object.keys(SETS),SLOT_KEYS=Object.keys(SLOTS);
const randGear=()=>'g_'+randOf(SLOT_KEYS)+'_'+randOf(SET_KEYS);
function resCell(r){
  if(r.kind==='food'){const f=FOODS[r.id];return {art:'food_'+f.id,rar:f.rar,txt:f.n,gear:1};}
  if(r.kind==='chest'){if(r.pet)return resCell(r.pet);if(r.item)return resCell({kind:'item',item:r.item,rar:r.item.rar});return {art:'coins',rar:'n',txt:'+'+fmt(r.coins)+' coins'};}
  if(r.kind==='pet')return {art:'pet_'+r.id,rar:PETS[r.id].rar,txt:PETS[r.id].n};
  return {art:gearArt(r.item),rar:r.item.rar,txt:SETS[r.item.set].n+' '+SLOTS[r.item.slot].n,gear:1};
}
function poolCell(mode,tier){
  if(mode==='food'){
    const w=FOOD_BAGS[tier].rars.map(x=>Math.sqrt(x));let t=w.reduce((a,b)=>a+b,0),x=Math.random()*t,i=0;for(;i<3;i++){if(x<w[i])break;x-=w[i];}
    return {art:'food_'+randOf(FOODS_LIST.filter(f=>f.rar===RAR_ORDER[i])).id,rar:RAR_ORDER[i],gear:1};
  }
  if(mode==='chest'){
    const c=CHESTS[tier];
    if(Math.random()<.55)return {art:'coins',rar:'n'};
    const w=c.rars.map(x=>Math.sqrt(x));let t=w.reduce((a,b)=>a+b,0),x=Math.random()*t,i=0;for(;i<3;i++){if(x<w[i])break;x-=w[i];}
    return {art:randGear(),rar:RAR_ORDER[i],gear:1};
  }
  const w=BAG_RATES.map(r=>Math.sqrt(r[2]));let t=w.reduce((a,b)=>a+b,0),x=Math.random()*t,i=0;for(;i<w.length-1;i++){if(x<w[i])break;x-=w[i];}
  const r=BAG_RATES[i];
  if(r[0]==='pet'){const l=PETS_LIST.filter(p=>p.rar===r[1]);return {art:'pet_'+randOf(l).id,rar:r[1]};}
  return {art:randGear(),rar:r[1],gear:1};
}
const cellHTML=c=>`<div class="cell r-${c.rar}${c.gear?' gear':''}"><img src="${artUri(c.art)}" alt="" decoding="async"></div>`;
async function runBatch(cfg){
  const results=await cfg.make();if(!results||!results.length){render();return;}
  SP={cfg,results,done:false,anims:[]};
  $('#overlay').innerHTML=`<div class="spin" role="dialog" aria-modal="true"><h2>${cfg.title(results.length)}</h2><div class="spin-body" id="spbody"></div><div class="btns" id="spbtns"><button class="btn ghost" data-act="spin-skip">Skip</button></div></div>`;
  if(PREF.fastOpen||RM||results.length>10)quickOpen();
  else if(results.length===1)reelOne();
  else reelMany();
}
function reelOne(){
  const {cfg,results}=SP,c=resCell(results[0]),cells=[];
  const FINAL=22,TOTAL=26;
  const pool=[];for(let i=0;i<8;i++)pool.push(poolCell(cfg.mode,cfg.tier));
  for(let i=0;i<TOTAL;i++)cells.push(i===FINAL?c:pool[i%pool.length]);
  $('#spbody').innerHTML=`<div class="reel-wrap"><div class="reel-mark"></div><div class="reel" id="reel">${cells.map(cellHTML).join('')}</div></div>`;
  const reel=$('#reel'),wrap=reel.parentElement,cw=102,dist=FINAL*cw+48-wrap.clientWidth/2+(Math.random()*44-22);
  if(!reel.animate){spinDone();return;}
  const a=reel.animate([{transform:'translateX(0)'},{transform:`translateX(${-dist}px)`}],{duration:2300,easing:'cubic-bezier(.1,.72,.16,1)',fill:'forwards'});
  const run=SP;SP.anims.push(a);a.onfinish=()=>{if(SP===run)spinDone();};
  setTimeout(()=>{if(SP===run)spinDone();},2600);
}
function reelMany(){
  const {cfg,results}=SP,pool=[];for(let i=0;i<8;i++)pool.push(poolCell(cfg.mode,cfg.tier));
  $('#spbody').innerHTML=`<div class="minis">${results.map((r,i)=>{const cells=[];for(let k=0;k<7;k++)cells.push(pool[(i*3+k)%pool.length]);cells.push(resCell(r));return `<div class="mini" id="mini-${i}"><div class="mini-strip">${cells.map(cellHTML).join('')}</div></div>`;}).join('')}</div>`;
  let left=results.length;const run=SP;
  results.forEach((r,i)=>{
    const m=$('#mini-'+i),st=m.firstElementChild,fin=()=>{m.classList.add('stop','r-'+resCell(r).rar);if(--left===0&&SP===run)spinDone();};
    if(!st.animate){fin();return;}
    const a=st.animate([{transform:'translateY(0)'},{transform:`translateY(${-(7/8*100)}%)`}],{duration:620+i*120,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    SP.anims.push(a);a.onfinish=fin;
  });
  setTimeout(()=>{if(SP===run)spinDone();},900+results.length*120);
}
function quickOpen(){
  const {cfg}=SP;
  $('#spbody').innerHTML=`<div class="quick">${pic(cfg.art,'')}</div>`;
  const q=$('.quick img');
  if(q&&q.animate&&!RM){const a=q.animate([{transform:'rotate(0) scale(1)'},{transform:'rotate(-9deg) scale(1.08)'},{transform:'rotate(9deg) scale(1.14)'},{transform:'rotate(-6deg) scale(1.2)'},{transform:'rotate(0) scale(1.3)'}],{duration:520,easing:'ease-in'});const run=SP;SP.anims.push(a);a.onfinish=()=>{if(SP===run)spinDone();};setTimeout(()=>{if(SP===run)spinDone();},700);}
  else spinDone();
}
function spinDone(){
  if(!SP||SP.done)return;SP.done=true;
  const {cfg,results}=SP;
  const coins=results.reduce((a,r)=>a+(r.coins||0),0);
  /* many foods of one kind show as one card with a count */
  const foodCounts={};
  if(cfg.mode==='food')results.forEach(r=>{foodCounts[r.id]=(foodCounts[r.id]||0)+1;});
  const list=cfg.mode==='food'?Object.keys(foodCounts).map(id=>({kind:'food',id,k:foodCounts[id]})):results.map(r=>{if(r.kind==='chest'){if(r.pet)return r.pet;if(r.item)return {kind:'item',item:r.item,rar:r.item.rar};return null;}return r;}).filter(Boolean);
  const shown=list.map(r=>({r,rar:r.kind==='pet'?PETS[r.id].rar:r.kind==='food'?FOODS[r.id].rar:r.item.rar})).sort((a,b)=>RAR_ORDER.indexOf(b.rar)-RAR_ORDER.indexOf(a.rar));
  const best=shown[0]?shown[0].rar:'n';
  const cap=results.length<=10?shown:shown.slice(0,48),more=shown.length-cap.length;
  const body=$('#spbody'),keep=$('.reel-wrap')||$('.minis');
  const sum=`<div class="sum">${coins?`<div class="big-coin num">${coin}+${fmt(coins)}</div>`:''}
    ${cap.length===1&&results.length===1?bigCard(cap[0].r):cap.length?`<div class="reveal">${cap.map((x,i)=>revealCard(x.r,i)).join('')}</div>`:''}
    ${more>0?`<p class="note">And ${more} more items in your inventory.</p>`:''}
    ${!cap.length&&!coins?'<p class="note">Nothing this time.</p>':''}</div>`;
  if(results.length>1||!keep)body.innerHTML=sum;else body.insertAdjacentHTML('beforeend',sum);
  const again=cfg.canAgain&&cfg.canAgain();
  $('#spbtns').innerHTML=`${again?`<button class="btn" data-act="spin-again">${again}</button>`:''}${cfg.mode==='food'?'<button class="btn" data-act="spin-feed">Feed a hamster</button>':''}<button class="btn ghost" data-act="spin-close">Done</button>`;
  const r=body.getBoundingClientRect(),c={x:r.left+r.width/2,y:r.top+r.height/2};
  if(best==='l'){FX.ring(c,'#FFC94D',20,220,10,700);FX.burst(c.x,c.y,'#FFC94D',26,420,'star',10,900,80);}
  else if(best==='e'){FX.ring(c,'#C99BFF',20,180,8,600);FX.burst(c.x,c.y,'#C99BFF',18,340,'spark',9,760);}
  else FX.burst(c.x,c.y,'#FFE27A',10,240,'spark',7,520);
}
function bigCard(r){
  const c=resCell(r),rays=c.rar==='e'||c.rar==='l';
  const label=r.kind==='food'?fmt(FOODS[r.id].fill)+' fullness':r.kind==='pet'?(r.fresh?'New pet!':r.refund?'Converted to '+fmt(r.refund)+' coins':'Now '+r.star+' stars'):itemEffect(r.item);
  return `<div class="big-res r-${c.rar}">${rays?'<i class="rays" aria-hidden="true"></i>':''}<span class="big-pic${c.gear?' gear':''}">${pic(c.art,c.txt)}</span><b>${c.txt}</b><span class="rar">${RARS[c.rar].n}</span><small>${label}</small></div>`;
}
function revealCard(r,i){
  const d=`animation-delay:${Math.min(i,12)*50}ms`;
  if(r.kind==='food'){const f=FOODS[r.id];return `<div class="rv r-${f.rar}" style="${d}"><span class="i-pic">${picL('food_'+f.id,f.n)}</span><b>${f.n}</b><em class="num">x${r.k}</em></div>`;}
  if(r.kind==='pet'){const p=PETS[r.id];return `<div class="rv r-${p.rar}" style="${d}">${picL('pet_'+r.id,p.n)}<b>${p.n}</b><em>${r.fresh?'New pet!':r.refund?'+'+fmt(r.refund)+' coins':'Now '+r.star+' stars'}</em></div>`;}
  const it=r.item;return `<div class="rv r-${it.rar}" style="${d}"><span class="i-pic">${picL(gearArt(it),itemName(it))}</span><b>${SETS[it.set].n} ${SLOTS[it.slot].n}</b><small style="color:var(--rc)">${RARS[it.rar].n}</small></div>`;
}
function spinClose(){SP=null;$('#overlay').innerHTML='';render();}
const bagCfg=n=>({mode:'bag',art:'bag',title:k=>k===1?'Opening a blind bag':`Opening ${k} blind bags`,make:async()=>(await action('bag',{n})).results,canAgain:()=>G.coins>=BAG_COST?(n>1&&G.coins>=BAG_COST*n?`Open ${n} more`:'Open 1 more'):null,next:()=>bagCfg(G.coins>=BAG_COST*n?n:1)});
const foodBagCfg=(t,n)=>{const b=FOOD_BAGS[t];return {mode:'food',tier:t,art:'fbag_'+b.id,title:k=>k===1?'Opening a '+b.n:`Opening ${k} ${b.n}s`,make:async()=>(await action('foodbag',{tier:t,n})).results,canAgain:()=>G.coins>=b.cost?(n>1&&G.coins>=b.cost*n?`Open ${n} more`:'Open 1 more'):null,next:()=>foodBagCfg(t,G.coins>=b.cost*n?n:1)};};
const chestCfg=(t,n)=>({mode:'chest',tier:t,art:'chest_'+(t+1),title:k=>k===1?'Opening a '+CHESTS[t].n:`Opening ${k} ${CHESTS[t].n}s`,make:async()=>(await action('chest',{tier:t,n})).results,canAgain:()=>G.chests[t]>0?(G.chests[t]>=n&&n>1?`Open ${n} more`:'Open 1 more'):null,next:()=>chestCfg(t,G.chests[t]>=n?n:1)});
const chestAllCfg=()=>({mode:'chest',tier:0,art:'chest_5',title:k=>`Opening ${k} chests`,make:async()=>(await action('chest',{all:true})).results,canAgain:()=>null});

/* GEAR FORGE */
async function forgeRun(uid){
  const it=itemByUid(G,uid);if(!it||!canMerge(G,it))return;
  const nameBefore=itemName(it),art=gearArt(it),rar=it.rar,chance=mergeChance(it),to=it.plus+1;
  const r=(await action('merge',{uid})).r;if(!r)return;
  $('#overlay').innerHTML=`<div class="spin forge" role="dialog" aria-modal="true"><h2>Merging ${nameBefore}</h2>
    <div class="fg-stage" id="fg">${pic('anvil','','fg-anvil')}<span class="i-pic fg-mat a">${pic(art,'')}</span><span class="i-pic fg-main r-${rar}" id="fgm">${pic(art,nameBefore)}</span><span class="i-pic fg-mat b">${pic(art,'')}</span>${pic('forge_hammer','','fg-ham')}</div>
    <p class="fg-rate num">Chance for +${to}: ${pct(chance)}</p><div id="fgres"></div>
    <div class="btns" id="spbtns"><button class="btn ghost" data-act="spin-skip">Skip</button></div></div>`;
  SP={forge:true,done:false,anims:[],timers:[],fin:()=>forgeDone(r,uid)};
  if(RM||PREF.fastOpen){SP.fin();return;}
  const m=$$('.fg-mat'),h=$('.fg-ham'),main=$('#fgm');
  const ctr=()=>{const q=main.getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2};};
  const anm=(el,f,o)=>{if(el&&el.animate){const a=el.animate(f,o);SP.anims.push(a);return a;}return null;};
  anm(m[0],[{transform:'translate(0,0)',opacity:1},{transform:'translate(84px,0) scale(.6)',opacity:0}],{duration:430,easing:'ease-in',fill:'forwards'});
  anm(m[1],[{transform:'translate(0,0)',opacity:1},{transform:'translate(-84px,0) scale(.6)',opacity:0}],{duration:430,easing:'ease-in',fill:'forwards'});
  [430,700,970].forEach((ms,i)=>{SP.timers.push(setTimeout(()=>{if(!SP||SP.done)return;anm(h,[{transform:'rotate(0)'},{transform:'rotate(-46deg)',offset:.5},{transform:'rotate(0)'}],{duration:240,easing:'ease-in'});const c=ctr();SP.timers.push(setTimeout(()=>{FX.burst(c.x,c.y,'#FFC94D',8+i*3,240,'spark',7,420);FX.ring(c,'#FFE27A',6,44+i*14,5,260);},120));},ms));});
  SP.timers.push(setTimeout(()=>{if(SP&&!SP.done)SP.fin();},1300));
}
function forgeDone(r,uid){
  if(!SP||SP.done)return;SP.done=true;
  (SP.timers||[]).forEach(clearTimeout);
  const main=$('#fgm'),box=$('#fgres'),it=itemByUid(G,uid);
  $$('.fg-mat').forEach(el=>{el.style.opacity=0;});
  if(main&&it&&r.ok)main.insertAdjacentHTML('beforeend',`<em>+${r.plus}</em>`);
  if(box)box.innerHTML=r.ok?`<p class="fg-ok">Success! ${itemName(it)}</p><p class="note">${itemEffect(it)}</p>`:`<p class="fg-no">Failed</p><p class="note">You lost 2 materials. The main item stays at +${r.plus}.</p>`;
  if(main){const q=main.getBoundingClientRect(),c={x:q.left+q.width/2,y:q.top+q.height/2};
    if(r.ok){FX.ring(c,'#FFC94D',10,130,9,560);FX.burst(c.x,c.y,'#FFE27A',20,340,'star',9,720);anim(main,[{transform:'scale(1)'},{transform:'scale(1.25)',offset:.4},{transform:'scale(1)'}],420);}
    else{FX.burst(c.x,c.y,'#7A7690',14,120,'dot',8,760,-50);anim(main,[{transform:'translateX(0)'},{transform:'translateX(-9px)'},{transform:'translateX(9px)'},{transform:'translateX(0)'}],300);}
  }
  const can=it&&canMerge(G,it);
  $('#spbtns').innerHTML=`${can?`<button class="btn" data-act="forge-again" data-uid="${uid}">Merge again: ${pct(mergeChance(it))}</button>`:''}<button class="btn ghost" data-act="spin-close">Done</button>`;
}
async function forgeAll(){
  const r=(await action('merge',{all:true})).m;if(!r)return;
  const n=r.okN+r.failN;
  if(!n){toast('Nothing to merge yet');render();return;}
  $('#overlay').innerHTML=`<div class="spin forge" role="dialog" aria-modal="true"><h2>Merging everything</h2><div class="quick">${pic('anvil','')}</div><p class="big-coin num">${r.okN} succeeded, ${r.failN} failed</p><p class="note">A failed merge loses 2 materials. The main item stays as it was.</p><div class="btns" id="spbtns"><button class="btn" data-act="spin-close">Done</button></div></div>`;
  SP={forge:true,done:true,anims:[]};
  const q=$('.quick');if(q){const b=q.getBoundingClientRect();FX.burst(b.left+b.width/2,b.top+b.height/2,'#FFC94D',18,300,'spark',8,620);}
}

/* INVENTORY */
function viewInv(){
  const total=chestTotal(G),foods=foodTotal();
  return `<div class="head-row"><h1>Inventory</h1><span class="pill num">${total} chests, ${G.items.length} items, ${fmt(foods)} foods</span></div>
    <div class="tabs" role="group" aria-label="Inventory sections"><button class="chipb${UI.invTab==='chest'?' on':''}" data-act="inv" data-k="chest">Chests (${total})</button><button class="chipb${UI.invTab==='gear'?' on':''}" data-act="inv" data-k="gear">Gear (${G.items.length})</button><button class="chipb${UI.invTab==='food'?' on':''}" data-act="inv" data-k="food">Food (${fmt(foods)})</button></div>
    ${UI.invTab==='chest'?invChests():UI.invTab==='food'?invFood():invGear()}`;
}
function invFood(){
  const found=FOODS_LIST.filter(f=>G.foods[f.id]>0).length;
  return `<section class="box"><div class="head-row"><h2 style="flex:1 1 auto">Your pantry</h2><button class="btn sm" data-act="nav" data-v="team">Feed a hamster</button><button class="btn ghost sm" data-act="nav" data-v="shop">Buy food</button></div>
      <p class="note num">You hold ${found} of ${FOODS_LIST.length} kinds of food. Open a pet on the Team screen to feed it. Hover a food for details, on a phone press and hold.</p>
      <div class="fgrid">${RAR_ORDER.flatMap(r=>FOODS_LIST.filter(f=>f.rar===r)).map(f=>{const n=G.foods[f.id]||0;return `<div class="ftile r-${f.rar}${n?'':' none'}" data-tip="fd:${f.id}" tabindex="0"><span class="i-pic">${picL('food_'+f.id,f.n)}${n?`<em>${fmt(n)}</em>`:''}</span><b>${f.n}</b><small class="num">${fmt(f.fill)} fullness</small></div>`;}).join('')}</div>
    </section>`;
}
function invChests(){
  const total=chestTotal(G);
  return `<section class="box"><div class="head-row"><h2 style="flex:1 1 auto">Your chests</h2><button class="btn" data-act="chest-all"${total?'':' disabled'}>Open all ${total||''}</button>${fastToggle()}</div>
      <div class="chest-grid">${CHESTS.map((c,t)=>`<div class="chest-card${G.chests[t]?'':' empty'}">${pic('chest_'+(t+1),c.n)}<b>${c.n}</b><span class="num">x${G.chests[t]}</span>
        <div class="btns"><button class="btn sm" data-act="chest" data-t="${t}" data-n="1"${G.chests[t]?'':' disabled'}>Open</button><button class="btn ghost sm" data-act="chest" data-t="${t}" data-n="${Math.min(10,G.chests[t]||0)}"${G.chests[t]>1?'':' disabled'}>x${Math.max(2,Math.min(10,G.chests[t]||0))}</button></div></div>`).join('')}</div>
      ${total?'':'<p class="note">No chests yet. Clear new floors, replay old ones, or use Sweep to get chests.</p>'}
    </section>
    <div class="two"><section class="box"><h2>What is inside</h2>
      <div class="tbl"><table><thead><tr><th>Chest</th><th>Coins</th><th>Gear</th><th>Pet</th></tr></thead><tbody>${CHESTS.map(c=>`<tr><td>${c.n.replace(' Chest','')}</td><td class="num">${fmt(c.a)} to ${fmt(c.b)}</td><td class="num">${pct(c.gear)}</td><td class="num">${c.pet?dec(c.pet*100)+'%':'0%'}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Gear from high tier chests is rarer: Silver 5% Epic, Gold 23% Epic and 2% Legendary, Diamond 50% Epic and 10% Legendary.</p></section>
    <section class="box"><h2>Drop odds by floor</h2>
      <div class="tbl"><table><thead><tr><th>Floor</th><th>Wood</th><th>Bronze</th><th>Silver</th><th>Gold</th><th>Diamond</th></tr></thead><tbody>${CHEST_BANDS.map(b=>`<tr><td class="num">${b[1]>1e6?b[0]+'+':b[0]+' to '+b[1]}</td>${b[2].map(p=>`<td class="num">${dec(p)}%</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">A first clear gives 2 chests, 1 more on a boss floor, 1 more on a Zoomies floor. Boss and Zoomies floors also raise the chest tier. A replay gives 1 to 2 chests.</p></section></div>`;
}
function invGear(){
  const eq=equippedUids(G);
  const rars=RAR_ORDER.filter(r=>UI.sell[r]),pv=sellPreview(G,rars);
  const canM=G.items.some(it=>!eq.has(it.uid)&&canMerge(G,it));
  const all=G.items.filter(i=>UI.filter==='all'||i.slot===UI.filter).sort((a,b)=>RAR_ORDER.indexOf(b.rar)-RAR_ORDER.indexOf(a.rar)||b.plus-a.plus||a.set.localeCompare(b.set)||a.slot.localeCompare(b.slot));
  const list=all.slice(0,UI.limit);
  const counts=RAR_ORDER.map(r=>G.items.filter(i=>i.rar===r&&!eq.has(i.uid)).length);
  return `<div class="two">
      <section class="box"><h2>Mass sell</h2><p class="note">Tap a rarity to switch between Keep and Sell. Equipped items are never sold.</p>
        <div class="sell-grid">${RAR_ORDER.map((r,i)=>`<button class="sell-t r-${r}${UI.sell[r]?' sell':''}" data-act="sell-t" data-r="${r}" aria-pressed="${!!UI.sell[r]}">${UI.sell[r]?'Sell':'Keep'}: ${RARS[r].n}<span class="num">${counts[i]} items</span></button>`).join('')}</div>
        ${UI.sellAsk&&pv.list.length?`<div class="btns"><button class="btn warn" data-act="sell-do">Confirm: sell ${pv.list.length} items for ${fmt(pv.coins)} coins</button><button class="btn ghost sm" data-act="sell-no">Cancel</button></div>`:`<div class="btns"><button class="btn" data-act="sell-ask"${pv.list.length?'':' disabled'}>${pv.list.length?`Sell ${pv.list.length} items for ${fmt(pv.coins)} coins`:'Nothing to sell'}</button></div>`}
      </section>
      <section class="box"><h2>Merge gear</h2><p class="note">A main item plus 2 items of the same set, slot and rarity. Success adds 1 level, and each level is ${pct(TUNE.plusGrow)} stronger. Failure loses the 2 materials, the main item stays.</p>
        <div class="rates-line num">${MERGE_RATE.map((p,i)=>`<span>+${i+1}: <b>${pct(p)}</b></span>`).join('')}</div>
        <div class="btns"><button class="btn" data-act="merge-all"${canM?'':' disabled'}>${canM?'Merge everything':'Not enough matching items'}</button></div>
      </section>
    </div>
    <div class="filter" role="group" aria-label="Filter by slot"><button class="chipb${UI.filter==='all'?' on':''}" data-act="filter" data-k="all">All</button>${Object.keys(SLOTS).map(k=>`<button class="chipb${UI.filter===k?' on':''}" data-act="filter" data-k="${k}">${SLOTS[k].n}</button>`).join('')}</div>
    ${list.length?`<div class="igrid">${list.map(itemCard).join('')}</div>${all.length>list.length?`<div class="btns"><button class="btn ghost" data-act="more">Show more (${all.length-list.length} left)</button></div>`:''}`:`<div class="empty-note">No items yet. Open chests or blind bags to get gear.</div>`}`;
}
function itemCard(it){
  const own=ownerOf(it.uid);
  return `<button class="item r-${it.rar}" data-act="item" data-uid="${it.uid}"><span class="i-pic">${picL(gearArt(it),itemName(it))}${it.plus?`<em>+${it.plus}</em>`:''}${own?picL('pet_'+own,'Equipped by '+PETS[own].n,'i-own'):''}</span><b>${SETS[it.set].n} ${SLOTS[it.slot].n}</b><small>${RARS[it.rar].n}</small></button>`;
}
function sheetItem(s){
  const it=itemByUid(G,+s.uid);if(!it)return '<h2>This item is gone</h2>';
  const own=ownerOf(it.uid),same=sameItems(G,it).length,val=RARS[it.rar].sell*(1+it.plus),set=SETS[it.set],maxed=it.plus>=5;
  const cards=G.team.map(id=>`<button class="btn ghost sm" data-act="equip-from-item" data-id="${id}" data-uid="${it.uid}"${own===id?' disabled':''}>Equip on ${PETS[id].n}</button>`).join('');
  return `<h2>${itemName(it)}</h2>
    <div class="p-head r-${it.rar}"><span class="p-pic" style="background:#EEEAF6">${pic(gearArt(it),itemName(it))}</span><div class="p-info">
      <div class="info-row"><span class="tag" style="background:var(--rc)">${RARS[it.rar].n}</span><span class="tag">${SLOTS[it.slot].n}</span>${it.plus?`<span class="tag t-first">+${it.plus}</span>`:''}</div>
      <b>${itemEffect(it)}</b>
      <p class="note">${set.n} set. 2 pieces: ${set.p2} 4 pieces: ${set.p4}</p>
      ${own?`<p class="note">${PETS[own].n} is wearing this item.</p>`:''}
    </div></div>
    <div class="btns">${cards}</div>
    <div class="btns"><button class="btn sm" data-act="forge" data-uid="${it.uid}"${canMerge(G,it)?'':' disabled'}>${maxed?'Already +5':`Merge to +${it.plus+1}: ${pct(mergeChance(it))}`}</button><button class="btn warn sm" data-act="item-sell" data-uid="${it.uid}"${own?' disabled':''}>Sell: ${fmt(val)} coins</button></div>
    ${maxed?'':`<p class="note num">${same} matching materials, 2 needed. A failed merge loses the 2 materials.</p>`}`;
}

/* CODEX */
function viewCodex(){
  const tabs=[['pet','Pets'],['mon','Monsters'],['boss','Bosses'],['react','Reactions'],['rule','Rules'],['food','Food and wheel'],['wx','Weather and maps'],['gear','Gear sets']];
  const c={pet:codexPets,mon:codexMons,boss:codexBoss,react:codexReact,rule:codexRules,food:codexFood,wx:codexWx,gear:codexGear}[UI.tab]();
  return `<div class="head-row"><h1>Codex</h1></div>
    <div class="tabs" role="group" aria-label="Codex sections">${tabs.map(([k,l])=>`<button class="chipb${UI.tab===k?' on':''}" data-act="tab" data-k="${k}">${l}</button>`).join('')}</div>${c}`;
}
function codexPets(){
  const own=Object.keys(G.owned).length;
  return `<p class="note num">You own ${own} of ${PETS_LIST.length} pets. Tap a pet to see its skills.</p>
    <div class="pgrid">${RAR_ORDER.flatMap(r=>PETS_LIST.filter(p=>p.rar===r)).map(p=>petCard(p.id,false)).join('')}</div>`;
}
const tryBtn=id=>`<div class="btns" style="margin-top:3px"><button class="btn ghost sm" data-act="try" data-id="${id}">Practice</button></div>`;
function codexMons(){return `<p class="note">${MONS_LIST.length} kinds of monsters. They have their own moves and know when to use them. Practice battles give no rewards.</p><div class="list">${MONS_LIST.map(m=>enemyCard(m.id,tryBtn(m.id))).join('')}</div>`;}
function codexBoss(){return `<p class="note">${BOSS_LIST.length} bosses. Every 10 floors you meet a boss with 2 minions.</p><div class="list">${BOSS_LIST.map(m=>enemyCard(m.id,`<small>Minions: ${m.minions.map(x=>MONS[x].n).join(', ')}</small>`+tryBtn(m.id))).join('')}</div>`;}
function codexReact(){
  return `<p class="note">Elemental hits leave a mark on the target. A hit from another element on that mark triggers a reaction. Monsters can do this to you too.</p>
    <div class="list">${Object.keys(REACT).map(k=>{const[a,b]=k.split('+'),r=REACT[k];return `<div class="rx"><div class="rx-ic">${pic('el_'+a,ELS[a].n)}+${pic('el_'+b,ELS[b].n)}</div><div><b>${r.n}</b><span>${r.d}</span></div></div>`;}).join('')}</div>`;
}
function codexRules(){
  const ks=Object.keys(ELS);
  return `<section class="box"><h2>How to play</h2><ol class="how"><li>Each turn pick a skill for all 3 pets, tap an enemy to choose the target for the highlighted pet, then press Fight.</li>
      <li>Every unit acts once per turn. Higher Speed goes first, and each unit shows its order number.</li>
      <li>Hover over enemies, pets, skills or effects for details. On a phone, press and hold.</li>
      <li>A full Rage bar unlocks the big skill. Attacking and being hit both build Rage.</li>
      <li>Melee attacks and many enemy attacks only reach the front row. The first pet in your team is the front row.</li>
      <li>Cleared floors stay cleared. Losing costs nothing, so replay as much as you like for coins and chests.</li>
      <li>Chests go to your inventory and open from there. Use Sweep once per day to collect rewards from cleared floors.</li>
      <li>Coins buy food and blind bags in the Shop. Feed a hamster to 100% and run the wheel to earn levels.</li></ol></section>
    <section class="box"><h2>Element cycle</h2><div class="elwheel">${ks.map(k=>`<div class="elpair"><span>${pic('el_'+k,ELS[k].n)}${ELS[k].n}</span><i>beats</i><span>${pic('el_'+ELS[k].beats,ELS[ELS[k].beats].n)}${ELS[ELS[k].beats].n}</span></div>`).join('')}</div><p class="note">An advantage is 40% stronger, a disadvantage is 25% weaker.</p></section>
    <section class="box"><h2>Effects</h2><div class="st-list">${Object.keys(STS).map(k=>`<div><span class="chip" style="--c:${STS[k].c}">${STS[k].n}</span>${STS[k].d}</div>`).join('')}</div></section>
    <section class="box"><h2>Merge odds</h2><div class="rates-line num">${MERGE_RATE.map((p,i)=>`<span>Merge to +${i+1}: <b>${pct(p)}</b></span>`).join('')}</div></section>
    <section class="box"><h2>The hamster shapes the floors</h2><ul class="stack" style="gap:5px;font-size:13.5px;color:var(--soft)"><li>600 work or more makes a Zoomies floor: stronger enemies, chests one tier higher.</li><li>Under 300 work makes an Easy floor: weaker enemies.</li><li>A nap of 1 hour or more leaves a treasure chest.</li><li>Squeektoshi grows stronger with the work of the round being fought.</li><li>The round hash decides the enemies, map and weather, so everyone sees the same floor.</li></ul></section>
    <section class="box"><h2>Team bonuses</h2><div class="st-list">${RESON.map(r=>`<div><b>${r.n}.</b> ${r.d}</div>`).join('')}${TRIOS.map(t=>`<div><b>${t.n}</b> (${t.ids.map(i=>PETS[i].n).join(', ')}). ${t.d}</div>`).join('')}</div></section>
    <section class="box"><h2>Data source</h2><p class="note num">${ROUNDS.rounds.length} rounds with work, read from Ethereum Sepolia, last read at ${TIME_STR(ROUNDS.readAt)}. New floors appear on their own when a new round is settled.</p>${ROUNDS.cores.map((c,i)=>`<div class="core-row"><small class="num">Floors ${c.from||'?'} to ${c.to||'?'}, ${i<ROUNDS.cores.length-1?'stopped SqueekCore contract':'live SqueekCore contract'}</small><p class="addr" id="core-addr-${i}">${c.core}</p><button class="btn ghost sm" data-act="copy" data-t="${c.core}" data-el="core-addr-${i}">Copy address</button></div>`).join('')}</section>`;
}
/* fullness per coin of a bag, and the average coins one level costs using the bag that suits that level */
const bagFill=b=>FOODS_LIST.reduce((a,f)=>a+foodRate(b,f)/100*f.fill,0);
const bagForLevel=lv=>FOOD_BAGS.find(b=>lv>=b.a&&(!b.b||lv<b.b))||FOOD_BAGS[0];
const levelCoins=lv=>{const b=bagForLevel(lv);return xpNeed(lv)/(runXp(lv)*luckAvg)*stomach(lv)*b.cost/bagFill(b);};
const roundNice=v=>{const m=Math.pow(10,Math.max(0,Math.floor(Math.log10(v))-1));return Math.round(v/m)*m;};
function codexFood(){
  return `<section class="box"><h2>How hamsters level up</h2><ol class="how">
      <li>Buy food bags in the Shop with coins. Each bag opens into one food.</li>
      <li>Feed a hamster until it is 100% full. Foods fill it by different amounts, and a higher level means a bigger stomach.</li>
      <li>A full hamster can run the wheel. The run empties its stomach and gives random XP.</li>
      <li>Enough XP gives a level. Food never spoils and fullness never drops on its own.</li></ol></section>
    <div class="two"><section class="box"><h2>Wheel luck</h2>
      <div class="tbl"><table><thead><tr><th>Run</th><th>XP</th><th>Chance</th></tr></thead><tbody>${RUN_LUCK.map(l=>`<tr><td>${l.n}</td><td class="num">x${dec(l.x)}</td><td class="num">${l.p}%</td></tr>`).join('')}</tbody></table></div>
      <p class="note num">Each run also varies by up to 10% either way. On average a run gives x${dec(luckAvg)}.</p></section>
    <section class="box"><h2>Levels</h2>
      <div class="tbl"><table><thead><tr><th>Level</th><th>Full at</th><th>Run XP</th><th>To next</th><th>Coins</th></tr></thead><tbody>${[1,5,10,20,50,100,150,200].map(lv=>`<tr><td class="num">${lv}</td><td class="num">${fmt(stomach(lv))}</td><td class="num">${fmt(runXp(lv))}</td><td class="num">${fmt(xpNeed(lv))}</td><td class="num">${fmt(roundNice(levelCoins(lv)))}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Run XP is a normal run before luck. Coins is the average cost of one level with the bag that suits it.</p></section></div>
    <section class="box"><h2>All ${FOODS_LIST.length} foods and their odds</h2>
      <div class="tbl"><table class="food-tbl"><thead><tr><th>Food</th><th>Fullness</th>${FOOD_BAGS.map(b=>`<th>${b.n.split(' ')[0]}</th>`).join('')}</tr></thead><tbody>${RAR_ORDER.flatMap(r=>FOODS_LIST.filter(f=>f.rar===r)).map(f=>`<tr class="r-${f.rar}"><td><span class="ft-n" data-tip="fd:${f.id}" tabindex="0">${picL('food_'+f.id,'')}${f.n}</span></td><td class="num">${fmt(f.fill)}</td>${FOOD_BAGS.map(b=>{const p=foodRate(b,f);return `<td class="num">${p?(Math.round(p*100)/100)+'%':'0%'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note num">${FOOD_BAGS.map(b=>`${b.n}: ${fmt(b.cost)} coins, about ${fmt(bagFill(b))} fullness on average.`).join(' ')} A food that overfills the stomach wastes the rest.</p></section>
    <section class="box"><h2>Real hamsters</h2><p class="note">Every food here is named as safe in at least one care guide from PetMD, Chewy, Woodgreen or Burgess. The guides do not fully agree: some advise against all cooked human food and warn that sunflower seeds are very fatty. Grapes, nuts and pasta were left out because the guides clash on them. In real life these are tiny treats next to a complete pellet diet, not meals, and dwarf hamsters need less sugar. Hover a food to see how it should be served. Ask a vet before changing a real hamster's diet.</p></section>`;
}
function codexWx(){
  return `<section class="box"><h2>Weather</h2><p class="note">The round hash picks the weather. About 60% of floors have weather that changes the battle.</p><div class="st-list">${RULES.map(r=>`<div><b>${r.n}.</b> ${r.d}</div>`).join('')}</div></section>
    <section class="box"><h2>Maps</h2><p class="note">${MAP_NAMES.length} map kinds and ${TONE_NAMES.length} color tones. Props are placed from the hash, so every floor looks different.</p><div class="res-chips">${MAP_NAMES.map(m=>`<span class="res-chip">${m}</span>`).join('')}</div></section>`;
}
function codexGear(){
  return `<p class="note">Each pet wears 4 items. Weapons raise Bite, Armor raises HP, Hats raise Armor, Charms raise crit and Speed. Wearing 2 or 4 pieces of a set gives a bonus.</p>
    <div class="list">${Object.keys(SETS).map(k=>{const s=SETS[k];return `<div class="set-card"><b>${s.n} set</b><div class="set-ic">${Object.keys(SLOTS).map(x=>picL('g_'+x+'_'+k,s.n+' '+SLOTS[x].n)).join('')}</div><div>2 pieces: ${s.p2}</div><div>4 pieces: ${s.p4}</div></div>`;}).join('')}</div>`;
}
function sandboxNode(id){
  const m=MONS[id];
  let en=m.boss?[id,...m.minions]:[id,...MONS_LIST.filter(x=>x.id!==id&&x.tier===m.tier).slice(0,2).map(x=>x.id)];
  const f=Math.max(1,G.top),n=++UI.tryN,ms=seedOf(id+n);
  return {floor:f,round:0,work:450,blocks:43,type:'normal',boss:!!m.boss,hash:'0xpractice'+id+n,enemies:en,rule:pick(RULES,ms).id,map:{t:Math.floor(rnd(ms)*MAP_NAMES.length),tone:Math.floor(rnd(ms)*TONE_NAMES.length)}};
}

/* TEST PANEL */
function sheetTrial(){
  return `<h2>Test panel</h2>
    <p class="note">Only test wallets see this panel, so you can reach all the content quickly. It changes this account for real: floors you jump to count on the leaderboard until you erase your data.</p>
    <div class="sec-t">Add resources</div>
    <div class="btns"><button class="btn sm" data-act="tr-coins">Add 10,000 coins</button><button class="btn sm" data-act="tr-chests">Add 38 chests</button><button class="btn sm" data-act="tr-food">Add 10 of every food</button><button class="btn sm" data-act="tr-pets">Get all ${PETS_LIST.length} pets</button><button class="btn sm" data-act="tr-sweep">Reset Sweep</button></div>
    <div class="sec-t">Jump to a floor (the team is leveled up to match)</div>
    <div class="btns">${[9,19,29,49,99,199,399].filter(n=>n<FLOORS.length).map(n=>`<button class="btn ghost sm" data-act="tr-jump" data-n="${n}">Floor ${n+1}</button>`).join('')}</div>
    <div class="sec-t">Start over</div>
    <div class="btns">${UI.wipeAsk?'<button class="btn warn sm" data-act="tr-wipe2">Erase everything, this cannot be undone</button><button class="btn ghost sm" data-act="tr-nowipe">Cancel</button>':'<button class="btn ghost sm" data-act="tr-wipe">Erase my data</button>'}</div>`;
}

/* ACTIONS */
const ACT={
  nav(d){UI.view=d.v;UI.sheet=null;UI.result=null;UI.sellAsk=false;UI.limit=120;if(d.v==='tower')UI.block=null;render();window.scrollTo(0,0);if(d.v==='ranks')return loadRanks();},
  sheet(d){openSheet({type:d.type,f:d.f});},
  close(){closeSheet();},
  'close-bg'(d,t,e){if(e.target===t)closeSheet();},
  block(d){UI.block=+d.e;render();},
  async sweep(){const j=await action('sweep');if(j.r)openSheet({type:'sweep',r:j.r});else render();},
  async guest(){await api('/api/auth/guest',{});await afterLogin();},
  wallet(){UI.walletWait=null;askWallets();openSheet({type:'wallets'});},
  'wallet-pick'(d){pickWallet(+d.i);},
  async logout(){await api('/api/auth/logout',{});setTicket(null);if(BT)leaveBattle();G=null;PLAYER=null;UI.sheet=null;UI.ranks=null;UI.view='login';render();},
  async 'res-retry'(){const r=UI.result;if(!r||!r.finish)return;await saveResult(r);render();},
  'to-chests'(){UI.view='items';UI.invTab='chest';UI.sheet=null;UI.result=null;render();window.scrollTo(0,0);},
  enter(d){const f=+d.f;if(f>G.top+1||!FLOORS[f-1])return;UI.result=null;return enterBattle(FLOORS[f-1]);},
  pick(d){if(!BT||BT.playing)return;const i=+d.i;if(!canPick(BT.B,d.u,i))return;BT.plan[d.u].i=i;BT.focus=d.u;const sk=PETS[uById(BT.B,d.u).ref].skills[i];if(sk.tgt!=='foe')nextFocus();refreshPlan();},
  focus(d){if(!BT||BT.playing)return;const u=uById(BT.B,d.id);if(!u||!u.alive)return;BT.focus=d.id;refreshPlan();},
  target(d){if(!BT||BT.playing)return;const pl=BT.plan[BT.focus];if(!pl)return;pl.target=d.id;BT.lastT[BT.focus]=d.id;const sk=PETS[uById(BT.B,BT.focus).ref].skills[pl.i];if(sk.tgt==='foe')nextFocus();refreshPlan();},
  fight(){if(!BT||BT.playing||BT.B.over)return;BT.plans.push(JSON.parse(JSON.stringify(BT.plan)));const ev=runRound(BT.B,BT.plan);play(ev);},
  speed(){PREF.speed=speed()>=3?1:speed()+1;savePref();const b=$('#spd');if(b)b.textContent='x'+speed();},
  quality(){const l=(FX.Q.level+2)%3;FX.setLevel(l,true);PREF.fxLevel=l;savePref();const b=$('#qbtn');if(b)b.textContent=l===2?'High':l===1?'Medium':'Low';WX.reseed();},
  leave(){leaveBattle();UI.view='tower';render();window.scrollTo(0,0);},
  'try'(d){UI.lastTry=d.id;return enterBattle(sandboxNode(d.id),{sandbox:true,salt:'practice'});},
  'try-again'(){UI.result=null;return enterBattle(sandboxNode(UI.lastTry),{sandbox:true,salt:'practice'+UI.tryN});},
  pet(d){openSheet({type:'pet',id:d.id});},
  async feed(d){
    const o=G.owned[d.id],f=FOODS[d.food],cap=stomach(o.lv),before=fullRatio(o);
    /* a food far bigger than the stomach needs a second tap, it would mostly go to waste */
    if(f.fill-(cap-o.full)>Math.max(cap,f.fill)/2&&UI.feedAsk!==d.food){UI.feedAsk=d.food;render();return;}
    UI.feedAsk=null;
    await action('feed',{id:d.id,food:d.food,n:1});
    render();feedFx(d.id,before);
  },
  async 'feed-auto'(d){const before=fullRatio(G.owned[d.id]);await action('feed',{id:d.id,auto:true});UI.feedAsk=null;render();feedFx(d.id,before);},
  'run-wheel'(d){return wheelRun(d.id);},
  'run-all'(d){if(UI.allAsk!==d.id){UI.allAsk=d.id;render();return;}UI.allAsk=null;return trainRun(d.id);},
  'fast-run'(){PREF.fastRun=!PREF.fastRun;savePref();render();},
  async 'wr-again'(d){await action('feed',{id:d.id,auto:true});const o=G.owned[d.id],b={lv:o.lv,xp:o.xp,power:petPower(petStats(G,d.id))},r=(await action('run',{id:d.id})).r;if(r)wheelShow(d.id,r,b);},
  'wr-shop'(){spinClose();UI.sheet=null;UI.view='shop';render();window.scrollTo(0,0);},
  async branch(d){const o=G.owned[d.id];if(o.star<3)return;await action('branch',{id:d.id,b:o.branch===d.b?null:d.b});render();},
  async 'team-in'(d){if(G.team.length<3&&!G.team.includes(d.id))await action('team',{team:[...G.team,d.id]});render();},
  async 'team-out'(d){if(G.team.length>1)await action('team',{team:G.team.filter(x=>x!==d.id)});render();},
  async 'team-swap'(d){const i=G.team.indexOf(d.out);if(i>=0&&!G.team.includes(d.id)){const t=[...G.team];t[i]=d.id;await action('team',{team:t});}render();},
  async 'team-front'(d){const i=G.team.indexOf(d.id);if(i>0){const t=[...G.team];t[i]=t[0];t[0]=d.id;await action('team',{team:t});render();}},
  gear(d){UI.sheet={type:'gear',id:d.id,slot:d.slot};render();const s=$('.sheet');if(s)s.scrollTop=0;},
  async equip(d){await action('equip',{id:d.id,uid:+d.uid});UI.sheet={type:'pet',id:d.id};render();},
  async unequip(d){await action('unequip',{id:d.id,slot:d.slot});UI.sheet={type:'pet',id:d.id};render();},
  bag(d){return runBatch(bagCfg(+d.n));},
  foodbag(d){return runBatch(foodBagCfg(+d.t,+d.n));},
  'spin-feed'(){spinClose();UI.view='team';openSheet({type:'pet',id:lowestTeamPet()});window.scrollTo(0,0);},
  'to-pantry'(){UI.view='items';UI.invTab='food';render();window.scrollTo(0,0);},
  'to-food-odds'(){UI.view='codex';UI.tab='food';render();window.scrollTo(0,0);},
  chest(d){return runBatch(chestCfg(+d.t,+d.n));},
  'chest-all'(){return runBatch(chestAllCfg());},
  fast(){PREF.fastOpen=!PREF.fastOpen;savePref();render();},
  'spin-skip'(){if(!SP)return;if(SP.wheel){if(SP.fin)SP.fin();return;}if(SP.forge){(SP.anims||[]).forEach(a=>{try{a.finish();}catch(e){}});SP.fin&&SP.fin();return;}SP.anims.forEach(a=>{try{a.finish();}catch(e){}});spinDone();},
  'spin-again'(){if(!SP||!SP.cfg.next)return;const n=SP.cfg.next();SP=null;return runBatch(n);},
  'spin-close'(){spinClose();},
  forge(d){UI.sheet=null;return forgeRun(+d.uid);},
  'forge-again'(d){SP=null;return forgeRun(+d.uid);},
  'sell-t'(d){UI.sell[d.r]=!UI.sell[d.r];UI.sellAsk=false;render();},
  'sell-ask'(){UI.sellAsk=true;render();},
  'sell-no'(){UI.sellAsk=false;render();},
  async 'sell-do'(){const r=await action('sell',{rars:RAR_ORDER.filter(x=>UI.sell[x])});UI.sellAsk=false;render();toast(`Sold ${r.count} items for ${fmt(r.coins)} coins`);},
  'merge-all'(){return forgeAll();},
  inv(d){UI.invTab=d.k;render();},
  more(){UI.limit+=120;render();},
  filter(d){UI.filter=d.k;UI.limit=120;render();},
  item(d){openSheet({type:'item',uid:d.uid});},
  async 'item-sell'(d){const j=await action('sell',{uid:+d.uid});UI.sheet=null;render();toast(`Sold for ${fmt(j.coins)} coins`);},
  async 'equip-from-item'(d){await action('equip',{id:d.id,uid:+d.uid});render();toast(`${PETS[d.id].n} is now wearing it`);},
  tab(d){UI.tab=d.k;render();window.scrollTo(0,0);},
  copy(d){const ok=()=>toast('Copied');const no=()=>{const el=$('#'+d.el);if(el){const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Could not copy, the address is selected instead');}else toast('Could not copy: '+d.t);};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(d.t).then(ok,no);else no();},
  async 'tr-coins'(){await dev('coins');render();toast('Added 10,000 coins');},
  async 'tr-chests'(){await dev('chests');render();toast('Added 38 chests to your inventory');},
  async 'tr-food'(){await dev('food');render();toast('Added 10 of every food');},
  async 'tr-pets'(){await dev('pets');render();toast(`You now own all ${PETS_LIST.length} pets, at 3 stars for testing branches`);},
  async 'tr-sweep'(){await dev('sweep');render();toast('Sweep is available again');},
  async 'tr-jump'(d){const j=await dev('jump',{n:+d.n});UI.block=null;UI.view='tower';UI.sheet=null;render();window.scrollTo(0,0);toast(`Jumped to floor ${G.top+1}, team raised to level ${j.lv}`);},
  'tr-wipe'(){UI.wipeAsk=true;render();},
  'tr-nowipe'(){UI.wipeAsk=false;render();},
  async 'tr-wipe2'(){await dev('wipe');UI.wipeAsk=false;UI.sheet=null;UI.view='tower';UI.block=null;render();window.scrollTo(0,0);toast('Erased, starting again from floor 1');},
};
document.addEventListener('click',e=>{
  if(TIP.long){TIP.long=false;e.preventDefault();e.stopPropagation();return;}
  const chip=e.target.closest&&e.target.closest('.chip[data-tip],.mark img[data-tip],.ord[data-tip]');
  if(chip){tipShow(chip.dataset.tip,chip);clearTimeout(TIP.hide);TIP.hide=setTimeout(tipHide,3200);return;}
  const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
  const f=ACT[t.dataset.act];if(!f)return;
  if(UI.busy&&t.dataset.act!=='close')return;
  let r;try{r=f(t.dataset,t,e);}catch(x){fail(x);return;}
  if(r&&r.then){UI.busy=true;document.documentElement.classList.add('busy');r.catch(fail).finally(()=>{UI.busy=false;document.documentElement.classList.remove('busy');});}
},true);
const activeDialog=()=>$('#overlay [role="dialog"]')||$('.sheet[role="dialog"]');
const dialogButtons=d=>$$('button:not(:disabled),a[href]',d).filter(b=>b.tabIndex>=0&&b.getClientRects().length);
const dialogFocus=new MutationObserver(()=>{
  const d=activeDialog();
  if(d&&!d.contains(document.activeElement)){const b=dialogButtons(d)[0];if(b)b.focus({preventScroll:true});}
});
dialogFocus.observe($('#app'),{childList:true,subtree:true});
dialogFocus.observe($('#overlay'),{childList:true,subtree:true});
document.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    const d=activeDialog();
    if(d){const bs=dialogButtons(d),i=bs.indexOf(document.activeElement);e.preventDefault();if(bs.length)bs[i<0?(e.shiftKey?bs.length-1:0):(i+(e.shiftKey?-1:1)+bs.length)%bs.length].focus({preventScroll:true});return;}
  }
  if(e.key==='Escape'){if(SP){if(SP.done)spinClose();else ACT['spin-skip']();return;}if(UI.sheet){closeSheet();return;}}
  if((e.key==='Enter'||e.key===' ')&&e.target.getAttribute&&e.target.getAttribute('role')==='button'){e.preventDefault();e.target.click();return;}
  if(BT&&!BT.playing&&BT.focus&&['1','2','3'].includes(e.key)){const b=$(`#sk-${BT.focus}-${+e.key-1}`);if(b&&!b.disabled)b.click();}
  if(BT&&!BT.playing&&e.key==='Enter'&&e.target===document.body){ACT.fight();}
});
addEventListener('resize',()=>{if(BT)WX.fit();},{passive:true});
const roundsToRows=r=>r.map(x=>({round:x[0],work:x[1],blocks:x[2],hash:x[3],gap:x[4],t:x[5]}));
async function loadRounds(){
  const r=await api('/api/rounds');
  ROUNDS=r;
  const before=FLOORS.length;
  if(r.rounds.length!==before)FLOORS=buildFloors(roundsToRows(r.rounds));
  return r.rounds.length-before;
}
async function afterLogin(){
  const m=await api('/api/me');
  PLAYER=m.player;G=null;applyState(m.state);
  UI.view='tower';UI.block=null;render();window.scrollTo(0,0);
}
async function boot(){
  FX.init($('#fxc'),speed,()=>{const b=$('#qbtn');const l=FX.Q.level;if(b)b.textContent=l===2?'High':l===1?'Medium':'Low';if(BT)WX.reseed();});
  if(PREF.fxLevel!==undefined)FX.setLevel(PREF.fxLevel,true);
  else if((navigator.deviceMemory&&navigator.deviceMemory<=3)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4))FX.setLevel(1);
  try{
    const [c]=await Promise.all([api('/api/config'),loadRounds()]);
    CFG=c;
    try{await afterLogin();}catch(e){if(e.status===401){UI.view='login';render();}else throw e;}
  }catch(e){
    $('#app').innerHTML=`<main class="login gut"><div class="login-box"><h1>The tower could not open</h1><p>${(e&&e.message)||'Something went wrong'}</p><div class="btns"><button class="btn" onclick="location.reload()">Try again</button></div></div></main>`;
  }
  /* new floors: read through the CDN, so a crowd of players never reaches the database */
  setInterval(async()=>{
    if(BT||SP||!G)return;
    try{const n=await loadRounds();if(n>0){toast(`The hamster ran again, the tower grew by ${n} floor${n>1?'s':''}`);if(UI.view==='tower'&&!UI.sheet)render();}}catch(e){}
  },240000+Math.random()*120000);
}
boot();
