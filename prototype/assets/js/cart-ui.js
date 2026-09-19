// VELMONT — render del cart drawer + microinteracciones de "añadido"
import { computeCart, addToCart, setQty, removeFromCart, getEligibleCompletions, formatCOP } from './cart.js';
import { bottleSVG } from './catalog.js';

let drawerEl, overlayEl, panelEl;

export function mountCartDrawer(root) {
  root.innerHTML = `
    <div class="cart-overlay" data-cart-overlay></div>
    <aside class="cart-drawer" data-cart-drawer aria-hidden="true" aria-label="Tu selección VELMONT">
      <header class="cart-drawer__head">
        <h2>Tu selección VELMONT</h2>
        <button class="icon-btn" data-cart-close aria-label="Cerrar carrito">&times;</button>
      </header>
      <div class="cart-drawer__body" data-cart-body></div>
      <footer class="cart-drawer__foot" data-cart-foot></footer>
    </aside>
    <div class="toast" data-toast></div>
  `;
  drawerEl = root.querySelector('[data-cart-drawer]');
  overlayEl = root.querySelector('[data-cart-overlay]');
  root.querySelector('[data-cart-close]').addEventListener('click', closeCart);
  overlayEl.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
  document.addEventListener('velmont:cart-changed', renderCart);
  document.addEventListener('click', onDelegatedClick);
  renderCart();
}

function onDelegatedClick(e) {
  const addBtn = e.target.closest('[data-add-to-cart]');
  if (!addBtn) return;
  addToCart(addBtn.dataset.addToCart, 1);
  showToast('AÑADIDO A TU COLECCIÓN');
  openCart();
}

export function openCart() {
  drawerEl?.classList.add('is-open');
  overlayEl?.classList.add('is-open');
  drawerEl?.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('no-scroll');
}

export function closeCart() {
  drawerEl?.classList.remove('is-open');
  overlayEl?.classList.remove('is-open');
  drawerEl?.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('no-scroll');
}

let toastTimer;
export function showToast(msg) {
  const t = document.querySelector('[data-toast]');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2200);
}

async function renderCart() {
  const body = document.querySelector('[data-cart-body]');
  const foot = document.querySelector('[data-cart-foot]');
  const badges = document.querySelectorAll('[data-cart-count]');
  if (!body || !foot) return;

  const cart = await computeCart();
  badges.forEach(b => { b.textContent = cart.count; b.classList.toggle('is-hidden', cart.count === 0); });

  if (cart.lines.length === 0) {
    body.innerHTML = `<div class="cart-empty">
      <p>Tu selección está vacía.</p>
      <a href="/collection.html" class="btn btn--ghost">Ver colección</a>
    </div>`;
    foot.innerHTML = '';
    return;
  }

  const promoByProductId = new Map();
  cart.promoGroups.forEach(g => g.eligibleLines.forEach(l => promoByProductId.set(l.product.id, g)));

  body.innerHTML = `
    <ul class="cart-lines">
      ${cart.lines.map(l => cartLineTpl(l)).join('')}
    </ul>
    <div class="cart-promos">
      ${cart.promoGroups.map(g => promoProgressTpl(g)).join('')}
    </div>
    <div class="cart-cross" data-cart-cross></div>
  `;

  foot.innerHTML = `
    ${cart.totalSavings > 0 ? `<div class="cart-row cart-row--savings"><span>Ahorro total</span><span>${formatCOP(cart.totalSavings)}</span></div>` : ''}
    <div class="cart-row cart-row--total"><span>Total</span><span>${formatCOP(cart.total)}</span></div>
    <a href="/checkout-preview.html" class="btn btn--primary btn--block">Finalizar compra</a>
  `;

  body.querySelectorAll('[data-qty-inc]').forEach(b => b.addEventListener('click', () => bump(b.dataset.qtyInc, 1, cart)));
  body.querySelectorAll('[data-qty-dec]').forEach(b => b.addEventListener('click', () => bump(b.dataset.qtyDec, -1, cart)));
  body.querySelectorAll('[data-line-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.lineRemove)));

  renderCrossSell(cart);
}

function bump(id, delta, cart) {
  const line = cart.lines.find(l => l.product.id === id);
  if (!line) return;
  setQty(id, line.qty + delta);
}

function cartLineTpl(l) {
  return `
    <li class="cart-line">
      <div class="cart-line__thumb">${bottleSVG(l.product)}</div>
      <div class="cart-line__info">
        <p class="cart-line__name">${l.product.name}</p>
        <p class="cart-line__family">${l.product.family}</p>
        <div class="qty-stepper" aria-label="Cantidad">
          <button data-qty-dec="${l.product.id}" aria-label="Quitar uno">–</button>
          <span>${l.qty}</span>
          <button data-qty-inc="${l.product.id}" aria-label="Agregar uno">+</button>
        </div>
      </div>
      <div class="cart-line__price">
        <span>${formatCOP(l.product.price * l.qty)}</span>
        <button class="link-remove" data-line-remove="${l.product.id}">Quitar</button>
      </div>
    </li>`;
}

function promoProgressTpl(g) {
  if (g.applied && g.remainder === 0) {
    return `
      <div class="promo-card promo-card--applied">
        <p class="promo-card__title">¡Promoción aplicada! · ${g.collection.label}</p>
        <p class="promo-card__meta"><s>${formatCOP(g.originalTotal)}</s> <strong>${formatCOP(g.promoTotal)}</strong> · ahorras ${formatCOP(g.savings)}</p>
      </div>`;
  }
  const units = g.collection.promoUnits;
  const stillNeeded = units - g.remainder;
  const pct = Math.round((g.remainder / units) * 100);
  return `
    <div class="promo-card">
      <p class="promo-card__title">${g.collection.label} · ${g.collection.promoTitle}</p>
      <p class="promo-card__hint">Agrega ${stillNeeded} perfume${stillNeeded > 1 ? 's' : ''} más y desbloquea tu oferta.</p>
      <div class="promo-bar"><div class="promo-bar__fill" style="width:${pct}%"></div></div>
      <p class="promo-bar__label">${g.remainder}/${units}</p>
      ${g.applied ? `<p class="promo-card__meta">Ya tienes ${g.pairs} oferta${g.pairs > 1 ? 's' : ''} aplicada${g.pairs > 1 ? 's' : ''} · ahorras ${formatCOP(g.savings)}</p>` : ''}
    </div>`;
}

async function renderCrossSell(cart) {
  const el = document.querySelector('[data-cart-cross]');
  if (!el) return;
  const incompleteGroup = cart.promoGroups.find(g => !g.applied || g.remainder > 0);
  if (!incompleteGroup) { el.innerHTML = ''; return; }
  const exclude = incompleteGroup.eligibleLines.map(l => l.product.id);
  const completions = (await getEligibleCompletions(incompleteGroup.collection.id, exclude)).slice(0, 3);
  if (completions.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <p class="cart-cross__title">Puedes completar tu oferta</p>
    <ul class="cart-cross__list">
      ${completions.map(p => `
        <li>
          <div class="cart-cross__thumb">${bottleSVG(p)}</div>
          <div class="cart-cross__info">
            <span>${p.name}</span>
            <span>${formatCOP(p.price)}</span>
          </div>
          <button class="btn btn--tiny" data-add-to-cart="${p.id}">Agregar</button>
        </li>`).join('')}
    </ul>`;
}
