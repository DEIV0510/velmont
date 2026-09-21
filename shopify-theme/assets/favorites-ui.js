// VELMONT — Guardados. Mismo lenguaje visual que la bolsa.
import { isFavorite, toggleFavorite, getFavoriteIds, removeFavorite } from './favorites.js';
import { getProducts, bottleSVG, formatCOP } from './catalog.js';

const HEART = (on) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4"><path d="M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z"/></svg>`;

export function mountFavoritesDrawer(root) {
  if (!root) return;
  root.innerHTML = `
    <div class="scrim" data-fav-scrim></div>
    <aside class="drawer" data-fav-drawer aria-hidden="true" aria-label="Guardados">
      <header class="drawer__head">
        <span class="label">Guardados</span>
        <button class="icon-btn" data-fav-close aria-label="Cerrar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </header>
      <div class="drawer__body" data-fav-body></div>
    </aside>`;

  const drawer = root.querySelector('[data-fav-drawer]');
  const scrim = root.querySelector('[data-fav-scrim]');
  const open = () => {
    drawer.classList.add('open'); scrim.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
  };
  const close = () => {
    drawer.classList.remove('open'); scrim.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  };
  root.querySelector('[data-fav-close]').addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.querySelectorAll('[data-fav-open]').forEach(b => b.addEventListener('click', open));

  // Corazon en cualquier pieza de la pagina
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    const on = toggleFavorite(btn.dataset.save);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = HEART(on);
  });

  document.addEventListener('velmont:favorites-changed', render);
  render();

  async function render() {
    const ids = getFavoriteIds();
    document.querySelectorAll('[data-fav-count]').forEach(b => {
      b.textContent = ids.length;
      b.classList.toggle('off', ids.length === 0);
    });
    const body = root.querySelector('[data-fav-body]');
    if (!body) return;
    if (!ids.length) {
      body.innerHTML = `<div class="bag-empty">
        <p class="lede">Aún no guardas fragancias.</p>
        <a href="/collection.html" class="act">Ver la colección</a>
      </div>`;
      return;
    }
    const products = (await getProducts()).filter(p => ids.includes(p.id));
    body.innerHTML = products.map(p => `
      <div class="bag-line">
        <div>${bottleSVG(p)}</div>
        <div>
          <p class="bag-line__name">${p.name}</p>
          <span class="label">${p.family || ''}</span>
        </div>
        <div class="bag-line__right">
          <span class="price">${formatCOP(p.price)}</span>
          <button class="mini" data-add="${p.id}">Añadir</button>
          <button class="mini" data-unsave="${p.id}">Quitar</button>
        </div>
      </div>`).join('');
    body.querySelectorAll('[data-unsave]').forEach(b =>
      b.addEventListener('click', () => removeFavorite(b.dataset.unsave)));
  }
}

export { isFavorite };
