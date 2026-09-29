/* ==========================================================================
   VELMONT — capa de movimiento
   Vanilla, sin dependencias. UN solo listener de scroll pasivo, UN solo rAF
   compartido y UN solo IntersectionObserver reutilizado. Solo se animan
   transform, opacity y filter.

   Esta capa es la duena del loader, el cursor, los reveals, el scrub del hero
   y el tilt. global.js NO debe volver a montar ninguno de ellos: dos cursores
   o dos loaders a la vez es el fallo clasico de portar una capa de animacion.
   ========================================================================== */

/* ==========================================================================
   AJUSTES — todo lo que se toca para calibrar el movimiento vive aqui
   ========================================================================== */
export const CONFIG = {
  loader: {
    minMs: 900,          // minimo en pantalla para que no parpadee
    maxMs: 1400,         // tope duro: nunca retiene mas que esto
    key: 'velmont_intro_seen',
  },
  reveal: {
    threshold: 0.18,     // porcion visible para disparar
    rootMargin: '0px 0px -8% 0px',
    paso: 70,            // ms entre hermanos de la misma seccion
    tope: 6,             // escalones maximos: 6 x 70 = 420ms y ahi se queda
  },
  hero: {
    raton: 12,           // px maximos de parallax de raton (tope duro)
    lerp: 0.09,          // suavizado del seguimiento
    haloSeg: 9,          // segundos del ciclo de respiracion del halo
  },
  titulo: {
    palabraMs: 40,       // escalonado entre palabras del titular
  },
  lenis: {
    lerp: 0.085,         // inercia del scroll suave
    wheelMultiplier: 1,
  },
  parallax: {
    imagen: 6,           // % de recorrido de la imagen dentro de su seccion
    texto: 2,            // % del texto: mas lento, esa diferencia es la profundidad
  },
  tilt: {
    maxDeg: 6,           // inclinacion maxima
    lift: 14,            // px de elevacion en Z
    shadow: 'rgba(0,0,0,.18)',
  },
  cursor: {
    lerp: 0.18,          // suavizado del seguimiento
  },
};

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ==========================================================================
   Bucle compartido: un rAF para todo lo que reacciona al scroll o al raton
   ========================================================================== */
const frameTasks = new Set();
let frameQueued = false;

function runFrame() {
  frameQueued = false;
  for (const task of frameTasks) task();
}
function queueFrame() {
  if (!frameQueued) {
    frameQueued = true;
    requestAnimationFrame(runFrame);
  }
}
/** Registra una tarea que se ejecutara, como mucho, una vez por frame. */
function onFrame(task) {
  frameTasks.add(task);
  queueFrame();
  return () => frameTasks.delete(task);
}

let scrollBound = false;
function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;
  window.addEventListener('scroll', queueFrame, { passive: true });
  window.addEventListener('resize', queueFrame, { passive: true });
}

/* ==========================================================================
   1 · LOADER
   No bloquea el scroll: si algo fallara (un error de JS, una pestana en
   segundo plano con los temporizadores frenados), la pagina quedaria
   atrapada. Solo en la primera visita de la sesion.
   ========================================================================== */
function initLoader() {
  const el = $('[data-loading-screen]');
  if (!el) { document.documentElement.classList.add('hero-ready'); return; }

  let seen = false;
  try { seen = sessionStorage.getItem(CONFIG.loader.key) === '1'; } catch { /* modo privado */ }
  // Con menos movimiento la pantalla SI se muestra: el CSS la deja quieta —el
  // logo a opacidad 1, sin desplazamiento ni desenfoque, sin fundido de
  // salida—. Antes se eliminaba entera y quien tuviera ese ajuste no veia
  // nunca la marca. Lo que no se repite jamas es dentro de la misma sesion.
  if (seen) { el.remove(); startHero(); return; }
  try { sessionStorage.setItem(CONFIG.loader.key, '1'); } catch { /* sin espacio */ }

  const t0 = performance.now();
  let done = false;
  const hide = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 700);
    startHero();
  };
  const finish = () => {
    if (done) return;
    done = true;
    setTimeout(hide, Math.max(0, CONFIG.loader.minMs - (performance.now() - t0)));
  };

  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
  setTimeout(finish, CONFIG.loader.maxMs); // salvavidas

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.readyState === 'complete') { done = true; hide(); }
  }, { once: true });
}

