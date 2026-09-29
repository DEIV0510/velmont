/* ==========================================================================
   VELMONT — capa de interaccion.
   Portado del prototipo (assets/js/ui.js + motion.js + cart*.js) y adaptado a
   Shopify: el carrito habla con /cart/*.js y el buscador con la busqueda
   predictiva. Nada aqui calcula precios: los lee de lo que devuelve Shopify,
   para que un descuento automatico se refleje solo.
   ========================================================================== */


const V = window.VELMONT || {};
const routes = V.routes || {};
const motion = V.motion || {};
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = (cents) => '$' + Math.round(cents / 100).toLocaleString('es-CO');
const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

// La capa de movimiento se expone por window a proposito: importarla aqui
// crearia una segunda instancia del modulo (ver velmont-motion.js).
const initReveal = (scope) => window.VelmontMotion?.initReveal?.(scope);

// Modulos cargados con su URL versionada (ver assets en theme.liquid)
const assets = V.assets || {};
let initSwipeHint = () => {};
let initReel = () => {};
let initQuiz = () => {};
async function cargarModulos() {
  const [carousel, quiz] = await Promise.all([
    import(assets.carousel || './carousel.js'),
    import(assets.quiz || './quiz.js'),
  ]);
  initSwipeHint = carousel.initSwipeHint;
  initReel = carousel.initReel;
  initQuiz = quiz.initQuiz;
}

/* ---------------- Header ----------------
   Ademas de fijarse al bajar, la barra toma el tono de la seccion que tiene
   debajo: el vidrio oscuro sobre una banda crema se ve como una franja gris
   sucia. Se mide contra el centro de la barra, no contra el borde superior. */
function initHeader() {
  const hdr = $('header[data-hdr]');
  if (!hdr) return;

  // Solo secciones en flujo: el menu, el buscador y los paneles tambien llevan
  // data-tone y, al ser fixed, su caja cubre el viewport entero y ganarian
  // siempre. Se recalcula porque el editor de temas puede cambiar el orden.
  const tonedSections = () => $$('main [data-tone], .foot');
  let sections = tonedSections();

  const toneAt = (y) => {
    for (const el of sections) {
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) {
        if (el.classList.contains('foot')) return 'dark';
        return el.dataset.tone === 'light' ? 'light' : 'dark';
      }
    }
    return 'dark';
  };

  let raf = null;
  let ultimaY = window.scrollY;
  const update = () => {
    raf = null;
    const y = window.scrollY;
    const stuck = y > 40;
    hdr.classList.toggle('is-stuck', stuck);
    // Se aparta al bajar y vuelve al subir. El umbral evita que tiemble con
    // los microajustes del scroll suave.
    if (Math.abs(y - ultimaY) > 6) {
      hdr.classList.toggle('hdr--away', y > ultimaY && y > 260);
      ultimaY = y;
    }
    hdr.classList.toggle('hdr--light', stuck && toneAt(hdr.offsetHeight / 2) === 'light');
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('shopify:section:load', () => { sections = tonedSections(); update(); });
}

/* ---------------- Menu a pantalla completa ---------------- */
function initMenu() {
  const menu = $('[data-menu]');
  if (!menu) return;
  const toggle = $('[data-menu-open]');
  const open = () => {
    menu.classList.add('open');
    document.documentElement.classList.add('no-scroll');
    toggle?.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    menu.classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    toggle?.setAttribute('aria-expanded', 'false');
  };
  toggle?.addEventListener('click', open);
  $('[data-menu-close]')?.addEventListener('click', close);
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) close(); });

  const visuals = $$('[data-menu-visual] figure', menu);
  if (visuals.length) {
    $$('[data-visual]', menu).forEach((link) => {
      link.addEventListener('mouseenter', () => {
        const i = Number(link.dataset.visual);
        visuals.forEach((f, idx) => f.classList.toggle('on', idx === i));
      });
    });
  }
}

/* ==========================================================================
   Superposiciones: una sola vela y un solo velo para todas
   ========================================================================== */
const scrim = $('[data-scrim]');
let openPanel = null;

