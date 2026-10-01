(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const header = document.querySelector('.header');
  const menu = document.querySelector('.menu-toggle');
  const panel = document.querySelector('.menu-panel');
  const motion = document.querySelector('#motion-toggle');
  let off = reduced.matches;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const reset = () => scrollTo({top:0,left:0,behavior:'instant'});
  if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    reset(); addEventListener('pageshow', reset, {once:true});
  }
  document.querySelector('#ftr-loader')?.remove();
  function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    panel.inert = !open; panel.classList.toggle('open',open);
  }
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', event => {if(event.target.closest('a'))setMenu(false)});
  document.addEventListener('keydown', event => {if(event.key==='Escape'){setMenu(false);menu.focus()}});
  function setMotion() {
    root.classList.toggle('motion-off', off);
    if (!motion) return;
    motion.textContent = off ? 'MOTION OFF ○' : 'MOTION ON ◉';
    motion.setAttribute('aria-pressed', String(off));
  }
  motion?.addEventListener('click',()=>{off=!off;setMotion()});
  reduced.addEventListener('change',()=>{off=reduced.matches;setMotion()}); setMotion();
  // Restore the original letter wave without changing link names or word wrapping.
  document.querySelectorAll('.nav-links>a,.pill,.plain-link').forEach(link=>{
    const label=document.createElement('span');label.className='pill-label';
    [...link.childNodes].filter(node=>node.nodeType===3).forEach(node=>{
      const words=node.textContent.trim().split(/\s+/);
      words.forEach((word,index)=>{
        if(index)label.append(' ');
        const group=document.createElement('span');group.className='wave-word';
        [...word].forEach(character=>{const letter=document.createElement('span');letter.className='wl';letter.textContent=character;group.append(letter)});
        label.append(group);
      });
      node.remove();
    });
    if(!label.textContent)return;
    link.prepend(label);
    const play=()=>{
      if(off||!fine.matches)return;
      link.querySelectorAll('.wl').forEach((letter,index)=>{
        letter.getAnimations().forEach(animation=>animation.cancel());
        letter.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(-7px) scale(1.14)',offset:.45},{transform:'translateY(0) scale(1)'}],{duration:500,delay:index*35});
      });
    };
    link.addEventListener('pointerenter',play);
    link.addEventListener('focus',play);
  });
  document.querySelectorAll('.service-grid article').forEach((card,i)=>{
    card.style.setProperty('--card-index',i);
    const art=document.createElement('div');art.className='service-art';art.setAttribute('aria-hidden','true');
    art.innerHTML='<div class="circuit-stack"><i></i><i></i><i></i><b>'+['IT','SYS','OPS','AMC'][i]+'</b></div>';
    card.append(art);
    let frame=0,x=0,y=0;
    card.addEventListener('pointermove',event=>{
      if(off||!fine.matches)return;
      const box=card.getBoundingClientRect();x=(event.clientX-box.left)/box.width-.5;y=(event.clientY-box.top)/box.height-.5;
      if(!frame)frame=requestAnimationFrame(()=>{frame=0;art.style.setProperty('--rx',(-y*12)+'deg');art.style.setProperty('--ry',(x*16)+'deg')});
    },{passive:true});
    card.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);frame=0;art.style.setProperty('--rx','0deg');art.style.setProperty('--ry','0deg')});
  });
  let frame=0,lastY=scrollY,direction=1;
  function draw(){
    frame=0;
    const y=scrollY;direction=y>=lastY?1:-1;lastY=y;
    // A small dead band avoids flicker when scrolling near the top edge.
    header.classList.toggle('is-compact', y > (header.classList.contains('is-compact') ? 8 : 64));
    const max=root.scrollHeight-innerHeight;
    const probe=Math.min(innerHeight-1,header.getBoundingClientRect().bottom+8);
    const section=document.elementsFromPoint(innerWidth/2,probe).map(el=>el.closest('section')).find(Boolean);
    header.classList.toggle('glass-light',!!section?.matches('.surface'));
    document.querySelector('.scroll-progress').style.transform=`scaleX(${max?y/max:0})`;
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw)};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});draw();
  const observed=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){
      if(!off&&direction===1){entry.target.classList.remove('entrance');requestAnimationFrame(()=>entry.target.classList.add('entrance'))}
      const count=entry.target.querySelector('[data-count]');
      if(count&&!count.dataset.done){count.dataset.done='true';const end=Number(count.dataset.count),start=performance.now();
        const tick=now=>{const p=off?1:Math.min(1,(now-start)/900);count.textContent=Math.round(end*(1-(1-p)**3));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}
    }else entry.target.classList.remove('entrance');
  }),{threshold:.08});
  document.querySelectorAll('.section-pad>h2,.section-top,.stats,.steps article,.timeline article').forEach(el=>observed.observe(el));
})();
