# Documento de Especificación Técnica y Funcional — v2.0
## Sistema de Control de Costos, Cuentas Corrientes y Rentabilidad Gastronómica
### Cliente: Restaurant Green Garden

> **Nota para el implementador:** este documento reemplaza a la v1.0. Los cambios de la v2.0 no son cosméticos: modifican el modelo de datos y la lógica de cálculo. Leer completa la **Sección 3 (Reglas de Oro)** antes de escribir una sola línea de código. Si algo del código contradice esas reglas, el código está mal.

---

## 1. Resumen del Proyecto

Aplicación web para la gestión gastronómica de Green Garden, orientada a tres objetivos:

1. **Control de costos de materia prima** con historial de precios y unidades normalizadas.
2. **Gestión de cuentas corrientes de proveedores** con facturas, pagos parciales e imputación automática.
3. **Análisis de rentabilidad por plato** mediante escandallos (recetas) con recálculo automático.

Es una aplicación **informativa de gestión**. No mueve dinero real ni emite comprobantes fiscales.

**Condición fiscal del cliente: RESPONSABLE INSCRIPTO.** Este dato es determinante para toda la lógica de costeo (ver Sección 3.2).

---

## 2. Alcance del Sistema

### 2.1. In Scope

* **Proveedores y Cuentas Corrientes**
  * Registro de proveedores con datos de contacto, CUIT y condición fiscal.
  * Carga de facturas con desglose fiscal (neto, IVA, percepciones, total).
  * Registro de pagos parciales o totales con fecha y método.
  * Imputación automática (FIFO) o manual de pagos a facturas pendientes.
  * Anulación de pagos por contraasiento.
  * Dashboard de deuda consolidada por proveedor y global.
* **Insumos / Materia Prima**
  * Registro con **unidad base normalizada** y presentación de compra.
  * Alícuota de IVA por insumo.
  * Factor de corrección (rendimiento neto tras limpieza/desposte).
  * Historial cronológico de cambios de precio.
  * Alerta de precios desactualizados.
* **Escandallos / Recetas**
  * Recetas compuestas por insumos **y/o sub-recetas** (preparaciones intermedias).
  * Recálculo automático del costo al cambiar cualquier insumo.
  * Cálculo de food cost %, margen bruto en $ y precio sugerido.
* **Reportes**
  * Exportación a Excel (`.xlsx`) vía SheetJS.
  * Impresión a PDF vía `window.print()` + hoja de estilos `@media print`.
* **Infraestructura**
  * Firebase Cloud Firestore, Hosting y Authentication.

### 2.2. Out of Scope

* ❌ No procesa dinero real ni integra pasarelas de pago.
* ❌ No emite facturación electrónica ni integra con AFIP/ARCA.
* ❌ No gestiona inventario/stock físico ni descuento por ventas.
* ❌ No funciona como Punto de Venta (POS).
* ❌ No gestiona mermas operativas. **Excepción:** sí contempla el `factor_correccion` por insumo, que es un dato estático de rendimiento, no una gestión de mermas.

---

## 3. Reglas de Oro (No Negociables)

Estas reglas son la columna vertebral del sistema. Cualquier decisión de implementación se subordina a ellas.

### 3.1. Toda magnitud física se almacena en unidad base

Nunca se guarda un costo "por kilo" o "por bidón". Se guarda **siempre por unidad base**:

| Magnitud | Unidad base | Ejemplos de presentación de compra |
|---|---|---|
| Masa | gramo (`g`) | Bolsa 25 kg, caja 12×400 g |
| Volumen | mililitro (`ml`) | Bidón 5 L, botella 750 ml |
| Unidad | unidad (`un`) | Cajón 30 un, docena |

La presentación de compra existe **solo para la UI y la conversión**. La lógica de negocio jamás la usa para calcular.

**Motivo:** evita errores de factor 1000 (comprás en kg, usás en g) que son silenciosos y catastróficos.

### 3.2. El escandallo vive 100 % en NETO (sin IVA)

