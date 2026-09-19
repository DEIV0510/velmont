// VELMONT — carrito real sobre la Cart AJAX API de Shopify + motor de
// promociones "2 x precio fijo". Misma interfaz publica que la version de
// prototipo (assets/js/cart.js del prototipo estatico): addToCart, setQty,
// removeFromCart, clearCart, getRawItems, getCartCount, computeCart,
// getEligibleCompletions. Todo lo que consume estas funciones (cart-ui.js,
// finder.js, assistant.js, product-card.js, favorites.js) no necesita saber
// que aqui adentro hablamos con /cart.js en vez de localStorage.
import { getProducts, getCollections, formatCOP } from './catalog.js';

let _variantMap = null; // productId (string) -> variantId (string)

async function getVariantMap() {
  if (_variantMap) return _variantMap;
  const products = await getProducts();
  _variantMap = new Map(products.map(p => [String(p.id), String(p.variantId || p.id)]));
  return _variantMap;
}

function emitChange() {
  document.dispatchEvent(new CustomEvent('velmont:cart-changed'));
}

async function fetchShopifyCart() {
  const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
  return res.json();
}

export async function addToCart(productId, qty = 1) {
  const variants = await getVariantMap();
  const variantId = variants.get(String(productId));
  if (!variantId) return;
  await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items: [{ id: variantId, quantity: qty }] })
  });
  emitChange();
}

async function changeLineByVariant(variantId, qty) {
  await fetch('/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: variantId, quantity: qty })
  });
  emitChange();
}

export async function setQty(productId, qty) {
  const variants = await getVariantMap();
  const variantId = variants.get(String(productId));
  if (!variantId) return;
  await changeLineByVariant(variantId, Math.max(0, qty));
}

export async function removeFromCart(productId) {
  await setQty(productId, 0);
}

export async function clearCart() {
  await fetch('/cart/clear.js', { method: 'POST' });
  emitChange();
}

export async function getRawItems() {
  const cart = await fetchShopifyCart();
  return cart.items.map(i => ({ id: String(i.product_id), qty: i.quantity }));
}

export async function getCartCount() {
  const cart = await fetchShopifyCart();
  return cart.item_count;
}

/**
 * Misma logica de negocio que el prototipo (ver docs/PROMOCIONES.md):
 * agrupa por coleccion de promocion, arma pares con las unidades de mayor
 * precio primero, cobra a precio normal las unidades que sobran.
 * La diferencia con el prototipo es de donde vienen `lines`: aqui de
 * /cart.js (fuente real) en vez de localStorage.
 */
export async function computeCart() {
  const [shopifyCart, products, collections] = await Promise.all([
    fetchShopifyCart(), getProducts(), getCollections()
  ]);
  const byId = new Map(products.map(p => [String(p.id), p]));

  const qtyByProduct = new Map();
  shopifyCart.items.forEach(item => {
    const pid = String(item.product_id);
    qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + item.quantity);
  });

  const lines = [...qtyByProduct.entries()]
    .map(([pid, qty]) => ({ product: byId.get(pid), qty }))
    .filter(l => l.product);

  const promoGroups = [];
  let promoLinesTotal = 0;
  let promoLinesOriginalTotal = 0;

  for (const collection of collections) {
    if (collection.kind !== 'promo') continue;
    const eligibleLines = lines.filter(l => l.product.promo === collection.id);
    const units = [];
    eligibleLines.forEach(l => { for (let i = 0; i < l.qty; i++) units.push(l.product.price); });
    if (units.length === 0) continue;

    units.sort((a, b) => b - a);
    const pairs = Math.floor(units.length / collection.promoUnits);
    const pairedCount = pairs * collection.promoUnits;
    const pairedUnits = units.slice(0, pairedCount);
    const leftoverUnits = units.slice(pairedCount);

    const originalForPaired = pairedUnits.reduce((a, b) => a + b, 0);
    const promoForPaired = pairs * collection.promoPrice;
    const leftoverTotal = leftoverUnits.reduce((a, b) => a + b, 0);

    const groupOriginalTotal = originalForPaired + leftoverTotal;
    const groupPromoTotal = promoForPaired + leftoverTotal;

    promoLinesTotal += groupPromoTotal;
    promoLinesOriginalTotal += groupOriginalTotal;

    promoGroups.push({
      collection,
      eligibleCount: units.length,
      pairs,
      remainder: units.length - pairedCount,
      originalTotal: groupOriginalTotal,
      promoTotal: groupPromoTotal,
      savings: originalForPaired - promoForPaired,
      applied: pairs > 0,
      eligibleLines: eligibleLines.map(l => ({ product: l.product, qty: l.qty }))
    });
  }

  const nonPromoLines = lines.filter(l => !collections.some(c => c.kind === 'promo' && c.id === l.product.promo));
  const nonPromoTotal = nonPromoLines.reduce((sum, l) => sum + l.product.price * l.qty, 0);

  const subtotalOriginal = nonPromoLines.reduce((s, l) => s + l.product.price * l.qty, 0) + promoLinesOriginalTotal;
  const total = nonPromoTotal + promoLinesTotal;
  const totalSavings = promoGroups.reduce((s, g) => s + g.savings, 0);

  return { lines, promoGroups, subtotalOriginal, total, totalSavings, count: shopifyCart.item_count };
}

export async function getEligibleCompletions(promoId, excludeIds = []) {
  const products = await getProducts();
  return products.filter(p => p.promo === promoId && !excludeIds.includes(p.id));
}

export { formatCOP };
