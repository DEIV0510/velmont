// VELMONT — buscador inteligente + Asesor VELMONT.
// Ambos comparten un interprete de texto libre por palabras clave (reglas),
// NO es un modelo de lenguaje real. Se deja preparado para conectar un
// backend de IA despues (ver interpretQuery/searchProducts): el resto de la
// UI solo consume la lista de resultados, sin acoplarse a como se calculo.
import { getProducts, bottleSVG, formatCOP } from './catalog.js';

const KEYWORD_MAP = {
  gender: {
    hombre: ['hombre', 'masculino', 'el', 'caballero'],
    mujer: ['mujer', 'femenino', 'ella', 'dama'],
    unisex: ['unisex'],
  },
  intensity: {
    intensa: ['fuerte', 'intenso', 'intensa', 'potente', 'marcado'],
    suave: ['suave', 'ligero', 'ligera', 'discreto', 'sutil'],
    media: ['medio', 'media', 'moderado'],
  },
  family: {
    dulce: ['dulce', 'dulces', 'goloso'],
    fresco: ['fresco', 'fresca', 'ligero', 'veraniego'],
    amaderado: ['amaderado', 'madera', 'maderas'],
    citrico: ['citrico', 'cítrico', 'citricos', 'limon', 'limón', 'naranja'],
    oriental: ['oriental', 'especiado', 'especias'],
    especiado: ['especiado', 'especias', 'picante'],
    floral: ['floral', 'flores', 'flor'],
  },
  personality: {
    elegante: ['elegante', 'elegancia', 'sobrio'],
    seductor: ['seductor', 'sensual', 'seduccion', 'seducción'],
    misterioso: ['misterioso', 'misterio', 'enigmatico'],
    sofisticado: ['sofisticado', 'refinado'],
    clasico: ['clasico', 'clásico', 'tradicional'],
  },
  occasion: {
    cita: ['cita', 'date'],
    noche: ['noche', 'nocturno'],
    oficina: ['oficina', 'trabajo', 'laboral'],
    diario: ['diario', 'diariamente', 'dia a dia', 'cotidiano'],
    evento: ['evento', 'fiesta', 'gala'],
    vacaciones: ['vacaciones', 'viaje', 'playa'],
  },
};

export function interpretQuery(text) {
  const t = (text || '').toLowerCase();
  const filters = { gender: null, intensity: null, family: null, personality: null, occasion: null, regalo: /regal/.test(t) };
  for (const [field, groups] of Object.entries(KEYWORD_MAP)) {
    for (const [value, words] of Object.entries(groups)) {
      if (words.some(w => t.includes(w))) { filters[field] = value; break; }
    }
  }
  return filters;
}

function scoreByFilters(product, filters) {
  let score = 0;
  let matchedAny = false;
  if (filters.gender) {
    if (product.gender !== filters.gender && product.gender !== 'unisex') return -1;
    matchedAny = true;
  }
  if (filters.family && product.family === filters.family) { score += 3; matchedAny = true; }
  if (filters.personality && product.personality?.includes(filters.personality)) { score += 3; matchedAny = true; }
  if (filters.occasion && product.occasion?.includes(filters.occasion)) { score += 2; matchedAny = true; }
  if (filters.intensity && product.intensity === filters.intensity) { score += 2; matchedAny = true; }
  if (filters.regalo && product.featured) { score += 1; matchedAny = true; }
  return matchedAny ? score : -1;
}

export async function searchProducts(text, limit = 6) {
  const products = await getProducts();
  const filters = interpretQuery(text);
  let scored = products.map(p => ({ product: p, score: scoreByFilters(p, filters) })).filter(s => s.score >= 0);

  if (scored.length === 0) {
    // sin coincidencia por reglas: degradamos con honestidad a destacados,
    // nunca fingimos una comprension que no ocurrio.
    return { filters, fallback: true, results: products.filter(p => p.featured).slice(0, limit) };
  }
  scored.sort((a, b) => b.score - a.score);
  return { filters, fallback: false, results: scored.slice(0, limit).map(s => s.product) };
}

