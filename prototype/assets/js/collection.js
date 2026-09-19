import { initAll, initReveal } from './ui.js';
import { getProducts, getCollections } from './catalog.js';
import { mountCartDrawer, openCart } from './cart-ui.js';
import { mountFavoritesDrawer } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { productCardTpl } from './product-card.js';

initAll();
mountCartDrawer(document.querySelector('[data-cart-root]'));
mountFavoritesDrawer(document.querySelector('[data-favorites-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-assistant-root]'));
document.querySelector('[data-cart-open]')?.addEventListener('click', openCart);

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'hombre', label: 'Hombre', type: 'gender' },
  { value: 'mujer', label: 'Mujer', type: 'gender' },
  { value: 'unisex', label: 'Unisex', type: 'gender' },
  { value: 'dulce', label: 'Dulces', type: 'family' },
  { value: 'fresco', label: 'Frescos', type: 'family' },
  { value: 'amaderado', label: 'Amaderados', type: 'family' },
  { value: 'intenso', label: 'Intensos', type: 'intensity', match: 'intensa' },
  { value: 'citrico', label: 'Cítricos', type: 'family' },
  { value: 'oriental', label: 'Orientales', type: 'family' },
];

(async () => {
  const [products, collections] = await Promise.all([getProducts(), getCollections()]);
  const params = new URLSearchParams(location.search);
  const promoParam = params.get('promo');

  let activeFilter = 'all';
  const filterBar = document.querySelector('[data-filter-bar]');
  const grid = document.querySelector('[data-collection-grid]');
  const emptyState = document.querySelector('[data-empty-state]');

  if (promoParam) {
    const rule = collections.find(c => c.id === promoParam);
    filterBar.innerHTML = `<p class="lede">Mostrando fragancias participantes de <strong>${rule ? rule.label : promoParam}</strong> · <a href="/collection.html" class="link-underline">ver todo el catálogo</a></p>`;
    renderGrid(products.filter(p => p.promo === promoParam));
    return;
  }

  filterBar.innerHTML = FILTERS.map(f => `<button type="button" class="filter-chip ${f.value === 'all' ? 'is-active' : ''}" data-filter="${f.value}">${f.label}</button>`).join('');
  filterBar.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('is-active', c === chip));
      applyFilter();
    });
  });

  function applyFilter() {
    if (activeFilter === 'all') { renderGrid(products); return; }
    const def = FILTERS.find(f => f.value === activeFilter);
    const filtered = products.filter(p => {
      if (def.type === 'gender') return p.gender === def.value;
      if (def.type === 'family') return p.family === def.value;
      if (def.type === 'intensity') return p.intensity === def.match;
      return true;
    });
    renderGrid(filtered);
  }

  function renderGrid(list) {
    grid.innerHTML = list.map(productCardTpl).join('');
    emptyState.style.display = list.length === 0 ? 'block' : 'none';
    grid.querySelectorAll('.product-card').forEach(el => el.setAttribute('data-reveal', 'fade'));
    initReveal();
  }

  renderGrid(products);
})();
