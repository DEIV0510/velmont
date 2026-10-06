/* ==========================================================================
   VELMONT — Descubre tu marca personal.
   Una pregunta por pantalla, opciones como tipografia grande, sin radios ni
   "paso 1 de 4". Las preguntas las emite la seccion como JSON: este modulo no
   sabe nada del contenido.

   Cada paso se monta en su propio contenedor y se cruza lateralmente con el
   anterior: avanzar entra por la derecha, volver entra por la izquierda.

   El resultado sale del catalogo real: cada opcion puede apuntar a una
   coleccion y al final se piden sus piezas a /collections/<handle>?view=piezas.
   ========================================================================== */

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initQuiz({ showPanel, closePanel, initReveal } = {}) {
  const el = $('[data-quiz]');
  const dataTag = $('[data-quiz-data]');
  const openers = $$('[data-quiz-open]');
  if (!el || !dataTag || !openers.length) return; // sin seccion, los enlaces navegan normal

  let data;
  try { data = JSON.parse(dataTag.textContent); } catch { return; }
  const steps = (data.steps || []).filter((s) => s.options && s.options.length);
  if (!steps.length) return;

  const body = $('[data-quiz-body]', el);
  const bar = $('[data-quiz-bar]', el);
  const stepLabel = $('[data-quiz-step]', el);
  const state = { i: 0, answers: {} };

  const open = () => {
    state.i = 0;
    state.answers = {};
    body.innerHTML = '';
    render();
    showPanel ? showPanel(el) : el.classList.add('open');
  };
  const close = () => (closePanel ? closePanel() : el.classList.remove('open'));

  openers.forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); open(); }));
  $('[data-quiz-close]', el)?.addEventListener('click', close);

  /**
   * Monta el contenido en su propio paso y lo cruza con el anterior. El
   * saliente pasa a posicion absoluta mientras dura el cruce para que no
   * empuje al entrante ni deje un salto de altura.
   */
  function mount(html, dir) {
    const nuevo = document.createElement('div');
    nuevo.className = 'finder__step';
    if (!reduceMotion) {
      nuevo.classList.add('is-enter');
      if (dir === 'back') nuevo.classList.add('from-left');
    }
    nuevo.innerHTML = html;

    // El saliente es el ultimo paso que NO esta saliendo ya. Con
    // firstElementChild, si el resultado llegaba antes de que terminara el
    // cruce anterior, se marcaba dos veces el mismo paso y el intermedio
    // ("Leyendo tu perfil…") se quedaba en pantalla para siempre.
    const viejo = [...body.children].filter((c) => !c.classList.contains('is-exit')).pop();
    if (viejo) {
      viejo.classList.add('is-exit');
      if (dir === 'back') viejo.classList.add('to-right');
      setTimeout(() => viejo.remove(), 460);
    }
    body.appendChild(nuevo);
    if (!reduceMotion) requestAnimationFrame(() => nuevo.classList.remove('is-enter', 'from-left'));
    return nuevo;
  }

  /**
   * Acciones del pie. Van en su propio grupo para que la barra pueda separar
   * acciones (izquierda) de texto de ayuda (derecha) sin que nada se solape.
   * Si no hay ninguna accion no se emite el grupo: un div vacio en un
   * space-between desplaza la ayuda sin motivo.
   */
  function acciones(step) {
    const partes = [];
    if (step.multi) partes.push(`<button class="act" data-next aria-disabled="true">${data.next || 'Continuar'}</button>`);
    if (state.i > 0) partes.push(`<button class="link" data-back>${data.back || 'Atrás'}</button>`);
    return partes.length ? `<div class="finder__acts">${partes.join('')}</div>` : '';
  }

  /**
   * Estado del boton de avance. aria-disabled en vez del atributo disabled:
   * el boton sigue siendo enfocable y anunciable, el bloqueo real lo hace el
   * manejador. Asi el estado no depende solo del color.
   */
  function marcarAvance(btn, activo) {
    if (!btn) return;
    btn.setAttribute('aria-disabled', activo ? 'false' : 'true');
  }

  function progreso(n) {
    if (bar) bar.style.width = `${(n / steps.length) * 100}%`;
    if (stepLabel) {
      const actual = Math.min(n + 1, steps.length);
      stepLabel.textContent = `${String(actual).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
    }
  }

  function render(dir) {
    const step = steps[state.i];
    const key = String(state.i);
    const current = state.answers[key];
    progreso(state.i);

    const paso = mount(`
      <h2 class="display finder__q" data-reveal>${step.title}</h2>
      <div class="finder__opts">
        ${step.options.map((o, i) => {
          const on = step.multi ? (current || []).includes(o.label) : current === o.label;
          return `<button class="finder__opt ${on ? 'on' : ''}" data-val="${o.label}" data-handle="${o.handle || ''}"
                          data-reveal style="--i:${i}">${o.label}</button>`;
        }).join('')}
      </div>
      <div class="finder__foot" data-reveal>
        ${acciones(step)}
        ${step.hint ? `<span class="label finder__hint">${step.hint}</span>` : ''}
      </div>`, dir);

    $$('.finder__opt', paso).forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.val;
        if (step.multi) {
          const arr = state.answers[key] || [];
          if (arr.includes(v)) state.answers[key] = arr.filter((x) => x !== v);
          else if (arr.length < (step.max || 99)) state.answers[key] = [...arr, v];
          // Marcado en sitio: re-montar el paso entero por un toque cortaria
          // la animacion y perderia el foco del teclado.
          btn.classList.toggle('on', (state.answers[key] || []).includes(v));
          marcarAvance($('[data-next]', paso), (state.answers[key] || []).length > 0);
        } else {
          state.answers[key] = v;
          advance();
        }
      });
    });

    const next = $('[data-next]', paso);
    if (next) {
      marcarAvance(next, (state.answers[key] || []).length > 0);
      next.addEventListener('click', () => {
        if (next.getAttribute('aria-disabled') === 'true') return;
        advance();
      });
    }
    $('[data-back]', paso)?.addEventListener('click', () => { state.i -= 1; render('back'); });

    initReveal?.(paso);
  }

  /*
   * Recomendacion. Antes salian los 4 primeros de la coleccion del genero
   * —los ultimos subidos, con repetidos— y las otras tres respuestas no
   * contaban. Ahora cada respuesta suma familias olfativas y gana el perfume
   * cuya familia (la linea bajo el precio) coincide con mas; los empates se
   * barajan para que no salga siempre lo mismo. Un perfume publicado dos
   * veces (IL ROSO e ILMIN IL ROSO) solo sale una.
   * Las claves son las etiquetas de las opciones, sin tildes: si se cambia
   * una en el editor, esa respuesta deja de sumar (no rompe nada).
   */
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const PERFIL = {
    misterio: ['oud', 'amaderad', 'ahumad', 'cuero', 'incienso', 'resin', 'oriental', 'ambar'],
    elegancia: ['floral', 'chipre', 'iris', 'almizcl', 'aromatic', 'fougere'],
    intensidad: ['especiad', 'oriental', 'oud', 'cuero', 'ambar', 'gourmand'],
    magnetismo: ['ambar', 'vainill', 'gourmand', 'oriental', 'almizcl', 'dulce'],
    sofisticacion: ['chipre', 'cuero', 'iris', 'amaderad', 'floral'],
    luz: ['citric', 'acuatic', 'marin', 'fresc', 'verde', 'frutal', 'solar'],
    calidez: ['ambar', 'vainill', 'gourmand', 'especiad', 'dulce', 'oriental'],
    permanencia: ['oud', 'ambar', 'oriental', 'cuero', 'resin', 'extrait', 'parfum'],
    'todos los dias': ['citric', 'acuatic', 'aromatic', 'fresc', 'floral', 'almizcl'],
    'la oficina': ['citric', 'aromatic', 'acuatic', 'fresc', 'almizcl', 'verde'],
    'una cita': ['ambar', 'vainill', 'gourmand', 'floral', 'oriental', 'almizcl'],
    'la noche': ['oud', 'ambar', 'oriental', 'especiad', 'cuero', 'gourmand'],
    'un evento': ['oriental', 'ambar', 'oud', 'floral', 'chipre'],
    'el viaje': ['citric', 'acuatic', 'marin', 'fresc', 'aromatic'],
    'apenas un rastro': ['citric', 'acuatic', 'fresc', 'almizcl', 'verde', 'toilette'],
    'que no haya duda': ['oud', 'ambar', 'especiad', 'oriental', 'extrait', 'parfum', 'cuero'],
  };
  const clavesElegidas = () => Object.values(state.answers).flat().flatMap((l) => PERFIL[norm(l)] || []);
  const llave = (p) => {
    let t = norm(p.t);
    const casa = norm(p.v);
    if (casa && t.startsWith(casa + ' ')) t = t.slice(casa.length + 1);
    return t.replace(/\b(edt|edp|parfum|extrait|eau de (toilette|parfum)|\d+ ?ml)\b/g, '').replace(/\s+/g, ' ').trim();
  };
  async function recomendar(handle) {
    const res = await fetch(`/collections/${handle}?view=quiz`);
    if (!res.ok) return '';
    const lista = JSON.parse(await res.text());
    const claves = clavesElegidas();
    const vistos = new Set();
    const elegidos = lista
      .filter((p) => p.a && p.h !== 'duo-velmont')
      .map((p) => {
        const fam = norm(p.f);
        const puntos = claves.reduce((n, c) => n + (fam.includes(c) ? 1 : 0), 0) + (fam ? 0.5 : 0);
        return { ...p, puntos, azar: Math.random() };
      })
      .sort((x, y) => y.puntos - x.puntos || x.azar - y.azar)
      .filter((p) => { const l = llave(p); if (vistos.has(l)) return false; vistos.add(l); return true; })
      .slice(0, 4);
    if (!elegidos.length) return '';
    const html = await Promise.all(elegidos.map((p) => fetch(`/products/${p.h}?view=pieza`).then((r) => (r.ok ? r.text() : ''))));
    return html.join('').trim();
  }

  /** Coleccion elegida: la del paso mas reciente que aporte una. */
  function chosenHandle() {
    for (let i = state.i; i >= 0; i -= 1) {
      const step = steps[i];
      const answer = state.answers[String(i)];
      if (!answer) continue;
      const labels = Array.isArray(answer) ? answer : [answer];
      for (const label of labels) {
        const opt = step.options.find((o) => o.label === label);
        if (opt && opt.handle) return opt.handle;
      }
    }
    return '';
  }

  async function advance() {
    if (state.i < steps.length - 1) { state.i += 1; render(); return; }

    progreso(steps.length);
    mount(`<h2 class="display finder__q">${data.reading || 'Leyendo tu perfil…'}</h2>`);

    const handle = chosenHandle() || 'all';
    let pieces = '';
    try { pieces = await recomendar(handle); } catch { /* abajo, el camino de siempre */ }
    if (!pieces) {
      try {
        const res = await fetch(`/collections/${handle}?view=piezas&limit=4`);
        if (res.ok) pieces = (await res.text()).trim();
      } catch { /* si falla, se muestra el camino alterno */ }
    }

    const paso = mount(`
      <span class="section-index" data-reveal style="--i:0">${data.resultIndex || ''}</span>
      <h2 class="display finder__q" data-reveal style="--i:1">${
        pieces ? (data.resultHeading || '') : 'Sin coincidencias'
      }</h2>
      ${pieces
        ? `<div class="finder__results">${pieces}</div>`
        : `<p class="lede">${data.resultEmpty || ''}</p>`}
      <div class="finder__foot" data-reveal style="--i:3">
        <a class="act" href="${data.resultCtaUrl || '/collections/all'}">${data.resultCta || 'Ver toda la colección'}</a>
        <button class="link" data-restart>${data.restart || 'Empezar de nuevo'}</button>
      </div>`);

    // Las piezas del resultado entran escalonadas, no todas de golpe
    $$('.finder__result, .finder__results > *', paso).forEach((x, i) => {
      x.setAttribute('data-reveal', '');
      x.style.setProperty('--i', i + 2);
    });

    $('[data-restart]', paso)?.addEventListener('click', () => {
      state.i = 0;
      state.answers = {};
      render('back');
    });
    initReveal?.(paso);
  }
}
