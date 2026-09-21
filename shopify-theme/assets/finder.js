// VELMONT — Descubre tu firma. Experiencia a pantalla completa: una
// pregunta por pantalla, opciones como tipografia grande, sin radio buttons
// ni "paso 1 de 4". La logica de scoring contra el catalogo se mantiene.
import { getProducts, formatCOP } from './catalog.js';
import { pieceHTML } from './piece.js';
import { initReveal } from './ui.js';

const STEPS = [
  {
    key: 'gender', title: 'Para quién', multi: false,
    options: [
      { value: 'hombre', label: 'Para él' },
      { value: 'mujer', label: 'Para ella' },
      { value: 'unisex', label: 'Sin género' },
    ]
  },
  {
    key: 'personality', title: 'Cómo quieres ser recordado', multi: true, max: 2,
    options: [
      { value: 'misterioso', label: 'Misterioso' },
      { value: 'elegante', label: 'Elegante' },
      { value: 'intenso', label: 'Intenso' },
      { value: 'seductor', label: 'Irresistible' },
      { value: 'sofisticado', label: 'Sofisticado' },
      { value: 'fresco', label: 'Luminoso' },
      { value: 'dulce', label: 'Cálido' },
      { value: 'clasico', label: 'Atemporal' },
    ]
  },
  {
    key: 'occasion', title: 'Dónde lo vas a usar', multi: false,
    options: [
      { value: 'diario', label: 'Todos los días' },
      { value: 'oficina', label: 'La oficina' },
      { value: 'cita', label: 'Una cita' },
      { value: 'noche', label: 'La noche' },
      { value: 'evento', label: 'Un evento' },
      { value: 'vacaciones', label: 'El viaje' },
    ]
  },
  {
    key: 'intensity', title: 'Cuánto quieres que se note', multi: false,
    options: [
      { value: 'suave', label: 'Apenas un rastro' },
      { value: 'media', label: 'Lo justo' },
      { value: 'intensa', label: 'Que no haya duda' },
    ]
  },
];

const ORDER = ['suave', 'media', 'intensa'];

function score(product, a) {
  if (a.gender && a.gender !== 'unisex' && product.gender !== a.gender && product.gender !== 'unisex') return -1;
  let s = 0;
  s += (a.personality || []).filter(p => product.personality?.includes(p)).length * 3;
  if (a.occasion && product.occasion?.includes(a.occasion)) s += 2;
  if (a.intensity) {
    const d = Math.abs(ORDER.indexOf(product.intensity) - ORDER.indexOf(a.intensity));
    s += d === 0 ? 2 : d === 1 ? 1 : 0;
  }
  return s;
}

export async function getRecommendations(answers, limit = 4) {
  const products = await getProducts();
  return products
    .map(p => ({ p, s: score(p, answers) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.p);
}

export function mountFinder(root) {
  if (!root) return;
  root.innerHTML = `
    <section class="finder grain" data-finder data-tone="dark" aria-hidden="true" aria-label="Descubre tu firma">
      <div class="finder__progress"><i data-finder-bar></i></div>
      <div class="finder__bar">
        <span class="label" data-finder-step></span>
        <button class="icon-btn" data-finder-close aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>
      <div class="finder__body" data-finder-body></div>
    </section>`;

  const el = root.querySelector('[data-finder]');
  const body = root.querySelector('[data-finder-body]');
  const bar = root.querySelector('[data-finder-bar]');
  const stepLabel = root.querySelector('[data-finder-step]');
  const state = { i: 0, answers: { personality: [] } };

  const open = () => {
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    render();
  };
  const close = () => {
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  };
  root.querySelector('[data-finder-close]').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('open')) close(); });
  document.querySelectorAll('[data-finder-open]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(); }));

  function render() {
    const step = STEPS[state.i];
    bar.style.width = `${(state.i / STEPS.length) * 100}%`;
    stepLabel.textContent = `${String(state.i + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;

    const current = state.answers[step.key];
    body.innerHTML = `
      <h2 class="display finder__q" data-reveal>${step.title}</h2>
      <div class="finder__opts">
        ${step.options.map((o, i) => {
          const on = step.multi ? (current || []).includes(o.value) : current === o.value;
          return `<button class="finder__opt ${on ? 'on' : ''}" data-val="${o.value}" data-reveal style="--reveal-delay:${60 + i * 45}ms">${o.label}</button>`;
        }).join('')}
      </div>
      <div class="finder__foot" data-reveal style="--reveal-delay:420ms">
        ${step.multi ? '<button class="act" data-next>Continuar</button>' : ''}
        ${state.i > 0 ? '<button class="link" data-back>Atrás</button>' : ''}
        ${step.multi ? '<span class="label">Elige hasta dos</span>' : ''}
      </div>`;

    body.querySelectorAll('.finder__opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.val;
        if (step.multi) {
          const arr = state.answers[step.key] || [];
          if (arr.includes(v)) state.answers[step.key] = arr.filter(x => x !== v);
          else if (arr.length < (step.max || 99)) state.answers[step.key] = [...arr, v];
          render();
        } else {
          state.answers[step.key] = v;
          advance();
        }
      });
    });
    const next = body.querySelector('[data-next]');
    if (next) {
      next.disabled = (state.answers[step.key] || []).length === 0;
      next.addEventListener('click', advance);
    }
    body.querySelector('[data-back]')?.addEventListener('click', () => { state.i--; render(); });
    initReveal(body);
  }

  async function advance() {
    if (state.i < STEPS.length - 1) { state.i++; render(); return; }
    bar.style.width = '100%';
    stepLabel.textContent = `${String(STEPS.length).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
    body.innerHTML = `<h2 class="display finder__q" data-reveal>Leyendo tu perfil…</h2>`;
    initReveal(body);

    const recs = await getRecommendations(state.answers, 4);
    body.innerHTML = `
      <span class="section-index" data-reveal>Tu firma olfativa</span>
      <h2 class="display finder__q" data-reveal style="--reveal-delay:80ms">${recs.length ? 'Esto te define' : 'Sin coincidencias'}</h2>
      ${recs.length ? `<div class="finder__results">${recs.map(p => `<div class="finder__result">${pieceHTML(p, { reveal: false })}</div>`).join('')}</div>` : '<p class="lede">Prueba con otra combinación.</p>'}
      <div class="finder__foot" data-reveal style="--reveal-delay:300ms">
        <a class="act" href="/collection.html">Ver toda la colección</a>
        <button class="link" data-restart>Empezar de nuevo</button>
      </div>`;
    body.querySelector('[data-restart]')?.addEventListener('click', () => {
      state.i = 0; state.answers = { personality: [] }; render();
    });
    initReveal(body);
  }

  return { open, close };
}

export { formatCOP };