// ---------- Buscador (overlay de pantalla completa) ----------
export function mountSearchOverlay(root) {
  root.innerHTML = `
    <div class="search-overlay" data-search-overlay aria-hidden="true">
      <div class="search-overlay__panel">
        <button class="icon-btn search-overlay__close" data-search-close aria-label="Cerrar buscador">&times;</button>
        <p class="search-overlay__label">¿QUÉ PERFUME ESTÁS BUSCANDO?</p>
        <input type="text" class="search-overlay__input" placeholder="Ej. algo dulce para una cita…" data-search-input autocomplete="off">
        <div class="search-overlay__results" data-search-results></div>
      </div>
    </div>
  `;
  const overlay = root.querySelector('[data-search-overlay]');
  const input = root.querySelector('[data-search-input]');
  const results = root.querySelector('[data-search-results]');

  root.querySelector('[data-search-close]').addEventListener('click', closeSearch);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(runSearch, 220);
  });

  async function runSearch() {
    const q = input.value.trim();
    if (q.length < 2) { results.innerHTML = ''; return; }
    const { results: products, fallback } = await searchProducts(q, 6);
    results.innerHTML = `
      ${fallback ? '<p class="search-overlay__fallback">No encontramos una coincidencia exacta — estas son fragancias destacadas de VELMONT:</p>' : ''}
      <ul class="search-results-grid">
        ${products.map(p => `
          <li>
            <a href="/product.html?slug=${p.slug}" class="search-result">
              <div class="search-result__thumb">${bottleSVG(p)}</div>
              <span class="search-result__name">${p.name}</span>
              <span class="search-result__price">${formatCOP(p.price)}</span>
            </a>
          </li>`).join('')}
      </ul>
    `;
  }

  function openSearch() {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    setTimeout(() => input.focus(), 60);
  }
  function closeSearch() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  }

  document.querySelectorAll('[data-search-open]').forEach(btn => btn.addEventListener('click', openSearch));
}

// ---------- Asesor VELMONT (chat privado) ----------
const QUICK_REPLIES = [
  'Algo intenso para la noche',
  'Fresco para el día a día',
  'Quiero un regalo',
  'Ver las ofertas',
];

export function mountAssistant(root) {
  root.innerHTML = `
    <button class="assistant-fab" data-assistant-toggle aria-label="Abrir Asesor VELMONT">
      <span>Asesor VELMONT</span>
    </button>
    <div class="assistant-panel" data-assistant-panel aria-hidden="true">
      <header class="assistant-panel__head">
        <div>
          <p class="assistant-panel__title">Asesor VELMONT</p>
          <p class="assistant-panel__status">En línea</p>
        </div>
        <button class="icon-btn" data-assistant-close aria-label="Cerrar asesor">&times;</button>
      </header>
      <div class="assistant-panel__body" data-assistant-body></div>
      <div class="assistant-panel__quick" data-assistant-quick></div>
      <form class="assistant-panel__form" data-assistant-form>
        <input type="text" placeholder="Escribe tu mensaje…" data-assistant-input autocomplete="off">
        <button type="submit" aria-label="Enviar">→</button>
      </form>
    </div>
  `;

  const panel = root.querySelector('[data-assistant-panel]');
  const body = root.querySelector('[data-assistant-body]');
  const quick = root.querySelector('[data-assistant-quick]');
  const form = root.querySelector('[data-assistant-form]');
  const input = root.querySelector('[data-assistant-input]');
  let greeted = false;

  root.querySelector('[data-assistant-toggle]').addEventListener('click', openPanel);
  root.querySelector('[data-assistant-close]').addEventListener('click', closePanel);

  function openPanel() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (!greeted) {
      greeted = true;
      addBotMessage('Hola. Soy tu asesor VELMONT.');
      addBotMessage('¿Qué tipo de fragancia estás buscando?');
      renderQuickReplies();
    }
  }
  function closePanel() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function addMessage(text, from) {
    const div = document.createElement('div');
    div.className = `assistant-msg assistant-msg--${from}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }
  const addBotMessage = (t) => addMessage(t, 'bot');
  const addUserMessage = (t) => addMessage(t, 'user');

  function renderQuickReplies() {
    quick.innerHTML = QUICK_REPLIES.map(q => `<button type="button" class="assistant-chip">${q}</button>`).join('');
    quick.querySelectorAll('.assistant-chip').forEach(chip => {
      chip.addEventListener('click', () => handleUserText(chip.textContent));
    });
  }

  async function handleUserText(text) {
    addUserMessage(text);
    quick.innerHTML = '';

    if (/oferta/i.test(text)) {
      addBotMessage('Tenemos dos experiencias activas: MATAI 2x$450.000 y Selección VELMONT 2x$280.000. Puedes verlas en la sección de ofertas.');
      const products = await getProducts();
      renderProductCards(products.filter(p => p.promo).slice(0, 3));
      renderQuickReplies();
      return;
    }

    const { results, fallback } = await searchProducts(text, 3);
    if (fallback) {
      addBotMessage('Aún no tengo una coincidencia precisa para eso, pero estas son fragancias muy queridas en VELMONT:');
    } else {
      addBotMessage('Con eso en mente, te recomiendo:');
    }
    renderProductCards(results);
    addBotMessage('¿Quieres afinar por ocasión, intensidad o género?');
    renderQuickReplies();
  }

  function renderProductCards(products) {
    const wrap = document.createElement('div');
    wrap.className = 'assistant-msg assistant-msg--bot assistant-msg--products';
    wrap.innerHTML = products.map(p => `
      <a class="assistant-product" href="/product.html?slug=${p.slug}">
        <div class="assistant-product__thumb">${bottleSVG(p)}</div>
        <span>${p.name}</span>
        <span>${formatCOP(p.price)}</span>
      </a>`).join('');
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    handleUserText(text);
  });
}
