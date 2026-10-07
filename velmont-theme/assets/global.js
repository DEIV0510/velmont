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
// Un producto subido sin proveedor trae el nombre de la tienda («Mi tienda»):
// eso no es una casa perfumera y no se enseña como tal (window.VELMONT.sinCasa).
const casaVisible = (v) => (v && !(window.VELMONT?.sinCasa || ['Mi tienda']).includes(v) ? v : '');
// La busqueda predictiva devuelve el precio en pesos y como texto ("500000.00"),
// no en centavos como el carrito: sin esto salia tal cual, sin $ ni puntos.
const precioBusqueda = (txt) => {
  const n = parseFloat(txt);
  return Number.isFinite(n) ? money(Math.round(n * 100)) : '';
};
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

/* La linea de un combo enseña los dos perfumes elegidos (propiedad privada
   _duo, ver initBundlePicker), no la foto del producto combo: un cliente que
   eligio dos frascos y ve otra cosa en su bolsa duda de lo que compro. */
const fotosDuo = new Map();
async function pintarDuo(raiz) {
  for (const im of raiz.querySelectorAll('img[data-duo-h]:not([src])')) {
    const h = im.dataset.duoH;
    try {
      if (!fotosDuo.has(h)) {
        fotosDuo.set(h, fetch(`${routes.root || '/'}products/${encodeURIComponent(h)}.js`)
          .then((r) => r.json()).then((p) => p.featured_image || ''));
      }
      const src = await fotosDuo.get(h);
      if (src) im.src = src.replace(/(\.[a-z]+)(\?|$)/i, '_128x$1$2');
    } catch { /* sin foto: queda el hueco, el nombre sigue debajo */ }
  }
}

