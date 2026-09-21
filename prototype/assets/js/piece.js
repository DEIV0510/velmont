// VELMONT — "pieza": la unidad editorial que reemplaza a la tarjeta de
// producto. Sin marco, sin bloque de datos apilados: imagen con aire, nombre
// en serif, precio discreto y metadatos que solo aparecen al hover.
import { bottleSVG, formatCOP } from './catalog.js';
import { isFavorite } from './favorites.js';

const HEART = (on) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4"><path d="M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z"/></svg>`;

export function saveButton(id) {
  const on = isFavorite(id);
  return `<button class="piece__save ${on ? 'on' : ''}" data-save="${id}" aria-label="Guardar" aria-pressed="${on}">${HEART(on)}</button>`;
}

export function pieceHTML(p, opts = {}) {
  const href = p.url || `/product.html?slug=${p.slug}`;
  const media = p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
    : bottleSVG(p);
  const edition = p.promo === 'matai' ? 'MATAI Edit' : p.promo === 'seleccion' ? 'Dúo VELMONT' : '';
  return `
    <article class="piece" ${opts.reveal === false ? '' : 'data-reveal="wipe"'}>
      <div class="piece__stage">
        ${edition ? `<span class="label piece__edit">${edition}</span>` : ''}
        ${saveButton(p.id)}
        ${media}
        <div class="piece__hover">
          <span class="label">${p.family || ''}${p.intensity ? ' · ' + p.intensity : ''}</span>
          <button class="link piece__add" data-add="${p.id}">Añadir</button>
        </div>
      </div>
      <a class="piece__link" href="${href}" aria-label="${p.name}"></a>
      <div class="piece__meta">
        <div>
          <h3 class="piece__name">${p.name}</h3>
          <span class="label piece__house">${p.house || 'VELMONT'}</span>
        </div>
        <span class="price">${formatCOP(p.price)}</span>
      </div>
    </article>`;
}
