// VELMONT — capa de interaccion: carga, header, menu fullscreen, reveals,
// profundidad del hero. Todo con transform/opacity y respetando reduced-motion.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initLoader() {
  const el = document.querySelector('[data-loading-screen]');
  if (!el) return;
  const MIN = reduce ? 0 : 900;
  const t0 = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    const wait = Math.max(0, MIN - (performance.now() - t0));
    setTimeout(() => {
      el.classList.add('out');
      document.documentElement.classList.remove('no-scroll');
      setTimeout(() => el.remove(), 900);
    }, wait);
  };
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
  setTimeout(finish, 2600); // salvavidas
}

export function initHeader() {
  const hdr = document.querySelector('[data-hdr]');
  if (!hdr) return;
  const onScroll = () => hdr.classList.toggle('is-stuck', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function initMenu() {
  const menu = document.querySelector('[data-menu]');
  if (!menu) return;
  const open = () => {
    menu.classList.add('open');
    document.documentElement.classList.add('no-scroll');
    document.querySelector('[data-menu-open]')?.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    menu.classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    document.querySelector('[data-menu-open]')?.setAttribute('aria-expanded', 'false');
  };
  document.querySelector('[data-menu-open]')?.addEventListener('click', open);
  document.querySelector('[data-menu-close]')?.addEventListener('click', close);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) close(); });

  bindMenuVisuals();
}

/** Se llama de nuevo cuando el catalogo inyecta las imagenes del menu. */
export function bindMenuVisuals() {
  const menu = document.querySelector('[data-menu]');
  if (!menu) return;
  const visuals = menu.querySelectorAll('[data-menu-visual] figure');
  if (!visuals.length) return;
  menu.querySelectorAll('[data-visual]').forEach(link => {
    if (link.dataset.visualBound) return;
    link.dataset.visualBound = '1';
    link.addEventListener('mouseenter', () => {
      const i = Number(link.dataset.visual);
      visuals.forEach((f, idx) => f.classList.toggle('on', idx === i));
    });
  });
}

let io = null;
export function initReveal(scope = document) {
  const items = scope.querySelectorAll('[data-reveal]:not(.in)');
  if (!items.length) return;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
    return;
  }
  if (!io) {
    io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }
  items.forEach(el => io.observe(el));
}

// Profundidad: capas que responden al mouse a distinta velocidad
export function initDepth() {
  const hero = document.querySelector('[data-hero]');
  if (!hero || reduce) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const layers = hero.querySelectorAll('[data-depth]');
  if (!layers.length) return;
  let raf = null;
  hero.addEventListener('mousemove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      // Solo variables: el transform final se compone en CSS para no pisar
      // el efecto de scroll que escribe sobre el mismo elemento.
      layers.forEach(l => {
        const d = parseFloat(l.dataset.depth) || 0;
        l.style.setProperty('--px', `${x * d}px`);
        l.style.setProperty('--py', `${y * d}px`);
      });
      raf = null;
    });
  });
  hero.addEventListener('mouseleave', () => {
    layers.forEach(l => { l.style.setProperty('--px', '0px'); l.style.setProperty('--py', '0px'); });
  });
}

// El producto del hero se aleja levemente al hacer scroll (escala cinematografica)
export function initHeroScroll() {
  const stage = document.querySelector('[data-hero-stage]');
  if (!stage || reduce) return;
  let raf = null;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        const p = Math.min(1, y / (window.innerHeight || 1));
        stage.style.setProperty('--scroll-scale', String(1 - p * 0.08));
        stage.style.setProperty('--scroll-y', `${p * 60}px`);
      }
      raf = null;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function initAll() {
  document.documentElement.classList.add('no-scroll');
  initLoader();
  initHeader();
  initMenu();
  initReveal();
  initDepth();
  initHeroScroll();
}