> ⚠️ **ACTUALIZACIÓN 2026-08 — Costeo por PRECIO FINAL (con IVA).**
> Por decisión de la administración del restaurante, el costeo **ya NO
> descuenta el IVA como crédito fiscal**: los insumos y recetas se costean por
> el **precio final pagado al proveedor, con IVA incluido**, sea Factura A, B
> o C. En la práctica `costoRealPorUnidadBase` siempre hace
> `neto * (1 + alícuota/100)`. Las **facturas** siguen guardando el desglose
> neto/IVA/total (realidad fiscal para AFIP); esto solo cambia el **costeo**.
> El texto original de esta sección se conserva como referencia histórica del
> criterio anterior (por si se quisiera volver a él). Ver `core/costeo.js` y
> `CONTEXTO-COSTEO.md`.

Green Garden es **Responsable Inscripto**, por lo tanto el IVA de compras es **crédito fiscal recuperable, no es costo**.

* **Costo de insumos → NETO.**
* **Precio de venta en el cálculo → NETO** (se deriva del precio de carta).
* **El IVA aparece únicamente en dos lugares:**
  1. La cuenta corriente del proveedor (se debe el **total con IVA**).
  2. El precio de carta que ve el comensal (**con IVA incluido**).

**Excepción crítica — Factura C:** si el proveedor es monotributista y emite **Factura C**, no hay IVA discriminado y por lo tanto **no hay crédito fiscal**. En ese caso el importe completo **sí es costo**. Es el caso típico del verdulero o el pescadero chico. Ignorar esto subestima el costo entre 10,5 % y 21 %.

**Nunca mezclar bases.** Como las alícuotas varían (21 % general, 10,5 % para muchos alimentos), el error no se compensa y se vuelve impredecible plato por plato.

### 3.3. El dinero se almacena como entero en centavos

`0.1 + 0.2 !== 0.3` en JavaScript. Todos los importes se guardan como **enteros en centavos** (`$6.800,00` → `680000`). La conversión a decimal ocurre solo en la capa de presentación, a través de helpers centralizados.

### 3.4. Los movimientos contables no se editan: se anulan

Un pago mal cargado **nunca se edita ni se borra**. Se anula generando un contraasiento que revierte las imputaciones. Esto garantiza trazabilidad y que los saldos siempre cierren.

### 3.5. Toda operación multi-documento va en transacción

Imputar un pago toca N facturas + el proveedor. Si se hace con escrituras sueltas y falla una, los saldos quedan corruptos. Se usa `runTransaction()` o `writeBatch()`, y los saldos se actualizan con `increment()` atómico — **nunca** leer-sumar-escribir.

### 3.6. Las Firestore Rules SON el backend

La app es 100 % frontend. La validación en JavaScript es **solo UX**: cualquiera abre la consola del navegador y escribe directo contra Firestore. Toda regla de integridad crítica debe estar duplicada en `firestore.rules`.

### 3.7. Nada se borra físicamente

Soft delete en todas las colecciones (`activo: true/false`). Borrar un proveedor o un insumo con historial rompe la trazabilidad de facturas y escandallos pasados.

---

## 4. Stack Tecnológico

* **Frontend**
  * HTML5 semántico.
  * CSS3 puro: CSS Variables, Flexbox, Grid. Sin frameworks UI.
  * JavaScript ES6+ vanilla, en módulos nativos (`type="module"`).
* **Backend as a Service**
  * Firebase Cloud Firestore (NoSQL).
  * Firebase Hosting (SSL gratuito).
  * Firebase Authentication (email/password).
* **Librerías vía CDN**
  * **SheetJS (`xlsx.full.min.js`)** — exportación a Excel.

### 4.1. Librerías eliminadas respecto de la v1.0

* ❌ **html2pdf.js** y **jsPDF** — se eliminan ambas. Eran dos librerías para la misma tarea. Los reportes en PDF se generan con `window.print()` + una hoja `@media print` bien construida: pesa 0 KB, respeta el CSS del proyecto y produce mejor tipografía que un canvas rasterizado.

### 4.2. Estrategia de lectura de datos

**No usar `onSnapshot` por defecto.** Con 1–3 usuarios concurrentes, el tiempo real no aporta valor y multiplica el costo de lecturas (Firestore factura por documento leído).

* **Por defecto:** `getDocs()` + caché en memoria, con botón de refresco manual.
* **Excepción:** habilitar `onSnapshot` solo en la pantalla de Cuenta Corriente si se confirma que dos personas cargan facturas simultáneamente.

---

## 5. Modelo de Datos (Cloud Firestore)

