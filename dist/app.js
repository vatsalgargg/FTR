const root = document.documentElement;
const menu = document.querySelector('.menu-toggle');
const panel = document.querySelector('.menu-panel');
const motionButton = document.querySelector('#motion-toggle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const hero = document.querySelector('.hero');
const progress = document.querySelector('.scroll-progress');
let motionOff = reducedMotion.matches;
let frame = 0;
let tiltX = 0, tiltY = 0, currentX = 0, currentY = 0;
const counters = new Map();
function setMenu(open, restoreFocus = false) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  panel.inert = !open;
  panel.classList.toggle('open', open);
  if (restoreFocus) menu.focus();
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
panel.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false, true); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.classList.contains('open')) setMenu(false, true); });
document.addEventListener('click', event => { if (!event.target.closest('.header,.menu-panel')) setMenu(false); });
document.addEventListener('focusin', event => { if (!event.target.closest('.header,.menu-panel')) setMenu(false); });
function draw(now) {
  frame = 0;
  const distance = root.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`;
  const offset = motionOff ? 0 : Math.min(scrollY, 1000);
  currentX += (tiltX - currentX) * .09;
  currentY += (tiltY - currentY) * .09;
  hero.style.setProperty('--background-y', `${offset * .17}px`);
  hero.style.setProperty('--collage-y', `${offset * -.34}px`);
  hero.style.setProperty('--tilt-x', `${motionOff ? 0 : currentX}deg`);
  hero.style.setProperty('--tilt-y', `${motionOff ? 0 : currentY}deg`);
  for (const [element, counter] of counters) {
    const fraction = motionOff ? 1 : Math.min(1, (now - counter.start) / 1800);
    const eased = 1 - Math.pow(1 - fraction, 4);
    element.textContent = String(Math.round(counter.value * eased));
    if (fraction === 1) counters.delete(element);
  }
  if (counters.size || (!motionOff && (Math.abs(tiltX-currentX) > .01 || Math.abs(tiltY-currentY) > .01))) schedule();
}
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function applyMotion() {
  root.classList.toggle('motion-off', motionOff);
  motionButton.replaceChildren(document.createTextNode(motionOff ? 'MOTION OFF ' : 'MOTION ON '));
  const icon = document.createElement('span'); icon.textContent = motionOff ? '○' : '◉'; icon.setAttribute('aria-hidden','true'); motionButton.append(icon);
  motionButton.setAttribute('aria-pressed', String(motionOff)); schedule();
}
motionButton.addEventListener('click', () => { motionOff = !motionOff; applyMotion(); });
reducedMotion.addEventListener('change', event => { motionOff = event.matches; applyMotion(); });
hero.addEventListener('pointermove', event => {
  if (motionOff || !finePointer.matches) return;
  const bounds = hero.getBoundingClientRect(); tiltY = ((event.clientX - bounds.left) / bounds.width - .5) * 5; tiltX = -((event.clientY - bounds.top) / bounds.height - .5) * 4; schedule();
});
hero.addEventListener('pointerleave', () => { tiltX = tiltY = 0; schedule(); });
addEventListener('scroll', schedule, {passive:true}); addEventListener('resize', schedule, {passive:true}); addEventListener('load', schedule, {once:true});
// Native scrolling, progressive content and finite animation frames keep input responsive.
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.remove('pending'); revealObserver.unobserve(entry.target); }
  }, {threshold:.06});
  if (!motionOff) document.querySelectorAll('.reveal').forEach(element => {
    if (element.getBoundingClientRect().top > innerHeight) { element.classList.add('pending'); revealObserver.observe(element); }
  });
  const countObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      if (!motionOff) { counters.set(entry.target, {value:Number(entry.target.dataset.count), start:performance.now()}); schedule(); }
      countObserver.unobserve(entry.target);
    }
  }, {threshold:.7});
  document.querySelectorAll('[data-count]').forEach(element => countObserver.observe(element));
  const navObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) document.querySelectorAll('.nav-links a').forEach(link => {
      if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    });
  }, {rootMargin:'-10% 0px -65% 0px'});
  ['home','about','services','contact'].forEach(id => navObserver.observe(document.getElementById(id)));
}
function openLinkedService() {
  const id = location.hash.slice(1);
  if (!['infrastructure','integration','management','maintenance'].includes(id)) return;
  const details = document.getElementById(id); details.open = true; details.classList.remove('pending');
}
addEventListener('hashchange', openLinkedService); openLinkedService(); applyMotion();