function closePanel() {
  if (!openPanel) return;
  openPanel.classList.remove('open');
  openPanel.setAttribute('aria-hidden', 'true');
  openPanel = null;
  scrim?.classList.remove('open');
  document.documentElement.classList.remove('no-scroll');
}

function showPanel(el) {
  if (!el) return;
  if (openPanel && openPanel !== el) closePanel();
  openPanel = el;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  scrim?.classList.add('open');
  document.documentElement.classList.add('no-scroll');
}

scrim?.addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

/* ---------------- Bolsa ---------------- */
const bag = $('[data-bag]');

function lineHTML(item, index) {
  const img = item.image
    ? `<img src="${item.image.replace(/(\.[a-z]+)(\?|$)/i, '_128x$1$2')}" alt="" width="64" height="80" loading="lazy">`
    : '';
  const discounted = item.original_line_price > item.final_line_price;

  // Lo que el cliente eligio dentro de un combo. Sin esto la bolsa decia solo
  // "Dúo VELMONT" y no habia forma de comprobar que fragancias habia cogido:
  // se paga por dos perfumes concretos y hay que verlos. Shopify guarda las
  // que empiezan por "_" como privadas; esas no se muestran.
  const elegidas = Object.entries(item.properties || {})
    .filter(([k, v]) => k && v && !k.startsWith('_'))
    .map(([k, v]) => `<span class="bag-line__elec"><i>${k}</i>${v}</span>`)
    .join('');

  return `
    <div class="bag-line" data-vid="${item.variant_id}">
      <a href="${item.url}" aria-label="${item.product_title}">${img}</a>
      <div>
        <a href="${item.url}"><span class="bag-line__name">${item.product_title}</span></a>
        ${item.variant_title ? `<span class="label">${item.variant_title}</span>` : ''}
        ${elegidas ? `<div class="bag-line__eleccion">${elegidas}</div>` : ''}
        <div class="stepper">
          <button type="button" data-qty="${index + 1}" data-delta="-1" aria-label="Quitar una">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-qty="${index + 1}" data-delta="1" aria-label="Sumar una">+</button>
        </div>
      </div>
      <div class="bag-line__right">
        ${discounted
          ? `<span class="price promo__on">${money(item.final_line_price)}</span><s class="price">${money(item.original_line_price)}</s>`
          : `<span class="price">${money(item.final_line_price)}</span>`}
        <button type="button" class="mini" data-qty="${index + 1}" data-remove>Quitar</button>
      </div>
    </div>`;
}

function renderBag(cart) {
  const body = $('[data-bag-body]');
  const foot = $('[data-bag-foot]');
  const count = $('[data-bag-count]');
  const titleCount = $('[data-bag-title-count]');

  if (count) {
    count.textContent = cart.item_count;
    count.classList.toggle('off', cart.item_count === 0);
  }
  if (titleCount) titleCount.textContent = cart.item_count ? `(${cart.item_count})` : '';
  if (!body) return;

  if (!cart.item_count) {
    body.innerHTML = `
      <div class="bag-empty">
        <p class="lede">Tu bolsa está vacía.</p>
        <a class="act" href="${routes.root || '/'}collections/all">Ver la colección</a>
      </div>`;
    foot?.setAttribute('hidden', '');
    return;
  }

  // Los descuentos automaticos llegan ya calculados por Shopify
  const discounts = (cart.cart_level_discount_applications || [])
    .map((d) => `<p class="label promo__on">${d.title} · −${money(d.total_allocated_amount)}</p>`)
    .join('');

  body.innerHTML = cart.items.map(lineHTML).join('') + (discounts ? `<div class="promo">${discounts}</div>` : '');
  foot?.removeAttribute('hidden');
  const total = $('[data-bag-total]');
  if (total) total.textContent = money(cart.total_price);
}

async function fetchCart() {
  const res = await fetch(`${routes.cart || '/cart'}.js`, { headers: { Accept: 'application/json' } });
  return res.json();
}

async function changeLine(line, quantity) {
  const res = await fetch(routes.cart_change || '/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ line, quantity }),
  });
  renderBag(await res.json());
}

