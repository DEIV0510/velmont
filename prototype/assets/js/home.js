import { initAll } from './ui.js';
import { getProducts, bottleSVG } from './catalog.js';
import { mountCartDrawer, openCart } from './cart-ui.js';
import { mountFavoritesDrawer } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { mountFinder } from './finder.js';
import { productCardTpl } from './product-card.js';

initAll();
mountCartDrawer(document.querySelector('[data-cart-root]'));
mountFavoritesDrawer(document.querySelector('[data-favorites-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-assistant-root]'));
mountFinder(document.querySelector('[data-finder-root]'));

document.querySelector('[data-cart-open]')?.addEventListener('click', openCart);

(async () => {
  const products = await getProducts();

  const heroBottleTarget = document.getElementById('hero-bottle');
  const heroProduct = products.find(p => p.id === 'bois-de-nuit') || products[0];
  if (heroBottleTarget) heroBottleTarget.innerHTML = bottleSVG(heroProduct);

  const editorialTarget = document.getElementById('editorial-bottle');
  const editorialProduct = products.find(p => p.id === 'or-et-santal') || products[1];
  if (editorialTarget) editorialTarget.innerHTML = bottleSVG(editorialProduct, { className: 'bottle-hero-svg' });

  const featuredGrid = document.querySelector('[data-featured-grid]');
  if (featuredGrid) {
    const featured = products.filter(p => p.featured);
    featuredGrid.innerHTML = featured.map(productCardTpl).join('');
  }

  const previewGrid = document.querySelector('[data-collection-preview]');
  if (previewGrid) {
    previewGrid.innerHTML = products.slice(0, 8).map(productCardTpl).join('');
  }

  // los cards inyectados dinamicamente tambien entran al reveal-on-scroll
  const { initReveal } = await import('./ui.js');
  document.querySelectorAll('.product-card').forEach(el => el.setAttribute('data-reveal', 'fade'));
  initReveal();
})();