> **Convención de IDs:** todas las colecciones usan **auto-ID de Firestore**. El identificador legible va en un campo `codigo` aparte. Los IDs semánticos tipo `ins_q_mozzarella` de la v1.0 quedan descartados (colisionan y se rompen al renombrar).

> **Convención de fechas:** todas las fechas usan `Timestamp` de Firestore. Nunca strings ISO ni date-only.

> **Campos de auditoría:** todas las colecciones incluyen `activo`, `creado_en`, `creado_por`, `modificado_en`, `modificado_por`.

### 5.1. Colección `proveedores`

```json
{
  "codigo": "PROV-001",
  "nombre": "Distribuidora Lácteos del Sur",
  "cuit": "30-12345678-9",
  "condicion_fiscal": "responsable_inscripto",
  "contacto": "Juan Pérez",
  "telefono": "+54 221 555-0192",
  "email": "ventas@lacteosdelsur.com",
  "saldo_total_deuda_centavos": 18500000,
  "activo": true,
  "creado_en": "<Timestamp>",
  "creado_por": "<uid>",
  "modificado_en": "<Timestamp>",
  "modificado_por": "<uid>"
}
```

`condicion_fiscal`: `"responsable_inscripto" | "monotributo" | "exento"`

### 5.2. Colección `insumos`

```json
{
  "codigo": "INS-0042",
  "nombre": "Queso Mozzarella Barra",
  "magnitud": "masa",
  "unidad_base": "g",
  "costo_neto_por_unidad_base_centavos": 680,
  "alicuota_iva": 21,
  "factor_correccion": 1.0,
  "presentacion_compra": {
    "descripcion": "Barra 5 kg",
    "cantidad_base": 5000,
    "precio_neto_centavos": 3400000
  },
  "proveedor_habitual_id": "<docId>",
  "fecha_ultimo_precio": "<Timestamp>",
  "activo": true
}
```

* `magnitud`: `"masa" | "volumen" | "unidad"`
* `costo_neto_por_unidad_base_centavos`: costo **sin IVA** por gramo/ml/unidad.
* `factor_correccion`: rendimiento neto tras limpieza. `1.0` = sin pérdida. Ejemplo: lomo con `0.78` significa que de 1000 g comprados quedan 780 g útiles, por lo que el costo real del gramo útil es `costo / 0.78`.

### 5.3. Subcolección `insumos/{id}/historial_precios`

```json
{
  "costo_anterior_centavos": 640,
  "costo_nuevo_centavos": 680,
  "variacion_porcentual": 6.25,
  "fecha": "<Timestamp>",
  "origen": "factura",
  "factura_id": "<docId>",
  "usuario": "<uid>"
}
```

`origen`: `"factura" | "manual" | "carga_inicial"`

Esta subcolección alimenta el gráfico de evolución de precios y la alerta de precios desactualizados. Con la inflación local, es de lo más valioso que va a tener la app.

### 5.4. Colección `facturas`

```json
{
  "proveedor_id": "<docId>",
  "tipo_comprobante": "A",
  "numero_factura": "A-0002-000841",
  "fecha_emision": "<Timestamp>",
  "fecha_vencimiento": "<Timestamp>",
  "neto_gravado_centavos": 20661157,
  "iva_discriminado_centavos": 4338843,
  "percepciones_centavos": 0,
  "monto_total_centavos": 25000000,
  "saldo_pendiente_centavos": 6500000,
  "estado": "parcial",
  "observaciones": "Entrega de lácteos semanal",
  "activo": true
}
```

* `tipo_comprobante`: `"A" | "B" | "C"`
* `estado`: `"pendiente" | "parcial" | "pagada" | "anulada"`
* **`neto_gravado_centavos`** alimenta el costeo de insumos.
* **`monto_total_centavos`** alimenta la cuenta corriente y los pagos.
* **Nunca se cruzan.**

**Sobre las percepciones:** las percepciones de IVA e Ingresos Brutos aparecen habitualmente en facturas de distribuidoras grandes. Forman parte de lo que se paga (van al saldo de deuda) pero **no son costo ni crédito fiscal** — son anticipos de impuesto. Si no se modelan, el saldo de deuda no cierra contra el resumen de cuenta del proveedor.

**Validación obligatoria al guardar:**
`neto_gravado + iva_discriminado + percepciones === monto_total`
Si no coincide, bloquear el guardado y mostrar la diferencia. Este chequeo atrapa la mayoría de los errores de tipeo.

