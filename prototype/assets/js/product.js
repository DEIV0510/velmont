import { initAll, initReveal } from './ui.js';
import { getProducts, getProductBySlug, bottleSVG, formatCOP } from './catalog.js';
import { mountCartDrawer, openCart, showToast } from './cart-ui.js';
import { mountFavoritesDrawer, heartButtonHTML } from './favorites-ui.js';
import { mountSearchOverlay, mountAssistant } from './assistant.js';
import { addToCart } from './cart.js';
import { toggleFavorite, isFavorite } from './favorites.js';
import { productCardTpl } from './product-card.js';

initAll();
mountCartDrawer(document.querySelector('[data-cart-root]'));
mountFavoritesDrawer(document.querySelector('[data-favorites-root]'));
mountSearchOverlay(document.querySelector('[data-search-root]'));
mountAssistant(document.querySelector('[data-assistant-root]'));
document.querySelector('[data-cart-open]')?.addEventListener('click', openCart);

const FAMILY_LABELS = { dulce: 'Dulce', fresco: 'Fresco', amaderado: 'Amaderado', intenso: 'Intenso', citrico: 'Cítrico', oriental: 'Oriental', especiado: 'Especiado', floral: 'Floral' };
const PROFILE_ORDER = ['dulce', 'fresco', 'intenso', 'amaderado', 'especiado', 'citrico', 'oriental'];

(async () => {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const product = slug ? await getProductBySlug(slug) : null;
  const root = document.querySelector('[data-product-root]');

  if (!product) {
    root.innerHTML = `<div class="container"><p class="lede">No encontramos ese perfume. <a class="link-underline" href="/collection.html">Volver a la colección</a></p></div>`;
    return;
  }

  document.querySelector('[data-title]').textContent = `${product.name} — VELMONT`;
  document.querySelector('[data-meta-description]').setAttribute('content', product.description);
  document.querySelector('[data-crumb-name]').textContent = product.name;

  const ldScript = document.createElement('script');
  ldScript.type = 'application/ld+json';
  ldScript.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    brand: { '@type': 'Brand', name: product.house },
    offers: { '@type': 'Offer', priceCurrency: 'COP', price: product.price, availability: 'https://schema.org/InStock' }
  });
  document.head.appendChild(ldScript);

  document.querySelector('[data-pdp-stage]').innerHTML = bottleSVG(product);
  document.querySelector('[data-pdp-family]').textContent = `${product.house} · ${product.family}`;
  document.querySelector('[data-pdp-name]').textContent = product.name;
  document.querySelector('[data-pdp-price]').textContent = formatCOP(product.price);
  document.querySelector('[data-pdp-desc]').textContent = product.description;

  document.querySelector('[data-pdp-facts]').innerHTML = [
    product.gender, product.intensity, ...(product.occasion || []).slice(0, 2)
  ].map(f => `<span class="pdp__fact">${f}</span>`).join('');

  document.querySelector('[data-pdp-notes]').innerHTML = (product.notes || []).map(n => `<li>${n}</li>`).join('');

  document.querySelector('[data-pdp-profile]').innerHTML = PROFILE_ORDER.map(key => {
    const val = product.profile?.[key] || 0;
    return `
      <div class="profile-bar">
        <span class="profile-bar__label">${FAMILY_LABELS[key]}</span>
        <div class="profile-bar__track"><div class="profile-bar__fill" style="width:${val * 20}%"></div></div>
      </div>`;
  }).join('');

  const favBtn = document.querySelector('[data-pdp-fav]');
  const syncFavBtn = () => { favBtn.textContent = isFavorite(product.id) ? 'Guardado en favoritos' : 'Guardar en favoritos'; };
  syncFavBtn();
  favBtn.addEventListener('click', () => { toggleFavorite(product.id); syncFavBtn(); });

  document.querySelector('[data-pdp-add]').addEventListener('click', () => {
    addToCart(product.id, 1);
    showToast('AÑADIDO A TU COLECCIÓN');
    openCart();
  });

  const allProducts = await getProducts();
  const crossSell = allProducts
    .filter(p => p.id !== product.id)
    .map(p => ({ p, score: (p.family === product.family ? 2 : 0) + (p.personality || []).filter(t => product.personality?.includes(t)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => x.p);

  document.querySelector('[data-cross-sell]').innerHTML = crossSell.map(productCardTpl).join('');
  document.querySelectorAll('[data-cross-sell] .product-card').forEach(el => el.setAttribute('data-reveal', 'fade'));
  initReveal();
})();
