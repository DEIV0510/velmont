// VELMONT — capa de interaccion: carga, header, menu fullscreen, reveals,
// profundidad del hero. Todo con transform/opacity y respetando reduced-motion.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// La pantalla de carga NO bloquea el scroll: si lo hiciera, cualquier fallo
// (una pagina sin loader, un error de JS, temporizadores frenados en una
// pestaña en segundo plano) dejaria la pagina atrapada sin poder desplazarse.
// Solo aparece en la primera visita de la sesion, como pide el brief.
const LOADER_KEY = 'velmont_intro_seen';

export function initLoader() {
  const el = document.querySelector('[data-loading-screen]');
  if (!el) return;

  let seen = false;
  try { seen = sessionStorage.getItem(LOADER_KEY) === '1'; } catch { /* modo privado */ }
  if (seen || reduce) { el.remove(); return; }
  try { sessionStorage.setItem(LOADER_KEY, '1'); } catch { /* modo privado */ }

  const MIN = 900;
  const t0 = performance.now();
  let done = false;
  const hide = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 900);
  };
  const finish = () => {
    if (done) return;
    done = true;
    setTimeout(hide, Math.max(0, MIN - (performance.now() - t0)));
  };
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
  setTimeout(finish, 2600); // salvavidas

  // Pestaña abierta en segundo plano: el navegador frena los temporizadores.
  // Al volver a ella, la intro no debe seguir tapando la pagina.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.readyState === 'complete') {
      done = true;
      hide();
    }
  }, { once: true });
}

export function initHeader() {
  // header[...] y no [data-hdr] a secas: el <body> de las paginas claras
  // tambien lleva data-hdr="light" y va primero en el documento.
  const hdr = document.querySelector('header[data-hdr]');
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

/**
 * Indicador de una galeria deslizable (movil): filete de progreso + contador
 * "02 / 06" segun la pieza que quedo mas cerca del borde izquierdo.
 */
export function bindSwipeHint(scroller, hint) {
  if (!scroller || !hint) return;
  const count = hint.querySelector('[data-swipe-count]');
  const total = scroller.children.length;
  let raf = null;
  const update = () => {
    raf = null;
    const max = scroller.scrollWidth - scroller.clientWidth;
    if (max <= 0) return;
    const p = scroller.scrollLeft / max;
    hint.style.setProperty('--p', String(Math.max(0.12, p)));
    const left = scroller.getBoundingClientRect().left;
    let idx = 0, best = Infinity;
    [...scroller.children].forEach((el, i) => {
      const d = Math.abs(el.getBoundingClientRect().left - left);
      if (d < best) { best = d; idx = i; }
    });
    // La ultima pieza nunca llega al borde izquierdo: al tope, es la ultima
    if (scroller.scrollLeft >= max - 2) idx = total - 1;
    if (count) count.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  };
  scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  // Garantiza el estado final exacto aunque se pierda un frame del rAF
  scroller.addEventListener('scrollend', update);
  update();
}

/**
 * Barra de compra fija (movil). Se muestra siempre que el boton principal
 * NO este en pantalla — antes de llegar a el o despues de pasarlo — asi
 * comprar nunca queda a mas de un toque y nunca se ven dos botones a la vez.
 */
export function bindBuyBar(mainButton, bar) {
  if (!mainButton || !bar || !('IntersectionObserver' in window)) return;
  const btn = bar.querySelector('button');
  const set = (on) => {
    bar.classList.toggle('on', on);
    bar.setAttribute('aria-hidden', String(!on));
    if (btn) btn.tabIndex = on ? 0 : -1;
    document.body.classList.toggle('has-buybar', on && window.matchMedia('(max-width: 899px)').matches);
  };
  new IntersectionObserver(([e]) => set(!e.isIntersecting), { threshold: 0 }).observe(mainButton);
}

export function initAll() {
  initLoader();
  initHeader();
  initMenu();
  initReveal();
  initDepth();
  initHeroScroll();
}
