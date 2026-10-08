// Regenera snippets/notas-datos.liquid a partir de:
//   datos-x.json            -> hoja del comerciante (Excel), 53 fichas, se respetan tal cual
//   datos-1..4.json         -> investigación (solo estado OK)
//   reinvestigacion-*.json  -> segunda pasada de los dudosos / no encontrados (si existen)
// Uso: node generar-notas.mjs [--escribir]
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const TEMA = path.join(DIR, '..', 'velmont-theme', 'snippets', 'notas-datos.liquid');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const existe = (f) => fs.existsSync(path.join(DIR, f));

// La familia va en femenino (concuerda con «familia», como en la hoja del comerciante:
// «Amaderada acuática», «Frutal floral ambarada»). Si empieza por «Cuero», el
// adjetivo concuerda con cuero.
const FEM = {
  amaderado: 'amaderada', especiado: 'especiada', aromático: 'aromática', acuático: 'acuática',
  ambarado: 'ambarada', almizclado: 'almizclada', cítrico: 'cítrica', marino: 'marina',
  blanco: 'blanca', fresco: 'fresca', dulce: 'dulce', resinoso: 'resinosa', balsámico: 'balsámica',
  verde: 'verde', ahumado: 'ahumada', afrutado: 'afrutada', floral: 'floral', frutal: 'frutal',
};
function familiaFem(f) {
  const t = (f || '').trim();
  if (!t) return '';
  if (/^cuero\b/i.test(t)) return t[0].toUpperCase() + t.slice(1);
  const out = t.replace(/[A-Za-zÁÉÍÓÚáéíóúÑñü]+/g, (w) => {
    const low = w.toLowerCase();
    if (!(low in FEM)) return w;
    const r = FEM[low];
    return w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
  });
  return out[0].toUpperCase() + out.slice(1);
}

const CONC = { EDP: 'Eau de Parfum', EDT: 'Eau de Toilette', EXTRAIT: 'Extrait de Parfum', PARFUM: 'Parfum', EDC: 'Eau de Cologne' };
function concLarga(c, tam) {
  let t = (c || '').trim();
  const k = t.toUpperCase();
  if (CONC[k]) t = CONC[k];
  else t = t.replace(/^EDP\b/, 'Eau de Parfum').replace(/^EDT\b/, 'Eau de Toilette');
  const ml = (tam || '').trim();
  if (ml && !t.includes('ml')) t = t ? `${t} ${ml}` : ml;
  return t;
}

const limpio = (v) => {
  const s = (v == null ? '' : String(v)).replace(/[\u0027]/g, '\u2019').replace(/§/g, ' ').replace(/\s+/g, ' ').trim();
  return s || '-';
};

const filas = new Map(); // handle -> {campos, origen}

// 1) Hoja del comerciante: tal cual (solo se escribe la concentración completa).
for (const d of leer('datos-x.json')) {
  filas.set(d.handle, {
    origen: 'hoja',
    c: [d.familia, d.salida, d.corazon, d.fondo, d.ideal, concLarga(d.concentracion), ''],
  });
}

// 2) Investigación (estado OK) — no pisa la hoja del comerciante.
const inv = ['datos-1.json', 'datos-2.json', 'datos-3.json', 'datos-4.json'].flatMap(leer);
for (const d of inv) {
  if (d.estado !== 'OK' || filas.has(d.handle)) continue;
  filas.set(d.handle, {
    origen: 'investigacion',
    c: [familiaFem(d.familia), d.salida, d.corazon, d.fondo, '', concLarga(d.concentracion, d.tam_tienda), d.notas],
  });
}

