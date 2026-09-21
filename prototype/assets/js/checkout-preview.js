import { computeCart, formatCOP } from './cart.js';
import { bottleSVG } from './catalog.js';

(async () => {
  const cart = await computeCart();
  const lines = document.querySelector('[data-ck-lines]');
  const totals = document.querySelector('[data-ck-totals]');

  if (!cart.lines.length) {
    lines.innerHTML = `<p class="lede">Tu selección está vacía.</p>
      <p style="margin-top:var(--s5)"><a class="link" href="/collection.html">Ver la colección</a></p>`;
    totals.innerHTML = '';
    return;
  }

  lines.innerHTML = cart.lines.map(l => `
    <div class="ck__line">
      <div>${bottleSVG(l.product)}</div>
      <div>
        <p class="bag-line__name" style="font-size:1rem">${l.product.name}</p>
        <span class="label">× ${l.qty}</span>
      </div>
      <span class="price">${formatCOP(l.product.price * l.qty)}</span>
    </div>`).join('');

  const shipping = cart.total >= 200000 ? 0 : 15000;
  totals.innerHTML = `
    <div class="bag-totals"><span class="label">Subtotal</span><span class="price">${formatCOP(cart.subtotalOriginal)}</span></div>
    ${cart.totalSavings > 0 ? `<div class="bag-totals"><span class="label">Ediciones</span><span class="price promo__on">− ${formatCOP(cart.totalSavings)}</span></div>` : ''}
    <div class="bag-totals"><span class="label">Envío</span><span class="price">${shipping === 0 ? 'Gratis' : formatCOP(shipping)}</span></div>
    <div class="ck__total"><span>Total</span><span>${formatCOP(cart.total + shipping)}</span></div>`;
})();
