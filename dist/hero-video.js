(() => {
  'use strict';
  const hero = document.querySelector('.n-hero');
  const video = hero?.querySelector('video');
  const button = hero?.querySelector('.hero-video-toggle');
  if (!video || !button) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let visible = false, paused = false, selecting = false, ready = false, retried = false;
  const base = '/assets/technology/hero-server-';
  const allowed = () => visible && !document.hidden && !paused && !reduced.matches &&
    !document.documentElement.classList.contains('motion-off') && !connection?.saveData;
  async function selectSource() {
    // Keep the lightweight rendition when a phone rotates to landscape.
    const phone = matchMedia('(max-width:700px)').matches ||
      (matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) <= 700);
    const constrained = /(^|-)2g$/.test(connection?.effectiveType || '') ||
      (typeof connection?.downlink === 'number' && connection.downlink < 3);
    let quality = phone || constrained ? '720' : '1080';
    if (!phone && !constrained && innerWidth * Math.min(devicePixelRatio, 2) >= 2500 && navigator.mediaCapabilities) {
      try {
        const result = await navigator.mediaCapabilities.decodingInfo({type:'file',video:{
          contentType:'video/mp4; codecs="avc1.640033"',width:3840,height:2160,bitrate:18000000,framerate:24
        }});
        if (result.supported && result.smooth) quality = '4k';
      } catch { /* Older browsers receive the compatible 1080p film. */ }
    }
    video.muted = true;
    video.src = base + quality + '.mp4';
    video.dataset.quality = quality;
    ready = true;
  }
  async function sync() {
    if (reduced.matches || document.documentElement.classList.contains('motion-off') || connection?.saveData) {
      button.hidden = true;
    } else if (ready) button.hidden = false;
    if (!allowed()) { video.pause(); return; }
    if (!ready) {
      if (selecting) return;
      selecting = true;
      await selectSource();
      selecting = false;
    }
    if (!allowed()) return;
    try { await video.play(); } catch {
      if (allowed()) {
        button.hidden = false;
        button.textContent = 'Play video';
        button.setAttribute('aria-label','Play background video');
      }
    }
  }
  video.addEventListener('playing', () => {
    video.classList.add('is-playing');
    button.hidden = false;
    button.textContent = 'Pause video';
    button.setAttribute('aria-label','Pause background video');
    button.setAttribute('aria-pressed','false');
  });
  video.addEventListener('error', () => {
    video.classList.remove('is-playing');
    if (!retried && video.dataset.quality !== '720') {
      retried = true;
      video.src = base + '720.mp4';
      video.dataset.quality = '720';
      sync();
    } else button.hidden = true;
  });
  button.addEventListener('click', () => {
    paused = !video.paused;
    button.textContent = paused ? 'Play video' : 'Pause video';
    button.setAttribute('aria-label',paused ? 'Play background video' : 'Pause background video');
    button.setAttribute('aria-pressed',String(paused));
    sync();
  });
  new IntersectionObserver(entries => {visible = entries[0].isIntersecting;sync();},{threshold:0}).observe(hero);
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('ftr-motion-change',sync);
  reduced.addEventListener('change',sync);
  connection?.addEventListener?.('change',sync);
})();
