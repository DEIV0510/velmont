/* ==========================================================================
   VELMONT — galerias deslizables.
   En escritorio la coleccion es una composicion de 12 columnas: aqui no hay
   carrusel. En <=859px se convierte en tira con scroll-snap nativo y este
   modulo solo pinta el indicador. El .reel (relacionados) si se arrastra.
   ========================================================================== */

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

/** Indicador "02 / 06" + filete de progreso de la galeria de la home. */
export function initSwipeHint() {
  const scroller = $('[data-composition]');
  const hint = $('[data-swipe-hint]');
  if (!scroller || !hint || scroller.dataset.hintBound) return;
  scroller.dataset.hintBound = '1';

  const count = $('[data-swipe-count]', hint);
  const total = scroller.children.length;
  if (!total) return;
  let raf = null;

  const update = () => {
    raf = null;
    const max = scroller.scrollWidth - scroller.clientWidth;
    if (max <= 0) return;
    hint.style.setProperty('--p', String(Math.max(0.12, scroller.scrollLeft / max)));

    const left = scroller.getBoundingClientRect().left;
    let idx = 0;
    let best = Infinity;
    [...scroller.children].forEach((el, i) => {
      const d = Math.abs(el.getBoundingClientRect().left - left);
      if (d < best) { best = d; idx = i; }
    });
    // La ultima pieza nunca llega al borde izquierdo: al tope, es la ultima
    if (scroller.scrollLeft >= max - 2) idx = total - 1;
    if (count) count.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  };

  scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  scroller.addEventListener('scrollend', update);
  update();
}

/**
 * Carrusel de relacionados: se arrastra con el mouse y desliza nativo en
 * tactil. La pieza mas centrada queda con foco total; el resto se atenua.
 *
 * setPointerCapture solo se llama tras confirmar movimiento real: capturarlo
 * en pointerdown redirige el click siguiente al contenedor y mata los toques.
 */
export function initReel(scope = document) {
  $$('[data-reel]', scope).forEach((reel) => {
    if (reel.dataset.reelBound) return;
    reel.dataset.reelBound = '1';

    let down = false;
    let dragging = false;
    let justDragged = false;
    let startX = 0;
    let startLeft = 0;
    let pointerId = null;

    reel.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true;
      dragging = false;
      startX = e.clientX;
      startLeft = reel.scrollLeft;
      pointerId = e.pointerId;
    });

    reel.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < 6) return; // umbral: sin esto, un click cuenta como arrastre
        dragging = true;
        reel.classList.add('dragging');
        reel.setPointerCapture(pointerId);
      }
      reel.scrollLeft = startLeft - dx;
    });

    const end = () => {
      if (!down) return;
      down = false;
      if (dragging) {
        justDragged = true;
        // bandera persistente, no un listener de un solo uso: si el arrastre
        // no termina en click, el listener quedaria colgado para el siguiente
        setTimeout(() => { justDragged = false; }, 0);
      }
      dragging = false;
      reel.classList.remove('dragging');
      if (pointerId !== null && reel.hasPointerCapture?.(pointerId)) reel.releasePointerCapture(pointerId);
      pointerId = null;
    };
    reel.addEventListener('pointerup', end);
    reel.addEventListener('pointercancel', end);
    reel.addEventListener('click', (e) => { if (justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);

    // La pieza mas centrada se destaca
    let raf = null;
    const mark = () => {
      raf = null;
      const mid = reel.getBoundingClientRect().left + reel.clientWidth / 2;
      let best = null;
      let dist = Infinity;
      [...reel.children].forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < dist) { dist = d; best = el; }
      });
      [...reel.children].forEach((el) => el.classList.toggle('active', el === best));
    };
    reel.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, { passive: true });
    mark();
  });
}
