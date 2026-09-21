// VELMONT — bootstrap unico del tema. Una sola capa de JS para todas las
// plantillas: cada bloque se activa solo si encuentra su marcador en el DOM.
// Importa el resto de modulos con rutas relativas (mismo directorio /assets)
// para que exista UNA sola instancia de cada modulo — cargarlos ademas con
// <script src> duplicaria el estado del carrito.
import { initAll, initReveal, bindMenuVisuals } from './ui.js';
import { getProducts, getProductBySlug, getCollections, bottleSVG, formatCOP } from './catalog.js';
import { mountCartDrawer, openCart, showToast } from './cart-ui.js';
import { mountFavoritesDrawer } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { mountFinder } from './finder.js';
import { pieceHTML } from './piece.js';
import { addToCart } from './cart.js';
import { toggleFavorite, isFavorite } from './favorites.js';

initAll();
mountCartDrawer(document.querySelector('[data-bag-root]'));
mountFavoritesDrawer(document.querySelector('[data-saved-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-advisor-root]'));
mountFinder(document.querySelector('[data-finder-root]'));

const AXES = ['dulce', 'fresco', 'intenso', 'amaderado', 'especiado', 'citrico', 'oriental'];
const AXIS_LABEL = { dulce: 'Dulce', fresco: 'Fresco', intenso: 'Intenso', amaderado: 'Amaderado', especiado: 'Especiado', citrico: 'Cítrico', oriental: 'Oriental' };

const FILTERS = [
  { v: 'all', label: 'Todas' },
  { v: 'hombre', label: 'Para él', type: 'gender' },
  { v: 'mujer', label: 'Para ella', type: 'gender' },
  { v: 'unisex', label: 'Sin género', type: 'gender' },
  { v: 'amaderado', label: 'Amaderadas', type: 'family' },
  { v: 'oriental', label: 'Orientales', type: 'family' },
  { v: 'fresco', label: 'Frescas', type: 'family' },
  { v: 'citrico', label: 'Cítricas', type: 'family' },
  { v: 'dulce', label: 'Dulces', type: 'family' },
  { v: 'intensa', label: 'Intensas', type: 'intensity' },
];

