(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.querySelector('.menu-toggle');
  const panel = document.querySelector('#mobile-menu');
  const toggle = document.querySelector('#motion-toggle');
  let off = reduced.matches;
  function setMenu(open) { panel.hidden = !open; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); menu.textContent = open ? '×' : '☰'; }
  menu.addEventListener('click', () => setMenu(panel.hidden));
  panel.addEventListener('click', e => { if(e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !panel.hidden) { setMenu(false); menu.focus(); } });
  matchMedia('(min-width:1081px)').addEventListener('change', e => { if(e.matches) setMenu(false); });
  function motion() { root.classList.toggle('motion-off', off); toggle.textContent = off ? 'Motion off' : 'Motion on'; toggle.setAttribute('aria-pressed', String(off)); if(off) document.getAnimations().forEach(a => a.cancel()); }
  toggle.addEventListener('click', () => { off = !off; motion(); });
  reduced.addEventListener('change', () => { off = reduced.matches; motion(); }); motion();
  // Reuse the original staggered letter wave on the current controls.
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.button,.header nav a,.text-link,.contact-topics button').forEach(control => {
    const label = document.createElement('span');
    label.className = 'button-wave';
    const name = control.textContent.trim().replace(/\s+/g,' ');
    [...control.childNodes].filter(node=>node.nodeType===3).forEach(node => {
      node.textContent.trim().split(/\s+/).forEach((word,index) => {
        if(index) label.append(' ');
        const group = document.createElement('span');
        group.className = 'wave-word';
        [...word].forEach(character => {
          const letter = document.createElement('span');
          letter.className = 'wave-letter'; letter.textContent = character; group.append(letter);
        });
        label.append(group);
      });
      node.remove();
    });
    if(!label.textContent) return;
    if(!control.hasAttribute('aria-label')) control.setAttribute('aria-label',name);
    label.setAttribute('aria-hidden','true');
    control.prepend(label);
    const letters = [...label.querySelectorAll('.wave-letter')];
    const play = () => {
      if(off || reduced.matches || !finePointer.matches) return;
      if(letters.some(letter => letter.getAnimations().length)) return;
      letters.forEach((letter,index) => {
        letter.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(-7px) scale(1.14)',offset:.45},{transform:'translateY(0) scale(1)'}],{duration:480,delay:index*160/Math.max(1,letters.length-1),easing:'cubic-bezier(.22,1,.36,1)'});
      });
    };
    control.addEventListener('pointerenter',play);
    control.addEventListener('focus',play);
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if(performance.getEntriesByType('navigation')[0]?.type === 'reload') { addEventListener('pageshow', () => scrollTo({top:0,behavior:'instant'}), {once:true}); }
  // One-shot section entrances preserve readable content when returning up the page.
  // Heading masks provide their own entrance; never hide their entire parent.
  document.querySelectorAll('.reveal').forEach(el => el.classList.remove('pending'));
  // Reading text stays native and visible; animate cards and imagery only.
  root.classList.add('motion-ready');
  const ticker = document.querySelector('.ticker>div');
  let tickerVisible = true;
  const pauseTicker = () => {ticker.style.animationPlayState = tickerVisible && !document.hidden ? 'running' : 'paused';};
  new IntersectionObserver(entries => {tickerVisible=entries[0].isIntersecting; pauseTicker();}).observe(ticker.parentElement);
  document.addEventListener('visibilitychange', pauseTicker);
  const slides = [...document.querySelectorAll('.process-slide')];
  const buttons = [...document.querySelectorAll('[data-step]')];
  let active = 0;
  function showStep(i) {
    active = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide,index) => { slide.hidden = index !== active; });
    buttons.forEach(button => {button.disabled = (Number(button.dataset.step) < 0 && active === 0) || (Number(button.dataset.step) > 0 && active === slides.length - 1);});
    document.querySelector('.process-counter').textContent = `0${active+1} / 04`;
    document.querySelector('.process-track i').style.width = `${(active+1)*25}%`;
    if(!off) { const copy = slides[active].querySelector('.process-copy'); copy.getAnimations().forEach(a=>a.cancel()); copy.animate([{opacity:.3,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'}); }
  }
  buttons.forEach(button => button.addEventListener('click', () => showStep(active + Number(button.dataset.step)))); showStep(0);
  document.querySelectorAll('.contact-topics button').forEach(button => button.addEventListener('click', () => {document.querySelectorAll('.contact-topics button').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); document.querySelector('.enquiry').href='mailto:laxman@ftresolver.com?subject='+encodeURIComponent(button.textContent);}));
  // Progress-linked motion stays visible throughout the viewport entry, including touch scrolling.
  const travelNodes = [...document.querySelectorAll('.service-card,.milestone,.metric-bars article,.partner-grid>span,.contact-card')];
  travelNodes.forEach(node => {node.classList.remove('reveal','pending'); node.classList.add('scroll-card');});
  const cardGroups=[document.querySelector('.service-grid'),document.querySelector('.timeline')];
  const cardLayout=new Map();
  const pageTop=node=>{let top=0;for(let parent=node;parent;parent=parent.offsetParent)top+=parent.offsetTop;return top;};
  function measureCards(){
    // Sticky offsets are visual; cache the natural flow positions before enabling stacks.
    cardGroups.forEach(group=>{group.classList.remove('stack-enabled');group.classList.add('stack-measuring');});
    const measurements=cardGroups.map(group=>[group,[...group.children].map(node=>({node,top:pageTop(node),height:node.offsetHeight}))]);
    measurements.forEach(([group,cards])=>{
      cards.forEach((card,index)=>{
        cardLayout.set(card.node,{...card,index,next:cards[index+1]?.top});
        card.node.style.setProperty('--card-order',index);
        card.node.style.setProperty('--stack-top',`${104+index*8}px`);
      });
      group.classList.toggle('stack-enabled',!off && cards.every(card=>card.height<innerHeight-150));
    });
    const flow=cardGroups.flatMap(group=>[...group.children].map(node=>({node,top:pageTop(node)})));
    flow.forEach(({node,top})=>{cardLayout.get(node).top=top;node.style.setProperty('--covered',0);});
    cardGroups.forEach(group=>{
      [...group.children].forEach((node,index)=>{cardLayout.get(node).next=cardLayout.get(group.children[index+1])?.top;});
      group.classList.remove('stack-measuring');
    });
  }
  measureCards();
  addEventListener('resize',measureCards,{passive:true});
  toggle.addEventListener('click',measureCards);reduced.addEventListener('change',measureCards);
  document.fonts.ready.then(()=>{measureCards();schedule();});
  const images = [...document.querySelectorAll('.card-image img,.feature-media>img,.cta-image>img')];
  images.forEach(image => image.classList.add('scroll-image'));
  const moving = new Set();
  const travelObserver = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting)moving.add(entry.target);else moving.delete(entry.target); schedule();}),{rootMargin:'150px'});
  [...travelNodes,...images].forEach(node=>travelObserver.observe(node));
  const clamp = value => Math.max(0,Math.min(1,value));
  function updateTravel() {
    // Read every position before writing styles to avoid forced layouts during touch scrolling.
    const updates = [...moving].map(node => {
      let layoutTop=cardLayout.get(node)?.top??pageTop(node);
      if(node.classList.contains('scroll-image')) {
        const host=node.parentElement.getBoundingClientRect();
        const progress=clamp((innerHeight-host.top)/(innerHeight+host.height));
        return [node,'--pan',off?'0px':`${(progress-.5)*Math.min(host.height*.6,320)}px`];
      }
      const card=cardLayout.get(node);
      const stagger=node.classList.contains('service-card') && innerWidth>700?(card?.index||0)*.09:0;
      const progress=off?1:clamp((innerHeight-(layoutTop-scrollY))/(innerHeight*.7)-stagger);
      if(card?.next && node.parentElement.classList.contains('stack-enabled')) {
        const cover=off?0:clamp((scrollY+160-card.next)/(innerHeight*.4));
        return [node,'--travel',progress.toFixed(3),cover];
      }
      return [node,'--travel',progress.toFixed(3)];
    });
    updates.forEach(([node,key,value,cover])=>{
      node.style.setProperty(key,value);
      if(cover!==undefined)node.style.setProperty('--covered',cover.toFixed(3));
    });
  }
  const links = [...document.querySelectorAll('.header nav a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  let frame = 0;
  function position() { frame=0; updateTravel(); let current=sections[0]; sections.forEach(section=>{if(section.getBoundingClientRect().top<=150)current=section;}); links.forEach(link=>{if(link.hash==='#'+current.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}); }
  function schedule(){if(!frame)frame=requestAnimationFrame(position);}
  addEventListener('scroll',schedule,{passive:true}); addEventListener('resize',schedule,{passive:true}); toggle.addEventListener('click',schedule); reduced.addEventListener('change',schedule); position();
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
