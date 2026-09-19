// VELMONT — favoritos (wishlist), mismo patron que cart.js
const STORAGE_KEY = 'velmont_favorites_v1';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function write(ids) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* modo privado */ }
}

let ids = read();

function emit() {
  document.dispatchEvent(new CustomEvent('velmont:favorites-changed'));
}

export function isFavorite(id) { return ids.includes(id); }
export function getFavoriteIds() { return ids.slice(); }

export function toggleFavorite(id) {
  ids = isFavorite(id) ? ids.filter(i => i !== id) : [...ids, id];
  write(ids);
  emit();
  return isFavorite(id);
}

export function removeFavorite(id) {
  ids = ids.filter(i => i !== id);
  write(ids);
  emit();
}
