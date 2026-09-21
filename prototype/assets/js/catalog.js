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

// Tinte por familia olfativa: si el catalogo real no define colores de
// liquido, el frasco igual sale con el tono correcto de su familia.
const FAMILY_TINT = {
  amaderado: ['#6B5334', '#2A1E12'],
  oriental:  ['#B27A2C', '#59300E'],
  especiado: ['#9A3F22', '#4A170C'],
  dulce:     ['#D0A0B4', '#8A4A63'],
  floral:    ['#DCC3CB', '#9E7A88'],
  fresco:    ['#8FA07A', '#465235'],
  citrico:   ['#DDBE4C', '#8A6C16'],
  intenso:   ['#3E3A34', '#141110'],
};

/**
 * Render de producto de la casa: frasco en vidrio con refraccion en los
 * cantos, liquido con profundidad, tapa metalica y sombra proyectada.
 * Es el sustituto honesto de la fotografia mientras VELMONT no entregue
 * fotos reales — cuando un producto trae imagen, las piezas la prefieren
 * y esto queda solo como respaldo.
 */
export function bottleSVG(product, opts = {}) {
  const tint = FAMILY_TINT[product.family] || ['#6B5334', '#2A1E12'];
  const [c1, c2] = product.liquid || tint;
  const id = 'b' + Math.random().toString(36).slice(2, 9);
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `
  <svg${cls} viewBox="0 0 200 310" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${product.name}">
    <defs>
      <linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#fff" stop-opacity="0.34"/>
        <stop offset="9%"   stop-color="#fff" stop-opacity="0.10"/>
        <stop offset="26%"  stop-color="#fff" stop-opacity="0.03"/>
        <stop offset="62%"  stop-color="#fff" stop-opacity="0.02"/>
        <stop offset="88%"  stop-color="#fff" stop-opacity="0.13"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0.30"/>
      </linearGradient>
      <linearGradient id="l-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${c1}" stop-opacity="0.72"/>
        <stop offset="18%"  stop-color="${c1}" stop-opacity="0.94"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="m-${id}" x1="0" y1="0" x2="1" y2="0.2">
        <stop offset="0%"   stop-color="#7A6136"/>
        <stop offset="18%"  stop-color="#E4D3AB"/>
        <stop offset="42%"  stop-color="#C9A867"/>
        <stop offset="68%"  stop-color="#8A6F3C"/>
        <stop offset="88%"  stop-color="#D8C7A6"/>
        <stop offset="100%" stop-color="#6E5730"/>
      </linearGradient>
      <radialGradient id="s-${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#000" stop-opacity="0.55"/>
        <stop offset="60%"  stop-color="#000" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="d-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.34"/>
      </linearGradient>
      <clipPath id="c-${id}">
        <path d="M84 84 L38 118 Q32 123 32 132 L32 272 Q32 286 46 286 L154 286 Q168 286 168 272 L168 132 Q168 123 162 118 L116 84 Z"/>
      </clipPath>
    </defs>

    <!-- sombra proyectada -->
    <ellipse cx="100" cy="291" rx="84" ry="12" fill="url(#s-${id})"/>

    <!-- tapa: ancha y con peso, como un flacon de perfumeria -->
    <rect x="62" y="14" width="76" height="52" rx="1.5" fill="url(#m-${id})"/>
    <rect x="62" y="60" width="76" height="6" fill="#000" opacity="0.26"/>
    <rect x="73" y="20" width="9" height="40" fill="#fff" opacity="0.28"/>
    <rect x="120" y="20" width="4" height="40" fill="#fff" opacity="0.14"/>
    <!-- collar -->
    <rect x="84" y="66" width="32" height="8" fill="url(#m-${id})"/>
    <rect x="84" y="74" width="32" height="12" fill="url(#g-${id})"/>

    <!-- cuerpo -->
    <path d="M84 84 L38 118 Q32 123 32 132 L32 272 Q32 286 46 286 L154 286 Q168 286 168 272 L168 132 Q168 123 162 118 L116 84 Z"
          fill="url(#g-${id})"/>
    <g clip-path="url(#c-${id})">
      <!-- liquido con menisco -->
      <path d="M32 168 Q100 158 168 168 L168 286 L32 286 Z" fill="url(#l-${id})"/>
      <!-- sombra interior en la base -->
      <rect x="32" y="214" width="136" height="72" fill="url(#d-${id})"/>
      <!-- reflejo especular principal -->
      <path d="M52 124 Q46 130 46 140 L46 268" stroke="#fff" stroke-opacity="0.40" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M66 130 L66 258" stroke="#fff" stroke-opacity="0.13" stroke-width="3" stroke-linecap="round"/>
      <!-- luz de canto derecha -->
      <path d="M150 126 Q154 134 154 146 L154 264" stroke="#fff" stroke-opacity="0.20" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- hombro iluminado -->
      <path d="M86 88 L44 119" stroke="#fff" stroke-opacity="0.22" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <!-- filo del vidrio -->
    <path d="M84 84 L38 118 Q32 123 32 132 L32 272 Q32 286 46 286 L154 286 Q168 286 168 272 L168 132 Q168 123 162 118 L116 84 Z"
          fill="none" stroke="#C9A867" stroke-opacity="0.5" stroke-width="1"/>

    <!-- filetes de la etiqueta -->
    <line x1="70" y1="210" x2="130" y2="210" stroke="#E4D3AB" stroke-opacity="0.45" stroke-width="0.8"/>
    <line x1="82" y1="218" x2="118" y2="218" stroke="#E4D3AB" stroke-opacity="0.28" stroke-width="0.6"/>
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
