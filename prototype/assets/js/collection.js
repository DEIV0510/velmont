import { initAll, initReveal, bindMenuVisuals } from './ui.js';
import { getProducts, getCollections, bottleSVG } from './catalog.js';
import { mountCartDrawer } from './cart-ui.js';
import { mountFavoritesDrawer } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { mountFinder } from './finder.js';
import { pieceHTML } from './piece.js';

initAll();
mountCartDrawer(document.querySelector('[data-bag-root]'));
mountFavoritesDrawer(document.querySelector('[data-saved-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-advisor-root]'));
mountFinder(document.querySelector('[data-finder-root]'));

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
  const grid = document.querySelector('[data-grid]');
  const bar = document.querySelector('[data-filters]');
  const empty = document.querySelector('[data-empty]');
  const note = document.querySelector('[data-collection-note]');

  const menuVisual = document.querySelector('[data-menu-visual]');
  if (menuVisual) {
    menuVisual.innerHTML = products.slice(0, 5).map((p, i) => `<figure class="${i === 0 ? 'on' : ''}">${bottleSVG(p)}</figure>`).join('');
    bindMenuVisuals();
  }

  const params = new URLSearchParams(location.search);
  const promo = params.get('promo');

  function paint(list) {
    grid.innerHTML = list.map(p => pieceHTML(p)).join('');
    if (empty) empty.hidden = list.length > 0;
    initReveal(grid);
  }

  if (promo) {
    const rule = collections.find(c => c.id === promo);
    const list = products.filter(p => p.promo === promo);
    if (note) note.innerHTML = `Piezas que participan en <strong>${rule ? rule.label : promo}</strong>. <a class="link" href="/collection.html" style="margin-left:12px">Ver todo</a>`;
    if (bar) bar.remove();
    paint(list);
    return;
  }

  if (note) note.textContent = `${products.length} fragancias en catálogo. Seleccionadas una por una.`;

  let active = 'all';
  bar.innerHTML = FILTERS.map(f => `<button data-f="${f.v}" class="${f.v === 'all' ? 'on' : ''}">${f.label}</button>`).join('');
  bar.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      active = b.dataset.f;
      bar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (active === 'all') return paint(products);
      const def = FILTERS.find(f => f.v === active);
      paint(products.filter(p => {
        if (def.type === 'gender') return p.gender === def.v;
        if (def.type === 'family') return p.family === def.v;
        if (def.type === 'intensity') return p.intensity === def.v;
        return true;
      }));
    });
  });

  paint(products);
})();
