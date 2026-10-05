# Datos de perfumes (VELMONT)

Fuente de la ficha olfativa del tema (`velmont-theme/snippets/notas-datos.liquid`)
y de las descripciones de producto cargadas en Shopify (2026-10-04).

- `datos-x.json` — hoja del comerciante (Excel), 53 fichas. Manda sobre lo demás.
- `datos-1..4.json` / `investigacion-1..4.json` — investigación perfume por perfume (solo entra `estado: OK`).
- `reinvestigacion-*.json` — segunda pasada de los dudosos y no encontrados, y correcciones
  (Karpos: tarjeta oficial de AHLI de febrero de 2026).
- `todas.json` + `textos-faltantes.json` — descripciones HTML; `textos-faltantes` manda si un perfume está en los dos.
- `generar-notas.mjs` — regenera el snippet: `node generar-notas.mjs --escribir`, y después
  `theme push --only snippets/notas-datos.liquid --allow-live`.

Sin notas fiables (solo concentración en la tarjeta): Il Peace, Crux y Gemini (este con pirámide oficial pero sin familia).
