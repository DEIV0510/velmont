import { initAll, initReveal, bindMenuVisuals } from './ui.js';
import { getProducts, getCollections, bottleSVG, formatCOP } from './catalog.js';
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

(async () => {
  const [products, collections] = await Promise.all([getProducts(), getCollections()]);
  if (!products.length) return;

  // --- Hero: la pieza mas oscura de la casa como protagonista ---
  const heroPick = products.find(p => p.family === 'amaderado' && p.featured) || products.find(p => p.featured) || products[0];
  const heroMount = document.querySelector('[data-hero-bottle]');
  if (heroMount) heroMount.innerHTML = bottleSVG(heroPick);
  const reflect = document.querySelector('[data-hero-reflect]');
  if (reflect) reflect.innerHTML = bottleSVG(heroPick);

  // --- Composicion editorial: 6 piezas en ritmo asimetrico ---
  const composition = document.querySelector('[data-composition]');
  if (composition) {
    const featured = products.filter(p => p.featured);
    const picks = (featured.length >= 6 ? featured : [...featured, ...products.filter(p => !p.featured)]).slice(0, 6);
    composition.innerHTML = picks.map(p => pieceHTML(p)).join('');
  }

  // --- Campañas: el duo de cada edicion, con precio real del catalogo ---
  for (const rule of collections.filter(c => c.kind === 'promo')) {
    const duo = document.querySelector(`[data-duo="${rule.id}"]`);
    if (duo) {
      const pair = products.filter(p => p.promo === rule.id).slice(0, 2);
      duo.innerHTML = pair.map(p => `<figure>${bottleSVG(p)}</figure>`).join('');
    }
    const price = document.querySelector(`[data-promo-price="${rule.id}"]`);
    if (price) price.innerHTML = `${rule.promoUnits} × ${formatCOP(rule.promoPrice)}<sup>COP</sup>`;
  }

  // --- La casa ---
  const world = document.querySelector('[data-world-bottle]');
  if (world) {
    const pick = products.find(p => p.family === 'oriental') || products[1] || products[0];
    world.innerHTML = bottleSVG(pick);
  }

  // --- Visuales del menu fullscreen ---
  const menuVisual = document.querySelector('[data-menu-visual]');
  if (menuVisual) {
    const picks = products.slice(0, 5);
    menuVisual.innerHTML = picks.map((p, i) => `<figure class="${i === 0 ? 'on' : ''}">${bottleSVG(p)}</figure>`).join('');
    bindMenuVisuals();
  }

  initReveal();
})();
