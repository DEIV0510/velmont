// CSV de importación para los productos subidos el 2026-10-05 (y dos viejos con la
// casa mal escrita): título, descripción, proveedor y etiqueta «Casa: X».
// Lee la tienda EN VIVO (products.json) para no pisar nada que el dueño haya
// cambiado: las etiquetas se conservan todas y solo se añade/corrige la de casa;
// la opción de la variante se copia tal cual (Invictus no es «Default Title").
// Uso: node csv-nuevos.mjs            -> tabla de revisión + CSV
//      node csv-nuevos.mjs --solo h1,h2 -> CSV solo con esos handles (prueba)
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SALIDA = path.join(DIR, '..', 'velmont-nuevos-2026-10-05.csv');
const TIENDA = 'https://dhqvcp-bw.myshopify.com';
const leerObj = (f) => (fs.existsSync(path.join(DIR, f)) ? JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) : {});
const leer = (f) => (fs.existsSync(path.join(DIR, f)) ? JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) : []);

// --- Tienda en vivo ---------------------------------------------------------
const vivos = [];
for (let p = 1; p < 10; p++) {
  const r = await fetch(`${TIENDA}/products.json?limit=250&page=${p}`);
  const j = await r.json();
  if (!j.products.length) break;
  vivos.push(...j.products);
}
const porHandle = new Map(vivos.map((p) => [p.handle, p]));

// --- Investigación ----------------------------------------------------------
const inv = new Map();
for (const f of ['nuevos-a.json', 'nuevos-b.json', 'nuevos-c.json', 'nuevos-d.json', 'nuevos-e.json']) for (const d of leer(f)) inv.set(d.handle, d);

// Productos que entran: los subidos el 2026-10-05 desde las 18:00 y dos viejos
// con la casa mal escrita. El dúo no (no es un perfume; su «Mi tienda» lo oculta el tema).
const VIEJOS = ['ck-one-100ml', 'new-gotas-de-color-edt100ml'];
const lista = vivos.filter((p) => p.created_at >= '2026-10-05T18:00' || VIEJOS.includes(p.handle));

// Correcciones a mano (las de la investigación van en titulo_sugerido / vendor_correcto).
const TITULOS = {
  'ahli-swtzerland': 'AHLI SWITZERLAND',
  'stronger-with-you-edt': 'STRONGER WITH YOU EDT',
  'montblanc-explorer-edp': 'MONTBLANC EXPLORER EDP',
};
const CASAS = {
  'ck-one-100ml': 'CALVIN KLEIN',
  'new-gotas-de-color-edt100ml': 'AGATHA RUIZ DE LA PRADA',
  'sugardaddy': 'FUGAZZI',
  'sugardaddy-1': 'FUGAZZI',
  'korbaj-rose-sands': 'KORBAJ',
  'korbaj-toxic-desire': 'KORBAJ',
  'mancera-french-riviera': 'MANCERA',
  'mancera-instant-crush-1': 'MANCERA',
  'mancera-roses-vanille': 'MANCERA',
  'montblanc-explorer-edp': 'MONTBLANC',
};
// Duplicados sin investigación propia: llevan el texto del original (el que está en vivo).
const DUPLICADOS = { 'sugardaddy-1': 'sugardaddy', 'ilmin-il-roso': 'roso' };
// Textos ya escritos (2026-10-04) de productos que el dueño retiró, p. ej. nautica-voyage.
const textosPrevios = { ...leerObj('todas.json'), ...leerObj('textos-faltantes.json') };

