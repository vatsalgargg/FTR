(() => {
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');let off=reduced.matches, smoothScroll=null;root.classList.add('studio-ready');
 const menu=document.querySelector('.n-menu'),mobile=document.querySelector('.n-mobile');
 function setMenu(open){mobile.hidden=!open;menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu')}
 menu.addEventListener('click',()=>setMenu(mobile.hidden));mobile.addEventListener('click',e=>{if(e.target.closest('a'))setMenu(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobile.hidden){setMenu(false);menu.focus()}});
 matchMedia('(min-width:1101px)').addEventListener('change',e=>{if(e.matches)setMenu(false)});
 const motion=document.querySelector('#motion-toggle');function updateMotion(){
 if(off){smoothScroll?.destroy();smoothScroll=null;document.getAnimations().forEach(animation=>animation.cancel());}
 else if(!smoothScroll&&window.Lenis){smoothScroll=new Lenis({smoothWheel:true,duration:1.2,infinite:false,orientation:'vertical',gestureOrientation:'vertical',autoRaf:true,autoToggle:true,anchors:{offset:-90},allowNestedScroll:true,syncTouch:false,stopInertiaOnNavigate:true});}
 root.classList.toggle('motion-off',off);root.classList.toggle('js-motion',!off);motion.textContent=off?'Motion off':'Motion on';motion.setAttribute('aria-pressed',String(off));document.dispatchEvent(new Event('ftr-motion-change'));schedule()}
 motion.addEventListener('click',()=>{off=!off;updateMotion()});reduced.addEventListener('change',()=>{off=reduced.matches;updateMotion()});
 const panels=[...document.querySelectorAll('.service-panel')];panels.forEach(panel=>panel.querySelector('button').addEventListener('click',()=>{panels.forEach(p=>{const active=p===panel;p.classList.toggle('is-open',active);p.querySelector('button').setAttribute('aria-expanded',String(active));p.querySelector('button b').textContent=active?'−':'+';p.querySelector('.service-body').setAttribute('aria-hidden',String(!active))});}));panels.forEach((p,i)=>p.querySelector('.service-body').setAttribute('aria-hidden',String(i!==0)));
 const steps=[...document.querySelectorAll('.process-steps details')];steps.forEach(step=>step.addEventListener('toggle',()=>{if(step.open)steps.forEach(other=>{if(other!==step)other.open=false})}));
 document.querySelectorAll('.enquiry-topics button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.enquiry-topics button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelector('.enquiry').href='mailto:laxman@ftresolver.com?subject='+encodeURIComponent(button.textContent)}));

 // Measured from Nocta: first word lit, remaining words scrub between start 75% and start 15%.
 const reader=document.querySelector('[data-reading]');
 const words=reader.textContent.trim().split(/\s+/);
 reader.setAttribute('aria-label',reader.textContent);reader.replaceChildren();
 words.forEach(word=>{const span=document.createElement('span');span.className='read-word';span.textContent=word+'\u00a0';span.setAttribute('aria-hidden','true');reader.append(span)});
 const spans=[...reader.children],clamp=value=>Math.min(1,Math.max(0,value));
 // Reveal complete section groups once, with the reference's 15% visibility threshold.
 document.querySelectorAll('.section-title [data-reveal]').forEach(el=>el.removeAttribute('data-reveal'));
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target)}}),{threshold:.15});
 document.querySelectorAll('[data-reveal]').forEach(el=>observer.observe(el));
 const header=document.querySelector('.n-header'),images=[...document.querySelectorAll('.project-card')];let frame=0;
 function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(draw)}
 function draw(){
  frame=0;const vh=innerHeight;header.classList.toggle('compact',scrollY>60);
  const r=reader.getBoundingClientRect(),progress=clamp((vh*.75-r.top)/(vh*.6));
  const light=root.dataset.theme==='light';
  const from=light?[151,151,151]:[120,120,120],to=light?[25,25,25]:[255,255,255];
  spans.forEach((span,i)=>{const amount=off||i===0?1:clamp(progress*spans.length-i);const rgb=from.map((channel,j)=>Math.round(Math.sqrt(channel*channel+(to[j]*to[j]-channel*channel)*amount)));span.style.color='rgb('+rgb.join(',')+')'});
  images.forEach(card=>{const box=card.getBoundingClientRect();if(box.bottom>=-100&&box.top<=vh+100||off){const progress=clamp((vh-box.top)/(vh+box.height));card.style.setProperty('--image-y',(off?0:(progress-.5)*.7*box.height).toFixed(3)+'px')}});
 }
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 document.addEventListener('visibilitychange',schedule);
 new ResizeObserver(schedule).observe(reader);
 new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-theme']});
 document.fonts.ready.then(schedule);updateMotion();
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  // Reference counter: zero to final value, 1 second, easeIn, replay on re-entry.
  const counters=[...document.querySelectorAll('[data-count],.journey-card strong')].map(el=>({el,end:Number(el.dataset.count||el.textContent),start:null,visible:false})).filter(item=>Number.isFinite(item.end));
  counters.forEach(({el,end})=>{el.setAttribute('aria-label',String(end));});
  let countFrame=0;
  const easeIn=t=>{let lo=0,hi=1,u=t;for(let i=0;i<12;i++){u=(lo+hi)/2;const x=3*.42*(1-u)*(1-u)*u+3*(1-u)*u*u+u*u*u;if(x<t)lo=u;else hi=u;}return 3*(1-u)*u*u+u*u*u;};
  function renderCounts(now){countFrame=0;let running=false;for(const item of counters){if(!item.visible||item.start===null)continue;const t=Math.min(1,(now-item.start)/1000);item.el.textContent=String(Math.round(item.end*easeIn(t)));if(t<1)running=true;else item.start=null;}if(running)countFrame=requestAnimationFrame(renderCounts);}
  const countObserver=new IntersectionObserver(entries=>{for(const entry of entries){const item=counters.find(c=>c.el===entry.target);item.visible=entry.isIntersecting;if(off){item.el.textContent=String(item.end);continue;}if(item.visible){item.start=performance.now();item.el.textContent='0';}else{item.start=null;item.el.textContent=String(item.end);}}if(!off&&!countFrame)countFrame=requestAnimationFrame(renderCounts);},{threshold:.25});
  counters.forEach(item=>countObserver.observe(item.el));
  document.addEventListener('ftr-motion-change',()=>{cancelAnimationFrame(countFrame);countFrame=0;for(const item of counters){item.start=null;item.el.textContent=String(item.end);}});
  // Original letter wave; complete the wave when moving to the next control.
  document.querySelectorAll('.n-button,.button,.n-header nav a,.enquiry-topics button').forEach(control=>{
    const text=[...control.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    if(!text)return;
    if(!control.hasAttribute('aria-label'))control.setAttribute('aria-label',text);
    const label=document.createElement('span');label.className='button-wave';label.setAttribute('aria-hidden','true');
    text.split(/\s+/).forEach((word,index)=>{
      if(index)label.append(' ');
      const group=document.createElement('span');group.className='wave-word';
      [...word].forEach(character=>{const letter=document.createElement('span');letter.className='wave-letter';letter.textContent=character;group.append(letter)});
      label.append(group);
    });
    [...control.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());control.prepend(label);
    const letters=[...label.querySelectorAll('.wave-letter')];
    const play=()=>{
      if(off||reduced.matches||!finePointer.matches||letters.some(letter=>letter.getAnimations().length))return;
      letters.forEach((letter,index)=>letter.animate([
        {transform:'translateY(0) scale(1)'},
        {transform:'translateY(-7px) scale(1.14)',offset:.45},
        {transform:'translateY(0) scale(1)'}
      ],{duration:480,delay:index*160/Math.max(1,letters.length-1),easing:'cubic-bezier(.22,1,.36,1)'}));
    };
    control.addEventListener('pointerenter',play);control.addEventListener('focus',play);
  });
  const metal = document.querySelector('.metal-panel');
  if(metal) {
    metal.classList.add('footer-waiting');
    const footerObserver = new IntersectionObserver(entries => {
      if(entries[0].isIntersecting){metal.classList.remove('footer-waiting');footerObserver.disconnect();}
    },{threshold:.12});
    footerObserver.observe(metal);
    let metalFrame=0, pointerX=0, pointerY=0;
    metal.addEventListener('pointermove',event=>{
      if(off || reduced.matches || !finePointer.matches)return;
      pointerX=event.clientX;pointerY=event.clientY;
      if(metalFrame)return;
      metalFrame=requestAnimationFrame(()=>{
        metalFrame=0;
        const rect=metal.getBoundingClientRect(), x=pointerX-rect.left,y=pointerY-rect.top;
        metal.style.setProperty('--metal-x',`${x}px`);metal.style.setProperty('--metal-y',`${y}px`);
        metal.style.setProperty('--metal-angle',`${Math.atan2(y-rect.height/2,x-rect.width/2)*180/Math.PI+90}deg`);
      });
    },{passive:true});
  }
})();
