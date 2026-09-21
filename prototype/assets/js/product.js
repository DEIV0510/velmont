import { initAll, initReveal, bindMenuVisuals, bindBuyBar } from './ui.js';
import { getProducts, getProductBySlug, bottleSVG, formatCOP } from './catalog.js';
import { mountCartDrawer, openCart, showToast } from './cart-ui.js';
import { mountFavoritesDrawer } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { mountFinder } from './finder.js';
import { addToCart } from './cart.js';
import { toggleFavorite, isFavorite } from './favorites.js';
import { pieceHTML } from './piece.js';

initAll();
mountCartDrawer(document.querySelector('[data-bag-root]'));
mountFavoritesDrawer(document.querySelector('[data-saved-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-advisor-root]'));
mountFinder(document.querySelector('[data-finder-root]'));

const AXES = ['dulce', 'fresco', 'intenso', 'amaderado', 'especiado', 'citrico', 'oriental'];
const AXIS_LABEL = { dulce: 'Dulce', fresco: 'Fresco', intenso: 'Intenso', amaderado: 'Amaderado', especiado: 'Especiado', citrico: 'Cítrico', oriental: 'Oriental' };

(async () => {
  const slug = new URLSearchParams(location.search).get('slug');
  const product = slug ? await getProductBySlug(slug) : null;
  const root = document.querySelector('[data-product-root]');

  const products = await getProducts();
  const menuVisual = document.querySelector('[data-menu-visual]');
  if (menuVisual) {
    menuVisual.innerHTML = products.slice(0, 5).map((p, i) => `<figure class="${i === 0 ? 'on' : ''}">${bottleSVG(p)}</figure>`).join('');
    bindMenuVisuals();
  }

  if (!product) {
    root.innerHTML = `<section class="band"><div class="wrap">
      <h1 class="display">No encontramos esa fragancia.</h1>
      <p style="margin-top:32px"><a class="act" href="/collection.html">Ver la colección</a></p>
    </div></section>`;
    return;
  }

  document.querySelector('[data-title]').textContent = `${product.name} — VELMONT`;
  document.querySelector('[data-meta-description]').setAttribute('content', product.description || '');

  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product',
    name: product.name, description: product.description,
    brand: { '@type': 'Brand', name: product.house || 'VELMONT' },
    offers: { '@type': 'Offer', priceCurrency: 'COP', price: product.price, availability: 'https://schema.org/InStock' }
  });
  document.head.appendChild(ld);

  const stage = document.querySelector('[data-pdp-stage]');
  stage.innerHTML = product.image ? `<img src="${product.image}" alt="${product.name}">` : bottleSVG(product);

  document.querySelector('[data-pdp-house]').textContent = product.house || 'VELMONT';
  document.querySelector('[data-pdp-name]').textContent = product.name;
  document.querySelector('[data-pdp-price]').textContent = formatCOP(product.price);
  document.querySelector('[data-pdp-desc]').textContent = product.description || '';
  document.querySelector('[data-pdp-family]').textContent = product.family || '—';
  document.querySelector('[data-pdp-intensity]').textContent = product.intensity || '—';
  document.querySelector('[data-pdp-occasion]').innerHTML =
    (product.occasion || []).map(o => `<span>${o}</span>`).join('') || '—';
  document.querySelector('[data-pdp-notes]').innerHTML =
    (product.notes || []).map(n => `<span>${n}</span>`).join('') || '—';

  document.querySelector('[data-pdp-profile]').innerHTML = AXES.map(k => {
    const v = product.profile?.[k] || 0;
    return `<div class="profile__row">
      <span class="label">${AXIS_LABEL[k]}</span>
      <div class="profile__track"><i style="width:${v * 20}%"></i></div>
    </div>`;
  }).join('');

  const saveBtn = document.querySelector('[data-pdp-save]');
  const syncSave = () => { saveBtn.textContent = isFavorite(product.id) ? 'Guardado' : 'Guardar'; };
  syncSave();
  saveBtn.addEventListener('click', () => { toggleFavorite(product.id); syncSave(); });

  const add = () => {
    addToCart(product.id, 1);
    showToast('Añadido a tu selección');
    openCart();
  };
  const mainAdd = document.querySelector('[data-pdp-add]');
  mainAdd.addEventListener('click', add);

  // Barra de compra fija en movil
  const bar = document.querySelector('[data-buybar]');
  if (bar) {
    bar.querySelector('[data-buybar-name]').textContent = product.name;
    bar.querySelector('[data-buybar-price]').textContent = formatCOP(product.price);
    bar.querySelector('[data-buybar-add]').addEventListener('click', add);
    bindBuyBar(mainAdd, bar);
  }

  const related = products
    .filter(p => p.id !== product.id)
    .map(p => ({ p, s: (p.family === product.family ? 2 : 0) + (p.personality || []).filter(t => product.personality?.includes(t)).length }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map(x => x.p);
  document.querySelector('[data-related]').innerHTML = related.map(p => pieceHTML(p)).join('');

  initReveal();
})();
