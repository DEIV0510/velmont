# VELMONT — guía de administración del tema Shopify

Este tema lee casi todo su contenido variable (catálogo, promociones, destacados)
desde tags, metafields y ajustes del tema — no hay nada de eso escrito en el
código. Esta guía explica exactamente qué configurar en el admin de Shopify.

## 1. Cómo se arma el catálogo que ve el sitio

El archivo `snippets/catalog-json.liquid` recorre una colección (por defecto,
"Todos los productos"; puedes elegir otra en **Configuración del tema →
Catálogo VELMONT → "Colección que alimenta el catálogo"**) y construye un
JSON con cada producto. El buscador, el Perfume Finder, el Asesor VELMONT,
las cuadrículas y el carrito leen únicamente de ese JSON — así que basta con
etiquetar bien un producto para que aparezca correctamente en todas partes.

### Tags que reconoce el tema (agrégalos en el producto, sin espacios)

| Categoría    | Tags válidos                                                                                     |
|--------------|---------------------------------------------------------------------------------------------------|
| Género       | `hombre`, `mujer`, `unisex`                                                                       |
| Familia      | `familia-dulce`, `familia-fresco`, `familia-amaderado`, `familia-intenso`, `familia-citrico`, `familia-oriental`, `familia-especiado`, `familia-floral` |
| Personalidad | `perfil-seductor`, `perfil-elegante`, `perfil-intenso`, `perfil-fresco`, `perfil-misterioso`, `perfil-sofisticado`, `perfil-dulce`, `perfil-clasico` (puedes poner varios) |
| Ocasión      | `ocasion-diario`, `ocasion-oficina`, `ocasion-cita`, `ocasion-noche`, `ocasion-evento`, `ocasion-vacaciones` (puedes poner varios) |
| Intensidad   | `intensidad-suave`, `intensidad-media`, `intensidad-intensa`                                       |
| Destacado    | El tag configurado en **Catálogo VELMONT → "Tag que marca un producto como destacado"** (por defecto `destacado`) |
| Promoción    | `promo-matai` o `promo-seleccion` (ver sección 3)                                                  |

Un producto sin ninguno de estos tags igual aparece en el catálogo general,
solo que no entrará en el Finder, los filtros ni las promociones.

### Metafields opcionales (namespace `velmont`)

Estos dos le dan contenido real a la ficha de producto. Créalos en
**Configuración → Metafields → Productos**:

1. `velmont.notes` — tipo **Lista de líneas de texto**. Las 3-4 notas
   olfativas ("Vetiver", "Cuero", "Ámbar gris").
2. `velmont.profile` — tipo **JSON**. El perfil que llena las barras
   "¿Te gustará este perfume?", con esta forma exacta (valores de 0 a 5):
   ```json
   { "dulce": 1, "fresco": 1, "amaderado": 5, "intenso": 4, "citrico": 0, "oriental": 2, "especiado": 2 }
   ```
3. `velmont.short_description` — tipo **Una línea de texto** (opcional). Si
   no existe, el tema usa la descripción normal del producto (recortada).

Si un producto no tiene `notes` o `profile`, esas secciones de su ficha
simplemente salen vacías — no rompen nada.

### Imagen del producto

Si el producto tiene una imagen destacada en Shopify, el tema la usa
directamente (en la ficha y en las tarjetas). Si no tiene ninguna, se muestra
automáticamente el frasco ilustrado de marca (el mismo que ves en el
prototipo) como reemplazo — nunca se inventa ni se genera una foto.

## 2. Productos destacados

Agrega el tag de "destacado" (por defecto `destacado`, configurable) a
cualquier producto para que aparezca en la sección "Productos destacados" de
la portada y en la cuadrícula editorial.

## 3. Promociones MATAI y Selección VELMONT

Cada promoción se configura en **Configuración del tema**:

- **Promoción MATAI**: tag elegible (`promo-matai`), nombre, unidades
  requeridas (2) y precio fijo del combo ($450.000).
- **Promoción Selección VELMONT**: igual, con `promo-seleccion` y $280.000.

Para que un producto participe, solo agrégale el tag correspondiente. El
carrito lateral detecta automáticamente cuántas unidades elegibles hay,
arma los combos (2 a 2, empezando por las unidades más caras para mostrarle
al cliente el mayor ahorro), y muestra el progreso ("agrega 1 más y
desbloquea tu oferta") cuando falta una unidad.

### ⚠️ Importante: esto es una vista previa del precio, no todavía el cobro real

El carrito lateral calcula y **muestra** el precio con descuento
correctamente. Pero Shopify **no aplica ese descuento en el checkout
automáticamente** solo por este código de tema — el checkout de Shopify
siempre cobra el precio de catálogo salvo que exista una regla de descuento
real configurada del lado de Shopify. Sin esa pieza, un cliente vería
"$450.000" en el carrito pero pagaría el precio normal (~$564.000) en el
checkout, lo cual sería un bug grave en producción.

Antes de lanzar, hay que cerrar esta brecha con **una** de estas dos rutas
(no son necesarias las dos):

1. **Shopify Functions (recomendado si la tienda es Shopify Plus, o si se
   instala vía una app personalizada con acceso a Functions)**: una función
   de descuento que replique exactamente esta misma regla ("2 productos con
   el tag X → precio fijo Y") del lado del servidor, para cualquier
   combinación de productos elegibles. Es la opción más precisa y la que de
   verdad "IMPLEMENTA" la promoción de punta a punta.
2. **Una app de descuentos tipo "mix and match" del App Store** (ej. Bundler,
   Zoorix, Kite, Bold) configurada con las mismas dos reglas. Es la ruta
   práctica para una tienda que no es Shopify Plus y no quiere programar una
   Function — se configura desde el admin, sin código.

Cualquiera de las dos rutas debe apuntar a los mismos tags (`promo-matai`,
`promo-seleccion`) y a los mismos precios fijos configurados aquí, para que
lo que el cliente ve en el carrito coincida con lo que paga en el checkout.

## 4. Navegación y footer

- El menú del header se controla en **Configuración del tema → sección
  Header → "Menú de navegación"** (usa el gestor de menús de Shopify en
  Ventas online → Navegación). Crea un menú con Perfumes, Encuentra tu
  perfume (enlaza a `/#finder`), Ofertas (`/#ofertas`), Marcas (`/#marcas`)
  y Contacto (`/#contacto`).
- El footer tiene sus propios ajustes de sección: descripción de marca, dos
  menús (Navegación / Ayuda), WhatsApp, Instagram y correo de contacto.

## 5. Textos e imágenes editables

Todas las secciones de la portada (hero, invitación al Finder, editorial,
ofertas, destacados) tienen sus textos como ajustes de sección — edítalos
desde el editor de temas sin tocar código.

## 6. Búsqueda y Asesor VELMONT

Ambos interpretan el texto libre por palabras clave contra los tags del
catálogo (ver `assets/assistant.js`) — no hay ningún modelo de IA conectado
todavía. Está aislado en dos funciones (`interpretQuery`, `searchProducts`)
para que, si más adelante se conecta un backend de IA real, sea un solo
punto de cambio.
