# Contexto — Cambio de política de costeo (v0.4.0)

> App **Green Garden — Costos y Proveedores** (`green-garden-costos`).
> Documento para **no olvidar** por qué el costeo cambió y dónde tocarlo.

---

## 1. Qué pidió la administración

El gerente administrativo pidió que el costo de los insumos **NO** descuente el
IVA como crédito fiscal. Que se costee por el **precio final que el restaurante
le paga al proveedor** (IVA incluido), sin importar el tipo de factura.

## 2. Cómo era antes

El sistema es Responsable Inscripto, así que costeaba en **neto**: si la factura
era **A** (de un Responsable Inscripto), el IVA se tomaba como **crédito fiscal
recuperable** y **no** era costo. Solo cuando no había IVA discriminado
(Factura C de monotributista) el importe completo era costo.

```
// ANTES (core/costeo.js)
const recuperaIVA = recuperaCreditoFiscal(tipoComprobante, proveedor.condicion_fiscal);
const base = recuperaIVA ? neto : neto * (1 + alicuota/100);
```

## 3. Cómo es ahora (v0.4.0)

**El IVA es costo, siempre.** El costo se calcula por el precio final:

```
// AHORA (core/costeo.js → costoRealPorUnidadBase)
const base = neto * (1 + alicuota_iva/100);   // precio final con IVA
return base / factor_correccion;
```

- El tipo de comprobante (A/B/C) y la condición fiscal del proveedor **ya no
  afectan el costo**. Los parámetros siguen en la firma por compatibilidad,
  pero se ignoran.
- Vale para insumos y, en cascada, para todas las recetas/escandallos.

## 4. Qué NO cambió (importante)

- **Las facturas siguen guardando el desglose neto / IVA / percepciones /
  total.** Eso es realidad fiscal (AFIP) y la cuenta corriente del proveedor lo
  necesita. Solo cambió **cómo se costea**, no cómo se registran las facturas.
- **`core/fiscal.js` queda intacto** (calcularIVA, netoATotal, desglosarFactura,
  validarCuadratura, recuperaCreditoFiscal). `recuperaCreditoFiscal` ya no se
  usa en el costeo, pero se conserva por si se vuelve al criterio anterior.
- **El precio de venta / food cost % NO se tocó** (ver punto 6).

## 5. Dónde están los cambios

- `js/core/costeo.js` → `costoRealPorUnidadBase` (el cambio central).
- `test/costeo.test.js` → tests actualizados a la nueva política.
- `js/ui/escandallos.js` y `js/ui/dashboard.js` → etiquetas: "Costo neto" →
  "Costo (c/IVA)" en las pantallas de recetas (el costo ahora incluye IVA).
- `js/store.js` y `docs/especificacion-v2.md` (Sección 3.2) → notas aclaratorias.
- `js/ui/insumos.js` **no** cambió: ahí se sigue mostrando y cargando el
  **costo neto por unidad base** (el valor guardado sigue siendo el neto; el
  IVA se agrega recién al costear).

## 6. Efecto en el food cost % (a tener en cuenta)

Como el **costo** ahora es más alto (incluye IVA) pero el **food cost %** se
sigue calculando contra el **precio de venta NETO**, el food cost % que muestra
la app va a dar **más alto** que antes.

Si en algún momento se quiere que quede coherente "todo con IVA", habría que
comparar el costo (con IVA) contra el **precio de carta final** (con IVA) en
`rentabilidad()` / `precioSugerido()` (core/costeo.js). **No se hizo** porque la
administración solo pidió cambiar el costo. Es un cambio de una línea si lo
piden.

## 7. Cómo volver atrás (si cambian de idea)

En `core/costeo.js`, reponer en `costoRealPorUnidadBase` la rama con
`recuperaCreditoFiscal(tipoComprobante, proveedor.condicion_fiscal)` y volver a
importar esa función desde `core/fiscal.js`. Los tests viejos están en el
historial de git (v0.3.0).

## 8. Recalcular costos ya guardados

Los costos de receta se recalculan **en vivo** en las pantallas (Dashboard y
Costos), así que se ven correctos apenas se despliega. El campo guardado
`costo_calculado_centavos` de cada receta se actualiza la próxima vez que se
edita/guarda esa receta.

## 9. Deploy

```bash
firebase deploy --only hosting
# (esta versión no cambia firestore.rules; con --only hosting alcanza)
```
Verificá que diga `=== Deploying to 'green-garden-costos'...`.