/**
 * @param {string|number} id        variante
 * @param {number}        quantity
 * @param {Object}        propiedades  campos `properties[...]` de la ficha
 *
 * Las propiedades NO son opcionales cuando hay un combo: ahi viven las dos
 * fragancias que eligio el cliente. Esta funcion mandaba solo la variante, asi
 * que el combo entraba al carrito sin saber que perfumes llevaba — el pedido
 * habria llegado como "Dúo VELMONT" a secas y no habria forma de prepararlo.
 */
async function addToCart(id, quantity = 1, propiedades = null) {
  const item = { id: Number(id), quantity };
  if (propiedades && Object.keys(propiedades).length) item.properties = propiedades;
  const res = await fetch(routes.cart_add || '/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items: [item] }),
  });
  if (!res.ok) throw new Error('add failed');
  renderBag(await fetchCart());
  showPanel(bag);

  // Recompensa: la pieza que acaba de entrar se marca un instante, para que
  // el cajon no parezca la misma lista de antes con un numero distinto.
  const linea = document.querySelector(`[data-vid="${Number(id)}"]`);
  if (linea) {
    linea.classList.remove('is-new');
    void linea.offsetWidth;          // reinicia la animacion si se repite
    linea.classList.add('is-new');
    setTimeout(() => linea.classList.remove('is-new'), 1400);
  }
}

function initBag() {
  if (!bag) return;
  $$('[data-bag-open]').forEach((b) => b.addEventListener('click', async () => {
    renderBag(await fetchCart());
    showPanel(bag);
  }));
  $('[data-bag-close]')?.addEventListener('click', closePanel);

  bag.addEventListener('click', (e) => {
    const step = e.target.closest('[data-qty]');
    if (!step) return;
    const line = Number(step.dataset.qty);
    if (step.hasAttribute('data-remove')) return changeLine(line, 0);
    const span = step.parentElement.querySelector('span');
    const current = Number(span?.textContent || 1);
    changeLine(line, Math.max(0, current + Number(step.dataset.delta || 0)));
  });

  // Añadir desde cualquier pieza, sin salir de la pagina
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    e.preventDefault();
    btn.disabled = true;
    addToCart(btn.dataset.add).catch(() => { window.location.href = routes.cart || '/cart'; })
      .finally(() => { btn.disabled = false; });
  });

  // Formulario de la ficha: interceptado, con respaldo al envio normal
  const form = $('#VelmontProductForm');
  form?.addEventListener('submit', async (e) => {
    const select = $('[data-variant-select]', form);
    if (!select) return;
    e.preventDefault();
    const btn = $('[data-add-main]', form);
    if (btn) btn.disabled = true;
    try {
      // Se recoge el formulario ENTERO, no solo la variante: los campos
      // `properties[...]` son las fragancias que el cliente eligio en el
      // combo. Sin esto el pedido llegaba como "Dúo VELMONT" sin decir que
      // perfumes eran, y no habria forma de prepararlo.
      const props = {};
      for (const [k, v] of new FormData(form).entries()) {
        const m = k.match(/^properties\[(.+)\]$/);
        if (m && String(v).trim()) props[m[1]] = v;
      }
      await addToCart(select.value, 1, props);
    } catch {
      form.submit();   // plan B: envio normal, que tambien lleva el formulario entero
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Pagina de bolsa completa
  $('[data-cart-form]')?.addEventListener('click', async (e) => {
    const step = e.target.closest('[data-qty]');
    if (!step) return;
    e.preventDefault();
    const line = Number(step.dataset.qty);
    if (step.hasAttribute('data-remove')) { await changeLine(line, 0); window.location.reload(); return; }
    const span = step.parentElement.querySelector('span');
    const current = Number(span?.textContent || 1);
    await changeLine(line, Math.max(0, current + Number(step.dataset.delta || 0)));
    window.location.reload();
  });
}

/* ==========================================================================
   Guardados (localStorage)
   --------------------------------------------------------------------------
   Se guardan HANDLES, no ids: el handle tiene endpoint publico
   (/products/<handle>.js) y el id no, asi que antes se buscaba el id como
   texto en el buscador y a veces devolvia otro producto o nada.

   La clave lleva el dominio de la tienda por delante para que dos tiendas en
   el mismo navegador no compartan lista.
   ========================================================================== */
const SHOP = (window.VELMONT && window.VELMONT.shop) || location.hostname;
const SAVED_KEY = `velmont:${SHOP}:saved`;
const SAVED_KEY_VIEJA = 'velmont_saved';

const getSaved = () => {
  try {
    const crudo = localStorage.getItem(SAVED_KEY);
    if (crudo) return JSON.parse(crudo) || [];
    // Migracion: la lista vieja guardaba ids numericos, irrecuperables por
    // endpoint publico. Se descarta en silencio en vez de dejar huecos.
    const viejo = JSON.parse(localStorage.getItem(SAVED_KEY_VIEJA) || '[]');
    const handles = viejo.filter((x) => typeof x === 'string' && !/^\d+$/.test(x));
    if (handles.length) localStorage.setItem(SAVED_KEY, JSON.stringify(handles));
    return handles;
  } catch { return []; }
};

const setSaved = (list) => {
  const limpia = [...new Set(list.filter(Boolean))];
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(limpia)); } catch { /* sin espacio */ }
  paintSavedCount();
  paintSavedButtons();
  // Cualquier vista abierta se repinta al instante: cajon y pagina.
  document.dispatchEvent(new CustomEvent('velmont:saved', { detail: { list: limpia } }));
};