function lineHTML(item, index) {
  const duo = item.properties && item.properties._duo
    ? String(item.properties._duo).split('|').filter(Boolean).slice(0, 2)
    : [];
  const img = duo.length
    ? `<span class="bag-line__duo">${duo.map((h) => `<img data-duo-h="${h}" alt="" width="44" height="55">`).join('')}</span>`
    : item.image
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
  pintarDuo(body);
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
      // Combo: manda lo que dicen los <select> (lo que eligio el cliente), no
      // los campos ocultos de la app, que pueden ir un paso atras (llegan con
      // «9PM BLACK» y solo se ponen al dia con cada «change»). Y recompone
      // _bundle_selection con el formato de la app, «A <> B», que es el que
      // separa el combo en sus dos perfumes en el checkout.
      const sels = [...form.querySelectorAll('select[name^="properties["]')];
      if (sels.length) {
        for (const s of sels) {
          const m = s.name.match(/^properties\[(.+)\]$/);
          if (m && s.value) props[m[1]] = s.value;
        }
        if ('_bundle_selection' in props) props._bundle_selection = sels.map((s) => s.value).join(' <> ');
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
        ${casaVisible(p.vendor) ? `<span class="label">${casaVisible(p.vendor)}</span>` : ''}
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
            <div><h3 class="piece__name">${p.title}</h3><span class="label piece__house">${casaVisible(p.vendor)}</span></div>
            <span class="price">${precioBusqueda(p.price)}</span>
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

  // Relleno de los lados de la foto (que va entera, sin recortar). Se mide el
  // borde de una copia diminuta: si es un fondo liso de estudio (las fotos de
  // Mundus, en blanco), los lados toman ese color; si es una escena (las de
  // arcos dorados), se deja el desenfoque de la propia foto. Desenfocar una
  // foto blanca arrastraba el gris del frasco a los lados y se veia sucio.
  const borde = stage.dataset.fotoBorde;
  if (borde) {
    const escena = () => stage.classList.add('pdp__stage--escena');
    const muestra = new Image();
    muestra.crossOrigin = 'anonymous';
    muestra.onload = () => {
      try {
        const w = 32, h = 40;
        const lienzo = document.createElement('canvas');
        lienzo.width = w; lienzo.height = h;
        const cx = lienzo.getContext('2d');
        cx.drawImage(muestra, 0, 0, w, h);
        const d = cx.getImageData(0, 0, w, h).data;
        let n = 0, lisos = 0, r = 0, g = 0, b = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (x > 1 && x < w - 2 && y > 1 && y < h - 2) continue;   // solo el marco
            const i = (y * w + x) * 4;
            n += 1; r += d[i]; g += d[i + 1]; b += d[i + 2];
            const hi = Math.max(d[i], d[i + 1], d[i + 2]), lo = Math.min(d[i], d[i + 1], d[i + 2]);
            if (lo > 215 && hi - lo < 24) lisos += 1;
          }
        }
        if (lisos / n < 0.85) { escena(); return; }
        stage.style.setProperty('--pdp-liso', `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
        stage.classList.add('pdp__stage--liso');
      } catch { escena(); }
    };
    muestra.onerror = escena;
    muestra.src = borde;
  }

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
  const porHandle = new Map(piezas.map((p) => [p.h, p]));
  // La app de bundles guarda SUS nombres y no se entera si el producto cambia:
  // «9PM DIVE» (hoy 9AM DIVE), «HAYATY» (HAYAATI), «ODYSSEY-GO-MANGO»,
  // «NÁUTICA» con tilde. Comparando el texto tal cual, esas tarjetas salian
  // sin foto, casa ni precio (el dueño lo vio en su iPhone, 2026-10-06). Se
  // compara sin tildes, espacios ni signos, contra el titulo Y el handle, y
  // si nada coincide, con una letra de diferencia (dos en nombres largos).
  const clave = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const distancia = (a, b) => {
    const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let diag = fila[0];
      fila[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const arriba = fila[j];
        fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = arriba;
      }
    }
    return fila[b.length];
  };
  const porClave = new Map();
  const indexar = (p) => { for (const k of [clave(p.t), clave(p.h)]) if (k && !porClave.has(k)) porClave.set(k, p); };
  piezas.forEach(indexar);
  const buscarPieza = (texto) => {
    const k = clave(texto);
    if (!k) return null;
    if (porClave.has(k)) return porClave.get(k);
    let mejor = null, dmin = Infinity, empate = false;
    for (const [kk, p] of porClave) {
      if (Math.abs(kk.length - k.length) > 2) continue;
      const d = distancia(k, kk);
      if (d < dmin) { dmin = d; mejor = p; empate = false; }
      else if (d === dmin && p !== mejor) empate = true;
    }
    return mejor && !empate && dmin <= (k.length >= 12 ? 2 : 1) ? mejor : null;
  };
  const precioCombo = parseInt(datos.dataset.precioCombo, 10) || 0;
  // NO se guarda el contenedor: la app reemplaza el subarbol de .pdp__info,
  // y una referencia vieja apunta a un nodo ya desconectado. Se busca
  // siempre desde el documento.
  const boton = $('[name=add]');
  // Si ya venia bloqueado (sin existencias), no se toca: el bloqueo por falta
  // de eleccion nunca debe DESbloquear algo que Shopify dio por agotado.
  const bloqueadoDeOrigen = boton ? boton.disabled : false;
  let aviso = null;
  // Paso reabierto con «Cambiar». Sin el, esta abierto el primero sin elegir.
  let reabierto = null;
  // Tras elegir hay que llevar al cliente al paso siguiente. Se hace dentro
  // de revisar() y no en el clic: la app puede rehacer su widget justo
  // despues, y el reloj vuelve a montar las rejillas un instante mas tarde.
  let avanzar = false;
  // Lo que eligio el cliente, por nombre de desplegable: la UNICA fuente de
  // verdad. La app dibuja sus <select> DOS veces al cargar (medido: a los ~400
  // y ~900 ms) y la segunda llega otra vez con «9PM BLACK» en los dos: vaciar
  // una sola vez dejaba el combo armado sin que el cliente eligiera nada. En
  // cada vuelta del reloj se obliga a cada <select> a decir lo de este mapa.
  const elecciones = new Map();
  const imponer = (sel) => {
    const quiere = elecciones.get(sel.name) || '';
    if (sel.value === quiere) return false;
    if (quiere && [...sel.options].some((o) => o.value === quiere)) { sel.value = quiere; return true; }
    if (!quiere && sel.options[0] && !sel.options[0].value) { sel.selectedIndex = 0; return true; }
    return false;
  };

  const selects = () => $$('select[name^="properties["]');
  const elegida = (sel) => {
    if (!sel.value) return null;
    const texto = sel.options[sel.selectedIndex]?.text || '';
    return buscarPieza(texto) || { t: texto.trim() };
  };
  const pasoAbierto = (todos) => (reabierto !== null && reabierto < todos.length
    ? reabierto
    : todos.findIndex((s) => !s.value));
  const ir = (el) => {
    if (!el) return;
    const lenis = window.VelmontLenis;
    if (lenis && typeof lenis.scrollTo === 'function') lenis.scrollTo(el, { offset: -110 });
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---------------------------------------------------------------------
     Todo sale de los valores de los <select>: que paso esta abierto, el
     resumen de la barra fija, el boton y el dato _duo. Asi, si la app
     rehace su widget y el reloj vuelve a montar las rejillas, el estado se
     recompone igual sin guardarlo en ningun otro sitio.
     --------------------------------------------------------------------- */
  const revisar = () => {
    const todos = selects();
    if (!todos.length || !boton) return;
    // Primero, que cada <select> y su rejilla digan lo que eligio el cliente.
    todos.forEach((sel) => {
      imponer(sel);
      const rejilla = sel.nextElementSibling;
      if (!rejilla?.classList.contains('bundle-pick')) return;
      for (const b of rejilla.querySelectorAll('.bundle-pick__it')) {
        const on = b.dataset.val === sel.value;
        if (b.classList.contains('on') !== on) {
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      }
    });
    const abierto = pasoAbierto(todos);

    todos.forEach((sel, i) => {
      const rejilla = sel.nextElementSibling;
      if (!rejilla || !rejilla.classList.contains('bundle-pick')) return;
      const p = elegida(sel);
      rejilla.classList.toggle('is-cerrado', i !== abierto);
      const paso = rejilla.querySelector('.bundle-paso');
      if (!paso) return;
      const nombre = paso.querySelector('.bundle-paso__elegida');
      if (nombre.textContent !== (p ? p.t : '')) nombre.textContent = p ? p.t : '';
      paso.querySelector('.bundle-paso__cambiar').hidden = !(p && i !== abierto);
      paso.querySelector('.bundle-paso__espera').hidden = !(!p && i !== abierto);
    });

    if (avanzar && todos.every((s) => s.nextElementSibling?.classList.contains('bundle-pick'))) {
      avanzar = false;
      // Al siguiente paso abierto; si ya estan los dos, al primero, para que
      // se vean juntas las dos elecciones y, debajo, el boton.
      ir((abierto >= 0 ? todos[abierto] : todos[0]).nextElementSibling);
    }

    if (bloqueadoDeOrigen) return;
    const faltan = todos.filter((s) => !s.value).length;
    boton.disabled = faltan > 0;
    if (!aviso || !aviso.isConnected) {
      aviso = document.createElement('p');
      aviso.className = 'bundle-aviso';
      aviso.setAttribute('aria-live', 'polite');
      // DENTRO del grupo de acciones, no antes: ese grupo se queda fijo al pie
      // mientras el cliente elige, y el resumen tiene que viajar con el.
      boton.closest('.pdp__cta')?.prepend(aviso);
    }
    const nombres = todos.map((s) => elegida(s)?.t).filter(Boolean);
    // El reloj llama a revisar() cada 400 ms: el resumen solo se reescribe si
    // cambio, o un lector de pantalla (aria-live) lo repetiria sin parar.
    const clave = nombres.join('|') + '#' + faltan;
    if (aviso.dataset.clave === clave) return;
    aviso.dataset.clave = clave;
    aviso.replaceChildren();
    if (!nombres.length) {
      aviso.textContent = 'Elige tus dos fragancias';
    } else {
      const b = document.createElement('b');
      b.textContent = nombres.join(' + ');
      aviso.append('Tu dúo: ', b);
      if (faltan) {
        aviso.append(' · falta la segunda');
      } else {
        // El ahorro solo se dice si lo hay. Con los perfumes mas baratos de
        // la seleccion, la pareja suelta cuesta MENOS que el combo: ahi no se
        // promete nada.
        const suelto = todos.reduce((t, s) => t + (elegida(s)?.c || 0), 0);
        const ahorro = suelto - precioCombo;
        if (precioCombo && ahorro > 0) {
          const s = document.createElement('span');
          s.className = 'bundle-aviso__ahorro';
          s.textContent = ` · Por separado ${money(suelto)}: ahorras ${money(ahorro)}`;
          aviso.append(s);
        }
      }
    }

    // _duo: los dos perfumes elegidos, por handle. Es privado (empieza por
    // «_», no se le muestra al cliente) y sirve para pintar sus fotos en la
    // bolsa y en el carrito en vez de la foto del producto combo.
    const form = boton.form;
    if (form) {
      let duo = form.querySelector('input[name="properties[_duo]"]');
      if (!duo) {
        duo = document.createElement('input');
        duo.type = 'hidden';
        duo.name = 'properties[_duo]';
        form.appendChild(duo);
      }
      const valor = faltan ? '' : todos.map((s) => elegida(s)?.h || '').join('|');
      if (duo.value !== valor) duo.value = valor;
    }
  };

  let fichaLista = false;
  const prepararFicha = () => {
    if (fichaLista) return;
    fichaLista = true;
    // «$280.000 por los dos». Antes decia «2 × $280.000», que se lee como dos
    // veces 280.000. El precio es por la PAREJA, y asi se dice; debajo, como
    // funciona, en una linea.
    const precio = $('.pdp__price');
    if (precio && !precio.dataset.par) {
      precio.dataset.par = '1';
      const n = document.createElement('span');
      n.className = 'pdp__par';
      n.textContent = 'por los dos';
      precio.append(' ', n);
      // Con la guia de tres pasos (snippet guia-duo, encima del selector) esta
      // linea repetia lo mismo: solo se pone si la guia no esta.
      if (!$('.guia-duo')) {
        const como = document.createElement('p');
        como.className = 'pdp__como';
        como.textContent = `Elige dos perfumes de la selección y paga ${money(precioCombo)} por los dos, en dos pasos.`;
        precio.insertAdjacentElement('afterend', como);
      }
    }
    if (boton && !boton.dataset.duo && !bloqueadoDeOrigen) {
      boton.dataset.duo = '1';
      boton.textContent = 'Añadir el dúo';
    }
    // Llega preelegido desde la coleccion o desde la ficha de un perfume
    // (?elige=handle): ese perfume queda como primera fragancia.
    const h = new URLSearchParams(location.search).get('elige');
    const p = h && porHandle.get(h);
    const primero = selects()[0];
    if (p && primero && !elecciones.has(primero.name)) {
      const opt = [...primero.options].find((o) => o.value && buscarPieza(o.text) === p);
      // Sin «change»: la app se pone al dia cuando el cliente elija el
      // segundo, y al añadir se manda lo que dicen los <select> (ver submit).
      if (opt) { elecciones.set(primero.name, opt.value); imponer(primero); }
    }
  };

  // Tarjeta de un perfume del selector. Si se reconoce, foto, casa, nombre
  // real del producto y precio suelto; si no, al menos el nombre de la app.
  // «Suelto»: es el precio del frasco solo. Sin la palabra, 169.000 debajo de
  // cada perfume competia con el 280.000 del combo. Texto con textContent: los
  // nombres traen «&» (AL OUD HONOR & GLORY).
  const pintarTarjeta = (b, texto) => {
    const p = buscarPieza(texto);
    b.innerHTML =
      `<span class="bundle-pick__img">${
        p && p.img ? `<img src="${p.img}" alt="" width="420" height="525" loading="lazy" decoding="async">` : ''
      }</span>` +
      '<span class="bundle-pick__casa"></span><span class="bundle-pick__nom"></span><span class="bundle-pick__pre"></span>';
    b.querySelector('.bundle-pick__casa').textContent = p ? casaVisible(p.casa) : '';
    b.querySelector('.bundle-pick__nom').textContent = p ? p.t : texto;
    b.querySelector('.bundle-pick__pre').textContent = p && p.precio ? `Suelto ${p.precio}` : '';
  };

  // Ultimo recurso: un perfume que la app ofrece y que no esta ni en la
  // coleccion ni en «Más perfumes del combo». Se busca en la tienda y solo se
  // acepta si hay UN unico producto con ese nombre: con dos iguales (los
  // NAUTICA VOYAGE duplicados) no se adivina cual es.
  const buscados = new Set();
  const completarFuera = async (textos) => {
    const nuevos = [...new Set(textos)].filter((t) => !buscados.has(clave(t)));
    if (!nuevos.length) return;
    nuevos.forEach((t) => buscados.add(clave(t)));
    let hallados = 0;
    for (const t of nuevos) {
      try {
        const url = `${routes.predictive || '/search/suggest'}.json?q=${encodeURIComponent(t)}&resources[type]=product&resources[limit]=10`;
        const prods = (await (await fetch(url)).json()).resources?.results?.products || [];
        const iguales = prods.filter((x) => clave(x.title) === clave(t) || clave(x.handle) === clave(t));
        if (iguales.length !== 1) continue;
        const x = iguales[0];
        const c = Math.round(parseFloat(x.price) * 100);
        const pieza = {
          t: x.title, h: x.handle, casa: x.vendor, c, precio: Number.isFinite(c) ? money(c) : '',
          img: x.image ? x.image.replace(/(\.[a-z]+)(\?|$)/i, '_420x$1$2') : '',
        };
        porHandle.set(pieza.h, pieza);
        indexar(pieza);
        hallados += 1;
      } catch { /* sin red: la tarjeta se queda con el nombre */ }
    }
    if (!hallados) return;
    for (const b of document.querySelectorAll('.bundle-pick__it')) {
      if (!b.querySelector('img') && b.dataset.texto) pintarTarjeta(b, b.dataset.texto);
    }
    revisar();
  };

  const montar = () => {
    const sinDatos = [];
    selects().forEach((sel, i) => {
      if (sel.dataset.picker) return;
      // OJO: la marca de "ya procesado" se pone al FINAL, no aqui. La app
      // inyecta el <select> y sus opciones por separado, asi que este bucle
      // puede encontrarlo todavia vacio; si se marcaba de entrada, ese
      // desplegable quedaba descartado para siempre y no se dibujaba nada.

      const rejilla = document.createElement('div');
      rejilla.className = 'bundle-pick';
      rejilla.setAttribute('role', 'group');
      const etiqueta = sel.id ? document.querySelector(`label[for="${sel.id}"]`) : null;
      const titulo = (etiqueta?.textContent || '').trim() || (i === 0 ? 'Primera fragancia' : 'Segunda fragancia');
      rejilla.setAttribute('aria-label', titulo);

      // Cabecera del paso, DENTRO de la rejilla (a todo el ancho): asi el
      // <select> sigue teniendo la rejilla justo al lado, que es lo que mira
      // el reloj para saber si hay que volver a montar.
      const paso = document.createElement('div');
      paso.className = 'bundle-paso';
      paso.innerHTML =
        `<span class="bundle-paso__n" aria-hidden="true">${i + 1}</span>` +
        '<span class="bundle-paso__t"></span>' +
        '<span class="bundle-paso__elegida"></span>' +
        '<span class="bundle-paso__espera" hidden>Primero elige la anterior</span>' +
        '<button type="button" class="link bundle-paso__cambiar" hidden>Cambiar</button>';
      paso.querySelector('.bundle-paso__t').textContent = titulo;
      paso.querySelector('.bundle-paso__cambiar').addEventListener('click', () => {
        reabierto = i;
        revisar();
        ir(rejilla);
      });
      rejilla.appendChild(paso);

      for (const opt of sel.options) {
        if (!opt.value) continue;                 // el "Elige una fragancia"
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bundle-pick__it';
        b.dataset.val = opt.value;
        b.dataset.texto = opt.text;
        b.setAttribute('aria-pressed', 'false');
        pintarTarjeta(b, opt.text);
        if (!buscarPieza(opt.text)) sinDatos.push(opt.text);
        b.addEventListener('click', () => {
          // Volver a pulsar la elegida la quita: elegir tiene que poder
          // deshacerse sin recargar.
          const nuevo = sel.value === opt.value ? '' : opt.value;
          if (nuevo) elecciones.set(sel.name, nuevo); else elecciones.delete(sel.name);
          sel.value = nuevo;
          // `change` SI hace falta aqui: con el la app rehace sus campos
          // ocultos (_bundle_selection), que son los que separan el combo en
          // dos perfumes en el checkout. Medido sin el: seguian diciendo
          // «9PM BLACK <> 9PM BLACK», lo que la app trae puesto.
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          marcar();
          if (nuevo) { reabierto = null; avanzar = true; }
          revisar();
        });
        rejilla.appendChild(b);
      }
      if (!rejilla.querySelector('.bundle-pick__it')) return;

      const marcar = () => {
        for (const b of rejilla.querySelectorAll('.bundle-pick__it')) {
          const on = b.dataset.val === sel.value;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      };
      // El widget llega con la PRIMERA fragancia ya puesta en los DOS
      // desplegables. Un cliente que no se fije añade dos veces el mismo
      // perfume creyendo que ha elegido. Se vacian: elegir tiene que ser un
      // acto, no un descuido. SIN `change`: hasta que el cliente elija, el
      // boton esta bloqueado, y cada eleccion si lo dispara.
      // Solo la PRIMERA vez que aparece cada uno: si la app lo vuelve a
      // dibujar, ya trae lo que el cliente eligio y no se le borra.
      imponer(sel);

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
    });
    if (document.querySelector('.bundle-pick')) prepararFicha();
    if (sinDatos.length) completarFuera(sinDatos);
  };

  // Se reintenta con un temporizador, NO con un MutationObserver.
  //
  // Dos razones, las dos comprobadas aqui: el observador se disparaba con sus
  // propias mutaciones —`revisar()` escribe el aviso dentro de la zona
  // observada— y colgaba la pagina en un bucle; y ademas no avisaba de forma
  // fiable cuando la app rellenaba las opciones del <select>. Un sondeo corto
  // y acotado es aburrido, pero se comporta siempre igual.
  //
  // El reloj NO se para al primer exito: la app vuelve a dibujar su widget
  // despues de que nosotros montemos la rejilla, y se la lleva por delante.
  // Mientras falte una rejilla por cada desplegable, se vuelve a montar.
  let intentos = 0;
  const reloj = setInterval(() => {
    intentos += 1;
    const sels = selects();
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

// El dueño escribe descripciones pegando texto de un chat: llegan con emojis y
// con envoltorios vacíos (div con un <br>, section sin nada). La casa no usa
// emojis: se quitan aquí, antes de que el bloque se revele. ©, ® y ™ se quedan.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu;
function limpiarTextosPegados() {
  for (const raiz of $$('.collection-head__note, .pdp__desc')) {
    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
      const limpio = n.nodeValue.replace(EMOJI, '');
      if (limpio !== n.nodeValue) n.nodeValue = limpio.replace(/ {2,}/g, ' ');
    }
    for (const el of $$('div, section, p, span', raiz)) {
      if (el.isConnected && !el.textContent.trim() && !el.querySelector('img, video, iframe')) el.remove();
    }
  }
}

/* ---------------- Pestaña del Dúo VELMONT ----------------
   La etiqueta «Dúo VELMONT» de las piezas y el «¿Qué es?» de la ficha abren una
   pestaña que explica el duo. Con cursor se abre sola al pasar por encima (CSS);
   en tactil no hay hover, asi que el toque la abre y la cierra. Delegado en el
   documento: tambien sirve para las piezas que llegan despues (cuestionario). */
function initDuoTip() {
  const cerrar = (salvo) => {
    for (const tip of $$('[data-duo-tip].is-open')) {
      if (tip === salvo) continue;
      tip.classList.remove('is-open');
      $('.duo-tip__btn', tip)?.setAttribute('aria-expanded', 'false');
    }
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.duo-tip__btn');
    if (btn) {
      const tip = btn.closest('[data-duo-tip]');
      e.preventDefault();
      e.stopPropagation();
      const abrir = !tip.classList.contains('is-open');
      cerrar(tip);
      tip.classList.toggle('is-open', abrir);
      btn.setAttribute('aria-expanded', String(abrir));
      return;
    }
    // Un toque en la pestaña (fuera de su enlace) la cierra, sin abrir la ficha
    // que queda debajo. En piezas estrechas la pestaña tapa la etiqueta, asi
    // que este es el gesto para cerrarla.
    if (e.target.closest('.duo-tip__panel') && !e.target.closest('a')) e.preventDefault();
    cerrar(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar(null);
  });
}

async function boot() {
  limpiarTextosPegados();
  initHeader();
  initMenu();
  initBag();
  initSaved();
  initSearch();
  initProduct();
  initHouses();
  initBundlePicker();
  initDuoTip();
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
