// Gallery hero — cross-fades through one plate from every gallery discipline
// (personal edits, color grading, photoshop). The slides are plain <figure>s in
// gallery.html so the markup stays editable; the dots are generated from them.
// Auto-advance pauses while the header is hovered, keyboard-focused or scrolled
// out of view, and is disabled entirely for prefers-reduced-motion.

const INTERVAL = 2000; // 2s

export function setupGalleryHeroSlides() {
  const root = document.querySelector('[data-gallery-slides]');
  if (!root) return; // Exit if the slideshow is not on this page

  const slides = Array.from(root.querySelectorAll('.gallery-slides__slide'));
  const n = slides.length;
  if (n < 2) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dotsWrap = root.querySelector('.gallery-slides__dots');
  let index = 0;
  let timer = null;
  let visible = true;

  // Read the slide's own caption so dots stay labelled without extra data attrs
  const label = (slide) => {
    const section = slide.querySelector('.gallery-slides__section')?.textContent.trim() || '';
    const name = slide.querySelector('.gallery-slides__name')?.textContent.trim() || '';
    return [section, name].filter(Boolean).join(' — ');
  };

  // Dots — one per slide
  const dots = slides.map((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gallery-slides__dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Show ${label(slide)}`);
    dot.addEventListener('click', () => { index = i; render(); start(); });
    dotsWrap?.appendChild(dot);
    return dot;
  });

  function render() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
      dot.tabIndex = active ? 0 : -1;
    });
  }

  const go = (i) => { index = (i + n) % n; render(); };

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    if (reduce.matches || document.hidden || !visible) return;
    timer = setInterval(() => go(index + 1), INTERVAL);
  }

  // ── Pause while hovered or keyboard-focused ──
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', start);

  // ── Pause while the header is scrolled out of view ──
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.15 }).observe(root);
  }

  // ── Follow the OS motion setting if it changes mid-session ──
  reduce.addEventListener?.('change', () => (reduce.matches ? stop() : start()));

  // ── Arrow keys walk the dots ──
  dotsWrap?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    index = (index + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    render();
    dots[index].focus();
    start();
  });

  render();
  start();
}
