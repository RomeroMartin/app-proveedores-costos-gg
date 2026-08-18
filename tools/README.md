# tools/ — utilidades de carga para la demo

## `cargar-demo-consola.js`

Snippet para **cargar proveedores, productos (insumos) y sus costos** de una
sola vez en la demo, leyendo los datos de las boletas de proveedores.

### Uso

1. Entrá a la app y logueate con un usuario **Gerente**.
2. Abrí la consola del navegador (**F12 → Consola**).
3. Abrí `tools/cargar-demo-consola.js`, editá el bloque **`DATOS`** con lo que
   figura en las boletas y copiá **todo** el archivo.
4. Pegalo en la consola y Enter. Al terminar muestra un resumen
   (`+N proveedores`, `+N insumos`, errores).
5. Refrescá las pantallas **Proveedores** e **Insumos** para verlos.

### Qué hace y qué respeta

- Usa los mismos repos de la app (`proveedoresRepo`, `insumosRepo`), así que
  cumple las Reglas de Oro: dinero en **centavos**, magnitud en **unidad base**,
  el insumo guarda el **costo neto por unidad base** y queda su registro inicial
  en `historial_precios`. Los códigos `PROV-00X` / `INS-00X` se generan solos.
- **Idempotente**: si el proveedor o el insumo ya existe (mismo nombre, sin
  distinguir mayúsculas/acentos) no lo duplica. Se puede reejecutar sin miedo.
- **No** toca saldos, facturas ni pagos.

### Campos por producto

| Campo | Valores |
|---|---|
| `magnitud` | `masa` · `volumen` · `unidad` |
| `presentacion.unidad` | masa: `g` `kg` `mg` · volumen: `ml` `l` `cc` · unidad: `un` `docena` `ciento` |
| `alicuota_iva` | `0` · `10.5` · `21` · `27` |
| `precio` | precio de la presentación según la boleta (admite `"34.000,00"`) |
| `iva_incluido` | `true` si el precio de la boleta ya trae IVA (se convierte a neto); `false` si ya es neto |
| `rubro` | uno del catálogo en `js/core/rubros.js` |
| `factor_correccion` | opcional (merma/rendimiento), default `1` |

> El insumo se guarda en **neto** (el IVA se agrega recién al costear, ver
> `CONTEXTO-COSTEO.md`). Por eso, si la boleta muestra el total con IVA, poné
> `iva_incluido: true` y el snippet lo pasa a neto solo.
