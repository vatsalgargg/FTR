if('scrollRestoration'in history)history.scrollRestoration='manual';scrollTo(0,0);addEventListener('pageshow',()=>scrollTo(0,0));
const root=document.documentElement,menu=document.querySelector('.menu-toggle'),panel=document.querySelector('.menu-panel'),motionButton=document.querySelector('#motion-toggle'),hero=document.querySelector('.hero'),header=document.querySelector('.header'),progress=document.querySelector('.scroll-progress'),reduced=matchMedia('(prefers-reduced-motion: reduce)');let motionOff=reduced.matches,frame=0,lastToneY=-1;
function setMenu(open){menu.setAttribute('aria-expanded',open);menu.setAttribute('aria-label',open?'Close menu':'Open menu');panel.inert=!open;panel.classList.toggle('open',open)}menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));panel.addEventListener('click',e=>{if(e.target.closest('a'))setMenu(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
function updateGlassTone(){if(!header)return;const y=Math.min(innerHeight-1,header.getBoundingClientRect().bottom+14),surface=document.elementsFromPoint(innerWidth/2,y).map(el=>el.closest('section,footer')).find(Boolean);header.classList.toggle('glass-light',Boolean(surface?.classList.contains('surface')))}function draw(){frame=0;const max=root.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max?scrollY/max:0})`;if(Math.abs(scrollY-lastToneY)>16){lastToneY=scrollY;updateGlassTone()}}function schedule(){if(!frame)frame=requestAnimationFrame(draw)}addEventListener('scroll',schedule,{passive:true});addEventListener('resize',()=>{lastToneY=-1;schedule()},{passive:true});
function setMotion(){root.classList.toggle('motion-off',motionOff);motionButton.textContent=motionOff?'MOTION OFF ○':'MOTION ON ◉';motionButton.setAttribute('aria-pressed',motionOff);schedule()}motionButton.addEventListener('click',()=>{motionOff=!motionOff;setMotion()});reduced.addEventListener('change',e=>{motionOff=e.matches;setMotion()});
document.querySelectorAll('.nav-links>a,.pill,.plain-link,footer a').forEach(el=>{if(el.dataset.wave)return;el.dataset.wave='1';const nodes=[...el.childNodes];el.textContent='';const label=document.createElement('span');label.className='pill-label';nodes.forEach(n=>{if(n.nodeType===3){for(const c of n.textContent.trim()){const s=document.createElement('span');s.className='wl';s.textContent=c===' '?' ':c;label.append(s)}}else el.append(n)});if(label.childNodes.length)el.prepend(label);el.addEventListener('mouseenter',()=>{if(motionOff||reduced.matches)return;el.querySelectorAll('.wl').forEach((s,i)=>s.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(-7px) scale(1.14)',offset:.45},{transform:'translateY(0) scale(1)'}],{duration:500,delay:i*35}))})});
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const c=e.target.querySelector('[data-count]');if(c&&!c.dataset.done){c.dataset.done='1';const end=Number(c.dataset.count),start=performance.now();const tick=now=>{const t=Math.min(1,(now-start)/1500);c.textContent=Math.round(end*(1-(1-t)**4));if(t<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}observer.unobserve(e.target)}}),{threshold:.3});document.querySelectorAll('.stats').forEach(e=>observer.observe(e))}setMotion();

// Add a lightweight reveal only after the static page has rendered, keeping no-JS content visible.
const revealTargets=[...document.querySelectorAll('.section-pad h2,.section-top>p,.about-grid p,.contact-grid>div,.timeline article,.service-grid article')];
if(!reduced.matches&&'IntersectionObserver'in window){const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal-visible');revealObserver.unobserve(entry.target)}}),{threshold:.14,rootMargin:'0px 0px -7%'});revealTargets.forEach((element,index)=>{element.classList.add('reveal');if(index%3===1)element.classList.add('reveal-delay-1');if(index%3===2)element.classList.add('reveal-delay-2');revealObserver.observe(element)})}

// Manage graceful custom preloader dismiss
(() => {
  const loader = document.getElementById('ftr-loader');
  if (!loader) return;
  const hideLoader = () => {
    if (loader.classList.contains('loader-hide')) return;
    loader.classList.add('loader-hide');
    setTimeout(() => {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 700);
  };

  // Dismiss on window load with slight delay so user perceives smooth transition
  if (document.readyState === 'complete') {
    setTimeout(hideLoader, 450);
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 450));
    // Safe fallback in case any slow external resource holds up 'load'
    setTimeout(hideLoader, 2000);
  }
})();

// Start after the loader exits so the hero promise is visibly written on screen.
(()=>{const el=document.querySelector('[data-typewriter]');if(!el||reduced.matches)return;const text=el.dataset.typewriter||el.textContent.trim();const start=()=>setTimeout(()=>{let index=0;el.textContent='';el.classList.add('is-typing');const type=()=>{el.textContent=text.slice(0,index);if(index<text.length){index+=1;setTimeout(type,52)}else el.classList.remove('is-typing')};type()},1200);document.readyState==='complete'?start():addEventListener('load',start,{once:true})})();
// Headline motion plays only while travelling down the page; reverse travel keeps copy stable.
(()=>{if(reduced.matches||!('IntersectionObserver'in window))return;const headings=[...document.querySelectorAll('main h1,main h2,main h3')];let lastY=scrollY,direction='initial';addEventListener('scroll',()=>{const nextY=scrollY;if(Math.abs(nextY-lastY)>2)direction=nextY>lastY?'down':'up';lastY=nextY},{passive:true});const makeTypingHeading=heading=>{if(heading.dataset.headingTyped)return;heading.dataset.headingTyped='1';const label=heading.textContent.replace(/\s+/g,' ').trim();heading.setAttribute('aria-label',label);const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);const nodes=[];let node;while(node=walker.nextNode())nodes.push(node);let character=0;nodes.forEach(textNode=>{const fragment=document.createDocumentFragment();[...textNode.textContent].forEach(char=>{const letter=document.createElement('span');letter.className='type-char';letter.style.setProperty('--type-delay',`${Math.min(character++*14,650)}ms`);letter.textContent=char===' '?' ':char;fragment.append(letter)});textNode.replaceWith(fragment)});heading.classList.add('typing-heading')};const showWithoutMotion=heading=>{heading.classList.add('typing-no-motion','typing-active');requestAnimationFrame(()=>heading.classList.remove('typing-no-motion'))};headings.forEach(makeTypingHeading);const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const heading=entry.target;if(entry.isIntersecting){if(direction==='down'){heading.classList.remove('typing-no-motion','typing-active');requestAnimationFrame(()=>heading.classList.add('typing-active'))}else showWithoutMotion(heading)}else if(direction==='down'){heading.classList.remove('typing-active')}}),{threshold:.45,rootMargin:'0px 0px -8%'});const begin=()=>setTimeout(()=>headings.forEach(heading=>observer.observe(heading)),1200);document.readyState==='complete'?begin():addEventListener('load',begin,{once:true})})();