// Retoques a textos investigados (sin tocar los JSON de la investigación).
const AJUSTES_TEXTO = {
  // El dueño lo tiene como unisex y la fuente (tiendas) es floja: sin «para hombre».
  'monaco-11': [['es un cítrico amaderado de Another Lab (A.LAB), fresco y pensado para hombre.', 'es un cítrico amaderado y fresco de Another Lab (A.LAB).']],
};
// Etiquetas de tamaño corregidas por la etiqueta del frasco (Another Lab: 90 ml, no 100).
const TAGS_CAMBIO = { 'monaco-11': [['100 ml', '90 ml']], 'lyche-fiyi-88': [['100 ml', '90 ml']] };
const filas = [];
const revision = [];
for (const p of lista) {
  const d = inv.get(p.handle) || {};
  const dup = DUPLICADOS[p.handle] || (d.decision === 'nada' && d.duplicado_de) || '';
  const titulo = TITULOS[p.handle] || (d.titulo_sugerido || '').trim() || p.title;
  const casa = CASAS[p.handle] || (d.vendor_correcto || '').trim() || p.vendor;

  // Descripción: la investigada; si es duplicado, la del original (investigada o en vivo).
  let cuerpo = p.body_html || '';
  let origen = 'sin cambio';
  if (dup) {
    const o = inv.get(dup);
    const vivoOriginal = porHandle.get(dup);
    if (o && o.texto) { cuerpo = o.texto; origen = `= ${dup} (investigado)`; }
    else if (vivoOriginal) { cuerpo = vivoOriginal.body_html; origen = `= ${dup} (en vivo)`; }
    else if (textosPrevios[dup]) { cuerpo = textosPrevios[dup]; origen = `= ${dup} (texto previo)`; }
  } else if (d.texto && d.texto.trim()) { cuerpo = d.texto.trim(); origen = 'investigado'; }
  for (const [x, y] of AJUSTES_TEXTO[p.handle] || []) { if (!cuerpo.includes(x)) throw new Error('ajuste sin coincidencia en ' + p.handle); cuerpo = cuerpo.replace(x, y); }

  // Etiquetas: todas las que tiene + «Casa: <proveedor>» (se quita la de otra casa).
  const casaTag = `Casa: ${casa}`;
  let tags = p.tags.filter((t) => !t.startsWith('Casa: ') || t === casaTag);
  if (casa !== 'Mi tienda' && !tags.includes(casaTag)) tags = [...tags, casaTag];
  for (const [x, y] of TAGS_CAMBIO[p.handle] || []) tags = tags.map((t) => (t === x ? y : t));

  const opt = p.options[0];
  const variante = p.variants[0];
  filas.push({
    Handle: p.handle,
    Title: titulo,
    'Body (HTML)': cuerpo,
    Vendor: casa,
    Tags: tags.join(', '),
    'Option1 Name': opt.name,
    'Option1 Value': variante.option1,
  });
  revision.push({
    handle: p.handle,
    titulo: titulo === p.title ? '=' : `${p.title} → ${titulo}`,
    casa: casa === p.vendor ? '=' : `${p.vendor} → ${casa}`,
    tags: (() => { const a = new Set(p.tags), b = new Set(tags); const mas = [...b].filter((t) => !a.has(t)), menos = [...a].filter((t) => !b.has(t)); return (mas.length ? '+' + mas.join('|') : '') + (menos.length ? ' -' + menos.join('|') : '') || '='; })(),
    texto: origen,
    variantes: p.variants.length,
  });
}

const solo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1].split(',') : null;
// --listos: solo las filas con texto nuevo (investigado o de duplicado) y los dos viejos; --sin h1,h2 las excluye.
const listos = process.argv.includes('--listos') ? new Set(revision.filter((r) => r.texto !== 'sin cambio' || VIEJOS.includes(r.handle)).map((r) => r.handle)) : null;
const sin = process.argv.includes('--sin') ? new Set(process.argv[process.argv.indexOf('--sin') + 1].split(',')) : new Set();
const csvFilas = filas.filter((f) => (!solo || solo.includes(f.Handle)) && (!listos || listos.has(f.Handle)) && !sin.has(f.Handle));
const cab = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Tags', 'Option1 Name', 'Option1 Value'];
const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const csv = cab.join(',') + '\n' + csvFilas.map((f) => cab.map((c) => q(f[c])).join(',')).join('\n') + '\n';
const lote = process.argv.includes('--lote') ? process.argv[process.argv.indexOf('--lote') + 1] : null;
const destino = lote ? SALIDA.replace('.csv', '-' + lote + '.csv') : solo ? SALIDA.replace('.csv', '-prueba.csv') : listos ? SALIDA.replace('.csv', '-lote1.csv') : SALIDA;
fs.writeFileSync(destino, csv);

console.table(revision);
const sinTexto = revision.filter((r) => r.texto === 'sin cambio' && !VIEJOS.includes(r.handle)).map((r) => r.handle);
console.log(csvFilas.length, 'filas →', destino);
if (sinTexto.length) console.log('SIN texto investigado todavía:', sinTexto.join(' '));
if (revision.some((r) => r.variantes !== 1)) console.log('OJO: hay productos con más de una variante');