/** Ficha publica de un producto. null si ya no existe. */
async function fetchProducto(handle) {
  try {
    const r = await fetch(`${window.VELMONT?.rootUrl || '/'}products/${handle}.js`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/**
 * Resuelve la lista y limpia de paso los que ya no existen: si un producto se
 * borro del catalogo, desaparece de guardados en vez de romper la vista.
 */
async function resolverGuardados() {
  const handles = getSaved();
  if (!handles.length) return [];
  const fichas = await Promise.all(handles.map(fetchProducto));
  const vivos = [];
  const validos = [];
  fichas.forEach((p, i) => { if (p) { vivos.push(p); validos.push(handles[i]); } });
  if (validos.length !== handles.length) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(validos)); } catch { /* */ }
    paintSavedCount();
  }
  return vivos;
}

function paintSavedCount() {
  const el = $('[data-saved-count]');
  if (!el) return;
  const n = getSaved().length;
  el.textContent = n;
  el.classList.toggle('off', n === 0);
}

function paintSavedButtons() {
  const saved = getSaved();
  $$('[data-save]').forEach((b) => {
    const on = saved.includes(b.dataset.save);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function initSaved() {
  paintSavedCount();
  paintSavedButtons();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.save;
    const list = getSaved();
    const guardando = !list.includes(id);
    setSaved(guardando ? [...list, id] : list.filter((x) => x !== id));
    paintSavedButtons();
    // Solo al guardar: quitar algo no merece celebracion.
    if (guardando) {
      btn.classList.remove('just-on');
      void btn.offsetWidth;
      btn.classList.add('just-on');
      setTimeout(() => btn.classList.remove('just-on'), 500);
    }
  });

  // Repintado de cualquier vista abierta cuando cambia la lista
  document.addEventListener('velmont:saved', () => {
    if ($('[data-saved-body]')) pintarCajon();
    if ($('[data-saved-page]')) pintarPagina();
  });

  const panel = $('[data-saved]');
  if (panel) {
    $('[data-saved-close]')?.addEventListener('click', closePanel);
    $$('[data-saved-open]').forEach((b) => b.addEventListener('click', async () => {
      showPanel(panel);
      await pintarCajon();
    }));
  }

  if ($('[data-saved-page]')) pintarPagina();
}

/** Linea de producto, compartida por el cajon y la pagina. */
function lineaGuardada(p) {
  const img = p.featured_image
    ? `<img src="${p.featured_image.replace(/(\.[a-z]+)(\?|$)/i, '_160x$1$2')}" alt="" width="64" height="80" loading="lazy">`
    : '';
  const agotado = p.available === false;
  return `
    <div class="bag-line">
      <a href="${p.url}" tabindex="-1">${img}</a>
      <div>
        <a href="${p.url}"><span class="bag-line__name">${p.title}</span></a>
        ${p.vendor ? `<span class="label">${p.vendor}</span>` : ''}
      </div>
      <div class="bag-line__right">
        <span class="price">${agotado ? '' : money(p.price)}</span>
        ${agotado ? '<span class="label">No disponible</span>' : ''}
        <button class="link" data-save="${p.handle}" aria-pressed="true">Quitar</button>
      </div>
    </div>`;
}

function vacio() {
  const raiz = window.VELMONT?.rootUrl || '/';
  return `<div class="bag-empty">
    <p class="lede">Todavía no has guardado ninguna pieza.</p>
    <a class="act" href="${raiz}collections/all">Ver la colección</a>
  </div>`;
}

async function pintarCajon() {
  const body = $('[data-saved-body]');
  if (!body) return;
  const lista = await resolverGuardados();
  body.innerHTML = lista.length ? lista.map(lineaGuardada).join('') : vacio();
  paintSavedButtons();
}

async function pintarPagina() {
  const zona = $('[data-saved-page]');
  if (!zona) return;
  const lista = await resolverGuardados();
  zona.innerHTML = lista.length
    ? `<div class="saved-list">${lista.map(lineaGuardada).join('')}</div>`
    : vacio();
  paintSavedButtons();
}

/* ---------------- Buscador ---------------- */
function initSearch() {
  const panel = $('[data-search]');
  if (!panel) return;
  const input = $('[data-search-input]', panel);
  const out = $('[data-search-out]', panel);
  const note = $('[data-search-note]', panel);

  $$('[data-search-open]').forEach((b) => b.addEventListener('click', () => {
    showPanel(panel);
    setTimeout(() => input?.focus(), 120);
  }));
  $('[data-search-close]')?.addEventListener('click', closePanel);

  let timer = null;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { if (out) out.innerHTML = ''; if (note) note.textContent = 'Escribe para buscar'; return; }
    timer = setTimeout(async () => {
      const url = `${routes.predictive || '/search/suggest'}.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=8`;
      const res = await fetch(url);
      const data = await res.json();
      const products = data.resources?.results?.products || [];
      if (note) note.textContent = products.length ? `${products.length} resultados` : 'Sin resultados. Prueba con otro nombre.';
      if (!out) return;
      out.innerHTML = products.map((p) => `
        <article class="piece">
          <a class="piece__stage" href="${p.url}" aria-label="${p.title}">
            ${p.image ? `<img src="${p.image.replace(/(\.[a-z]+)(\?|$)/i, '_600x$1$2')}" alt="" loading="lazy">` : ''}
          </a>
          <div class="piece__meta">
            <div><h3 class="piece__name">${p.title}</h3><span class="label piece__house">${p.vendor || ''}</span></div>
            <span class="price">${p.price || ''}</span>
          </div>
        </article>`).join('');
    }, 220);
  });
}

