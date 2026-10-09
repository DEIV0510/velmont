// Foto de la tienda en vivo y comparación, para importaciones por CSV.
//   node foto-tienda.mjs foto  <archivo.json>                 -> guarda la foto
//   node foto-tienda.mjs diff  <antes.json> <csv> [h1,h2...]  -> foto nueva y compara:
//        las columnas del CSV deben haber cambiado a lo esperado; TODO lo demás, igual.
import fs from 'node:fs';

// Shopify limita las consultas seguidas («local_rate_limited», 429): reintentar con espera.
async function jget(url) {
  for (let i = 0; i < 20; i++) {
    if (i) await new Promise((s) => setTimeout(s, 30000));
    const r = await fetch(url);
    const t = await r.text();
    if (r.status === 429 || /rate_limited/.test(t)) { await new Promise((s) => setTimeout(s, 15000)); continue; }
    return JSON.parse(t);
  }
  throw new Error('sigue limitado: ' + url);
}

const CABECERAS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', Accept: 'application/json,text/plain,*/*', 'Accept-Language': 'es-CO,es;q=0.9' };
// Shopify responde 429 «local_rate_limited» a consultas seguidas sin pausa: 2,5 s entre
// consultas, cabeceras de navegador y reintentos con espera.
async function jfetch(url) {
  for (let i = 0; i < 20; i++) {
    await new Promise((s) => setTimeout(s, i ? 15000 : 2500));
    const r = await fetch(url, { headers: CABECERAS });
    if (r.status === 429) continue;
    const t = await r.clone().text();
    if (/rate_limited/.test(t)) continue;
    return r;
  }
  throw new Error('sigue limitado: ' + url);
}

const TIENDA = 'https://dhqvcp-bw.myshopify.com';
const COLECCIONES = ['para-el', 'para-ella', 'unisex', '2-x-280-000', '2-matai-x-450-000'];

async function foto() {
  const productos = [];
  for (let p = 1; p < 10; p++) {
    const j = await (await jfetch(`${TIENDA}/products.json?limit=250&page=${p}${process.env.NC ? '&nc=' + Date.now() : ''}`)).json();
    if (!j.products.length) break;
    productos.push(...j.products);
    if (j.products.length < 250) break;
  }
  const en = {};
  for (const c of COLECCIONES) {
    const j = await (await jfetch(`${TIENDA}/collections/${c}/products.json?limit=250${process.env.NC ? '&nc=' + Date.now() : ''}`)).json();
    for (const p of j.products) (en[p.handle] ||= []).push(c);
  }
  const out = {};
  for (const p of productos) {
    out[p.handle] = {
      id: p.id, title: p.title, vendor: p.vendor, product_type: p.product_type,
      tags: [...p.tags].sort(), body_html: p.body_html, published_at: p.published_at,
      opciones: p.options.map((o) => `${o.name}=${o.values.join('/')}`),
      variantes: p.variants.map((v) => ({ id: v.id, title: v.title, price: v.price, sku: v.sku, available: v.available, compare: v.compare_at_price || null })),
      fotos: p.images.map((i) => i.id),
      colecciones: (en[p.handle] || []).sort(),
    };
  }
  return out;
}

function leerCsv(ruta) {
  const t = fs.readFileSync(ruta, 'utf8');
  const filas = []; let fila = []; let campo = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift();
  return filas.map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i]])));
}

const [modo, a, b, soloArg] = process.argv.slice(2);
if (modo === 'foto') {
  const f = await foto();
  fs.writeFileSync(a, JSON.stringify(f, null, 1));
  console.log('foto:', Object.keys(f).length, 'productos →', a);
} else if (modo === 'diff') {
  const antes = JSON.parse(fs.readFileSync(a, 'utf8'));
  const ahora = await foto();
  const csv = leerCsv(b);
  const solo = soloArg ? new Set(soloArg.split(',')) : null;
  const esperado = new Map(csv.filter((r) => !solo || solo.has(r.Handle)).map((r) => [r.Handle, r]));
  const norm = (h) => (h || '').replace(/\s+/g, ' ').trim();
  let problemas = 0, aplicados = 0;
  const todos = new Set([...Object.keys(antes), ...Object.keys(ahora)]);
  for (const h of todos) {
    const x = antes[h], y = ahora[h], e = esperado.get(h);
    if (!x || !y) { console.log(`${h}: ${!x ? 'NUEVO (no estaba antes)' : 'YA NO ESTÁ publicado'}`); if (e) problemas++; continue; }
    const dif = [];
    for (const k of Object.keys(x)) {
      let va = x[k], vb = y[k];
      if (e && k === 'title' && e.Title !== undefined) va = e.Title;
      if (e && k === 'vendor' && e.Vendor !== undefined) va = e.Vendor;
      if (e && k === 'tags' && e.Tags !== undefined) va = e.Tags.split(',').map((s) => s.trim()).filter(Boolean).sort();
      if (e && k === 'body_html' && e['Body (HTML)'] !== undefined) { va = norm(e['Body (HTML)']); vb = norm(vb); }
      if (JSON.stringify(va) !== JSON.stringify(vb)) dif.push(`${k}: esperado ${String(JSON.stringify(va)).slice(0, 140)} | hay ${String(JSON.stringify(vb)).slice(0, 140)}`);
    }
    if (dif.length) { problemas++; console.log(`✗ ${h}${e ? ' (en el CSV)' : ' (NO estaba en el CSV)'}\n   ` + dif.join('\n   ')); }
    else if (e) aplicados++;
  }
  console.log(`\n${aplicados}/${esperado.size} filas del CSV aplicadas tal cual; ${problemas} productos con diferencias.`);
}
