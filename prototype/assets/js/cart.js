// VELMONT — carrito + motor de promociones "2 x precio fijo"
// En Shopify real: el estado del carrito vive en Cart AJAX API (/cart.js);
// este modulo simula ese contrato (add/setQty/remove/get) para que el
// port a Liquid solo tenga que reemplazar la capa de persistencia.
import { getProducts, getCollections, formatCOP } from './catalog.js';

const STORAGE_KEY = 'velmont_cart_v1';

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* modo privado: se pierde al recargar, no es critico */ }
}

let items = readStorage(); // [{ id, qty }]

function emitChange() {
  document.dispatchEvent(new CustomEvent('velmont:cart-changed'));
}

export function addToCart(productId, qty = 1) {
  const line = items.find(i => i.id === productId);
  if (line) line.qty += qty;
  else items.push({ id: productId, qty });
  writeStorage(items);
  emitChange();
}

export function setQty(productId, qty) {
  if (qty <= 0) return removeFromCart(productId);
  const line = items.find(i => i.id === productId);
  if (line) line.qty = qty;
  writeStorage(items);
  emitChange();
}

export function removeFromCart(productId) {
  items = items.filter(i => i.id !== productId);
  writeStorage(items);
  emitChange();
}

export function clearCart() {
  items = [];
  writeStorage(items);
  emitChange();
}

export function getRawItems() {
  return items.slice();
}

export function getCartCount() {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

/**
 * Calcula lineas, grupos de promocion y totales.
 * Regla de negocio (real, confirmada): dentro de una coleccion promo,
 * cualquier combinacion de N unidades elegibles cuesta un precio fijo,
 * sin importar cuales. El resto de unidades elegibles que no completan
 * el grupo se cobran a precio normal. Los pares se arman con las unidades
 * de mayor precio primero, para mostrarle al cliente el mayor ahorro real.
 */
export async function computeCart() {
  const [products, collections] = await Promise.all([getProducts(), getCollections()]);
  const byId = new Map(products.map(p => [p.id, p]));

  const lines = items
    .map(i => ({ product: byId.get(i.id), qty: i.qty }))
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

  return { lines, promoGroups, subtotalOriginal, total, totalSavings, count: getCartCount() };
}

export async function getEligibleCompletions(promoId, excludeIds = []) {
  const products = await getProducts();
  return products.filter(p => p.promo === promoId && !excludeIds.includes(p.id));
}

export { formatCOP };