### 5.5. Colección `pagos`

```json
{
  "proveedor_id": "<docId>",
  "fecha_pago": "<Timestamp>",
  "monto_pagado_centavos": 18500000,
  "metodo_pago": "transferencia",
  "referencia": "Transf. Galicia 0084512",
  "modo_imputacion": "fifo",
  "facturas_afectadas": [
    { "factura_id": "<docId>", "monto_imputado_centavos": 12000000 },
    { "factura_id": "<docId>", "monto_imputado_centavos": 6500000 }
  ],
  "estado": "activo",
  "anula_a_pago_id": null,
  "anulado_por_pago_id": null,
  "creado_en": "<Timestamp>",
  "creado_por": "<uid>"
}
```

* `estado`: `"activo" | "anulado"`
* `modo_imputacion`: `"fifo" | "manual"`
* `metodo_pago`: `"efectivo" | "transferencia" | "cheque" | "echeq" | "otro"`

**Anulación:** genera un nuevo documento de pago con `monto_pagado_centavos` negativo y `anula_a_pago_id` apuntando al original. El original pasa a `estado: "anulado"` y registra `anulado_por_pago_id`. Ambas escrituras + la reversión de saldos van en la misma transacción.

### 5.6. Colección `recetas`

Reemplaza a `platos` de la v1.0. Una receta puede ser un **plato final** (se vende) o una **preparación intermedia** (se usa dentro de otras recetas).

```json
{
  "codigo": "REC-0007",
  "nombre": "Pizza Margherita Extra",
  "tipo": "plato",
  "rendimiento_cantidad": 1,
  "rendimiento_unidad": "un",
  "precio_venta_publico_centavos": 1250000,
  "alicuota_venta": 21,
  "ingredientes": [
    { "tipo": "insumo", "ref_id": "<docId>", "cantidad": 250 },
    { "tipo": "insumo", "ref_id": "<docId>", "cantidad": 220 },
    { "tipo": "receta", "ref_id": "<docId>", "cantidad": 120 }
  ],
  "costo_calculado_centavos": 148500,
  "fecha_calculo": "<Timestamp>",
  "activo": true
}
```

* `tipo`: `"plato" | "preparacion"`
* `rendimiento_*`: cuánto produce la receta. Para una salsa: `4000 ml`. Para un plato: normalmente `1 un`. **Es imprescindible para poder usar una preparación como ingrediente** (el costo por ml de la salsa = costo total de la salsa / rendimiento).
* `precio_venta_publico_centavos` y `alicuota_venta` solo aplican si `tipo === "plato"`.
* `cantidad` se expresa siempre en la unidad base del ingrediente referenciado.
* `costo_calculado_centavos` es un **snapshot desnormalizado**: evita recorrer 200 insumos en cada render del dashboard. Se recalcula en vivo al editar la receta, y por lote cuando cambia un insumo.

**Sub-recetas:** son recursivas. Al guardar hay que **detectar ciclos** (receta A usa B, B usa C, C usa A) y rechazar el guardado. Sugerencia: limitar la profundidad a 4 niveles y validar con DFS antes de escribir.

---

## 6. Lógica de Negocio y Algoritmos

### 6.1. Costo real de un insumo

Función única, centralizada, usada en todo el sistema:

```js
/**
 * Devuelve el costo REAL por unidad base útil, en centavos.
 * Contempla crédito fiscal y factor de corrección.
 */
function costoRealPorUnidadBase(insumo, proveedor, tipoComprobante) {
  const recuperaIVA = tipoComprobante === 'A'
                   && proveedor.condicion_fiscal === 'responsable_inscripto';

  const base = recuperaIVA
    ? insumo.costo_neto_por_unidad_base_centavos
    : insumo.costo_neto_por_unidad_base_centavos * (1 + insumo.alicuota_iva / 100);

  // El factor de corrección encarece el gramo útil
  return base / (insumo.factor_correccion || 1);
}
```

### 6.2. Costo de una receta (recursivo)

```
costoReceta(receta):
  total = 0
  para cada ingrediente:
    si tipo === "insumo":
      total += cantidad × costoRealPorUnidadBase(insumo, ...)
    si tipo === "receta":
      subCosto = costoReceta(subReceta)            // recursión
      costoUnitarioSub = subCosto / subReceta.rendimiento_cantidad
      total += cantidad × costoUnitarioSub
  return total
```

