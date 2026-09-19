// A bounded 3D mesh, projected onto a lightweight canvas. No external assets.
(() => {
  const canvas = document.querySelector('.network-scene');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const host = canvas.closest('.hero');
  let width = 0, height = 0, raf = 0, last = 0, time = 0, visible = true, scrolling = false, scrollTimer = 0;
  let mx = 0, my = 0, targetX = 0, targetY = 0;
  const compact = matchMedia('(max-width: 700px)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const pointCount = compact ? 96 : 144;
  const fieldCount = compact ? 36 : 60;
  const points = Array.from({length: pointCount}, (_, i) => {
    const y = 1 - 2 * (i + .5) / pointCount, angle = i * 2.39996;
    const radius = i % 4 === 0 ? .62 : 1;
    return {x: Math.cos(angle)*Math.sqrt(1-y*y)*radius,
      y:y*radius, z:Math.sin(angle)*Math.sqrt(1-y*y)*radius};
  });
  // Cache topology once; frame rendering only traverses the actual connections.
  const edges = [];
  points.forEach((a,i) => points.map((b,j)=>({j,d:Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)}))
    .filter(b=>b.j!==i).sort((a,b)=>a.d-b.d).slice(0,4)
    .forEach(({j})=>{if(j>i)edges.push([i,j])}));
  const paused = () => document.documentElement.classList.contains('motion-off');
  function render() {
    ctx.clearRect(0, 0, width, height);
    if (!width || !height) return;
    const mobile=width<700, radius=Math.min(width*(mobile?.62:.235),height*.36);
    // A quiet full-width network ties the copy and neural core into one environment.
    const columns = compact ? 6 : 10;
    const rows = Math.ceil(fieldCount / columns);
    const fieldX = i => ((i % columns + .5) / columns) * width + Math.sin(i * 2.4 + time * .12) * 14 + mx * 10;
    const fieldY = i => ((Math.floor(i / columns) + .5) / rows) * height + Math.cos(i * 1.7 + time * .1) * 18 + my * 8;
    ctx.lineWidth=.65;
    for(let i=0;i<fieldCount;i++){
      const ax=fieldX(i),ay=fieldY(i);
      for(const j of [i%columns<columns-1?i+1:-1,i+columns<fieldCount?i+columns:-1,i%columns<columns-1&&i+columns+1<fieldCount?i+columns+1:-1]){
        if(j<0)continue;
        ctx.strokeStyle='rgba(83,148,208,.12)';ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(fieldX(j),fieldY(j));ctx.stroke();
      }
      ctx.fillStyle='rgba(119,192,246,.3)';ctx.beginPath();ctx.arc(ax,ay,1.4,0,Math.PI*2);ctx.fill();
    }
    const cx=width*(mobile?.68:.75), cy=height*.51;
    const angle=time*.065+mx*.7, pitch=my*.45-.15;
    const project=({x,y,z})=>{
      const rx=x*Math.cos(angle)-z*Math.sin(angle), rz=x*Math.sin(angle)+z*Math.cos(angle);
      const ry=y*Math.cos(pitch)-rz*Math.sin(pitch), depth=y*Math.sin(pitch)+rz*Math.cos(pitch);
      const p=3.8/(3.8+depth);
      return {x:cx+rx*radius*p,y:cy+ry*radius*p,p,a:(1-depth)*.3+.23};
    };
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.4);
    glow.addColorStop(0,'#143d6840');glow.addColorStop(.6,'#16466c20');glow.addColorStop(1,'#07101c00');
    ctx.fillStyle=glow;ctx.fillRect(cx-radius*1.4,cy-radius*1.4,radius*2.8,radius*2.8);
    const projected=points.map(project);
    ctx.lineWidth=.8;
    edges.forEach(([i,j],k)=>{
      const a=projected[i],b=projected[j];
      ctx.strokeStyle='rgba(98,167,239,'+Math.min(a.a,b.a)*.52+')';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      if(k%9===0){
        const t=(time*.24+k*.17)%1;
        ctx.strokeStyle='#6fd8ff90';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*Math.max(0,t-.16),a.y+(b.y-a.y)*Math.max(0,t-.16));
        ctx.lineTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);ctx.stroke();ctx.lineWidth=.8;
      }
    });
    projected.forEach((a,i)=>{
      const hub=i%19===0;
      ctx.fillStyle='rgba(154,219,255,'+a.a+')';ctx.beginPath();ctx.arc(a.x,a.y,(hub?3.4:1.45)*a.p,0,Math.PI*2);ctx.fill();
      if(hub){ctx.strokeStyle='#83c5ff60';ctx.beginPath();ctx.arc(a.x,a.y,7*a.p,0,Math.PI*2);ctx.stroke();}
    });
    // Thin orbital routing paths connect the neural core to distinct computing layers.
    const labels=['CLOUD','EDGE COMPUTE','SECURITY','DATA SYSTEMS'];
    labels.forEach((label,i)=>{
      const phase=i*Math.PI/2+.45;
      const x=cx+Math.cos(phase)*radius*1.22,y=cy+Math.sin(phase)*radius*.94;
      const a=projected[(i*Math.floor(pointCount/4)+7)%pointCount];
      ctx.strokeStyle='#6596c94d';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#091524';ctx.strokeStyle='#71b5ed90';ctx.lineWidth=1;
      ctx.fillRect(x-14,y-14,28,28);ctx.strokeRect(x-14,y-14,28,28);
      ctx.strokeStyle='#9bdfff';
      for(let n=0;n<3;n++){ctx.strokeRect(x-7,y-8+n*6,14,4);}
      if(!mobile){ctx.font='9px Mono,monospace';ctx.textAlign='center';ctx.fillStyle='#9bb6cc';ctx.fillText(label,x,y+31);}
    });
    if(!mobile){const intelligenceY=Math.min(cy+radius*1.2,height-94);ctx.font='10px Mono,monospace';ctx.textAlign='center';ctx.fillStyle='#7493b2';ctx.fillText('INTERCONNECTED INTELLIGENCE',cx,intelligenceY);}
  }
  function tick(now) {
    raf = 0;
    if (!visible || document.hidden || paused() || scrolling) { last = 0; return; }
    const dt = Math.min((now - (last || now)) / 1000, .05); last = now; time += dt;
    const ease = 1 - Math.exp(-dt * 4);
    mx += (targetX-mx)*ease; my += (targetY-my)*ease;
    render(); raf = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(raf); raf=0; last=0;
    render();
    if (visible && !document.hidden && !paused() && !scrolling) raf=requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
    width=host.clientWidth; height=host.clientHeight;
    const dpr=Math.min(devicePixelRatio || 1,1.5);
    canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); sync();
  }).observe(host);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()}).observe(host);
  new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);
  addEventListener('scroll',()=>{scrolling=true;clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;sync()},120)},{passive:true});
  host.addEventListener('pointermove',e=>{
    const r=host.getBoundingClientRect();
    targetX=(e.clientX-r.left)/r.width-.5; targetY=(e.clientY-r.top)/r.height-.5;
  },{passive:true});
  host.addEventListener('pointerleave',()=>{targetX=targetY=0});
})();
