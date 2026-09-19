// VELMONT — catalog access + placeholder bottle illustration
//
// Unico punto de acceso a datos de producto. Funciona en dos modos sin
// necesitar cambios en ningun otro archivo JS:
//   1) Tema Shopify: theme.liquid imprime el catalogo real (productos +
//      colecciones de promocion) en <script type="application/json"
//      id="velmont-catalog-data">. Si ese tag existe, lo usamos.
//   2) Prototipo estatico: si no existe ese tag, hacemos fetch al JSON
//      de muestra en assets/data/products.json.
let _catalog = null;

export async function getCatalog() {
  if (_catalog) return _catalog;
  const embedded = document.getElementById('velmont-catalog-data');
  if (embedded) {
    _catalog = JSON.parse(embedded.textContent);
    return _catalog;
  }
  const res = await fetch('/assets/data/products.json');
  _catalog = await res.json();
  return _catalog;
}

export async function getProducts() {
  const c = await getCatalog();
  return c.products;
}

export async function getProductBySlug(slug) {
  const products = await getProducts();
  return products.find(p => p.slug === slug) || null;
}

export async function getCollections() {
  const c = await getCatalog();
  return c.collections;
}

export async function getPromoRule(promoId) {
  const collections = await getCollections();
  return collections.find(c => c.id === promoId) || null;
}

export function formatCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/**
 * Genera el marcado del bottle-illustration de marca (linea dorada + liquido
 * teñido por familia) que usamos como render de producto mientras no exista
 * fotografia real. Cuando el catalogo real traiga imagen, la card debe
 * preferir esa imagen y usar esto solo como fallback.
 */
export function bottleSVG(product, opts = {}) {
  const [c1, c2] = product.liquid || ['#C9A867', '#96793C'];
  const id = 'b' + Math.random().toString(36).slice(2, 9);
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `
  <svg${cls} viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${product.name}">
    <defs>
      <linearGradient id="glass-${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="18%" stop-color="#ffffff" stop-opacity="0.08"/>
        <stop offset="45%" stop-color="#ffffff" stop-opacity="0.02"/>
        <stop offset="72%" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.5"/>
      </linearGradient>
      <linearGradient id="gold-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#E8D9B5"/>
        <stop offset="50%" stop-color="#C9A867"/>
        <stop offset="100%" stop-color="#96793C"/>
      </linearGradient>
      <linearGradient id="liquid-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c1}" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0.96"/>
      </linearGradient>
      <radialGradient id="shadow-${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.24"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="60" cy="192" rx="32" ry="6" fill="url(#shadow-${id})"/>
    <rect x="46" y="8" width="28" height="22" rx="3" fill="none" stroke="url(#gold-${id})" stroke-width="1.4"/>
    <rect x="48" y="10" width="24" height="18" rx="2" fill="url(#glass-${id})"/>
    <rect x="54" y="30" width="12" height="12" fill="none" stroke="url(#gold-${id})" stroke-width="1.2"/>
    <path d="M54 42 L40 62 L40 168 Q40 178 50 178 L70 178 Q80 178 80 168 L80 62 L66 42 Z"
          fill="url(#glass-${id})" stroke="url(#gold-${id})" stroke-width="1.6"/>
    <path d="M42.5 100 L42.5 168 Q42.5 175.5 50 175.5 L70 175.5 Q77.5 175.5 77.5 168 L77.5 100 Z"
          fill="url(#liquid-${id})"/>
    <line x1="46" y1="118" x2="74" y2="118" stroke="url(#gold-${id})" stroke-width="0.6" opacity="0.7"/>
    <line x1="46" y1="122" x2="74" y2="122" stroke="url(#gold-${id})" stroke-width="0.6" opacity="0.5"/>
    <path d="M46 62 L46 168" stroke="#ffffff" stroke-width="2" opacity="0.35" stroke-linecap="round"/>
  </svg>`;
}

export function matchesQuery(product, tokens) {
  const hay = [
    product.name, product.family, product.gender, product.intensity,
    ...(product.personality || []), ...(product.occasion || []), ...(product.notes || []),
    product.description
  ].join(' ').toLowerCase();
  return tokens.some(t => hay.includes(t));
}
