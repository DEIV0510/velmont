// VELMONT — card de producto compartida entre home, coleccion y cross-sell
import { bottleSVG, formatCOP } from './catalog.js';
import { heartButtonHTML } from './favorites-ui.js';

export function productCardTpl(p) {
  const href = p.url || `/product.html?slug=${p.slug}`;
  const media = p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
    : bottleSVG(p);
  return `
    <article class="product-card">
      <a class="product-card__link" href="${href}" aria-label="${p.name}"></a>
      <div class="product-card__thumb">
        ${p.promo ? `<span class="product-card__badge">${p.promo === 'matai' ? 'MATAI' : 'Selección'}</span>` : ''}
        ${heartButtonHTML(p.id)}
        ${media}
        <button class="btn btn--tiny btn--primary product-card__quick" data-add-to-cart="${p.id}">Agregar</button>
      </div>
      <div class="product-card__body">
        <span class="product-card__family">${p.family}</span>
        <h3 class="product-card__name">${p.name}</h3>
        <span class="product-card__price">${formatCOP(p.price)}</span>
      </div>
    </article>`;
}
