// VELMONT — loading screen, header, reveal-on-scroll, parallax de hero, menu movil
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initLoadingScreen() {
  const el = document.querySelector('[data-loading-screen]');
  if (!el) return;
  const MIN_MS = reduceMotion ? 0 : 700;
  const start = performance.now();
  const finish = () => {
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_MS - elapsed);
    setTimeout(() => {
      el.classList.add('is-hidden');
      document.documentElement.classList.remove('is-loading');
      setTimeout(() => el.remove(), 700);
    }, wait);
  };
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
  // salvavidas: nunca bloquear la pagina mas de 2.5s aunque algo tarde en cargar
  setTimeout(finish, 2500);
}

export function initHeaderScroll() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function initMobileNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const panel = document.querySelector('[data-nav-panel]');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('no-scroll', open);
  });
  panel.querySelectorAll('a, button').forEach(a => a.addEventListener('click', () => {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('no-scroll');
  }));
}

export function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
}

export function initHeroParallax() {
  const hero = document.querySelector('[data-hero-parallax]');
  if (!hero || reduceMotion) return;
  const layers = hero.querySelectorAll('[data-parallax-layer]');
  if (!layers.length) return;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  if (isCoarse) return; // en movil evitamos el listener por consumo/uso de la pantalla

  let raf = null;
  hero.addEventListener('mousemove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      layers.forEach(layer => {
        const depth = parseFloat(layer.dataset.parallaxLayer) || 0;
        layer.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
      });
      raf = null;
    });
  });
  hero.addEventListener('mouseleave', () => {
    layers.forEach(layer => { layer.style.transform = 'translate3d(0,0,0)'; });
  });
}

export function initAll() {
  document.documentElement.classList.add('is-loading');
  initLoadingScreen();
  initHeaderScroll();
  initMobileNav();
  initReveal();
  initHeroParallax();
}
