// VELMONT — buscador y Asesor. Interpretan texto libre por palabras clave
// contra los atributos del catalogo. NO hay un modelo de lenguaje detras:
// interpretQuery/searchProducts son el unico punto a reemplazar el dia que
// se conecte un backend de IA real.
import { getProducts, bottleSVG, formatCOP } from './catalog.js';

const KEYWORD_MAP = {
  gender: {
    hombre: ['hombre', 'masculino', 'caballero', 'para el', 'para él'],
    mujer: ['mujer', 'femenino', 'dama', 'para ella'],
    unisex: ['unisex'],
  },
  intensity: {
    intensa: ['fuerte', 'intenso', 'intensa', 'potente', 'marcado', 'duradero'],
    suave: ['suave', 'ligero', 'ligera', 'discreto', 'sutil'],
    media: ['medio', 'media', 'moderado'],
  },
  family: {
    dulce: ['dulce', 'dulces', 'goloso', 'vainilla'],
    fresco: ['fresco', 'fresca', 'veraniego', 'limpio'],
    amaderado: ['amaderado', 'madera', 'maderas', 'sandalo', 'sándalo'],
    citrico: ['citrico', 'cítrico', 'citricos', 'limon', 'limón', 'naranja', 'bergamota'],
    oriental: ['oriental', 'ambar', 'ámbar', 'incienso'],
    especiado: ['especiado', 'especias', 'picante', 'pimienta'],
    floral: ['floral', 'flores', 'flor', 'rosa', 'jazmin', 'jazmín'],
  },
  personality: {
    elegante: ['elegante', 'elegancia', 'sobrio'],
    seductor: ['seductor', 'sensual', 'seduccion', 'seducción', 'irresistible'],
    misterioso: ['misterioso', 'misterio', 'enigmatico', 'enigmático'],
    sofisticado: ['sofisticado', 'refinado'],
    clasico: ['clasico', 'clásico', 'tradicional', 'atemporal'],
  },
  occasion: {
    cita: ['cita', 'date', 'conquistar'],
    noche: ['noche', 'nocturno', 'fiesta'],
    oficina: ['oficina', 'trabajo', 'laboral'],
    diario: ['diario', 'diariamente', 'dia a dia', 'día a día', 'cotidiano'],
    evento: ['evento', 'gala', 'boda', 'matrimonio'],
    vacaciones: ['vacaciones', 'viaje', 'playa', 'calor'],
  },
};

export function interpretQuery(text) {
  const t = (text || '').toLowerCase();
  const f = { gender: null, intensity: null, family: null, personality: null, occasion: null, regalo: /regal/.test(t) };
  for (const [field, groups] of Object.entries(KEYWORD_MAP)) {
    for (const [value, words] of Object.entries(groups)) {
      if (words.some(w => t.includes(w))) { f[field] = value; break; }
    }
  }
  return f;
}

function scoreByFilters(p, f) {
  let s = 0, matched = false;
  if (f.gender) {
    if (p.gender !== f.gender && p.gender !== 'unisex') return -1;
    matched = true;
  }
  if (f.family && p.family === f.family) { s += 3; matched = true; }
  if (f.personality && p.personality?.includes(f.personality)) { s += 3; matched = true; }
  if (f.occasion && p.occasion?.includes(f.occasion)) { s += 2; matched = true; }
  if (f.intensity && p.intensity === f.intensity) { s += 2; matched = true; }
  if (f.regalo && p.featured) { s += 1; matched = true; }
  return matched ? s : -1;
}

export async function searchProducts(text, limit = 6) {
  const products = await getProducts();
  const filters = interpretQuery(text);
  const scored = products.map(p => ({ p, s: scoreByFilters(p, filters) })).filter(x => x.s >= 0);
  if (!scored.length) {
    // Degradamos con honestidad: no fingimos haber entendido.
    return { filters, fallback: true, results: products.filter(p => p.featured).slice(0, limit) };
  }
  scored.sort((a, b) => b.s - a.s);
  return { filters, fallback: false, results: scored.slice(0, limit).map(x => x.p) };
}

function miniResult(p) {
  return `
    <a class="piece" href="${p.url || `/product.html?slug=${p.slug}`}">
      <div class="piece__stage">${p.image ? `<img src="${p.image}" alt="${p.name}">` : bottleSVG(p)}</div>
      <div class="piece__meta">
        <h3 class="piece__name" style="font-size:1rem">${p.name}</h3>
        <span class="price">${formatCOP(p.price)}</span>
      </div>
    </a>`;
}