/* ---------------- Ficha de producto ---------------- */
function initProduct() {
  const stage = $('[data-pdp-stage]');
  if (!stage) return;

  const main = $('[data-pdp-image]');
  $$('[data-pdp-thumb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!main) return;
      main.src = btn.dataset.pdpThumb;
      main.removeAttribute('srcset');
      $$('[data-pdp-thumb]').forEach((b) => b.classList.toggle('on', b === btn));
    });
  });

  // Inclinacion hacia el cursor
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      stage.style.setProperty('--tilt-y', `${px * 6}deg`);
      stage.style.setProperty('--tilt-x', `${-py * 6}deg`);
    });
    stage.addEventListener('mouseleave', () => {
      stage.style.setProperty('--tilt-x', '0deg');
      stage.style.setProperty('--tilt-y', '0deg');
    });
  }

  // Selector de variante
  const select = $('[data-variant-select]');
  if (select) {
    const groups = $$('[data-option-index]');
    const apply = () => {
      const chosen = groups.map((g) => $('.pdp__opt.on', g)?.dataset.optionValue || '');
      const match = [...select.options].find((o) => (o.dataset.options || '').split('||').every((v, i) => !chosen[i] || v === chosen[i]));
      if (!match) return;
      select.value = match.value;
      const price = $('.pdp__price');
      if (price && match.dataset.price) price.textContent = match.dataset.price;
      const add = $('[data-add-main]');
      if (add) add.disabled = match.disabled;
    };
    groups.forEach((g) => g.addEventListener('click', (e) => {
      const btn = e.target.closest('.pdp__opt');
      if (!btn) return;
      $$('.pdp__opt', g).forEach((b) => b.classList.toggle('on', b === btn));
      apply();
    }));
  }

  // Barra de compra fija en movil
  const bar = $('[data-buybar]');
  const mainBtn = $('[data-add-main]');
  if (bar && mainBtn && 'IntersectionObserver' in window) {
    const barBtn = $('[data-buybar-add]', bar);
    barBtn?.addEventListener('click', () => mainBtn.click());
    new IntersectionObserver(([e]) => {
      const on = !e.isIntersecting;
      bar.classList.toggle('on', on);
      bar.setAttribute('aria-hidden', String(!on));
      if (barBtn) barBtn.tabIndex = on ? 0 : -1;
      document.body.classList.toggle('has-buybar', on && window.matchMedia('(max-width: 899px)').matches);
    }, { threshold: 0 }).observe(mainBtn);
  }
}

