# tools/ — utilidades de carga para la demo

Snippets para pegar en la **consola del navegador** (F12) estando logueado como
**Gerente**. Todos usan los repos de la app, así que respetan las Reglas de Oro
(dinero en centavos, magnitud en unidad base, historial de precios, códigos
`PROV-/INS-/REC-`, soft-delete). No tocan saldos, facturas ni pagos.

## Flujo para cargar los datos reales de Green Garden

1. **`borrar-todo-consola.js`** — da de baja (soft-delete `activo:false`) todos los
   proveedores, insumos y recetas actuales, para limpiar lo de prueba. Pide
   confirmación (escribir `BORRAR`).
2. **`cargar-real-consola.js`** — crea los datos reales:
   - **6 proveedores**: El Ave Fénix (almacén/lácteos/quesos), C&B (limpieza),
     Navacerrada (panadería), La Campiña del Sur (verdulería), Olliari (bebidas
     con alcohol) y Heineken (cervezas y sidras).
   - **~134 insumos**: los de las 4 boletas + los 98 de la barra (planilla
     *COSTOS DE BARRA*), con sus costos y presentaciones.
   - **63 recetas**: preparaciones (almíbares, exprimidos, crema, cold brew) +
     cocktelería + limonadas/jugos + cafetería, con ingredientes anidados y
     precio de carta (PVP) desde la pestaña RESUMEN.

   Al terminar recalcula el costo de todas las recetas con el costeo real del app.
3. **`cargar-movimientos-consola.js`** (opcional, para que el Tablero tenga vida) —
   crea facturas en varios estados (impagas, parciales, pagadas) con
   vencimientos vencidos y próximos, sus pagos (imputación FIFO/manual en
   transacción con `increment`), historial de precios retroactivo para ~15
   insumos (para ver la evolución de costos) y marca ~6 insumos con precio "sin
   actualizar". Enciende todos los KPIs y el panel de Alertas del tablero.

Los tres son **idempotentes**: no duplican lo que ya exista (comparan por nombre
sin mayúsculas/acentos; en movimientos, si un proveedor ya tiene facturas de la
demo no le crea más, así no infla la deuda). Se pueden reejecutar.

## Criterios de carga

- **Boletas Factura A** (Ave Fénix, C&B, Navacerrada): el precio unitario es
  **neto**; se guarda con la alícuota de IVA de la boleta, así el "costo c/IVA"
  del app = lo que se paga.
- **Verdulería (La Campiña)**: es una nota de pedido sin IVA discriminado; se
  tomaron los precios como **finales** y se guardó neto = precio/1,105 (IVA
  10,5%). Cada ítem se carga por su unidad de compra (bolsa, cajón, atado, caja,
  unidad); pepino y cherry por kg.
- **Panadería**: el pan se costea **por unidad** (caja ÷ cantidad de panes).
- **Barra**: se replica la planilla (IVA 21% parejo, que es lo que ella usa),
  guardando el neto por unidad base. Unidades de uso: **Oz → ml (1 oz = 30 ml)**,
  **Porción → unidad**, gr → g, cc → ml.

## Notas de validación (app vs planilla)

El app recalcula el costo de cada receta desde el costo real de sus insumos. De
las 63 recetas, **58 coinciden** con la planilla; 5 dan distinto por **errores o
desactualizaciones de la planilla** (el valor del app es el correcto):

| Receta | Planilla | App | Motivo |
|---|--:|--:|---|
| MIXER DE ANANÁ | $54,50 | $207,50 | La planilla costea el ananá con el precio del **agua** (error de fórmula). |
| BROMELIA PUNCH | $1.760,53 | $2.066,62 | Usa MIXER DE ANANÁ (hereda el error). |
| CYNARA | $2.401,96 | $2.620,33 | Usa MIXER DE ANANÁ (hereda el error). |
| SUNSET | $537,31 | $1.049,20 | El total guardado en la planilla quedó desactualizado vs. sus cantidades. |
| JARRA POMELADA | $1.379,47 | $2.113,18 | Ídem: total desactualizado vs. cantidades. |

## `cargar-demo-consola.js`

Plantilla genérica para cargar proveedores/insumos ad-hoc (se edita el bloque
`DATOS`). Sirve para pruebas sueltas; para los datos reales usá el flujo de arriba.
