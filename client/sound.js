/* SOUND: every effect is synthesized here, so there are no files to download and nothing to license.
   Browsers keep audio off until the first click or key press, so nothing plays before that */
const SND=(()=>{
  const VOL=2,GAP={hover:70,tick:24,hit:45,dot:60,cast:60,swing:60,st:70,buff:70,debuff:70,rage:120,levelup:220,coin:50,tap:30},last={};
  let ctx=null,out=null,noise=null,loop=null,voices=0,wasOn=false;
  const on=()=>PREF.sound!==false;
  function wire(c,dest){
    const comp=c.createDynamicsCompressor();
    comp.threshold.value=-16;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.14;
    const g=c.createGain();g.gain.value=VOL;g.connect(comp);comp.connect(dest);
    const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    ctx=c;out=g;noise=b;
  }
  function unlock(){
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{const c=new AC();wire(c,c.destination);}catch(e){return;}}
    if(ctx.state==='suspended'&&!document.hidden)ctx.resume().catch(()=>{});
  }
  const shape=(g,t,a,d,peak)=>{g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);};
  const done=n=>{voices++;n.onended=()=>{voices--;};};
  function tone(f,d,o){
    o=o||{};if(voices>40)return;
    const t=ctx.currentTime+(o.at||0),a=o.a||.004,s=ctx.createOscillator(),g=ctx.createGain();
    s.type=o.type||'sine';s.frequency.setValueAtTime(f,t);if(o.to)s.frequency.exponentialRampToValueAtTime(o.to,t+a+d);
    shape(g,t,a,d,o.g||.2);s.connect(g);g.connect(out);done(s);s.start(t);s.stop(t+a+d+.02);
  }
  function hiss(d,o){
    o=o||{};if(voices>40)return;
    const t=ctx.currentTime+(o.at||0),a=o.a||.004,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    s.buffer=noise;f.type=o.ft||'bandpass';f.Q.value=o.q||1;f.frequency.setValueAtTime(o.f||1800,t);if(o.to)f.frequency.exponentialRampToValueAtTime(o.to,t+a+d);
    shape(g,t,a,d,o.g||.1);s.connect(f);f.connect(g);g.connect(out);done(s);s.start(t,Math.random()*.7,a+d+.02);
  }
  const midi=n=>440*Math.pow(2,(n-69)/12);
  const run=(notes,gap,o)=>notes.forEach((n,i)=>tone(midi(n),o.d||.14,Object.assign({},o,{at:(o.at||0)+i*gap})));
  const shimmer=(at,g)=>[0,1,2,3].forEach(i=>tone(2200+i*520,.2,{g:g||.016,at:at+i*.045}));
  const thump=(g,at)=>tone(150,.1,{to:55,g,at:at||0});
  const CAST={
    seed(){tone(392,.16,{to:784,type:'triangle',g:.1});hiss(.1,{f:2600,q:2,g:.03,at:.03});},
    dream(){tone(740,.28,{to:1100,g:.07});tone(1110,.24,{to:1480,g:.05,at:.04});},
    spark(){tone(1700,.12,{to:420,type:'sawtooth',g:.05});hiss(.08,{f:5200,q:.8,g:.06});},
    water(){tone(320,.09,{to:900,g:.12});tone(420,.09,{to:1100,g:.1,at:.08});},
    steel(){tone(1320,.1,{type:'square',g:.03});tone(2030,.14,{g:.06});hiss(.05,{f:4200,q:1.4,g:.05});},
  };
  const EL_NOTE={seed:60,dream:64,spark:67,water:62,steel:69};
  const S={
    hover(){tone(1250,.03,{g:.03,type:'triangle'});},
    tap(){tone(660,.05,{to:520,g:.07,type:'triangle'});},
    deny(){tone(200,.09,{type:'square',g:.04});tone(150,.12,{type:'square',g:.04,at:.1});},
    go(){hiss(.16,{f:500,to:3200,q:.8,g:.14});tone(150,.12,{to:300,g:.16,type:'triangle'});},
    swing(){hiss(.13,{f:900,to:3600,q:1.2,g:.34});},
    cast(el){(CAST[el]||CAST.seed)();},
    ult(){hiss(.42,{f:400,to:5000,q:.9,g:.1,a:.2});tone(220,.42,{to:880,type:'sawtooth',g:.035,a:.15});[196,294,392].forEach(f=>tone(f,.7,{g:.09,at:.44,type:'triangle'}));},
    hit(o){
      o=o||{};
      if(o.shield){tone(2100,.08,{g:.06});tone(3200,.05,{g:.04});return;}
      thump(o.crit?.3:.22);hiss(.06,{f:o.weak?1200:o.eff?3400:2400,q:.7,g:o.crit?.16:.11});
      if(o.crit){tone(1400,.12,{to:900,g:.07,type:'triangle'});hiss(.1,{f:5200,q:1,g:.05,at:.02});}
    },
    dot(){tone(320,.05,{to:220,g:.05,type:'triangle'});},
    heal(){run([76,79,84],.05,{g:.05,d:.12});},
    buff(){run([72,76],.05,{g:.04,d:.09,type:'triangle'});},
    debuff(){run([70,65],.05,{g:.04,d:.09,type:'triangle'});},
    whiff(){hiss(.12,{f:3000,to:1200,q:1.4,g:.18});},
    shield(){tone(1500,.1,{g:.05});tone(2250,.14,{g:.03,at:.02});},
    fall(){tone(420,.3,{to:90,type:'triangle',g:.1});hiss(.2,{f:500,q:.8,g:.05,at:.04});},
    bossfall(){thump(.34);hiss(.5,{ft:'lowpass',f:1400,to:90,g:.26});tone(210,.6,{to:50,type:'triangle',g:.14});},
    revive(){run([67,72,76,84],.07,{g:.06,d:.16,type:'triangle'});},
    charge(){tone(110,.42,{to:330,type:'sawtooth',g:.03,a:.2});hiss(.4,{f:600,to:2600,q:1.6,g:.04,a:.2});},
    phase(){thump(.3);tone(392,.16,{type:'square',g:.03,at:.06});tone(311,.2,{type:'square',g:.03,at:.24});},
    react(p){p=p||{};tone(midi(EL_NOTE[p.a]||60),.3,{g:.08,type:'triangle'});tone(midi((EL_NOTE[p.b]||67)+12),.3,{g:.07,type:'triangle',at:.05});thump(.2,.04);shimmer(.08);},
    boom(){hiss(.34,{ft:'lowpass',f:1300,to:110,g:.26});tone(90,.28,{to:40,g:.22});},
    zap(){tone(2000,.12,{to:300,type:'sawtooth',g:.09});hiss(.1,{f:6000,q:.9,g:.1});},
    rage(){tone(520,.08,{to:880,g:.04,type:'triangle'});},
    win(){run([72,76,79,84],.1,{g:.09,d:.18,type:'triangle'});[72,76,79].forEach(n=>tone(midi(n+12),.55,{g:.05,at:.42}));shimmer(.48,.02);},
    lose(){run([67,63,60],.17,{g:.07,d:.26,type:'triangle'});},
    coin(){tone(1976,.05,{g:.05,type:'triangle'});tone(2637,.14,{g:.05,type:'triangle',at:.05});},
    coins(){[0,.07,.14,.22,.3].forEach((at,i)=>{tone(1800+i*130,.05,{g:.04,type:'triangle',at});tone(2500+i*130,.12,{g:.035,type:'triangle',at:at+.04});});},
    clink(){tone(1760,.06,{g:.04});tone(2600,.1,{g:.03,at:.03});hiss(.03,{f:3800,q:1.2,g:.03});},
    tick(){tone(1500,.012,{type:'square',g:.04});},
    stop(){tone(900,.05,{to:700,g:.09,type:'triangle'});},
    shake(){[0,.12,.24,.36].forEach(at=>hiss(.07,{f:1300,q:1.1,g:.2,at}));},
    rev_n(){tone(520,.1,{to:780,g:.17,type:'triangle'});},
    rev_r(){run([72,79],.07,{g:.08,d:.14,type:'triangle'});shimmer(.1,.012);},
    rev_e(){run([72,76,79,83],.08,{g:.08,d:.18,type:'triangle'});shimmer(.2,.02);},
    rev_l(){thump(.2);run([72,76,79,84,88],.09,{g:.09,d:.22,type:'triangle'});[72,79,84].forEach(n=>tone(midi(n+12),.8,{g:.05,at:.46}));shimmer(.4,.026);},
    hammer(){thump(.16);tone(1200,.09,{type:'square',g:.025});tone(1850,.14,{g:.05});hiss(.04,{f:3000,g:.1});},
    forgeok(){run([76,79,84,88],.07,{g:.08,d:.18,type:'triangle'});shimmer(.2,.02);},
    forgeno(){thump(.22);tone(240,.3,{to:110,type:'triangle',g:.09,at:.03});},
    munch(){[0,.07,.15].forEach((at,i)=>hiss(.05,{f:1100+i*300,q:1.6,g:.2,at}));},
    full(){run([79,84],.08,{g:.07,d:.16,type:'triangle'});},
    levelup(){run([72,79,84,88],.06,{g:.08,d:.16,type:'triangle'});shimmer(.2,.02);},
    luck(n){n=n===undefined?1:n;if(n===0){run([65,62],.1,{g:.06,d:.14,type:'triangle'});return;}if(n===1){tone(660,.12,{to:880,g:.16,type:'triangle'});return;}if(n===2){run([72,79],.07,{g:.08,d:.14,type:'triangle'});return;}if(n===3){run([72,76,79,84],.06,{g:.08,d:.14,type:'triangle'});return;}S.rev_l();},
    /* the wheel hum: climbs with the run, then eases off. Runs until stopLoop */
    whirr(o){
      o=o||{};const d=o.d||2.6,hot=!!o.hot,t=ctx.currentTime,s=ctx.createOscillator(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain(),n=ctx.createBufferSource(),nf=ctx.createBiquadFilter(),ng=ctx.createGain();
      s.type='triangle';s.frequency.setValueAtTime(60,t);s.frequency.linearRampToValueAtTime(hot?240:170,t+d*.6);s.frequency.linearRampToValueAtTime(hot?170:110,t+d);
      lfo.type='square';lfo.frequency.setValueAtTime(6,t);lfo.frequency.linearRampToValueAtTime(hot?34:22,t+d*.6);lfo.frequency.linearRampToValueAtTime(10,t+d);lg.gain.value=.016;
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.04,t+.18);
      n.buffer=noise;n.loop=true;nf.type='bandpass';nf.Q.value=.8;nf.frequency.setValueAtTime(500,t);nf.frequency.linearRampToValueAtTime(hot?2400:1600,t+d*.6);
      ng.gain.setValueAtTime(.0001,t);ng.gain.linearRampToValueAtTime(.022,t+.2);
      lfo.connect(lg);lg.connect(g.gain);s.connect(g);g.connect(out);n.connect(nf);nf.connect(ng);ng.connect(out);
      const end=t+d+1;[s,lfo,n].forEach(x=>{x.start(t);x.stop(end);});
      const c=ctx;
      loop={stop(){try{const q=c.currentTime;g.gain.cancelScheduledValues(q);ng.gain.cancelScheduledValues(q);g.gain.setTargetAtTime(.0001,q,.03);ng.gain.setTargetAtTime(.0001,q,.03);[s,lfo,n].forEach(x=>x.stop(q+.2));}catch(e){}}};
    },
  };
  function play(name,arg){
    if(!ctx||!on()||ctx.state!=='running')return;
    const t=performance.now();
    if(t-(last[name]||0)<(GAP[name]||25))return;
    last[name]=t;
    try{S[name](arg);}catch(e){}
  }
  function stopLoop(){if(loop){loop.stop();loop=null;}}
  /* draws one sound into a silent context, so a test can measure it without speakers */
  function renderInto(c,name,arg){const k=[ctx,out,noise,loop];wire(c,c.destination);S[name](arg);if(name==='whirr')loop=null;[ctx,out,noise,loop]=k;}
  ['pointerdown','pointerup','touchend','click','keydown'].forEach(n=>document.addEventListener(n,unlock,{capture:true,passive:true}));
  document.addEventListener('visibilitychange',()=>{
    if(!ctx)return;
    if(document.hidden){wasOn=ctx.state==='running';ctx.suspend().catch(()=>{});}
    else if(wasOn)ctx.resume().catch(()=>{});
  });
  return {play,stopLoop,renderInto,on,names:()=>Object.keys(S),state:()=>ctx?ctx.state:'none'};
})();