Cachear resultados de sub-recetas dentro de un mismo ciclo de cálculo para no recalcular la misma salsa seis veces.

### 6.3. Rentabilidad

```js
const precioNetoCentavos = plato.precio_venta_publico_centavos / (1 + plato.alicuota_venta / 100);
const foodCostPct       = (costoRecetaCentavos / precioNetoCentavos) * 100;
const margenBrutoCentavos = precioNetoCentavos - costoRecetaCentavos;
```

**Definición canónica:** la métrica principal del sistema es el **food cost %** = costo neto / precio de venta neto. Es el estándar de la industria gastronómica.

Si además se muestra markup (costo × factor), etiquetarlo explícitamente como algo distinto para no confundir al usuario.

**Regla de UI:** nunca mostrar un porcentaje suelto. Mostrar siempre los tres números juntos y etiquetados — **costo neto**, **precio neto**, **food cost %** — con el precio de carta con IVA como referencia. Un porcentaje sin base visible genera desconfianza en el sistema.

### 6.4. Imputación de pagos (FIFO)

Dentro de una **única transacción**:

1. Obtener facturas del proveedor con `saldo_pendiente_centavos > 0` y `estado != "anulada"`, ordenadas por `fecha_emision` ascendente.
2. Iterar descontando del monto del pago hasta agotarlo, registrando cada imputación en `facturas_afectadas`.
3. Actualizar `estado` de cada factura tocada (`parcial` o `pagada`).
4. Actualizar `saldo_total_deuda_centavos` del proveedor con `increment(-monto)`.
5. Si sobra dinero tras cubrir todas las facturas, registrar el excedente como saldo a favor y **avisar al usuario** — no descartarlo silenciosamente.

El modo manual permite al usuario elegir a qué facturas imputar; el resto de la lógica es idéntica.

### 6.5. Actualización de costos por cambio de precio

Al modificar el costo de un insumo (manual o al cargar factura):

1. Escribir el registro en `insumos/{id}/historial_precios`.
2. Actualizar `costo_neto_por_unidad_base_centavos` y `fecha_ultimo_precio`.
3. Buscar todas las recetas que referencian ese insumo (directa o indirectamente) y recalcular su `costo_calculado_centavos`.
4. Si alguna receta cruza un umbral de food cost configurable (ej. 35 %), listarla en las alertas del dashboard.

### 6.6. Alerta de precios desactualizados

Regla: si `fecha_ultimo_precio` de un insumo tiene más de **N días** (configurable, sugerido 30), marcarlo visualmente y sumarlo al panel de alertas del dashboard con el mensaje: *"El costo de este insumo no se actualiza hace X días. La rentabilidad mostrada puede ser optimista."*

---

## 7. Pantallas y Módulos (UX/UI)

### 7.1. Dashboard
* Deuda total consolidada + top 5 proveedores por deuda.
* Facturas próximas a vencer.
* Platos con peor food cost %.
* Panel de alertas: precios desactualizados, recetas sobre el umbral.

### 7.2. Proveedores
* Listado con saldo.
* Ficha: datos fiscales, cuenta corriente, botón "Registrar pago".
* Carga de factura con **cálculo bidireccional neto ↔ total** (ver 7.5).
* Historial de pagos con opción de anular.

### 7.3. Insumos
* Listado con costo por unidad base, alícuota, última actualización.
* Ficha: gráfico de evolución de precios, presentación de compra, factor de corrección.
* Actualización rápida de precio.

### 7.4. Escandallos
* Listado de recetas separadas por `tipo` (platos / preparaciones).
* Editor de receta con buscador de ingredientes (insumos y preparaciones).
* Panel de rentabilidad en vivo: costo neto, precio neto, food cost %, margen $.
* Calculadora inversa: "¿a cuánto tengo que vender esto para un food cost del 30 %?"
* Ficha técnica imprimible.

### 7.5. Detalle de UX crítico — Carga de facturas

Al cargar una factura, el usuario tiene el papel en la mano y ve el **total**. No obligarlo a calcular el neto mentalmente.

* Dos campos con **cálculo bidireccional**: escribe el neto → se completa el total; escribe el total → se completa el neto.
* Selector de alícuota (21 % / 10,5 % / mixta).
* Campo de percepciones.
* Validación contra el total impreso, con la diferencia visible si no cierra.

---

