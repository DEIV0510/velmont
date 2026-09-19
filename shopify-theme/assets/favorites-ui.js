// VELMONT — heart toggle en cards + drawer de favoritos
import { isFavorite, toggleFavorite, getFavoriteIds, removeFavorite } from './favorites.js';
import { getProducts, bottleSVG, formatCOP } from './catalog.js';

const HEART = (filled) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z"/></svg>`;

export function heartButtonHTML(productId) {
  const active = isFavorite(productId);
  return `<button type="button" class="heart-btn ${active ? 'is-active' : ''}" data-toggle-favorite="${productId}" aria-label="Guardar en favoritos" aria-pressed="${active}">${HEART(active)}</button>`;
}

export function mountFavoritesDrawer(root) {
  root.innerHTML = `
    <div class="cart-overlay" data-fav-overlay></div>
    <aside class="cart-drawer" data-fav-drawer aria-hidden="true" aria-label="Tus favoritos">
      <header class="cart-drawer__head">
        <h2>Tus favoritos</h2>
        <button class="icon-btn" data-fav-close aria-label="Cerrar favoritos">&times;</button>
      </header>
      <div class="cart-drawer__body" data-fav-body></div>
    </aside>
  `;
  const drawer = root.querySelector('[data-fav-drawer]');
  const overlay = root.querySelector('[data-fav-overlay]');
  const close = () => { drawer.classList.remove('is-open'); overlay.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('no-scroll'); };
  const open = () => { drawer.classList.add('is-open'); overlay.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); document.documentElement.classList.add('no-scroll'); };

  root.querySelector('[data-fav-close]').addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.querySelectorAll('[data-favorites-open]').forEach(btn => btn.addEventListener('click', open));

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-toggle-favorite]');
    if (!btn) return;
    const active = toggleFavorite(btn.dataset.toggleFavorite);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.innerHTML = HEART(active);
  });

  document.addEventListener('velmont:favorites-changed', renderBadgesAndDrawer);
  renderBadgesAndDrawer();

  async function renderBadgesAndDrawer() {
    const ids = getFavoriteIds();
    document.querySelectorAll('[data-favorites-count]').forEach(b => {
      b.textContent = ids.length;
      b.classList.toggle('is-hidden', ids.length === 0);
    });
    const body = root.querySelector('[data-fav-body]');
    if (!body) return;
    if (ids.length === 0) {
      body.innerHTML = `<div class="cart-empty"><p>Aún no guardas fragancias.</p><a href="/collection.html" class="btn btn--ghost">Ver colección</a></div>`;
      return;
    }
    const products = (await getProducts()).filter(p => ids.includes(p.id));
    body.innerHTML = `<ul class="cart-lines">
      ${products.map(p => `
        <li class="cart-line">
          <div class="cart-line__thumb">${bottleSVG(p)}</div>
          <div class="cart-line__info">
            <p class="cart-line__name">${p.name}</p>
            <p class="cart-line__family">${p.family}</p>
          </div>
          <div class="cart-line__price">
            <span>${formatCOP(p.price)}</span>
            <button class="btn btn--tiny btn--primary" data-add-to-cart="${p.id}">Agregar</button>
            <button class="link-remove" data-fav-remove="${p.id}">Quitar</button>
          </div>
        </li>`).join('')}
    </ul>`;
    body.querySelectorAll('[data-fav-remove]').forEach(b => b.addEventListener('click', () => removeFavorite(b.dataset.favRemove)));
  }
}