// 3) Segunda pasada: solo lo que salió fiable. Los nuevos-*.json son los productos
//    subidos el 2026-10-05 (mismo formato). Un duplicado de otro producto de la
//    tienda (duplicado_de) copia la fila de ese producto, al final.
const duplicados = new Map(); // handle -> handle original
for (const f of ['reinvestigacion-ahli.json', 'reinvestigacion-otros.json', 'reinvestigacion-extra.json',
                 'nuevos-a.json', 'nuevos-b.json', 'nuevos-c.json', 'nuevos-d.json', 'nuevos-e.json',
                 'nuevos-f.json']) {
  if (!existe(f)) continue;
  for (const d of leer(f)) {
    if (filas.get(d.handle)?.origen === 'hoja') continue;
    if (d.duplicado_de && d.decision === 'nada') { duplicados.set(d.handle, d.duplicado_de); continue; }
    if (d.decision === 'piramide') {
      filas.set(d.handle, { origen: f, c: [familiaFem(d.familia), d.salida, d.corazon, d.fondo, '', concLarga(d.concentracion, d.tam), d.notas] });
    } else if (d.decision === 'solo_familia' && d.familia) {
      filas.set(d.handle, { origen: f, c: [familiaFem(d.familia), '', '', '', '', concLarga(d.concentracion, d.tam), ''] });
    } else if (d.concentracion || d.tam) {
      // Sin notas fiables: solo lo que dice la etiqueta (concentración y tamaño).
      filas.set(d.handle, { origen: f, c: ['', '', '', '', '', concLarga(d.concentracion, d.tam), ''] });
    }
  }
}

// Duplicados: el mismo perfume subido dos veces lleva la misma ficha que el original.
// sugardaddy-1 es el Sugardaddy de Fugazzi subido otra vez (19:45, ya con su marca).
duplicados.set('sugardaddy-1', 'sugardaddy');
for (const [h, original] of duplicados) {
  const f = filas.get(original);
  if (f && !filas.has(h)) filas.set(h, { origen: 'duplicado', c: [...f.c] });
  else if (!f) console.warn('duplicado sin fila original:', h, '→', original);
}

// Correcciones puntuales de texto que el cliente vería (notas internas de la hoja).
const CORRECCIONES = { passion: { 5: '50 ml' } }; // era «50 ml (EDP o Extrait según la tienda)»
for (const [h, cambios] of Object.entries(CORRECCIONES)) {
  const f = filas.get(h);
  if (f) for (const [i, v] of Object.entries(cambios)) f.c[i] = v;
}

const casos = [...filas.entries()].map(([h, { c }]) => {
  const v = c.map(limpio);
  // 7.º campo (notas sin pirámide) solo si existe, para no tocar las filas de la hoja.
  const campos = v[6] === '-' ? v.slice(0, 6) : v;
  return `    when '${h}'\n      assign fila = '${campos.join('§')}'`;
}).join('\n');