## 8. Seguridad — Firestore Rules

Como la app es 100 % frontend, las reglas son la única barrera real. Mínimo exigible:

* Toda lectura y escritura requiere `request.auth != null`.
* Validar tipos y rangos: importes enteros y `>= 0`, `alicuota_iva` dentro de valores permitidos, enums válidos para `estado`, `tipo_comprobante` y `condicion_fiscal`.
* Prohibir la escritura directa de `saldo_total_deuda_centavos` fuera del flujo de pagos.
* Prohibir el `delete` en todas las colecciones (el borrado es lógico, vía `activo: false`).
* Impedir modificar documentos de `pagos` con `estado: "anulado"`.

---

## 9. Estructura de Archivos Sugerida

```
/
├── index.html
├── firebase.json
├── .firebaserc
├── firestore.rules
├── /css
│   ├── variables.css
│   ├── base.css
│   ├── componentes.css
│   └── print.css              ← hoja @media print para reportes
├── /js
│   ├── app.js                 ← bootstrap y router
│   ├── /config
│   │   └── firebase.js
│   ├── /core
│   │   ├── dinero.js          ← helpers de centavos, redondeo y formato
│   │   ├── unidades.js        ← conversiones a unidad base
│   │   ├── fiscal.js          ← IVA, crédito fiscal, neto ↔ total
│   │   └── costeo.js          ← costoRealPorUnidadBase, costoReceta, food cost
│   ├── /data
│   │   ├── proveedoresRepo.js
│   │   ├── insumosRepo.js
│   │   ├── facturasRepo.js
│   │   ├── pagosRepo.js
│   │   └── recetasRepo.js
│   ├── /ui
│   │   ├── dashboard.js
│   │   ├── proveedores.js
│   │   ├── insumos.js
│   │   └── escandallos.js
│   └── /export
│       └── excel.js           ← SheetJS
```

**Separación de responsabilidades:** `/core` no conoce Firebase, `/data` no conoce el DOM, `/ui` no calcula. Esto permite testear la lógica de costeo sin levantar la app.

---

## 10. Orden de Construcción

El scope completo es grande para arrancar de una sola vez. Construir en este orden:

| # | Módulo | Por qué en este orden |
|---|---|---|
| 1 | **Core** (`dinero`, `unidades`, `fiscal`) | Son los cimientos. Si esto queda mal, se cae todo lo demás. |
| 2 | **Insumos** + historial | Alimentan todo el costeo. |
| 3 | **Escandallos** + rentabilidad | Es la parte que más impacto genera en la demo. |
| 4 | **Proveedores** + facturas | Independiente de lo anterior salvo por el neto. |
| 5 | **Pagos** + imputación FIFO | Lo más delicado; requiere que facturas ya funcione. |
| 6 | **Dashboard** + exportación | Depende de que todo lo demás exista. |

Con los pasos 1–3 ya hay algo mostrable y útil para Green Garden, que es mejor que seis módulos a medio hacer.

---

## 11. Despliegue en Firebase Hosting (Windows)

> Método probado. Evita los errores de política de ejecución de PowerShell y de login en localhost.

1. **Antes de tocar el CLI**, inicializar Hosting desde la consola web de Firebase: *Build > Hosting > Get Started*. Sin este paso aparece el error `resolving hosting target with no site name`.
2. Descargar el `firebase.exe` portable desde `https://firebase.tools/bin/win/instant/latest` y colocarlo en la raíz del proyecto.
3. Crear `.firebaserc` con el project ID por defecto y `firebase.json` con `public: "."`.
4. **Agregar `firebase.exe` a la lista de `ignore`** en `firebase.json` — de lo contrario el plan Spark rechaza el deploy con HTTP 400 *"Executable files forbidden"*.
5. Ejecutar `firebase.exe` (aceptar el aviso de SmartScreen), luego `firebase login` y `firebase deploy`.

```json
// firebase.json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "firebase.exe",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

---

## 12. Advertencia Profesional

Este documento describe **lógica de costeo**, no asesoramiento impositivo. Antes de que la dirección de Green Garden tome decisiones de precio con estos números, el contador del establecimiento debe validar las alícuotas de IVA de los insumos principales. Hay alimentos con tratamientos particulares (leche fluida, pan común, entre otros) que conviene confirmar caso por caso.

---

*Versión 2.0 — Documento de especificación para implementación.*
