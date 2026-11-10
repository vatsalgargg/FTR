(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const loader = document.createElement('div');
  loader.className = 'orbit-loader';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-label', 'Loading First Time Resolver');
  const scene = document.createElement('div');
  scene.className = 'orbit-loader__scene';
  scene.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'orbit-loader__text';
  text.textContent = 'Loading...';
  scene.append(text);
  for (const name of ['one', 'two', 'three']) {
    const ring = document.createElement('span');
    ring.className = 'orbit-loader__ring orbit-loader__ring--' + name;
    scene.append(ring);
  }
  loader.append(scene);
  document.body.prepend(loader);
  let leaving = false;
  function dismiss() {
    if (leaving) return;
    leaving = true;
    loader.classList.add('is-leaving');
    setTimeout(() => loader.remove(), 250);
  }
  // Leave as soon as the HTML is parsed, never later than 400 ms, so the hero is never held back.
  if (document.readyState !== 'loading') dismiss();
  else document.addEventListener('DOMContentLoaded', dismiss, {once:true});
  const deadline = setTimeout(dismiss, 400);
  addEventListener('pageshow', event => {
    if (event.persisted) { clearTimeout(deadline); loader.remove(); }
  });
  document.addEventListener('keydown', dismiss, {once:true});
})();
