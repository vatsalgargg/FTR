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
  const started = performance.now();
  let leaving = false;
  function dismiss() {
    if (leaving) return;
    leaving = true;
    loader.classList.add('is-leaving');
    setTimeout(() => loader.remove(), 500);
  }
  // One complete orbit on fast loads, with a ceiling for slow or failed media.
  function ready() {
    setTimeout(dismiss, Math.max(0, 1150 - (performance.now() - started)));
  }
  if (document.readyState === 'complete') ready();
  else addEventListener('load', ready, {once:true});
  const deadline = setTimeout(dismiss, 3500);
  addEventListener('pageshow', event => {
    if (event.persisted) { clearTimeout(deadline); loader.remove(); }
  });
  document.addEventListener('keydown', dismiss, {once:true});
})();