// El dúo no es un perfume: en la tarjeta lleva su propia línea, y en la ficha
// no hay bloque de notas (allí van los dos pasos para elegir).
const render = `{%- if solo == 'familia' -%}
  {%- comment -%} Sin familia confirmada, la tarjeta dice lo que pone la etiqueta (concentración y tamaño). {%- endcomment -%}
  {%- if fila != blank -%}
    {%- assign c = fila | split: '§' -%}
    {%- if c[0] != '-' -%}{{ c[0] }}{%- elsif c[5] != '-' -%}{{ c[5] }}{%- endif -%}
  {%- elsif product.handle == 'duo-velmont' -%}
    Dos perfumes a tu elección
  {%- endif -%}
{%- elsif fila != blank -%}
  {%- assign c = fila | split: '§' -%}
  {%- assign n_familia = c[0] -%}
  {%- assign n_salida  = c[1] -%}
  {%- assign n_corazon = c[2] -%}
  {%- assign n_fondo   = c[3] -%}
  {%- assign n_ideal   = c[4] -%}
  {%- assign n_conc    = c[5] -%}
  {%- assign n_notas   = c[6] | default: '-' -%}

  <div class="notas" data-reveal>
    {%- if n_salida != '-' or n_corazon != '-' or n_fondo != '-' or n_notas != '-' -%}
      <div class="notas__piramide">
        {%- if n_salida != '-' -%}
          <div class="notas__paso"><span class="label notas__paso-t">Salida</span><p class="notas__paso-v">{{ n_salida }}</p></div>
        {%- endif -%}
        {%- if n_corazon != '-' -%}
          <div class="notas__paso"><span class="label notas__paso-t">Corazón</span><p class="notas__paso-v">{{ n_corazon }}</p></div>
        {%- endif -%}
        {%- if n_fondo != '-' -%}
          <div class="notas__paso"><span class="label notas__paso-t">Fondo</span><p class="notas__paso-v">{{ n_fondo }}</p></div>
        {%- endif -%}
        {%- if n_notas != '-' -%}
          <div class="notas__paso"><span class="label notas__paso-t">Notas</span><p class="notas__paso-v">{{ n_notas }}</p></div>
        {%- endif -%}
      </div>
    {%- endif -%}

    {%- if n_familia != '-' or n_ideal != '-' or n_conc != '-' -%}
      <dl class="notas__datos">
        {%- if n_familia != '-' -%}<div><dt class="label">Familia</dt><dd>{{ n_familia }}</dd></div>{%- endif -%}
        {%- if n_conc != '-' -%}<div><dt class="label">Concentración</dt><dd>{{ n_conc }}</dd></div>{%- endif -%}
        {%- if n_ideal != '-' -%}<div><dt class="label">Ideal para</dt><dd>{{ n_ideal }}</dd></div>{%- endif -%}
      </dl>
    {%- endif -%}
  </div>
{%- endif -%}
`;

const cabecera = `{%- comment -%}
  FICHA OLFATIVA — GENERADO por datos-perfumes/generar-notas.mjs (repo velmont).

  Dos fuentes, por orden de prioridad:
  1. La hoja del comerciante (Velmont_notas_perfumes.xlsx, hoja "Fichas"):
     familia, piramide, ocasion y concentracion tal cual.
  2. Investigacion perfume por perfume (marca, Fragrantica/Parfumo, tiendas que
     coinciden). Solo entran las fichas confirmadas; lo dudoso se queda fuera:
     antes un hueco que un dato que nadie ha podido confirmar.

  Campos: familia § salida § corazon § fondo § ideal § concentracion [§ notas]
  ('-' = sin dato). El 7.º campo, opcional, son las notas cuando la fuente no
  las separa en salida/corazon/fondo.

  Los datos y el marcado van JUNTOS porque {% raw %}{% render %}{% endraw %} aisla el ambito y un
  "assign" hecho en otro snippet no saldria de el.

  Mandan los metacampos si algun dia existen: este bloque solo aparece cuando el
  producto no trae ya su propia ficha.

  Con solo: 'familia' devuelve SOLO la familia, en texto plano, para la
  tarjeta del catalogo: {% raw %}{% render 'notas-datos', product: p, solo: 'familia' %}{% endraw %}

  No editar los datos a mano: se regeneran con el script.
{%- endcomment -%}

{%- liquid
  assign fila = ''
  case product.handle
${casos}
  endcase
-%}

`;

const salida = cabecera + render;
const resumen = {
  total: filas.size,
  hoja: [...filas.values()].filter((f) => f.origen === 'hoja').length,
  investigacion: [...filas.values()].filter((f) => f.origen === 'investigacion').length,
  segunda: [...filas.values()].filter((f) => f.origen.startsWith('reinv')).length,
  nuevos: [...filas.values()].filter((f) => f.origen.startsWith('nuevos')).length,
  duplicados: [...filas.values()].filter((f) => f.origen === 'duplicado').length,
  familias: [...new Set([...filas.values()].map((f) => limpio(f.c[0])))].length,
};
console.log(JSON.stringify(resumen));
if (process.argv.includes('--escribir')) {
  fs.writeFileSync(TEMA, salida);
  console.log('escrito', TEMA, salida.length, 'bytes');
} else {
  fs.writeFileSync(path.join(DIR, 'notas-datos.previa.liquid'), salida);
  console.log('previa en notas-datos.previa.liquid');
}
