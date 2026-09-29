# VELMONT — tema de Shopify

Réplica del sitio https://velmont-nine.vercel.app sobre Shopify Online Store 2.0,
con el catálogo real de la tienda.

- **Vista previa:** https://dhqvcp-bw.myshopify.com?preview_theme_id=191867912509
- **Editor:** https://dhqvcp-bw.myshopify.com/admin/themes/191867912509/editor
- **Estado:** borrador. No está publicado.

El diseño no es una interpretación: los tokens salen medidos del original y están
documentados en `../migracion-shopify/design-spec.md`. Ese documento manda.

## Instalación

El tema ya está subido. Para volver a subirlo desde cero:

```bash
cd velmont-theme
SHOPIFY_CLI_THEME_TOKEN=<token de Theme Access> \
SHOPIFY_FLAG_STORE=dhqvcp-bw.myshopify.com \
npx @shopify/cli theme push --unpublished --theme "VELMONT"
```

Para empaquetarlo como `.zip` y subirlo a mano desde el admin:

```bash
cd velmont-theme && zip -r ../velmont-theme.zip . -x "*.DS_Store"
```

Publicarlo (**esto lo ven los clientes**): Tienda online → Temas → ⋯ → Publicar.

## Stack

Liquid + CSS vanilla + JavaScript de módulos ES. Sin React, sin Tailwind, sin
build, sin dependencias de npm. Dawn 16 se usó como referencia técnica del
carrito; no queda código suyo ni su estética.

## Qué se edita y dónde

### Ajustes del tema (afectan a toda la tienda)

| Grupo | Controla |
|---|---|
| **Colores** | Los 11 colores de la paleta. `--surface` / `--on-surface` se derivan solos: cada sección elige tono claro u oscuro y el sistema invierte. |
| **Tipografía** | Familias, URL de Google Fonts y toda la escala (valores fluidos `clamp`). Incluye la micro-etiqueta, que es la firma de la casa. |
| **Espaciado** | Respiro vertical de sección, canal lateral y alto del encabezado. No hay contenedor centrado: el sitio va de borde a borde. |
| **Bordes y sombras** | Radio (0 por diseño), opacidad de los filetes y la sombra de los frascos. |
| **Botones** | Relleno, alto mínimo y grosor del texto. |
| **Movimiento** | Las cuatro duraciones y tres interruptores: cursor de marca, profundidad del hero y pantalla de carga. |
| **Marca** | Logotipo, letras de la marca de agua, sello, textura de mármol, WhatsApp, Instagram y ciudad. |

Todo se emite como variables CSS en `:root` desde `layout/theme.liquid`.
**Ninguna sección lleva un color o un tamaño escrito a mano.**

### Secciones de la portada

| Sección | Qué se edita |
|---|---|
| **Portada** | Antetítulo, titular (una línea por renglón; la última sale en cursiva), dos botones, foto y los datos del pie como bloques. |
| **Hilo de confianza** | Cada dato es un bloque. Sin iconos, como el original. |
| **Declaración** | Titular a dos líneas y texto de apoyo. La primera línea se revela palabra por palabra. |
| **Colección** | La colección de la que salen las piezas, cuántas mostrar y la **disposición**: «Rejilla ordenada» (4 columnas, la que está puesta) o «Composición asimétrica» (la de 12 columnas del prototipo, pensada para ilustraciones de frasco con aire alrededor: con fotos que llenan el marco resulta enorme). En móvil, cualquiera de las dos se vuelve galería deslizable con indicador `01 / 08`. |
| **Descubre (cuestionario)** | Cada pregunta es un bloque. Las opciones se escriben una por línea con el formato `Etiqueta \| identificador-de-coleccion`. Ese identificador decide qué se recomienda al final. |
| **Ediciones** | Cada edición es un bloque: título, texto, colección participante (de ahí salen las dos fotos) y el precio del anuncio. |
| **La casa** | Índice, titular, texto enriquecido, enlace e imagen. |

### Encabezado y pie

- **Encabezado:** dos menús (el de escritorio y el de pantalla completa, que puede
  tener más entradas) y hasta 5 imágenes que aparecen al pasar el cursor por cada
  entrada del menú grande. Una entrada cuyo enlace termine en `#descubre` abre el
  cuestionario en vez de navegar.
- **Pie:** cuatro columnas como bloques (texto, enlaces o contacto). El contacto usa
  el WhatsApp e Instagram de los ajustes del tema. El año del copyright es dinámico.

## Archivos

```
assets/
  base.css            Reset, tipografía, layout, movimiento y todos los componentes
  velmont-tokens.css  Escala de espacio, curvas y apilamiento (lo que no es ajuste)
  global.js           Carga, encabezado, menú, reveals, cursor, bolsa, guardados, buscador, ficha
  carousel.js         Indicador de la galería y arrastre del carrusel de relacionados
  quiz.js             Cuestionario
layout/theme.liquid   Emite los tokens en :root desde los ajustes
sections/             Secciones de portada + main-* de cada plantilla
snippets/             piece (pieza de producto), price, icon, section-header, drawers, quiz
templates/            Plantillas JSON + collection.piezas.liquid (vista que consume el quiz)
locales/              es.default.json y en.json
```

## Decisiones que conviene conocer

- **Ningún precio se escribe a mano.** Todo pasa por `money_without_trailing_zeros`
  y los totales de la bolsa se leen de `/cart.js`. Por eso un descuento automático
  de Shopify (2 MATAI × 450.000) aparece solo, sin tocar código.
- **El precio de las ediciones es solo el anuncio.** El descuento real se configura
  en Descuentos → Descuento automático. Si cambias uno, cambia el otro.
- **Los guardados viven en el navegador del visitante** (`localStorage`), sin cuenta.
- **La pantalla de carga nunca bloquea el scroll** y solo sale en la primera visita
  de cada sesión.
- **`height: auto` en las imágenes es obligatorio:** llevan `width`/`height` reales
  para reservar su espacio y evitar saltos de maquetación.
- **El cuestionario degrada bien:** si su sección no está en la página, los enlaces
  «Descubre» navegan a su destino normal en vez de no hacer nada.