/* ---------------- Arranque ---------------- */
// El loader, los reveals, el cursor, el magnetismo y el scrub del hero viven
// en velmont-motion.js. Aqui solo queda la tienda: navegacion y datos.
/* ==========================================================================
   Las casas: contar, filtrar, ordenar y repartir entre las tres tiras
   El servidor las emite todas en la primera tira y en alfabetico (Liquid no
   puede contar mas de 50 productos de una coleccion). Una sola peticion al
   catalogo publico basta. Si falla, se quedan donde estan: sin deriva y sin
   jerarquia, pero completas y legibles.

   Esto corre SIEMPRE, tambien con reduced-motion: filtrar y ordenar no es
   movimiento. Lo que se mueve vive en velmont-motion.js.
   ========================================================================== */
async function initHouses() {
  const set = $('[data-houses]');
  if (!set) return;
  const tiras = $$('[data-track]', set);
  if (tiras.length < 2) return;

  let productos;
  try {
    const r = await fetch(`${window.VELMONT?.rootUrl || '/'}collections/all/products.json?limit=250`);
    if (!r.ok) return;
    productos = (await r.json()).products || [];
  } catch { return; }
  if (!productos.length) return;

  const cuenta = new Map();
  for (const p of productos) {
    if (!p.vendor) continue;
    cuenta.set(p.vendor, (cuenta.get(p.vendor) || 0) + 1);
  }

  const minimo = Number(set.dataset.min || 1);
  const conCuenta = $$('[data-house]', set)
    .map((el) => ({ el, n: cuenta.get(el.dataset.house) || 0 }))
    .sort((a, b) => b.n - a.n || a.el.dataset.house.localeCompare(b.el.dataset.house));

  // Una casa con una sola pieza no es una casa que la tienda "reuna".
  const vivas = [];
  for (const { el, n } of conCuenta) {
    const sep = el.nextElementSibling;
    if (n < minimo) {
      if (sep && sep.classList.contains('house__sep')) sep.remove();
      el.remove();
      continue;
    }
    vivas.push({ el, sep });
  }
  if (!vivas.length) return;

  // Reparto en zigzag: la tira de en medio recibe la 2.ª, la 5.ª, la 8.ª…
  // Asi las casas grandes no se amontonan todas en la primera.
  vivas.forEach(({ el, sep }, i) => {
    const destino = tiras[i % tiras.length];
    destino.appendChild(el);
    if (sep && sep.classList.contains('house__sep')) destino.appendChild(sep);
  });

  // Una tira vacia no se pinta: mejor dos llenas que tres con un hueco.
  for (const t of tiras) {
    if (!t.children.length) t.closest('[data-marquee]')?.remove();
  }

  // La capa de movimiento espera esto para montar la deriva.
  document.dispatchEvent(new CustomEvent('velmont:casas'));
}