/** Cascada de entrada del hero: cada hijo entra 90ms despues del anterior. */
function startHero() {
  const hero = $('[data-hero]');
  if (!hero) return;
  $$('[data-hero-in]', hero).forEach((el, i) => el.style.setProperty('--i', i));
  requestAnimationFrame(() => hero.classList.add('hero-in'));
}

/* ==========================================================================
   2 · REVEALS
   IntersectionObserver reutilizado. Salvaguarda: un elemento recortado con
   clip-path tiene area visible cero y el observador NUNCA lo daria por
   visible — eso dejo invisible la rejilla entera del catalogo. Esos se miden
   por posicion.
   ========================================================================== */
let io = null;
const rectPending = new Set();

function isClipped(el) {
  const clip = getComputedStyle(el).clipPath;
  return clip && clip !== 'none';
}

function checkRect() {
  if (!rectPending.size) return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  for (const el of rectPending) {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) {
      el.classList.add('is-visible', 'in');
      rectPending.delete(el);
    }
  }
}

/**
 * Cascada de entrada, calculada — nunca escrita a mano en la plantilla.
 *
 * El contador se reinicia en CADA seccion: una seccion con tres elementos no
 * hereda el retardo de las anteriores. Dentro de la seccion el orden es
 * visual, por filas: los elementos de una misma fila de rejilla entran de
 * izquierda a derecha, no de arriba abajo, que es como se lee.
 *
 * El tope evita que el ultimo elemento de una seccion larga aparezca medio
 * segundo tarde: a partir del escalon 6 todos comparten el mismo retardo.
 */