(async () => {
  const [products, collections] = await Promise.all([getProducts(), getCollections()]);
  if (!products.length) return;

  // Visuales del menu fullscreen (en todas las plantillas)
  const menuVisual = document.querySelector('[data-menu-visual]');
  if (menuVisual) {
    menuVisual.innerHTML = products.slice(0, 5).map((p, i) => `<figure class="${i === 0 ? 'on' : ''}">${bottleSVG(p)}</figure>`).join('');
    bindMenuVisuals();
  }

  // ---------- Portada ----------
  const heroMount = document.querySelector('[data-hero-bottle]');
  if (heroMount) {
    const pick = products.find(p => p.family === 'amaderado' && p.featured) || products.find(p => p.featured) || products[0];
    heroMount.innerHTML = bottleSVG(pick);
    const reflect = document.querySelector('[data-hero-reflect]');
    if (reflect) reflect.innerHTML = bottleSVG(pick);
  }

  const composition = document.querySelector('[data-composition]');
  if (composition) {
    const featured = products.filter(p => p.featured);
    const picks = (featured.length >= 6 ? featured : [...featured, ...products.filter(p => !p.featured)]).slice(0, 6);
    composition.innerHTML = picks.map(p => pieceHTML(p)).join('');
  }

  for (const rule of collections.filter(c => c.kind === 'promo')) {
    const duo = document.querySelector(`[data-duo="${rule.id}"]`);
    if (duo) duo.innerHTML = products.filter(p => p.promo === rule.id).slice(0, 2).map(p => `<figure>${bottleSVG(p)}</figure>`).join('');
  }

  const world = document.querySelector('[data-world-bottle]');
  if (world) world.innerHTML = bottleSVG(products.find(p => p.family === 'oriental') || products[1] || products[0]);

  // ---------- Colección ----------
  const grid = document.querySelector('[data-grid]');
  if (grid) {
    const bar = document.querySelector('[data-filters]');
    const empty = document.querySelector('[data-empty]');
    const note = document.querySelector('[data-collection-note]');
    const promo = new URLSearchParams(location.search).get('promo');

    const paint = (list) => {
      grid.innerHTML = list.map(p => pieceHTML(p)).join('');
      if (empty) empty.hidden = list.length > 0;
      initReveal(grid);
    };

    if (promo) {
      const rule = collections.find(c => c.id === promo);
      if (note) note.innerHTML = `Piezas que participan en <strong>${rule ? rule.label : promo}</strong>.`;
      if (bar) bar.remove();
      paint(products.filter(p => p.promo === promo));
    } else {
      if (note) note.textContent = `${products.length} fragancias en catálogo. Seleccionadas una por una.`;
      if (bar) {
        bar.innerHTML = FILTERS.map(f => `<button data-f="${f.v}" class="${f.v === 'all' ? 'on' : ''}">${f.label}</button>`).join('');
        bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          bar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          const v = b.dataset.f;
          if (v === 'all') return paint(products);
          const def = FILTERS.find(f => f.v === v);
          paint(products.filter(p => {
            if (def.type === 'gender') return p.gender === def.v;
            if (def.type === 'family') return p.family === def.v;
            if (def.type === 'intensity') return p.intensity === def.v;
            return true;
          }));
        }));
      }
      paint(products);
    }
  }

  // ---------- Ficha de producto ----------
  const pdp = document.querySelector('[data-product-root]');
  if (pdp) {
    const product = await getProductBySlug(pdp.dataset.productSlug);
    if (product) {
      const stage = document.querySelector('[data-pdp-stage]');
      if (stage && !stage.querySelector('img')) stage.innerHTML = bottleSVG(product);

      const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
      set('[data-pdp-family]', product.family || '—');
      set('[data-pdp-intensity]', product.intensity || '—');
      const occ = document.querySelector('[data-pdp-occasion]');
      if (occ) occ.innerHTML = (product.occasion || []).map(o => `<span>${o}</span>`).join('') || '—';
      const notes = document.querySelector('[data-pdp-notes]');
      if (notes) notes.innerHTML = (product.notes || []).map(n => `<span>${n}</span>`).join('') || '—';

      const prof = document.querySelector('[data-pdp-profile]');
      if (prof) prof.innerHTML = AXES.map(k => {
        const v = product.profile?.[k] || 0;
        return `<div class="profile__row"><span class="label">${AXIS_LABEL[k]}</span><div class="profile__track"><i style="width:${v * 20}%"></i></div></div>`;
      }).join('');

      const saveBtn = document.querySelector('[data-pdp-save]');
      if (saveBtn) {
        const sync = () => { saveBtn.textContent = isFavorite(product.id) ? 'Guardado' : 'Guardar'; };
        sync();
        saveBtn.addEventListener('click', () => { toggleFavorite(product.id); sync(); });
      }

      // El form tiene fallback sin JS; con JS usamos la Cart AJAX API + bolsa lateral
      const addBtn = document.querySelector('[data-pdp-add]');
      if (addBtn) addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addToCart(product.id, 1);
        showToast('Añadido a tu selección');
        openCart();
      });

      const related = document.querySelector('[data-related]');
      if (related) {
        const list = products
          .filter(p => p.id !== product.id)
          .map(p => ({ p, s: (p.family === product.family ? 2 : 0) + (p.personality || []).filter(t => product.personality?.includes(t)).length }))
          .sort((a, b) => b.s - a.s)
          .slice(0, 4)
          .map(x => x.p);
        related.innerHTML = list.map(p => pieceHTML(p)).join('');
      }
    }
  }

  initReveal();
})();

export { formatCOP };