// ---------- Buscador ----------
export function mountSearchOverlay(root) {
  if (!root) return;
  root.innerHTML = `
    <div class="search" data-search data-tone="dark" aria-hidden="true">
      <button class="icon-btn search__close" data-search-close aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>
      <span class="label">¿Qué fragancia buscas?</span>
      <input type="text" data-search-input placeholder="algo intenso para la noche…" autocomplete="off">
      <div class="search__out" data-search-out></div>
      <p class="label search__note" data-search-note hidden></p>
    </div>`;

  const el = root.querySelector('[data-search]');
  const input = root.querySelector('[data-search-input]');
  const out = root.querySelector('[data-search-out]');
  const note = root.querySelector('[data-search-note]');

  const open = () => {
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    setTimeout(() => input.focus(), 80);
  };
  const close = () => {
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  };
  root.querySelector('[data-search-close]').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('open')) close(); });
  document.querySelectorAll('[data-search-open]').forEach(b => b.addEventListener('click', open));

  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(run, 240);
  });

  async function run() {
    const q = input.value.trim();
    if (q.length < 2) { out.innerHTML = ''; note.hidden = true; return; }
    const { results, fallback } = await searchProducts(q, 6);
    note.hidden = !fallback;
    if (fallback) note.textContent = 'Sin coincidencia exacta — estas son las piezas más queridas de la casa';
    out.innerHTML = results.map(miniResult).join('');
  }
}

// ---------- Asesor ----------
const CHIPS = ['Algo intenso para la noche', 'Fresco para el día', 'Es un regalo', 'Ver las ediciones'];

export function mountAssistant(root) {
  if (!root) return;
  root.innerHTML = `
    <button class="advisor-open" data-advisor-open aria-label="Abrir asesor"><i></i><span>Asesor</span></button>
    <div class="advisor" data-advisor aria-hidden="true">
      <header class="advisor__head">
        <div>
          <p class="label" style="color:var(--ivory)">Asesor VELMONT</p>
          <p class="label label--gold" style="margin-top:4px">En línea</p>
        </div>
        <button class="icon-btn" data-advisor-close aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </header>
      <div class="advisor__body" data-advisor-body></div>
      <div class="advisor__chips" data-advisor-chips></div>
      <form class="advisor__form" data-advisor-form>
        <input type="text" placeholder="Escribe aquí…" data-advisor-input autocomplete="off">
        <button type="submit" aria-label="Enviar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </form>
    </div>`;

  const panel = root.querySelector('[data-advisor]');
  const body = root.querySelector('[data-advisor-body]');
  const chips = root.querySelector('[data-advisor-chips]');
  const form = root.querySelector('[data-advisor-form]');
  const input = root.querySelector('[data-advisor-input]');
  let greeted = false;

  root.querySelector('[data-advisor-open]').addEventListener('click', () => {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (!greeted) {
      greeted = true;
      say('Buenas. Soy tu asesor en VELMONT.');
      say('¿Qué tipo de fragancia estás buscando?');
      renderChips();
    }
  });
  root.querySelector('[data-advisor-close]').addEventListener('click', () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });

  function bubble(text, who) {
    const d = document.createElement('div');
    d.className = `msg msg--${who}`;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }
  const say = t => bubble(t, 'bot');

  function renderChips() {
    chips.innerHTML = CHIPS.map(c => `<button type="button">${c}</button>`).join('');
    chips.querySelectorAll('button').forEach(b => b.addEventListener('click', () => handle(b.textContent)));
  }

  function items(products) {
    const w = document.createElement('div');
    w.className = 'msg msg--bot msg--items';
    w.innerHTML = products.map(p => `
      <a class="advisor__item" href="${p.url || `/product.html?slug=${p.slug}`}">
        <div>${bottleSVG(p)}</div>
        <span>${p.name}</span>
        <span class="price">${formatCOP(p.price)}</span>
      </a>`).join('');
    body.appendChild(w);
    body.scrollTop = body.scrollHeight;
  }

  async function handle(text) {
    bubble(text, 'me');
    chips.innerHTML = '';

    if (/edici|oferta|promo/i.test(text)) {
      say('Hay dos ediciones activas: The MATAI Edit (2 × $450.000) y el Dúo VELMONT (2 × $280.000).');
      const all = await getProducts();
      items(all.filter(p => p.promo).slice(0, 3));
      renderChips();
      return;
    }

    const { results, fallback } = await searchProducts(text, 3);
    say(fallback
      ? 'Todavía no tengo una coincidencia precisa para eso. Estas son piezas muy queridas de la casa:'
      : 'Con eso en mente, te recomiendo:');
    items(results);
    say('¿Quieres afinar por ocasión, intensidad o género?');
    renderChips();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    handle(v);
  });
}