function asignarCascada(items) {
  const PASO = CONFIG.reveal.paso;
  const TOPE = CONFIG.reveal.tope;
  const BANDA = 40; // px: dos elementos dentro de esta franja son "la misma fila"

  const grupos = new Map();
  for (const el of items) {
    const sec = el.closest('.finder, section, .shopify-section') || document.body;
    if (!grupos.has(sec)) grupos.set(sec, []);
    grupos.get(sec).push(el);
  }

  for (const lista of grupos.values()) {
    const cajas = lista.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, fila: Math.round((r.top + window.scrollY) / BANDA), izq: r.left };
    });
    cajas.sort((a, b) => (a.fila - b.fila) || (a.izq - b.izq));
    cajas.forEach(({ el }, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i, TOPE) * PASO}ms`);
    });
  }
}

export function initReveal(scope = document) {
  const items = $$('[data-reveal]:not(.is-visible)', scope);
  if (!items.length) return;

  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible', 'in'));
    return;
  }

  asignarCascada(items);

  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible', 'in');
        io.unobserve(e.target);
      });
    }, { threshold: CONFIG.reveal.threshold, rootMargin: CONFIG.reveal.rootMargin });
  }

  items.forEach((el) => {
    if (isClipped(el)) rectPending.add(el);
    else io.observe(el);
  });

  if (rectPending.size) { onFrame(checkRect); bindScroll(); checkRect(); }
}

/* ==========================================================================
   3 · ORQUESTA — gsap.matchMedia es la UNICA autoridad sobre el movimiento
   --------------------------------------------------------------------------
   Nada de condicionales sueltos repartidos por el archivo. Todo lo que se
   mueve vive dentro de un contexto de matchMedia; bajo
   prefers-reduced-motion ningun contexto se activa, asi que no se oculta ni
   se desplaza nada: el CSS ya declara el estado final y aqui no se toca.
   Si la preferencia cambia en caliente, matchMedia revierte solo.
   ========================================================================== */
const SIN_MOVIMIENTO = '(prefers-reduced-motion: reduce)';
const CON_MOVIMIENTO = '(prefers-reduced-motion: no-preference)';
const PUNTERO_FINO = '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 900px)';

function montarOrquesta() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return false;

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  const mm = gsap.matchMedia();

  /* ---- A · hay permiso para mover ---------------------------------- */
  mm.add(CON_MOVIMIENTO, () => {
    const limpiezas = [
      montarLenis(gsap, ScrollTrigger),
      heroScrub(gsap),
      haloRespirando(gsap),
      titularesPorPalabra(gsap),
      entradasLaterales(gsap),
      parallaxSecciones(gsap),
      coleccionAnclada(gsap),
      marquesinas(gsap),
    ];
    return () => limpiezas.forEach((f) => typeof f === 'function' && f());
  });

  /* ---- B · raton de verdad y pantalla grande ------------------------ */
  mm.add(PUNTERO_FINO, () => {
    const limpiezas = [heroRaton(gsap), initTilt(), initCursor(), initMagnetic()];
    return () => limpiezas.forEach((f) => typeof f === 'function' && f());
  });

  /* ---- C · sin movimiento: asegurar que nada quede escondido -------- */
  mm.add(SIN_MOVIMIENTO, () => {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-visible', 'in'));
    document.documentElement.classList.remove('js-motion');
    // El video de portada NO se toca aqui: por decision expresa es la unica
    // excepcion a la regla y se reproduce siempre. Se monta fuera de
    // matchMedia, en initMotion(). Todo lo demas si se queda quieto.
  });

  return true;
}

/* ==========================================================================
   4 · SCROLL SUAVE
   Solo en punteros finos: en tactil el scroll nativo gana siempre, y en iOS
   competir con el rebote del sistema se nota como lag. Los overlays con
   scroll propio llevan data-lenis-prevent o se quedarian bloqueados.
   ========================================================================== */
function montarLenis(gsap, ScrollTrigger) {
  if (!window.Lenis) return null;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  const l = new window.Lenis({
    lerp: CONFIG.lenis.lerp,
    wheelMultiplier: CONFIG.lenis.wheelMultiplier,
    smoothWheel: true,
    autoRaf: false,
  });
  l.on('scroll', ScrollTrigger.update);
  const tick = (t) => l.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  window.VelmontLenis = l;

  return () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    l.destroy();
    window.VelmontLenis = null;
  };
}

/* ==========================================================================
   5 · HERO — recorrido continuo, no un disparo
   El titular sube MENOS que el fondo: esa diferencia de velocidad es la
   profundidad, y la pieza escala levemente.

   El recorrido es la SALIDA de la portada (start top top / end bottom top),
   no una pista extra por debajo. Antes el scrub terminaba a los 270px contra
   un velo crema opaco y despues venian 870px de nada: el desvanecido ahora va
   pegado a la portada yendose de cuadro, que es movimiento que ya ocurre.
   ========================================================================== */
function heroScrub(gsap) {
  const wrap = $('[data-scrub]');
  if (!wrap) return null;
  const copy = $('.hero-copy', wrap);
  const fig = $('.hero-figure', wrap);
  const marca = $('.hero__wordmark', wrap);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: wrap, start: 'top top', end: 'bottom top', scrub: 0.6 },
  });
  if (copy) tl.to(copy, { yPercent: -9, opacity: 0, filter: 'blur(7px)' }, 0);
  if (marca) tl.to(marca, { yPercent: -26 }, 0);
  if (fig) tl.to(fig, { scale: 1.06, yPercent: 4 }, 0);
  return null;
}

/* ==========================================================================
   5b · FONDO DE VIDEO
   Se monta FUERA de gsap.matchMedia y fuera de la orquesta, a proposito:
   es la unica excepcion acordada a la regla de menos movimiento —el video de
   portada se reproduce siempre— y ademas asi arranca aunque las librerias de
   animacion no lleguen a cargar. El resto del sitio si sigue respetando
   prefers-reduced-motion.
   ========================================================================== */
function elVideoFondo() { return $('[data-hero-video] video'); }

/**
 * Insiste en arrancar. El atributo `autoplay` falla mas de lo que parece:
 * Safari no arranca si el clip aun no tiene suficiente buffer, y las webviews
 * de apps (el navegador de WhatsApp, sin ir mas lejos) a veces exigen que la
 * llamada salga de JS. Asi que se prueba al montar, en cuanto hay datos, al
 * volver a la pestana y —ultimo recurso— al primer toque del usuario.
 *
 * NO se respeta `saveData` aqui: el clip es la portada, no un extra, y se
 * sirve una version de 567 KB al movil. El ahorro de datos dejaba la portada
 * congelada sin que nadie entendiera por que.
 */
function videoFondo() {
  const v = elVideoFondo();
  if (!v) return null;

  let dentro = true;
  const intentar = () => {
    if (!dentro || !v.paused) return;
    const p = v.play();
    if (p) p.catch(() => { /* bloqueado: queda el reintento al primer toque */ });
  };

  const obs = new IntersectionObserver(([e]) => {
    dentro = e.isIntersecting;
    if (dentro) intentar(); else v.pause();
  }, { threshold: 0.01 });
  obs.observe(v);

  v.addEventListener('loadeddata', intentar);
  v.addEventListener('canplay', intentar);
  document.addEventListener('visibilitychange', intentar);
  // Un gesto real levanta cualquier bloqueo que quede. Una sola vez.
  const alTocar = () => intentar();
  document.addEventListener('pointerdown', alTocar, { once: true, passive: true });
  document.addEventListener('touchstart', alTocar, { once: true, passive: true });
  intentar();

  return () => {
    obs.disconnect();
    v.removeEventListener('loadeddata', intentar);
    v.removeEventListener('canplay', intentar);
    document.removeEventListener('visibilitychange', intentar);
    document.removeEventListener('pointerdown', alTocar);
    document.removeEventListener('touchstart', alTocar);
  };
}

/* Halo respirando. Lo mueve GSAP entero: el centrado va por la propiedad
   `translate` de CSS, que no compite con `transform`. */
function haloRespirando(gsap) {
  const halo = $('.hero-halo');
  if (!halo) return null;
  gsap.to(halo, {
    scale: 1.08,
    opacity: 0.66,
    duration: CONFIG.hero.haloSeg / 2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
  return null;
}

/* Parallax de raton por capas. Planos Z distintos y suavizado propio: el
   frasco se mueve entero, el halo la mitad, la marca de agua una quinta
   parte. Tope duro en CONFIG.hero.raton px. */
function heroRaton(gsap) {
  const stick = $('.hero-stick');
  if (!stick) return null;
  const capas = [
    { el: $('.hero-figure', stick), z: 1 },
    { el: $('.hero-halo', stick), z: 0.5 },
    { el: $('.hero__wordmark', stick), z: 0.2 },
  ].filter((c) => c.el);
  if (!capas.length) return null;

  const max = CONFIG.hero.raton;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const mover = (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2 * max;
    ty = (e.clientY / window.innerHeight - 0.5) * 2 * max;
  };
  const loop = () => {
    cx += (tx - cx) * CONFIG.hero.lerp;
    cy += (ty - cy) * CONFIG.hero.lerp;
    for (const c of capas) gsap.set(c.el, { x: cx * c.z, y: cy * c.z });
    raf = requestAnimationFrame(loop);
  };
  window.addEventListener('mousemove', mover, { passive: true });
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('mousemove', mover);
    for (const c of capas) gsap.set(c.el, { clearProps: 'x,y' });
  };
}

/* ==========================================================================
   6 · TITULARES PALABRA POR PALABRA
   Solo los titulos. Los parrafos entran como bloque: si todo entra palabra
   a palabra, deja de ser un gesto y se vuelve un tic.
   ========================================================================== */
function partirEnPalabras(el) {
  if (el.dataset.partido === '1') return $$('.pal__in', el);
  // Solo texto plano: si el titular trae <em> u otro marcado, no se toca.
  if (el.children.length) return [];
  const texto = el.textContent;
  if (!texto.trim()) return [];
  const frag = document.createDocumentFragment();
  for (const trozo of texto.split(/(\s+)/)) {
    if (!trozo) continue;
    if (!trozo.trim()) {
      frag.appendChild(document.createTextNode(trozo));
      continue;
    }
    const caja = document.createElement('span');
    caja.className = 'pal';
    const dentro = document.createElement('span');
    dentro.className = 'pal__in';
    dentro.textContent = trozo;
    caja.appendChild(dentro);
    frag.appendChild(caja);
  }
  el.textContent = '';
  el.appendChild(frag);
  el.dataset.partido = '1';
  return $$('.pal__in', el);
}

function titularesPorPalabra(gsap) {
  for (const t of $$('[data-words]')) {
    const palabras = partirEnPalabras(t);
    if (!palabras.length) continue;
    gsap.fromTo(
      palabras,
      { yPercent: 108, clipPath: 'inset(0 0 100% 0)' },
      {
        yPercent: 0,
        clipPath: 'inset(0 0 -12% 0)',
        duration: 0.95,
        ease: 'power3.out',
        stagger: CONFIG.titulo.palabraMs / 1000,
        scrollTrigger: { trigger: t, start: 'top 85%', once: true },
      }
    );
  }
  return null;
}

/* Cifras y antetitulos: desplazamiento lateral corto, no fundido.
 *
 * El `y: 0` NO sobra. Estos elementos tambien llevan [data-reveal], que
 * arranca con `transform: translateY(26px)` desde el CSS. GSAP solo escribia
 * la X, asi que tomaba la Y que encontraba —esos 26px— y la dejaba grabada en
 * su propio transform para siempre: `translate(0px, 26px)`. Resultado, TODOS
 * los antetitulos del sitio 26px mas abajo de su sitio, tapando lo de arriba.
 * Declarando las dos coordenadas, GSAP es dueño del transform entero.
 */
function entradasLaterales(gsap) {
  for (const p of $$('.section-index, [data-side-in]')) {
    gsap.fromTo(
      p,
      { x: -18, y: 0, opacity: 0 },
      {
        x: 0,
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: p, start: 'top 90%', once: true },
      }
    );
  }
  return null;
}

/* ==========================================================================
   7 · PARALLAX DE SECCION
   Imagen y texto a velocidades distintas dentro del mismo bloque. Recorridos
   cortos: pasado cierto punto se lee como un fallo de maquetacion.
   ========================================================================== */
function parallaxSecciones(gsap) {
  for (const sec of $$('[data-parallax]')) {
    const img = $('.world__figure img, .band-wide__media img, img', sec);
    const txt = $('.world__text, .band-wide__copy, .world__title', sec);
    const base = { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.8 };
    // `y: 0` por lo mismo que en entradasLaterales: si el elemento lleva
    // [data-reveal], su translateY(26px) inicial se quedaria sumado al
    // parallax de por vida.
    if (img) {
      gsap.fromTo(img, { yPercent: -CONFIG.parallax.imagen, y: 0 }, { yPercent: CONFIG.parallax.imagen, y: 0, ease: 'none', scrollTrigger: base });
    }
    if (txt) {
      gsap.fromTo(txt, { yPercent: -CONFIG.parallax.texto, y: 0 }, { yPercent: CONFIG.parallax.texto, y: 0, ease: 'none', scrollTrigger: base });
    }
  }
  return null;
}

/* ==========================================================================
   8 · COLECCION ANCLADA EN HORIZONTAL
   La pagina se queda quieta y el catalogo avanza de lado. Solo en pantallas
   anchas: en movil ya existe el carrusel de arrastre, que es el gesto
   natural ahi. Se apaga desde el personalizador si no convence.
   ========================================================================== */
function coleccionAnclada(gsap) {
  const sec = $('[data-pin-h]');
  if (!sec) return null;
  if (!window.matchMedia('(min-width: 900px)').matches) return null;
  const track = $('[data-pin-track]', sec);
  if (!track) return null;

  const recorrido = () => Math.max(0, track.scrollWidth - window.innerWidth + 120);
  if (recorrido() < 80) return null;

  const tw = gsap.to(track, {
    x: () => -recorrido(),
    ease: 'none',
    scrollTrigger: {
      trigger: sec,
      pin: true,
      scrub: 0.8,
      start: 'top top',
      end: () => '+=' + recorrido(),
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  });
  return () => {
    if (tw.scrollTrigger) tw.scrollTrigger.kill(true);
    tw.kill();
    gsap.set(track, { clearProps: 'x' });
  };
}

/* ==========================================================================
   13 · MARQUESINAS DE LAS CASAS
   --------------------------------------------------------------------------
   Bucle real, sin costura: el contenido de cada tira se duplica y el tween
   recorre exactamente la mitad del ancho. Al repetir, la copia cae donde
   estaba el original, asi que no hay salto que ver.

   Nada de scrollLeft: solo transform.

   Se monta cuando global.js ha repartido los nombres (evento velmont:casas).
   Si ya estaban repartidos al entrar aqui, se monta directamente.
   ========================================================================== */
function marquesinas(gsap) {
  const set = document.querySelector('[data-houses]');
  if (!set) return null;

  let tweens = [];
  let limpiezas = [];
  let montado = false;

  const montar = () => {
    if (montado) return;
    const tiras = [...set.querySelectorAll('[data-marquee]')];
    if (!tiras.length) return;
    // Sin contenido en ninguna tira no hay nada que derivar.
    if (!tiras.some((t) => t.querySelector('[data-track]')?.children.length)) return;
    montado = true;

    for (const tira of tiras) {
      const track = tira.querySelector('[data-track]');
      if (!track || !track.children.length) continue;

      // Duplicado para el bucle. Los hijos son enlaces y separadores: clonar
      // no rompe nada porque los listeners van delegados en el documento.
      const copia = track.cloneNode(true);
      while (copia.firstChild) track.appendChild(copia.firstChild);

      const mitad = () => track.scrollWidth / 2;
      const derecha = tira.dataset.dir === 'right';
      const seg = Number(tira.dataset.seg) || 55;
      const desde = derecha ? -mitad() : 0;
      const hasta = derecha ? 0 : -mitad();

      gsap.set(track, { x: desde });
      const tw = gsap.to(track, {
        x: hasta,
        duration: seg,
        ease: 'none',
        repeat: -1,
        overwrite: true,
      });
      tw.vars.__desde = desde;
      tw.vars.__hasta = hasta;
      tweens.push(tw);

      limpiezas.push(arrastre(gsap, tira, track, tw, mitad));
    }

    // Al pasar el cursor sobre CUALQUIER tira, todas se frenan al 25%.
    // Sensacion de control sin detener el movimiento.
    const frenar = () => tweens.forEach((t) => gsap.to(t, { timeScale: 0.25, duration: 0.5, overwrite: true }));
    const soltar = () => tweens.forEach((t) => gsap.to(t, { timeScale: 1, duration: 0.7, overwrite: true }));
    set.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') frenar(); });
    set.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') soltar(); });
    limpiezas.push(() => {
      set.removeEventListener('pointerenter', frenar);
      set.removeEventListener('pointerleave', soltar);
    });
  };

  // El reparto entre tiras lo hace global.js tras una peticion, asi que NO se
  // monta de entrada: hacerlo dejaba las tiras 2 y 3 vacias y solo derivaba la
  // primera. Se espera al evento, con una red de seguridad por si la peticion
  // nunca llega (entonces estan todas en la primera tira y se anima esa).
  document.addEventListener('velmont:casas', montar);
  const plazo = setTimeout(montar, 4000);

  return () => {
    clearTimeout(plazo);
    document.removeEventListener('velmont:casas', montar);
    limpiezas.forEach((f) => typeof f === 'function' && f());
    tweens.forEach((t) => t.kill());
    tweens = [];
    limpiezas = [];
  };
}

/**
 * Arrastre con el dedo. Solo en tactil: en escritorio el arrastre competiria
 * con el clic de los enlaces, y ahi ya esta el freno por hover.
 *
 * Al soltar se recalcula el progreso del tween desde la posicion real, para
 * que retome la deriva justo donde quedo en vez de dar un salto.
 */
function arrastre(gsap, tira, track, tw, mitad) {
  let activo = false, x0 = 0, xIni = 0, movido = 0;

  const abajo = (e) => {
    if (e.pointerType === 'mouse') return;
    activo = true; movido = 0;
    x0 = e.clientX;
    xIni = Number(gsap.getProperty(track, 'x'));
    tw.pause();
  };
  const mover = (e) => {
    if (!activo) return;
    const d = e.clientX - x0;
    movido = Math.abs(d);
    // Solo se captura el puntero cuando hay arrastre de verdad: capturarlo en
    // el pointerdown le robaria el clic a los enlaces.
    if (movido > 8 && !tira.classList.contains('is-dragging')) {
      tira.classList.add('is-dragging');
      try { tira.setPointerCapture(e.pointerId); } catch { /* ya capturado */ }
    }
    gsap.set(track, { x: xIni + d });
  };
  const arriba = (e) => {
    if (!activo) return;
    activo = false;
    tira.classList.remove('is-dragging');
    try { tira.releasePointerCapture(e.pointerId); } catch { /* no capturado */ }

    // Normaliza la posicion dentro del ciclo y reanuda desde ahi.
    const m = mitad();
    let x = Number(gsap.getProperty(track, 'x'));
    x = ((x % m) + m) % m - m;                 // siempre en [-m, 0)
    const { __desde: a, __hasta: b } = tw.vars;
    const p = Math.min(1, Math.max(0, (x - a) / (b - a)));
    gsap.set(track, { x });
    tw.progress(p);
    tw.play();
  };

  tira.addEventListener('pointerdown', abajo, { passive: true });
  tira.addEventListener('pointermove', mover, { passive: true });
  tira.addEventListener('pointerup', arriba);
  tira.addEventListener('pointercancel', arriba);

  return () => {
    tira.removeEventListener('pointerdown', abajo);
    tira.removeEventListener('pointermove', mover);
    tira.removeEventListener('pointerup', arriba);
    tira.removeEventListener('pointercancel', arriba);
    tira.classList.remove('is-dragging');
  };
}

/* ==========================================================================
   9 · TILT 3D — angulo en variables CSS, la sombra sigue al angulo
   ========================================================================== */
function initTilt() {
  const cards = $$('[data-tilt]');
  if (!cards.length) return null;
  const { maxDeg, lift, shadow } = CONFIG.tilt;
  const quitar = [];

  cards.forEach((card) => {
    let raf = null;
    const mover = (e) => {
      if (e.pointerType !== 'mouse' || raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.classList.remove('is-leaving');
        card.style.setProperty('--ry', (px * maxDeg * 2).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-py * maxDeg * 2).toFixed(2) + 'deg');
        card.style.setProperty('--tz', lift + 'px');
        card.style.setProperty('--tilt-shadow', (-px * 26).toFixed(0) + 'px ' + (18 + py * 10).toFixed(0) + 'px 40px ' + shadow);
      });
    };
    const salir = () => {
      card.classList.add('is-leaving');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--tz', '0px');
      card.style.setProperty('--tilt-shadow', '0 0 0 rgba(0,0,0,0)');
    };
    card.addEventListener('pointermove', mover);
    card.addEventListener('pointerleave', salir);
    quitar.push(() => {
      card.removeEventListener('pointermove', mover);
      card.removeEventListener('pointerleave', salir);
      salir();
    });
  });
  return () => quitar.forEach((f) => f());
}

/* ==========================================================================
   10 · CURSOR CON ETIQUETA
   ========================================================================== */
function initCursor() {
  if ($('.cursor')) return null;
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<div class="cursor-dot"></div><span class="cursor-label"></span>';
  document.body.appendChild(cursor);
  document.body.classList.add('cursor-on');

  const dot = $('.cursor-dot', cursor);
  const label = $('.cursor-label', cursor);
  let mx = window.innerWidth / 2, my = window.innerHeight / 2, cx = mx, cy = my, raf = 0;

  const mover = (e) => {
    mx = e.clientX;
    my = e.clientY;
    cursor.classList.add('is-ready');
  };
  const loop = () => {
    cx += (mx - cx) * CONFIG.cursor.lerp;
    cy += (my - cy) * CONFIG.cursor.lerp;
    dot.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
    label.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0) translate(-50%,-50%)';
    raf = requestAnimationFrame(loop);
  };
  const sobre = (e) => {
    const zona = e.target.closest('[data-cursor-label]');
    // Sobre un boton DENTRO de la zona (Añadir, el corazon de la pieza) la
    // etiqueta mentiria: diria «Ver» y el clic añade. Y el disco lo taparia.
    // Ahi vuelve el punto pequeño.
    const control = e.target.closest('button, input, select, textarea');
    if (zona && !(control && control !== zona && zona.contains(control))) {
      cursor.classList.add('is-active');
      label.textContent = zona.dataset.cursorLabel;
    } else if (!e.target.closest('.cursor')) {
      cursor.classList.remove('is-active');
      label.textContent = '';
    }
  };
  const fuera = () => cursor.classList.remove('is-ready');

  window.addEventListener('mousemove', mover, { passive: true });
  document.addEventListener('mouseover', sobre);
  document.addEventListener('mouseleave', fuera);
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseover', sobre);
    document.removeEventListener('mouseleave', fuera);
    cursor.remove();
    document.body.classList.remove('cursor-on');
  };
}

/* ==========================================================================
   11 · BOTONES MAGNETICOS
   ========================================================================== */
function initMagnetic() {
  const els = $$('.act, [data-magnetic]');
  if (!els.length) return null;
  const quitar = [];
  els.forEach((el) => {
    const mover = (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1);
      const dy = ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1);
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    const salir = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerleave', salir);
    quitar.push(() => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerleave', salir);
      salir();
    });
  });
  return () => quitar.forEach((f) => f());
}

/* ==========================================================================
   12 · ARRANQUE
   ========================================================================== */
function refrescar() {
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
}

export function initMotion() {
  // Guardia a nivel de ventana, no de modulo: theme.liquid carga este archivo
  // con ?v=hash y un import relativo no lleva esa query, asi que el navegador
  // los trata como dos modulos distintos y montaria DOS cursores.
  if (window.VelmontMotion && window.VelmontMotion.booted) return;
  window.VelmontMotion = { booted: true, initReveal, CONFIG, refrescar };

  initLoader();
  initReveal();
  videoFondo();   // fuera de la orquesta: tiene que arrancar pase lo que pase

  if (!montarOrquesta()) {
    // Sin librerias no se anima, pero NADA puede quedarse escondido.
    document.documentElement.classList.remove('js-motion');
    $$('[data-reveal]').forEach((el) => el.classList.add('is-visible', 'in'));
  }
}

/* Red de seguridad: solo actua si la capa NUNCA arranco. Un temporizador fijo
   que fuerza "mostrar todo" cancelaria los reveals legitimos. */
setTimeout(() => {
  if (!(window.VelmontMotion && window.VelmontMotion.booted)) {
    document.documentElement.classList.remove('js-motion');
  }
}, 3500);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMotion);
} else {
  initMotion();
}
