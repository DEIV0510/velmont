import { computeCart, formatCOP } from './cart.js';
import { bottleSVG } from './catalog.js';

(async () => {
  const cart = await computeCart();
  const linesEl = document.querySelector('[data-summary-lines]');
  const totalsEl = document.querySelector('[data-summary-totals]');

  if (cart.lines.length === 0) {
    linesEl.innerHTML = `<p class="lede">Tu carrito está vacío. <a class="link-underline" href="/collection.html">Ver colección</a></p>`;
    totalsEl.innerHTML = '';
    return;
  }

  linesEl.innerHTML = cart.lines.map(l => `
    <div class="summary-line">
      <div class="summary-line__thumb">${bottleSVG(l.product)}</div>
      <span>${l.product.name} × ${l.qty}</span>
      <span>${formatCOP(l.product.price * l.qty)}</span>
    </div>`).join('');

  const shipping = cart.total >= 200000 ? 0 : 15000;
  totalsEl.innerHTML = `
    <div class="row">Subtotal: ${formatCOP(cart.subtotalOriginal)}</div>
    ${cart.totalSavings > 0 ? `<div class="row">Ahorro por promoción: -${formatCOP(cart.totalSavings)}</div>` : ''}
    <div class="row">Envío: ${shipping === 0 ? 'Gratis' : formatCOP(shipping)}</div>
    <div class="row row-total">Total: ${formatCOP(cart.total + shipping)}</div>
  `;
})();
