# VELMONT — rediseño completo

Experiencia web nueva para VELMONT (boutique de perfumería), construida a
partir del brief "Tu fragancia. Tu identidad." Este repo tiene dos partes:

```
prototype/        → sitio estático real, para ver y probar el diseño ya (sin Shopify)
shopify-theme/     → el mismo diseño, portado a un tema Shopify instalable
```

## ⚠️ Léelo antes que nada: qué es real y qué es de muestra

La carpeta `VELMONT` que se entregó para este proyecto **solo contenía el
logo** (`Logo-velmont-VECTOR.pdf` / `Logo-velmont.pdf`) — ningún producto,
foto, precio ni catálogo. Se decidió (con aprobación explícita) construir
toda la arquitectura y la dirección de arte ya, usando un catálogo de
**20 perfumes de muestra claramente marcados como placeholder**
(`prototype/assets/data/products.json`, primer campo `_placeholder_notice`),
para no bloquear el trabajo de diseño/ingeniería.

**Lo que SÍ es real y funciona de verdad:**
- El logo oficial (usado tal cual, sin alterar — incluye el mismo texto
  "FRAGANCES" del archivo original).
- El motor de promociones **MATAI 2x$450.000** y **Selección VELMONT
  2x$280.000** — la lógica de negocio (armar combos, calcular ahorro, avisar
  cuánto falta) es real y funcional, confirmada por el cliente.
- Toda la interacción: Perfume Finder, buscador, Asesor VELMONT, carrito,
  favoritos, filtros — todo funciona de verdad, solo que sobre datos de
  muestra.

**Antes de publicar de verdad**, hay que reemplazar `products.json` (o, en
el tema Shopify, etiquetar los productos reales — ver
`shopify-theme/docs/ADMIN.md`) con el catálogo, fotos y precios reales de
VELMONT.

## Ver el prototipo

```bash
node prototype/server.js
```

Abre `http://localhost:5401`. Es HTML/CSS/JS plano, sin build ni
dependencias — pensado para revisar diseño e interacción rápido en
cualquier navegador, en cualquiera de los breakpoints del brief
(360/390/414/768/1366/1440/1920).

Páginas: `index.html` (home), `collection.html`, `product.html?slug=<slug>`,
`checkout-preview.html` (vista de continuidad visual, sin pasarela real).

## Instalar el tema en Shopify

`shopify-theme/` es un tema Online Store 2.0 completo (Liquid + JSON
templates + sections + metafields). Para probarlo:

```bash
cd shopify-theme
shopify theme dev --store tu-tienda.myshopify.com
```

o subirlo directo desde el admin de Shopify (Tienda online → Temas → Subir
tema, como .zip de la carpeta `shopify-theme/`).

**Antes de usarlo en una tienda real**, lee `shopify-theme/docs/ADMIN.md` —
explica el esquema de tags/metafields que necesita cada producto, cómo
configurar las dos promociones, y (importante) el paso pendiente para que el
checkout de Shopify realmente cobre el precio de combo, no solo lo muestre
en el carrito.

## Decisiones de diseño que vale la pena conocer

- **Sin fotografía de producto real** (no existía ninguna), se optó por una
  ilustración de frasco propia, en línea dorada, coherente con el icono del
  logo — en vez de fotos de stock genéricas que no habrían encajado entre sí
  ni con la marca. El momento que un producto tenga foto real, la tarjeta y
  la ficha la usan automáticamente en su lugar (ver `product-card.js` /
  `product-main.liquid`).
- **Tipografía**: Fraunces (editorial, títulos) + Manrope (UI). Dorado como
  degradado de tres tonos (nunca amarillo plano ni relleno sólido grande).
- **Un solo módulo de datos** (`catalog.js`) separa toda la UI de dónde
  vienen los datos — por eso el mismo `cart-ui.js`, `finder.js`,
  `assistant.js`, `product-card.js` funcionan sin cambios tanto en el
  prototipo (JSON estático) como en el tema Shopify (catálogo real vía
  Liquid + Cart AJAX API).
- El tema pasa `shopify theme check` sin errores (solo 4 advertencias de
  estilo, por usar Google Fonts en vez del selector nativo de fuentes de
  Shopify — decisión deliberada porque Fraunces no está en ese selector).

## Pendientes conocidos para lanzar

1. Catálogo, fotos y precios reales (reemplazar placeholders).
2. Cerrar la brecha de checkout de las promociones (Shopify Function o app
   de bundles — ver `shopify-theme/docs/ADMIN.md`, sección 3).
3. Crear el menú de navegación y cargar los metafields `velmont.notes` /
   `velmont.profile` para cada producto real.
4. Revisar textos legales de envíos/cambios en el footer (hoy son enlaces
   placeholder `#`).
