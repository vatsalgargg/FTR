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
    // ease-out-cubic over 1200 ms — smooth deceleration into the target number
    const fraction = motionOff ? 1 : Math.min(1, (now - counter.start) / 1200);
    const eased = 1 - Math.pow(1 - fraction, 3);
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
  // Reveal observer — re-adds .pending when element scrolls back out so the
  // fade-up plays again every time the element re-enters the viewport.
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (motionOff) { entry.target.classList.remove('pending'); continue; }
      if (entry.isIntersecting) {
        entry.target.classList.remove('pending');
      } else {
        // Only re-arm if the element is below the viewport (scrolled back up past it)
        // or fully above it — prevents flickering at the trigger edge.
        entry.target.classList.add('pending');
      }
    }
  }, {threshold: 0.06});
  document.querySelectorAll('.reveal').forEach(element => {
    if (element.getBoundingClientRect().top > innerHeight) {
      element.classList.add('pending');
    }
    revealObserver.observe(element);
  });

  // Counter observer — resets to 0 on exit, restarts count-up on re-entry.
  // Keeps observing (no unobserve) so scroll-up → scroll-down replays it.
  const countObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        // Start (or restart) the animated count from the current moment.
        if (!motionOff) {
          counters.set(entry.target, {value: Number(entry.target.dataset.count), start: performance.now()});
          schedule();
        } else {
          entry.target.textContent = String(entry.target.dataset.count);
        }
      } else {
        // Element has left the viewport — cancel any in-progress counter and
        // reset the displayed number to 0 so next entry starts fresh.
        counters.delete(entry.target);
        entry.target.textContent = '0';
      }
    }
  }, {threshold: 0.5});
  document.querySelectorAll('[data-count]').forEach(element => {
    element.textContent = '0';
    countObserver.observe(element);
  });
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

const partnerTiles = document.querySelector('.partner-names');
const tileMotionButton = document.querySelector('#tile-motion-toggle');
tileMotionButton.addEventListener('click', () => {
  const paused = partnerTiles.classList.toggle('tiles-paused');
  tileMotionButton.setAttribute('aria-pressed', String(paused));
  tileMotionButton.textContent = paused ? 'Resume tile animation ▶' : 'Pause tile animation Ⅱ';
});
if ('IntersectionObserver' in window) {
  const tileObserver = new IntersectionObserver(entries => {
    partnerTiles.classList.toggle('in-view', entries[0].isIntersecting);
  }, {threshold:0});
  tileObserver.observe(partnerTiles);
} else partnerTiles.classList.add('in-view');
function updateTileVisibility() { root.classList.toggle('page-hidden', document.hidden); }
document.addEventListener('visibilitychange', updateTileVisibility);
updateTileVisibility();

// ─── Nav pill wave hover ────────────────────────────────────────────────────
// Each letter in .nav-links > a gets its own <span> so we can stagger
// individual Web Animations API keyframes (left → right ripple).
(function initNavWave() {
  const STAGGER   = 35;   // ms between each letter's start
  const DURATION  = 500;  // total animation length per letter (ms)
  const RISE      = -7;   // px — how high each letter floats
  const SCALE_TOP = 1.15; // peak scale at the apex

  // Split the text of each nav link into individual letter spans.
  document.querySelectorAll('.nav-links > a').forEach(link => {
    // Preserve the original plain-text label for aria so screen readers
    // still read the full word rather than wrapped spans.
    if (!link.dataset.waveReady) {
      const text = link.textContent;
      link.dataset.waveReady = '1';
      link.setAttribute('aria-label', text.trim());
      link.innerHTML = [...text].map(ch =>
        `<span class="wl" aria-hidden="true">${ch === ' ' ? '\u00a0' : ch}</span>`
      ).join('');
    }

    link.addEventListener('mouseenter', () => {
      if (motionOff || reducedMotion.matches) return;

      const spans = link.querySelectorAll('.wl');
      spans.forEach((span, i) => {
        // Cancel any in-flight animation on this letter for a clean restart.
        span.getAnimations().forEach(a => a.cancel());

        span.animate(
          [
            { transform: 'translateY(0px) scale(1)',                   easing: 'ease-in-out' },
            { transform: `translateY(${RISE}px) scale(${SCALE_TOP})`,  easing: 'ease-in-out', offset: 0.45 },
            { transform: 'translateY(0px) scale(1)' }
          ],
          {
            duration: DURATION,
            delay:    i * STAGGER,
            fill:     'none'  // letter snaps back cleanly after the animation
          }
        );
      });
    });
  });
})();
