// VELMONT — La bolsa. Panel sobrio: filetes, tipografia pequeña, sin
// banners de descuento. La promocion se comunica con una linea de progreso.
import { computeCart, addToCart, setQty, removeFromCart, getEligibleCompletions, formatCOP } from './cart.js';
import { bottleSVG } from './catalog.js';

let drawer, scrim;

export function mountCartDrawer(root) {
  if (!root) return;
  root.innerHTML = `
    <div class="scrim" data-bag-scrim></div>
    <aside class="drawer" data-bag-drawer aria-hidden="true" aria-label="Tu selección">
      <header class="drawer__head">
        <span class="label">Tu selección</span>
        <button class="icon-btn" data-bag-close aria-label="Cerrar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </header>
      <div class="drawer__body" data-bag-body></div>
      <footer class="drawer__foot" data-bag-foot></footer>
    </aside>
    <div class="notice" data-notice></div>`;

  drawer = root.querySelector('[data-bag-drawer]');
  scrim = root.querySelector('[data-bag-scrim]');
  root.querySelector('[data-bag-close]').addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
  document.addEventListener('velmont:cart-changed', render);
  document.addEventListener('click', onAdd);
  document.querySelectorAll('[data-bag-open]').forEach(b => b.addEventListener('click', openCart));
  render();
}

function onAdd(e) {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  e.preventDefault();
  addToCart(btn.dataset.add, 1);
  showToast('Añadido a tu selección');
  openCart();
}

export function openCart() {
  drawer?.classList.add('open');
  scrim?.classList.add('open');
  drawer?.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('no-scroll');
}
export function closeCart() {
  drawer?.classList.remove('open');
  scrim?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('no-scroll');
}

let noticeTimer;
export function showToast(msg) {
  const n = document.querySelector('[data-notice]');
  if (!n) return;
  n.textContent = msg;
  n.classList.add('in');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => n.classList.remove('in'), 2600);
}

async function render() {
  const body = document.querySelector('[data-bag-body]');
  const foot = document.querySelector('[data-bag-foot]');
  if (!body || !foot) return;

  const cart = await computeCart();
  document.querySelectorAll('[data-bag-count]').forEach(b => {
    b.textContent = cart.count;
    b.classList.toggle('off', cart.count === 0);
  });

  if (!cart.lines.length) {
    body.innerHTML = `<div class="bag-empty">
      <p class="lede">Tu selección está vacía.</p>
      <a href="/collection.html" class="act">Ver la colección</a>
    </div>`;
    foot.innerHTML = '';
    return;
  }

  body.innerHTML = `
    ${cart.lines.map(lineHTML).join('')}
    ${cart.promoGroups.map(promoHTML).join('')}
    <div data-bag-suggest></div>`;

  foot.innerHTML = `
    ${cart.totalSavings > 0 ? `<div class="bag-totals"><span class="label">Ahorro</span><span class="price promo__on">− ${formatCOP(cart.totalSavings)}</span></div>` : ''}
    <div class="bag-totals"><span class="label">Total</span><strong>${formatCOP(cart.total)}</strong></div>
    <a href="/checkout-preview.html" class="act act--solid" style="justify-content:center">Finalizar compra</a>`;

  body.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => bump(b.dataset.inc, 1, cart)));
  body.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => bump(b.dataset.dec, -1, cart)));
  body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));

  renderSuggest(cart);
}

function bump(id, d, cart) {
  const line = cart.lines.find(l => l.product.id === id);
  if (line) setQty(id, line.qty + d);
}

function lineHTML(l) {
  return `
    <div class="bag-line">
      <div>${bottleSVG(l.product)}</div>
      <div>
        <p class="bag-line__name">${l.product.name}</p>
        <span class="label">${l.product.family || ''}</span>
        <div class="stepper">
          <button data-dec="${l.product.id}" aria-label="Quitar uno">−</button>
          <span>${l.qty}</span>
          <button data-inc="${l.product.id}" aria-label="Añadir uno">+</button>
        </div>
      </div>
      <div class="bag-line__right">
        <span class="price">${formatCOP(l.product.price * l.qty)}</span>
        <button class="mini" data-remove="${l.product.id}">Quitar</button>
      </div>
    </div>`;
}

function promoHTML(g) {
  const units = g.collection.promoUnits;
  if (g.applied && g.remainder === 0) {
    return `
      <div class="promo">
        <span class="label label--gold">${g.collection.label} · aplicada</span>
        <p class="price" style="margin-top:10px"><s>${formatCOP(g.originalTotal)}</s> &nbsp; ${formatCOP(g.promoTotal)}</p>
        <p class="label promo__on" style="margin-top:8px">Ahorras ${formatCOP(g.savings)}</p>
      </div>`;
  }
  const missing = units - g.remainder;
  return `
    <div class="promo">
      <span class="label">${g.collection.label} · ${units} × ${formatCOP(g.collection.promoPrice)}</span>
      <p class="fine" style="margin-top:8px">Añade ${missing} fragancia${missing > 1 ? 's' : ''} más y desbloqueas la edición.</p>
      <div class="promo__bar"><i style="transform:scaleX(${g.remainder / units})"></i></div>
      <p class="label" style="margin-top:8px">${g.remainder} / ${units}</p>
      ${g.applied ? `<p class="label promo__on" style="margin-top:6px">Ya ahorras ${formatCOP(g.savings)}</p>` : ''}
    </div>`;
}

async function renderSuggest(cart) {
  const el = document.querySelector('[data-bag-suggest]');
  if (!el) return;
  const open = cart.promoGroups.find(g => !g.applied || g.remainder > 0);
  if (!open) { el.innerHTML = ''; return; }
  const exclude = open.eligibleLines.map(l => l.product.id);
  const options = (await getEligibleCompletions(open.collection.id, exclude)).slice(0, 3);
  if (!options.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="bag-suggest">
      <span class="label">Completa tu dúo</span>
      <ul>
        ${options.map(p => `
          <li>
            <div>${bottleSVG(p)}</div>
            <div>
              <p class="bag-line__name" style="font-size:0.95rem">${p.name}</p>
              <span class="price">${formatCOP(p.price)}</span>
            </div>
            <button class="mini" data-add="${p.id}">Añadir</button>
          </li>`).join('')}
      </ul>
    </div>`;
}
