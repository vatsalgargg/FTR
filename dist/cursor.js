(() => {
  'use strict';
  const root = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const overlay = document.createElement('div');
  overlay.className = 'site-cursor';
  overlay.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  const shape = document.createElement('div');
  shape.className = 'cursor-shape';
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.append(shape);
  overlay.append(ring, dot);
  document.body.append(overlay);
  let x = 0, y = 0, rx = 0, ry = 0, frame = 0, last = 0, visible = false, target, bounds = null;
  let dirty = false, activeCard = null;
  function setCard(card) {
    if(card===activeCard)return;
    activeCard?.classList.remove('is-pointer-active');
    activeCard=card;
    activeCard?.classList.add('is-pointer-active');
  }
  const enabled = () => fine.matches && !reduced.matches && !root.classList.contains('motion-off');
  function hide() {
    visible = false;
    overlay.classList.remove('is-visible');
    if (root.classList.contains('cursor-active')) root.classList.remove('cursor-active');
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    setCard(null);
    target = undefined;
    bounds = null;
  }
  function hover(element) {
    if(element?.closest('input,textarea,select,[contenteditable="true"],iframe')) { hide(); return; }
    let candidate = element?.closest('a,button,[role="button"]');
    // Keep one continuous hover surface across the navbar's small link gaps.
    const navigation = element?.closest('.n-header nav,.header .nav-links,.n-actions');
    if (!candidate && navigation) {
      let nearest = Infinity;
      navigation.querySelectorAll('a').forEach(link => {
        const rect = link.getBoundingClientRect();
        const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
        if (distance < nearest) { nearest = distance; candidate = link; }
      });
    }
    const control = candidate && !candidate.matches('.project-card') && !candidate.matches(':disabled,[aria-disabled="true"]') ? candidate : null;
    const grid = element?.closest('.service-grid,.project-list');
    let card=element?.closest('.service-card') || null;
    if(grid && !card) {
      let nearest=Infinity;
      grid.querySelectorAll('.service-card').forEach(item=>{
        const rect=item.getBoundingClientRect();
        const dx=Math.max(rect.left-x,0,x-rect.right),dy=Math.max(rect.top-y,0,y-rect.bottom);
        const distance=dx*dx+dy*dy;
        if(distance<nearest){nearest=distance;card=item;}
      });
    }
    setCard(card);
    const image = !control && (grid || element?.closest('.partner-grid,.feature-media,.cta-image,.n-partner-grid,.hero-photo,.service-body img'));
    const globe = !control && !image && !element?.closest('.hero-copy,.hero-top,.hero-stats') && element?.closest('.hero');
    const next = control || image || globe || null;
    // The whole grid is one cursor surface, including its gutters.
    const controlRect = control ? control.getBoundingClientRect() : null;
    bounds = controlRect && controlRect.width < 360 && controlRect.height < 100 ? controlRect : null;
    target = next;
    overlay.classList.toggle('is-hover', !!control || !!image);
    overlay.classList.toggle('is-image', !!image);
    overlay.classList.toggle('is-globe', !!globe);
    overlay.classList.toggle('is-control', !!bounds);
    shape.style.width = `${bounds ? bounds.width + 16 : image ? 84 : control || globe ? 56 : 36}px`;
    shape.style.height = `${bounds ? bounds.height + 10 : image ? 84 : control || globe ? 56 : 36}px`;
  }
  function tick(now) {
    frame = 0;
    if (!visible || !enabled()) return hide();
    if (dirty) { dirty = false; hover(document.elementFromPoint(x, y)); }
    if (!visible) return;
    const tx = bounds ? bounds.left + bounds.width / 2 + (x - bounds.left - bounds.width / 2) * .08 : x;
    const ty = bounds ? bounds.top + bounds.height / 2 + (y - bounds.top - bounds.height / 2) * .08 : y;
    const amount = 1 - Math.exp(-Math.min(last ? now - last : 16.7, 64) / 65);
    last = now;
    rx += (tx - rx) * amount;
    ry += (ty - ry) * amount;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    if (Math.abs(tx - rx) + Math.abs(ty - ry) > .05) frame = requestAnimationFrame(tick);
    else last = 0;
  }
  function schedule() { if (!frame && visible) frame = requestAnimationFrame(tick); }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !enabled()) return hide();
    if (event.target.closest('input,textarea,select,[contenteditable="true"],iframe')) return hide();
    x = event.clientX;
    y = event.clientY;
    if (!visible) { rx = x; ry = y; target = undefined; visible = true; overlay.classList.add('is-visible'); root.classList.add('cursor-active'); }
    dirty = true;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    schedule();
  }, { passive: true });
  function refresh() {
    if (!visible) return;
    dirty = true;
    schedule();
  }
  addEventListener('scroll', refresh, { passive: true });
  addEventListener('resize', refresh, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  document.addEventListener('keydown', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  addEventListener('blur', hide);
  fine.addEventListener('change', hide);
  reduced.addEventListener('change', hide);
  new MutationObserver(() => { if (!enabled()) hide(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
})();
