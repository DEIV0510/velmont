// Aumento del 5 % (pedido del dueño 2026-10-09: «subir un 5 % a todos los productos, la
// pasarela sube el precio»). Redondeo hacia arriba a $5.000 y el Dúo VELMONT NO sube
// (las promociones se quedan: 2 MATAI = $450.000 se compensa en el descuento).
//   node precios-5.mjs csv [--solo h1,h2]  -> copia de precios + CSV de importación
//   node precios-5.mjs diff <foto-antes.json> -> compara la tienda en vivo contra la foto:
//        solo puede haber cambiado el precio, y al valor esperado.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const RAIZ = path.join(DIR, '..');
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
const EXCLUIR = new Set(['duo-velmont']);
const nuevo = (precio) => Math.ceil((precio * 1.05) / 5000) * 5000;

async function vivos() {
  const out = [];
  for (let p = 1; p < 10; p++) {
    const j = await (await jfetch(`${TIENDA}/products.json?limit=250&page=${p}${process.env.NC ? '&nc=' + Date.now() : ''}`)).json();
    if (!j.products.length) break;
    out.push(...j.products);
    if (j.products.length < 250) break;
  }
  return out;
}
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;

const [modo, arg1, arg2] = process.argv.slice(2);
const todos = await vivos();

if (modo === 'csv') {
  const solo = arg1 === '--solo' ? new Set(arg2.split(',')) : null;
  const copia = fs.existsSync(path.join(RAIZ, 'precios-antes-2026-10-09.json'))
    ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'precios-antes-2026-10-09.json'), 'utf8')) : null;
  const filas = [['Handle', 'Title', 'Option1 Name', 'Option1 Value', 'Variant Price']];
  const tabla = [];
  for (const p of todos) {
    if (EXCLUIR.has(p.handle) || (solo && !solo.has(p.handle))) continue;
    if (p.variants.length !== 1) { console.log('OJO, varias variantes:', p.handle); continue; }
    const v = p.variants[0];
    // El precio base sale de la copia (si ya existe), nunca de la tienda a medio subir.
    const base = copia ? copia[p.handle]?.precio : Number(v.price);
    if (!base) { console.log('sin precio base:', p.handle); continue; }
    const n = nuevo(base);
    filas.push([p.handle, p.title, p.options[0].name, v.option1, n]);
    tabla.push({ handle: p.handle, antes: base, despues: n });
  }
  if (!copia) {
    const c = Object.fromEntries(todos.map((p) => [p.handle, { id: p.id, variante: p.variants[0].id, titulo: p.title, precio: Number(p.variants[0].price) }]));
    fs.writeFileSync(path.join(RAIZ, 'precios-antes-2026-10-09.json'), JSON.stringify(c, null, 1));
    console.log('copia de precios:', Object.keys(c).length, 'productos → precios-antes-2026-10-09.json');
  }
  const nombre = solo ? 'velmont-precios-5-prueba.csv' : 'velmont-precios-5.csv';
  fs.writeFileSync(path.join(RAIZ, nombre), filas.map((f) => f.map(q).join(',')).join('\n') + '\n');
  const suba = tabla.map((t) => t.despues / t.antes - 1);
  console.log(`${nombre}: ${tabla.length} productos; suba mínima ${(Math.min(...suba) * 100).toFixed(1)} %, máxima ${(Math.max(...suba) * 100).toFixed(1)} %`);
  for (const t of tabla.slice(0, 6)) console.log(`  ${t.handle}: ${t.antes} → ${t.despues}`);
} else if (modo === 'diff') {
  const antes = JSON.parse(fs.readFileSync(arg1, 'utf8'));
  // Sin lista: todos deben tener el precio nuevo. Con lista (prueba): solo esos.
  const soloDiff = arg2 ? new Set(arg2.split(',')) : null;
  const copia = JSON.parse(fs.readFileSync(path.join(RAIZ, 'precios-antes-2026-10-09.json'), 'utf8'));
  let ok = 0, sinCambio = 0, mal = 0;
  for (const p of todos) {
    const x = antes[p.handle];
    if (!x) { console.log('NUEVO:', p.handle); mal++; continue; }
    const v = p.variants[0];
    const esperado = EXCLUIR.has(p.handle) || (soloDiff && !soloDiff.has(p.handle)) ? copia[p.handle].precio : nuevo(copia[p.handle].precio);
    const precio = Number(v.price);
    const otros = [];
    if (p.title !== x.title) otros.push('título');
    if (p.vendor !== x.vendor) otros.push('casa');
    if (p.product_type !== x.product_type) otros.push('tipo');
    if (JSON.stringify([...p.tags].sort()) !== JSON.stringify(x.tags)) otros.push('etiquetas');
    if ((p.body_html || '').replace(/\s+/g, ' ').trim() !== (x.body_html || '').replace(/\s+/g, ' ').trim()) otros.push('descripción');
    if (p.published_at !== x.published_at) otros.push('publicación');
    if (JSON.stringify(p.images.map((i) => i.id)) !== JSON.stringify(x.fotos)) otros.push('fotos');
    if (v.id !== x.variantes[0].id) otros.push('variante id');
    if (v.sku !== x.variantes[0].sku) otros.push('sku');
    if (v.available !== x.variantes[0].available) otros.push('disponible');
    if ((v.compare_at_price || null) !== x.variantes[0].compare) otros.push('precio tachado');
    if (otros.length || precio !== esperado) {
      mal++; console.log(`✗ ${p.handle}: precio ${precio} (esperado ${esperado})${otros.length ? '; cambió también: ' + otros.join(', ') : ''}`);
    } else if (precio === copia[p.handle].precio) sinCambio++; else ok++;
  }
  console.log(`\n${ok} con precio nuevo correcto, ${sinCambio} sin cambio esperado, ${mal} con diferencias.`);
}
