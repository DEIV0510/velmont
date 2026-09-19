// VELMONT — Perfume Finder: quiz de 4 pasos con scoring simple contra el catalogo
import { getProducts, bottleSVG, formatCOP } from './catalog.js';

const STEPS = [
  {
    key: 'gender', title: '¿PARA QUIÉN BUSCAS?', multi: false,
    options: [
      { value: 'hombre', label: 'Hombre' },
      { value: 'mujer', label: 'Mujer' },
      { value: 'unisex', label: 'Unisex' },
    ]
  },
  {
    key: 'personality', title: '¿QUÉ PERSONALIDAD QUIERES TRANSMITIR?', multi: true, max: 2,
    options: [
      { value: 'seductor', label: 'Seductor' },
      { value: 'elegante', label: 'Elegante' },
      { value: 'intenso', label: 'Intenso' },
      { value: 'fresco', label: 'Fresco' },
      { value: 'misterioso', label: 'Misterioso' },
      { value: 'sofisticado', label: 'Sofisticado' },
      { value: 'dulce', label: 'Dulce' },
      { value: 'clasico', label: 'Clásico' },
    ]
  },
  {
    key: 'occasion', title: '¿CUÁNDO LO USARÁS?', multi: false,
    options: [
      { value: 'diario', label: 'Diario' },
      { value: 'oficina', label: 'Oficina' },
      { value: 'cita', label: 'Cita' },
      { value: 'noche', label: 'Noche' },
      { value: 'evento', label: 'Evento' },
      { value: 'vacaciones', label: 'Vacaciones' },
    ]
  },
  {
    key: 'intensity', title: '¿QUÉ INTENSIDAD PREFIERES?', multi: false,
    options: [
      { value: 'suave', label: 'Suave' },
      { value: 'media', label: 'Media' },
      { value: 'intensa', label: 'Intensa' },
    ]
  },
];

const INTENSITY_ORDER = ['suave', 'media', 'intensa'];

function scoreProduct(product, answers) {
  let score = 0;
  if (answers.gender && answers.gender !== 'unisex' && product.gender !== answers.gender && product.gender !== 'unisex') {
    return -1; // descarta genero incompatible
  }
  const personality = answers.personality || [];
  score += personality.filter(p => product.personality?.includes(p)).length * 3;

  if (answers.occasion && product.occasion?.includes(answers.occasion)) score += 2;

  if (answers.intensity) {
    const diff = Math.abs(INTENSITY_ORDER.indexOf(product.intensity) - INTENSITY_ORDER.indexOf(answers.intensity));
    score += diff === 0 ? 2 : diff === 1 ? 1 : 0;
  }
  return score;
}

export async function getRecommendations(answers, limit = 5) {
  const products = await getProducts();
  const scored = products
    .map(p => ({ product: p, score: scoreProduct(p, answers) }))
    .filter(s => s.score >= 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.product);
}

export function mountFinder(root) {
  const state = { stepIndex: 0, answers: { personality: [] } };

  function render() {
    const step = STEPS[state.stepIndex];
    const progressPct = Math.round(((state.stepIndex) / STEPS.length) * 100);

    root.innerHTML = `
      <div class="finder">
        <div class="finder__progress"><div class="finder__progress-fill" style="width:${progressPct}%"></div></div>
        <p class="finder__step-label">Paso ${state.stepIndex + 1} de ${STEPS.length}</p>
        <h3 class="finder__title">${step.title}</h3>
        <div class="finder__options" data-multi="${step.multi}">
          ${step.options.map(o => `
            <button type="button" class="finder__option" data-value="${o.value}">
              <span>${o.label}</span>
            </button>`).join('')}
        </div>
        ${step.multi ? '<button type="button" class="btn btn--primary finder__continue" data-continue disabled>Continuar</button>' : ''}
        ${state.stepIndex > 0 ? '<button type="button" class="finder__back" data-back>← Atrás</button>' : ''}
      </div>
    `;

    const optionEls = root.querySelectorAll('.finder__option');
    const current = state.answers[step.key];
    optionEls.forEach(el => {
      const val = el.dataset.value;
      const isSelected = step.multi ? (current || []).includes(val) : current === val;
      el.classList.toggle('is-selected', isSelected);
      el.addEventListener('click', () => {
        if (step.multi) {
          const arr = state.answers[step.key] || [];
          if (arr.includes(val)) {
            state.answers[step.key] = arr.filter(v => v !== val);
          } else if (arr.length < (step.max || 99)) {
            state.answers[step.key] = [...arr, val];
          }
          render();
        } else {
          state.answers[step.key] = val;
          advance();
        }
      });
    });

    const continueBtn = root.querySelector('[data-continue]');
    if (continueBtn) {
      continueBtn.disabled = (state.answers[step.key] || []).length === 0;
      continueBtn.addEventListener('click', advance);
    }
    const backBtn = root.querySelector('[data-back]');
    if (backBtn) backBtn.addEventListener('click', () => { state.stepIndex--; render(); });
  }

  async function advance() {
    if (state.stepIndex < STEPS.length - 1) {
      state.stepIndex++;
      render();
    } else {
      await renderResults();
    }
  }

  async function renderResults() {
    root.innerHTML = `<div class="finder finder--loading"><p>Buscando tu perfil olfativo…</p></div>`;
    const recs = await getRecommendations(state.answers, 5);
    root.innerHTML = `
      <div class="finder finder--results">
        <p class="finder__step-label">Tu perfil olfativo</p>
        <h3 class="finder__title">${recs.length} fragancias para ti</h3>
        <ul class="finder-results">
          ${recs.map(p => `
            <li class="finder-result">
              <div class="finder-result__thumb">${bottleSVG(p)}</div>
              <div class="finder-result__info">
                <p class="finder-result__family">${p.family}</p>
                <p class="finder-result__name">${p.name}</p>
                <p class="finder-result__desc">${p.description}</p>
                <p class="finder-result__price">${formatCOP(p.price)}</p>
              </div>
              <div class="finder-result__actions">
                <a class="btn btn--ghost btn--tiny" href="/product.html?slug=${p.slug}">Descubrir</a>
                <button class="btn btn--primary btn--tiny" data-add-to-cart="${p.id}">Agregar</button>
              </div>
            </li>`).join('')}
        </ul>
        <button type="button" class="finder__restart" data-restart>Empezar de nuevo</button>
      </div>
    `;
    root.querySelector('[data-restart]').addEventListener('click', () => {
      state.stepIndex = 0;
      state.answers = { personality: [] };
      render();
    });
  }

  render();
}
