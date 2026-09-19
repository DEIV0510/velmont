// VELMONT — bootstrap unico para theme.liquid (compartido por todas las
// plantillas). Cada bloque se activa solo si encuentra su marcador en el
// DOM, asi una sola capa de JS sirve home/collection/product sin duplicar
// carga en paginas que no la necesitan.
import { initAll, initReveal } from './ui.js';
import { getProducts, getProductBySlug, bottleSVG, formatCOP } from './catalog.js';
import { mountCartDrawer, openCart, showToast } from './cart-ui.js';
import { mountFavoritesDrawer } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { mountFinder } from './finder.js';
import { productCardTpl } from './product-card.js';
import { addToCart } from './cart.js';
import { toggleFavorite, isFavorite } from './favorites.js';

initAll();
mountCartDrawer(document.querySelector('[data-cart-root]'));
mountFavoritesDrawer(document.querySelector('[data-favorites-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-assistant-root]'));
document.querySelector('[data-cart-open]')?.addEventListener('click', openCart);

const finderRoot = document.querySelector('[data-finder-root]');
if (finderRoot) mountFinder(finderRoot);

// ---- Home: hero bottle, destacados, preview de coleccion, editorial ----
(async () => {
  const heroStage = document.getElementById('hero-bottle');
  const featuredGrid = document.querySelector('[data-featured-grid]');
  const previewGrid = document.querySelector('[data-collection-preview]');
  const editorialStage = document.getElementById('editorial-bottle');
  if (!heroStage && !featuredGrid && !previewGrid && !editorialStage) return;

  const products = await getProducts();
  if (heroStage) {
    const heroProduct = products.find(p => p.featured) || products[0];
    if (heroProduct) heroStage.innerHTML = bottleSVG(heroProduct);
  }
  if (editorialStage) {
    const editorialProduct = products[1] || products[0];
    if (editorialProduct) editorialStage.innerHTML = bottleSVG(editorialProduct, { className: 'bottle-hero-svg' });
  }
  if (featuredGrid) {
    featuredGrid.innerHTML = products.filter(p => p.featured).map(productCardTpl).join('');
  }
  if (previewGrid) {
    previewGrid.innerHTML = products.slice(0, 8).map(productCardTpl).join('');
  }
  document.querySelectorAll('.product-card').forEach(el => el.setAttribute('data-reveal', 'fade'));
  initReveal();
})();

// ---- Coleccion: filtros + grid ----
(async () => {
  const grid = document.querySelector('[data-collection-grid]');
  if (!grid) return;
  const filterBar = document.querySelector('[data-filter-bar]');
  const emptyState = document.querySelector('[data-empty-state]');
  const products = await getProducts();

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

  const params = new URLSearchParams(location.search);
  const promoParam = params.get('promo');

  function renderGrid(list) {
    grid.innerHTML = list.map(productCardTpl).join('');
    if (emptyState) emptyState.style.display = list.length === 0 ? 'block' : 'none';
    grid.querySelectorAll('.product-card').forEach(el => el.setAttribute('data-reveal', 'fade'));
    initReveal();
  }

  if (promoParam) {
    if (filterBar) filterBar.innerHTML = `<p class="lede">Mostrando fragancias participantes de <strong>${promoParam}</strong> · <a href="${location.pathname}" class="link-underline">ver todo el catálogo</a></p>`;
    renderGrid(products.filter(p => p.promo === promoParam));
    return;
  }

  if (filterBar) {
    filterBar.innerHTML = FILTERS.map(f => `<button type="button" class="filter-chip ${f.value === 'all' ? 'is-active' : ''}" data-filter="${f.value}">${f.label}</button>`).join('');
    let active = 'all';
    filterBar.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        active = chip.dataset.filter;
        filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('is-active', c === chip));
        if (active === 'all') { renderGrid(products); return; }
        const def = FILTERS.find(f => f.value === active);
        renderGrid(products.filter(p => {
          if (def.type === 'gender') return p.gender === def.value;
          if (def.type === 'family') return p.family === def.value;
          if (def.type === 'intensity') return p.intensity === def.match;
          return true;
        }));
      });
    });
  }
  renderGrid(products);
})();

// ---- Producto: ficha + cross-sell ----
(async () => {
  const root = document.querySelector('[data-product-root]');
  if (!root) return;
  const slug = root.dataset.productSlug;
  const product = slug ? await getProductBySlug(slug) : null;
  if (!product) return;

  const FAMILY_LABELS = { dulce: 'Dulce', fresco: 'Fresco', amaderado: 'Amaderado', intenso: 'Intenso', citrico: 'Cítrico', oriental: 'Oriental', especiado: 'Especiado', floral: 'Floral' };
  const PROFILE_ORDER = ['dulce', 'fresco', 'intenso', 'amaderado', 'especiado', 'citrico', 'oriental'];

  const stage = document.querySelector('[data-pdp-stage]');
  if (stage && !stage.querySelector('img')) stage.innerHTML = bottleSVG(product);

  const factsEl = document.querySelector('[data-pdp-facts]');
  if (factsEl) {
    factsEl.innerHTML = [product.gender, product.intensity, ...(product.occasion || []).slice(0, 2)]
      .filter(Boolean).map(f => `<span class="pdp__fact">${f}</span>`).join('');
  }
  const notesEl = document.querySelector('[data-pdp-notes]');
  if (notesEl) notesEl.innerHTML = (product.notes || []).map(n => `<li>${n}</li>`).join('');

  const profileEl = document.querySelector('[data-pdp-profile]');
  if (profileEl) {
    profileEl.innerHTML = PROFILE_ORDER.map(key => {
      const val = product.profile?.[key] || 0;
      return `<div class="profile-bar"><span class="profile-bar__label">${FAMILY_LABELS[key]}</span><div class="profile-bar__track"><div class="profile-bar__fill" style="width:${val * 20}%"></div></div></div>`;
    }).join('');
  }

  const favBtn = document.querySelector('[data-pdp-fav]');
  if (favBtn) {
    const syncFavBtn = () => { favBtn.textContent = isFavorite(product.id) ? 'Guardado en favoritos' : 'Guardar en favoritos'; };
    syncFavBtn();
    favBtn.addEventListener('click', () => { toggleFavorite(product.id); syncFavBtn(); });
  }

  document.querySelector('[data-pdp-add]')?.addEventListener('click', () => {
    addToCart(product.id, 1);
    showToast('AÑADIDO A TU COLECCIÓN');
    openCart();
  });

  const crossEl = document.querySelector('[data-cross-sell]');
  if (crossEl) {
    const allProducts = await getProducts();
    const crossSell = allProducts
      .filter(p => p.id !== product.id)
      .map(p => ({ p, score: (p.family === product.family ? 2 : 0) + (p.personality || []).filter(t => product.personality?.includes(t)).length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(x => x.p);
    crossEl.innerHTML = crossSell.map(productCardTpl).join('');
    crossEl.querySelectorAll('.product-card').forEach(el => el.setAttribute('data-reveal', 'fade'));
    initReveal();
  }
})();
