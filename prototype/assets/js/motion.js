// VELMONT — capa cinematografica: cursor de marca, botones magneticos,
// revelado de texto palabra por palabra, profundidad en la ficha de
// producto y el carrusel de relacionados. Todo desktop-only donde aplica
// (pointer: fine) y apagado bajo prefers-reduced-motion. Nada aqui anima
// width/height/top/left: solo transform y opacity.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;

/**
 * Cursor de marca: un punto que sigue al puntero con una inercia leve
 * (lerp) y crece sobre elementos interactivos. Usa mix-blend-mode:difference
 * para leerse sobre cualquier fondo sin tener que rastrear el tono de cada
 * seccion. Se apaga por completo sobre campos de texto (el cursor nativo
 * sigue disponible ahi) y en touch/reduced-motion no se activa.
 */
export function initCursor() {
  if (reduce || !fine) return;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  document.body.classList.add('cursor-on');

  let x = -100, y = -100, cx = -100, cy = -100, ready = false;
  window.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (!ready) { ready = true; cx = x; cy = y; dot.classList.add('ready'); }
  }, { passive: true });

  const tick = () => {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    dot.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const isField = (t) => t.closest('input, textarea, select, [contenteditable]');
  document.addEventListener('pointerover', e => {
    if (isField(e.target)) { dot.classList.add('hide'); return; }
    dot.classList.remove('hide');
    dot.classList.toggle('grow', !!e.target.closest('a, button, [data-cursor]'));
  });
  document.addEventListener('pointerdown', () => dot.classList.add('press'));
  document.addEventListener('pointerup', () => dot.classList.remove('press'));
  document.addEventListener('pointerleave', () => dot.classList.add('hide'));
  document.addEventListener('pointerenter', () => dot.classList.remove('hide'));
}

/**
 * Botones magneticos: el CTA se desplaza unos px hacia el cursor y vuelve
 * al soltar. Solo en .act y .icon-btn — ninguno trae un transform propio
 * en su estado base, asi que fijar style.transform aqui no pisa nada
 * (el logo del header SI trae un transform de centrado y queda fuera).
 */
export function initMagnetic() {
  if (reduce || !fine) return;
  document.querySelectorAll('.act, .icon-btn').forEach(el => {
    let raf = null;
    el.addEventListener('mousemove', e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - r.left - r.width / 2) * 0.22;
        const my = (e.clientY - r.top - r.height / 2) * 0.3;
        el.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
        raf = null;
      });
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/**
 * Revelado palabra por palabra. Reutiliza el observer de [data-reveal] que
 * ya existe en initReveal(): el selector de atributo coincide con
 * data-reveal="words" igual que coincide con "wipe", asi que solo hace
 * falta partir el texto en spans ANTES de llamar a initReveal().
 */
export function initWordReveal() {
  document.querySelectorAll('[data-reveal="words"]:not([data-split])').forEach(el => {
    el.dataset.split = '1';
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    const words = text.split(/\s+/);
    el.innerHTML = words.map((w, i) => `<span class="word" style="--wi:${i}"><span>${w}</span></span>`).join(' ');
  });
}

/**
 * Ficha de producto: leve inclinacion del frasco hacia el cursor. La
 * columna de info va sticky por CSS (ver components.css); aqui solo se
 * encarga del tilt, compuesto en variables CSS para no pisar el
 * transform propio del elemento.
 */
export function initPdpTilt() {
  const stage = document.querySelector('[data-pdp-stage]');
  if (!stage || reduce || !fine) return;
  const media = stage.querySelector('svg, img');
  if (!media) return;
  let raf = null;
  stage.addEventListener('mousemove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      media.style.setProperty('--tilt-x', `${(-py * 10).toFixed(2)}deg`);
      media.style.setProperty('--tilt-y', `${(px * 10).toFixed(2)}deg`);
      raf = null;
    });
  });
  stage.addEventListener('mouseleave', () => {
    media.style.setProperty('--tilt-x', '0deg');
    media.style.setProperty('--tilt-y', '0deg');
  });
}

/**
 * Carrusel de relacionados: arrastre con mouse (el swipe tactil ya
 * funciona nativo via overflow-x, asi que en touch no se intercepta
 * nada) y la pieza mas centrada queda "activa" — un poco mas de foco.
 * Tambien evita que soltar el arrastre sobre un enlace dispare la
 * navegacion, el bug clasico de los carruseles con drag.
 */
export function initReel(scope = document) {
  scope.querySelectorAll('[data-reel]:not([data-reel-ready])').forEach(el => {
    el.dataset.reelReady = '1';
    let down = false, startX = 0, startScroll = 0, moved = false, justDragged = false, pid = null;

    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      down = true; moved = false; startX = e.clientX; startScroll = el.scrollLeft;
      pid = e.pointerId;
      // OJO: capturar el puntero aqui (antes de saber si hay arrastre) hace
      // que el navegador retargete tambien el click resultante al .reel, y
      // un simple tap en una tarjeta deja de "activar" el enlace. Por eso
      // la captura se pide recien en pointermove, solo si de verdad hubo
      // arrastre (ver mas abajo).
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        if (!moved) { moved = true; el.classList.add('dragging'); el.setPointerCapture(pid); }
        el.scrollLeft = startScroll - dx;
      }
    });
    const up = () => {
      if (!down) return;
      down = false;
      el.classList.remove('dragging');
      if (moved) justDragged = true;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('mouseleave', up);
    // Un unico listener fijo, no uno por arrastre: si el arrastre suelta
    // fuera de una tarjeta y nunca llega a disparar su propio click, un
    // listener "de un solo uso" quedaria pegado y se comeria el SIGUIENTE
    // click en cualquier otra tarjeta. Con una bandera no hay fuga posible.
    el.addEventListener('click', e => {
      if (!justDragged) return;
      justDragged = false;
      e.stopPropagation();
      e.preventDefault();
    }, { capture: true });

    const setActive = () => {
      if (!fine) return; // en touch el foco por centro no aporta y cuesta reflow
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      let best = null, bestD = Infinity;
      [...el.children].forEach(c => {
        const cr = c.getBoundingClientRect();
        const d = Math.abs((cr.left + cr.width / 2) - cx);
        if (d < bestD) { bestD = d; best = c; }
      });
      el.querySelectorAll(':scope > .active').forEach(c => c.classList.remove('active'));
      best?.classList.add('active');
    };
    let raf = null;
    el.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { setActive(); raf = null; }); }, { passive: true });
    setActive();
  });
}