/* ==========================================================================
   SELECTOR VISUAL DEL COMBO
   --------------------------------------------------------------------------
   La app de bundles pinta un <select> por fragancia: texto plano en una caja
   del sistema. Aqui se dibuja encima una rejilla con la foto, la casa y el
   precio de cada pieza, igual que en el catalogo.

   El <select> NO se elimina: se esconde y sigue siendo el que lleva el dato
   al carrito. Al pulsar una pieza se le asigna el valor y se dispara `change`
   para que la app se entere. Si este codigo no llegara a correr, el combo se
   compra igual con los desplegables. Nunca al reves.

   Los selects los inyecta la app despues de cargar, asi que hay que esperar:
   se observa el contenedor y el guardia `dataset.picker` hace que montar dos
   veces no duplique nada.
   ========================================================================== */
function initBundlePicker() {
  const datos = $('[data-bundle-piezas]');
  if (!datos) return;
  let piezas = [];
  try { piezas = JSON.parse(datos.textContent); } catch { return; }
  const porTitulo = new Map(piezas.map((p) => [String(p.t).trim().toUpperCase(), p]));
  // NO se guarda el contenedor: la app reemplaza el subarbol de .pdp__info,
  // y una referencia vieja apunta a un nodo ya desconectado. Se busca
  // siempre desde el documento.
  const boton = $('[name=add]');
  // Si ya venia bloqueado (sin existencias), no se toca: el bloqueo por falta
  // de eleccion nunca debe DESbloquear algo que Shopify dio por agotado.
  const bloqueadoDeOrigen = boton ? boton.disabled : false;
  let aviso = null;

  /** El boton solo se abre cuando estan elegidas TODAS las fragancias. */
  const revisar = () => {
    const todos = $$('select[name^="properties["]');
    if (!todos.length || !boton || bloqueadoDeOrigen) return;
    const faltan = todos.filter((s) => !s.value).length;
    boton.disabled = faltan > 0;
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.className = 'bundle-aviso';
      // DENTRO del grupo de acciones, no antes: ese grupo se queda fijo al pie
      // mientras el cliente elige, y el aviso tiene que viajar con el.
      boton.closest('.pdp__cta')?.prepend(aviso);
    }
    aviso.textContent = faltan === 0
      ? ''
      : faltan === todos.length
        ? 'Elige tus dos fragancias'
        : 'Falta la segunda fragancia';
    aviso.hidden = faltan === 0;
  };

  const montar = () => {
    for (const sel of $$('select[name^="properties["]')) {
      if (sel.dataset.picker) continue;
      // OJO: la marca de "ya procesado" se pone al FINAL, no aqui. La app
      // inyecta el <select> y sus opciones por separado, asi que este bucle
      // puede encontrarlo todavia vacio; si se marcaba de entrada, ese
      // desplegable quedaba descartado para siempre y no se dibujaba nada.

      const rejilla = document.createElement('div');
      rejilla.className = 'bundle-pick';
      rejilla.setAttribute('role', 'group');
      const etiqueta = sel.id ? document.querySelector(`label[for="${sel.id}"]`) : null;
      if (etiqueta) rejilla.setAttribute('aria-label', etiqueta.textContent.trim());

      for (const opt of sel.options) {
        if (!opt.value) continue;                 // el "Elige una fragancia"
        const p = porTitulo.get(opt.text.trim().toUpperCase());
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bundle-pick__it';
        b.dataset.val = opt.value;
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML =
          `<span class="bundle-pick__img">${
            p && p.img ? `<img src="${p.img}" alt="" width="420" height="525" loading="lazy" decoding="async">` : ''
          }</span>` +
          `<span class="bundle-pick__casa">${p && p.casa ? p.casa : ''}</span>` +
          `<span class="bundle-pick__nom">${opt.text}</span>` +
          `<span class="bundle-pick__pre">${p && p.precio ? p.precio : ''}</span>`;
        b.addEventListener('click', () => {
          // Volver a pulsar la elegida la quita: elegir tiene que poder
          // deshacerse sin recargar.
          sel.value = sel.value === opt.value ? '' : opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          marcar();
          revisar();
        });
        rejilla.appendChild(b);
      }
      if (!rejilla.children.length) continue;

      const marcar = () => {
        for (const b of rejilla.children) {
          const on = b.dataset.val === sel.value;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      };
      // El widget llega con la PRIMERA fragancia ya puesta en los DOS
      // desplegables. Un cliente que no se fije añade dos veces el mismo
      // perfume creyendo que ha elegido. Se vacian: elegir tiene que ser un
      // acto, no un descuido.
      // SIN disparar `change`: la app escucha ese evento y rehace su widget
      // entero, llevandose por delante la rejilla recien puesta. Se cambia el
      // valor en silencio; el evento solo se dispara cuando elige el cliente,
      // que es cuando la app tiene algo de lo que enterarse.
      if (sel.options[0] && !sel.options[0].value && sel.selectedIndex !== 0) {
        sel.selectedIndex = 0;
      }

      sel.addEventListener('change', () => { marcar(); revisar(); });
      sel.classList.add('visually-hidden');
      sel.setAttribute('tabindex', '-1');
      sel.insertAdjacentElement('afterend', rejilla);
      sel.dataset.picker = '1';   // ahora si: la rejilla existe de verdad
      marcar();

      // Solo aqui sabemos que esta ficha es un combo de verdad: hay
      // desplegables de la app. Liquid no puede saberlo, porque los inyecta
      // el JS de la app despues. La clase deshace la maqueta de dos columnas
      // y la pagina pasa a leerse como una coleccion.
      document.querySelector('.pdp')?.classList.add('pdp--combo');
      // Y avisa al <body>: sin escenario negro, el menu tiene que volver a
      // tinta o se queda marfil sobre crema, o sea invisible.
      document.body.classList.add('ficha-combo');

      // "2 × $280.000": el precio del combo es por PAREJA, y a secas se lee
      // como si fuera el de un frasco. Se marca aqui y no en Liquid por lo
      // mismo: hasta este momento no se sabe que la ficha es un combo.
      const precio = $('.pdp__price');
      if (precio && !precio.dataset.par) {
        precio.dataset.par = '1';
        const n = document.createElement('span');
        n.className = 'pdp__par';
        n.textContent = '2 ×';
        precio.prepend(n, ' ');
      }
    }
  };

  // Se reintenta con un temporizador, NO con un MutationObserver.
  //
  // Dos razones, las dos comprobadas aqui: el observador se disparaba con sus
  // propias mutaciones —`revisar()` escribe el aviso dentro de la zona
  // observada— y colgaba la pagina en un bucle; y ademas no avisaba de forma
  // fiable cuando la app rellenaba las opciones del <select>. Un sondeo corto
  // y acotado es aburrido, pero se comporta siempre igual.
  const yaEstan = () => {
    const s = $$('select[name^="properties["]');
    return s.length > 0 && s.every((x) => x.dataset.picker);
  };

  // El reloj NO se para al primer exito.
  //
  // La app vuelve a dibujar su widget despues de que nosotros montemos la
  // rejilla, y se la lleva por delante. Si el reloj se detenia al conseguirlo
  // una vez, la rejilla desaparecia para siempre y la pagina se quedaba con
  // los desplegables de la app. Asi que se vigila: mientras falte una rejilla
  // por cada desplegable, se vuelve a montar.
  let intentos = 0;
  const reloj = setInterval(() => {
    intentos += 1;
    const sels = $$('select[name^="properties["]');
    const faltanRejillas = sels.length > document.querySelectorAll('.bundle-pick').length;
    if (faltanRejillas) {
      // Se quitan las marcas viejas: los <select> pueden ser otros nodos.
      sels.forEach((s) => { if (!s.nextElementSibling?.classList.contains('bundle-pick')) delete s.dataset.picker; });
      montar();
    }
    revisar();
    if (intentos > 150) clearInterval(reloj);   // 60s y se deja de vigilar
  }, 400);

  montar();
  revisar();
}

async function boot() {
  initHeader();
  initMenu();
  initBag();
  initSaved();
  initSearch();
  initProduct();
  initHouses();
  initBundlePicker();
  await cargarModulos();
  initSwipeHint();
  initReel();
  initQuiz({ showPanel, closePanel, initReveal });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// El editor de temas reemplaza el HTML de una seccion: hay que reenganchar
document.addEventListener('shopify:section:load', () => {
  initSwipeHint();
  paintSavedButtons();
});

export { showPanel, closePanel, money };
