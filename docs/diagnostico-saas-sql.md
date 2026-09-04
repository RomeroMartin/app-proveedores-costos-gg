# Diagnóstico — Adaptación de `app-proveedores-costos-gg` como módulo del SaaS Gastronómico (SQL)

> **Objetivo del documento:** evaluar el estado actual de esta app y trazar el
> camino para convertirla en un **módulo** del *SaaS de Gestión Administrativa,
> Rentabilidad e Inventario Gastronómico*, re-plataformado de **Firestore
> (NoSQL) a PostgreSQL (SQL / Supabase)** y con **multi-tenancy real**.
>
> Documento de referencia del SaaS: `SaaS_Gastronomico_Especificacion_SQL.md`.
> Este diagnóstico **no cambia código todavía**: es el plano previo.

---

## 0. TL;DR (resumen ejecutivo)

- La app **ya resuelve, y bien, las Fases 2, 3 y 4** del SaaS (Proveedores y
  Cuentas por Pagar, Insumos y Costos, Rentabilidad y Escandallos). En varios
  puntos es **más sofisticada** que el DDL propuesto en la especificación.
- Su **arquitectura por capas** (`core` / `data` / `ui`) es el gran activo:
  **`core/` migra tal cual** (no conoce ni Firebase ni el DOM), y solo hay que
  **reescribir `data/`** para hablar SQL en lugar de Firestore.
- Los **dos huecos grandes** frente al SaaS son estructurales, no de detalle:
  1. **Multi-tenancy**: hoy la app es **mono-empresa** (un solo restaurante,
     sin `empresa_id` ni `sucursal_id` en ningún lado). El SaaS exige aislar
     por `empresa_id` con RLS.
  2. **Fase 5 (Inventario, sectores, movimientos y ventas)**: hoy está
     **fuera de alcance** por diseño. Es desarrollo nuevo.
- **Buena noticia para el perfil "100 % frontend sin backend":**
  **Supabase = SQL + Auth + RLS como servicio**, igual que Firebase pero
  relacional. Se puede conservar el modelo *frontend-only*, y además **cerrar
  el agujero de seguridad que hoy las Firestore Rules admiten** (ver §6),
  moviendo las operaciones sensibles a **funciones PostgreSQL (RPC)**.
- **Decisiones que requieren tu confirmación antes de codear** (ver §8):
  representación del dinero (centavos enteros vs `NUMERIC`), política de IVA
  por empresa, y cómo modelar la imputación pago↔factura (la spec la simplifica
  de más y perdería una funcionalidad que la app ya tiene).

---

## 1. Qué es hoy la app (estado actual)

| Dimensión | Estado |
|---|---|
| **Producto** | "Green Garden — Costos, Proveedores y Rentabilidad". App **informativa de gestión** (no mueve dinero real ni factura a AFIP). |
| **Stack** | HTML5 + CSS puro + **JS ES6 vanilla (módulos nativos)**. Backend: **Firebase** (Firestore NoSQL, Auth email/password, Hosting). SheetJS por CDN para export. |
| **Tenancy** | **Mono-tenant.** Un solo restaurante por proyecto Firebase. **No existe `empresa_id` ni `sucursal_id`** en el modelo. El "aislamiento" es tener un proyecto Firebase por cliente. |
| **Arquitectura** | 3 capas estrictas: **`core/`** (lógica pura y testeada), **`data/`** (repos Firestore, transacciones), **`ui/`** (DOM). Regla: *core no conoce Firebase; data no conoce el DOM; ui no calcula*. |
| **Seguridad** | `firestore.rules` como "backend": valida tipos/rangos/enums, prohíbe borrado físico, ancla al dueño por email. **Reconoce un límite**: no puede blindar `saldo_total_deuda_centavos` porque las transacciones corren en el cliente. |
| **Roles** | Dos: **Gerente** (todo) y **Cargador** (carga operativa). |
| **Tests** | `node --test` sobre `core/` (dinero, unidades, fiscal, costeo). |

### 1.1 Reglas de Oro vigentes (impactan la migración)

1. Toda magnitud física se guarda en **unidad base** (`g`/`ml`/`un`).
2. El dinero se guarda como **entero en centavos** (evita el error de punto flotante de JS).
3. Los movimientos contables **no se editan: se anulan** por contraasiento.
4. Toda operación multi-documento va en **transacción** con incremento atómico.
5. **Nada se borra físicamente** (soft delete `activo: false`).
6. Política de costeo (2026-08): se costea por **precio final CON IVA** (el IVA
   dejó de tratarse como crédito fiscal recuperable en el costeo, aunque las
   facturas siguen guardando el desglose neto/IVA/total para la realidad fiscal).

Estas reglas son **buenas prácticas que hay que preservar** en SQL, no
obstáculos. Varias son *más fáciles* de cumplir en Postgres que en Firestore
(ver §5).

---

## 2. Mapa app actual ↔ Fases del SaaS

| Fase del SaaS | ¿La app la cubre? | Detalle |
|---|---|---|
| **Fase 1 — Core Multi-Tenant & Seguridad** | ⚠️ **Parcial / mono-tenant** | Tiene Auth, usuarios y 2 roles, pero **sin `empresas`, sin `sucursales`, sin `empresa_id`**. Falta todo el modelo multi-tenant y RLS por empresa. |
| **Fase 2 — Proveedores & Cuentas por Pagar** | ✅ **Cubierta (y superada)** | Proveedores, facturas con **desglose fiscal** (neto/IVA/percepciones), pagos con **imputación FIFO/manual** y **anulación por contraasiento**. Más rico que el DDL de la spec. |
| **Fase 3 — Insumos & Costos Técnicos** | ✅ **Cubierta (y superada)** | Insumos con **unidad base normalizada**, presentación de compra, **factor de corrección**, alícuota de IVA e **historial de precios**. |
| **Fase 4 — Rentabilidad, Escandallos & Recetas** | ✅ **Cubierta** | Recetas (platos/preparaciones), **sub-recetas recursivas con detección de ciclos**, costo desnormalizado con recálculo por lote, food cost %, margen, precio sugerido. |
| **Fase 5 — Inventario, Sectores, Movimientos & Ventas** | ❌ **No cubierta (out of scope)** | La spec v2 excluye explícitamente stock físico, mermas operativas, POS y explosión de recetas por venta. Es **desarrollo nuevo**. |

**Conclusión de posicionamiento:** esta app es, casi exactamente, el
**"Módulo de Compras, Costos y Rentabilidad"** del SaaS (Fases 2+3+4). La
adaptación consiste en **envolverlo en la Fase 1 (multi-tenant)** y dejar
**ganchos** hacia la Fase 5 (el inventario consume insumos, recetas y facturas
que este módulo ya produce).

---

## 3. NoSQL → SQL: diferencias de modelo que hay que resolver

Firestore es documental; PostgreSQL es relacional. Lo que en la app son
**documentos con arrays embebidos**, en SQL se **normaliza en tablas hijas**.

| Patrón en la app (Firestore) | Equivalente correcto en SQL |
|---|---|
| Auto-ID de documento + campo `codigo` legible | `id UUID DEFAULT uuid_generate_v4()` (PK) + `codigo` como columna aparte. **Se conserva `codigo`.** |
| `receta.ingredientes[]` (array embebido) | Tabla **`ingredientes_receta`** (1 fila por ingrediente). *Ya prevista en la spec.* |
| `pago.facturas_afectadas[]` (array embebido) | Tabla **`pago_imputaciones`** (N:M pago↔factura). ⚠️ **La spec NO la tiene** (usa un único `factura_id` en `pagos_proveedor`): eso **perdería la imputación parcial/múltiple** que la app ya hace. **Hay que agregar esta tabla.** |
| Subcolección `insumos/{id}/historial_precios` | Tabla **`historial_precios_insumo`** con FK a `insumos`. *Ya prevista en la spec.* |
| `serverTimestamp()` | `DEFAULT CURRENT_TIMESTAMP` + (opcional) trigger `modificado_en`. |
| `increment(-monto)` atómico | `UPDATE proveedores SET saldo = saldo - $1 WHERE id = $2` dentro de una transacción. **Nativo y más simple.** |
| `runTransaction` (leer-antes-de-escribir por límite de Firestore) | `BEGIN … SELECT … FOR UPDATE … COMMIT`. Los locks de fila **eliminan la gimnasia** de resolver ids fuera de la transacción. |
| Filtros solo por igualdad + orden en memoria (para evitar índices compuestos) | `WHERE … ORDER BY …` con **índices** normales. Desaparece la limitación de Firestore. |
| `firestore.rules` | **Row Level Security (RLS)** + `CHECK`/`FOREIGN KEY`/enums nativos. |
| Soft delete `activo = false` | Igual: columna `activo BOOLEAN`. (Los `ON DELETE` de la spec conviven, pero la regla sigue siendo *no borrar*.) |

---

## 4. Reconciliación de esquemas: app vs DDL de la especificación

El DDL de la spec es un buen punto de partida, pero es **más pobre que el
modelo de la app** en varios puntos críticos. Al adaptar, hay que **enriquecer
la spec**, no recortar la app. Diferencias a resolver, tabla por tabla:

### `insumos`
| Campo app | Campo spec | Acción |
|---|---|---|
| `magnitud` (masa/volumen/unidad), `unidad_base` | `unidad_uso` (string libre) | Adoptar el modelo de la app: `magnitud` + `unidad_base` normalizada evita el error de factor 1000. |
| `costo_neto_por_unidad_base_centavos` | `costo_unidad_uso NUMERIC(18,6)` | Decidir representación del dinero (§8). |
| `alicuota_iva` | *(no existe)* | **Agregar.** Sin alícuota no hay costeo correcto. |
| `factor_correccion` (rendimiento) | *(no existe explícito)* | **Agregar.** La spec lo pone en la receta (`porcentaje_merma`); son cosas distintas: `factor_correccion` es del **insumo** (desposte/limpieza), la merma es de la **preparación**. Conviene tener **ambos**. |
| `presentacion_compra {desc, cantidad_base, precio}` | `unidad_compra`, `factor_conversion`, `costo_unidad_compra` | Equivalentes; mapear 1:1. |

### `proveedores` / `facturas` / `pagos`
| Concepto app | En la spec | Acción |
|---|---|---|
| `condicion_fiscal` (RI/monotributo/exento) | *(no existe)* | **Agregar** a `proveedores`. Determina el IVA como costo o crédito. |
| `facturas.tipo_comprobante` (A/B/C) | *(no existe)* | **Agregar.** |
| Desglose `neto_gravado` / `iva_discriminado` / `percepciones` / `monto_total` + **validación de cuadratura** | Solo `monto_total` | **Agregar** el desglose y el `CHECK (neto + iva + percep = total)`. Sin esto no cierra la cuenta contra el resumen del proveedor. |
| `saldo_pendiente_centavos` por factura + `estado` (pendiente/parcial/pagada/anulada) | `estado_pago` sin saldo | **Agregar `saldo_pendiente`.** Es la base de la imputación FIFO. |
| Pago **N:M** con facturas + **anulación por contraasiento** (monto negativo) | `pagos_proveedor.factura_id` único | **Agregar `pago_imputaciones`** y los campos `anula_a_pago_id` / `anulado_por_pago_id`. |

### `recetas` / `ingredientes_receta`
La spec y la app coinciden bien aquí. Solo:
- La app usa `tipo` (`plato`/`preparacion`); la spec usa `es_subreceta BOOLEAN`. Equivalentes.
- La spec ya modela `subreceta_hija_id` con `CHECK` de exclusividad → coincide con el `{tipo: insumo|receta, ref_id}` de la app.
- Mantener la **detección de ciclos y el límite de profundidad** (hoy en `core/costeo.js`): en SQL, validarlo en la RPC de guardado o con un `CHECK`/trigger recursivo.

---

## 5. Qué se migra tal cual, qué se reescribe

La separación por capas hace que la migración sea **quirúrgica**:

```
core/   ✅  MIGRA SIN CAMBIOS (o casi)
        dinero.js · unidades.js · fiscal.js · costeo.js · rubros.js
        No conocen Firebase ni el DOM. Son funciones puras ya testeadas.
        Sirven igual sobre SQL. (Único ajuste posible: si el dinero pasa a
        NUMERIC, revisar dinero.js — ver §8.)

data/   🔁  SE REESCRIBE (misma firma de funciones, otro motor)
        *Repo.js pasan de Firestore SDK → cliente Supabase / SQL.
        Como ui/ solo llama a estas funciones por su nombre, la UI casi
        no se toca si se respetan las firmas (listar, obtener, crear, …).
        Las transacciones (pagosRepo, facturasRepo) → funciones RPC en Postgres.

ui/     🔸  CAMBIOS MÍNIMOS
        Inyectar contexto de empresa_id/sucursal_id (viene de la sesión).
        Adaptar timestamps (Firestore Timestamp → ISO/Date de Postgres).

config/ 🔁  firebase.js → supabase.js (createClient con URL + anon key).
rules   🔁  firestore.rules → políticas RLS (.sql).
```

**Ventaja SQL sobre la app actual:** las operaciones delicadas
(imputación FIFO, anulación, alta de factura + saldo) hoy corren como
**transacciones del cliente** y por eso las reglas **no pueden** impedir que
alguien escriba un saldo arbitrario desde la consola del navegador (lo dice el
propio comentario de `firestore.rules`). En Postgres se resuelven como
**funciones `SECURITY DEFINER` (RPC)**: el cliente solo puede *invocar*
`registrar_pago(...)`, nunca tocar el saldo directo. **Esto cierra el agujero.**

---

## 6. Multi-tenancy y seguridad (Fase 1) — el trabajo nuevo principal

Hoy **no hay `empresa_id` en ninguna tabla**. Para el SaaS:

1. **Agregar `empresa_id UUID` a todas las tablas de negocio** (proveedores,
   facturas, pagos, insumos, recetas, etc.) y `sucursal_id` donde aplique
   (facturas, sectores, ventas).
2. **RLS por empresa** en cada tabla (patrón de la spec §6):
   ```sql
   ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON insumos
     FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
   ```
3. **Roles**: pasar de 2 (Gerente/Cargador) a los 4 de la spec
   (**ADMIN, GERENTE, COCINA, AUDITOR**), o mapear:
   `Gerente → ADMIN/GERENTE`, `Cargador → COCINA`, y sumar `AUDITOR` (solo
   lectura). El gating de `js/roles.js` se mantiene como UX; la barrera real
   pasan a ser RLS + `rol` en el JWT/tabla `usuarios`.
4. **Bootstrap del dueño por email** (hoy hardcodeado a un mail) deja de tener
   sentido en multi-tenant: se reemplaza por el **flujo de alta de empresa**
   (el que crea la `empresa` es su primer `ADMIN`).
5. **Costeo por empresa**: la política "con IVA vs crédito fiscal" (hoy global,
   decisión 2026-08) debe ser **configuración por empresa** (`empresas.config`),
   porque distintos restaurantes tienen distinta condición fiscal. `fiscal.js`
   ya tiene la lógica de ambas ramas: solo hay que **parametrizarla por tenant**
   en vez de hardcodearla.

---

## 7. Esquema SQL propuesto para el módulo (Fases 2–4, multi-tenant)

Esqueleto que **reconcilia** el DDL de la spec con el modelo real de la app.
(Extracto de las tablas del módulo; el dinero se muestra como `BIGINT`
centavos — ver la decisión de §8.)

```sql
-- INSUMOS (enriquecido respecto de la spec)
CREATE TABLE insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(50),
  nombre VARCHAR(255) NOT NULL,
  rubro VARCHAR(100),
  magnitud VARCHAR(20) NOT NULL CHECK (magnitud IN ('masa','volumen','unidad')),
  unidad_base VARCHAR(10) NOT NULL,             -- g | ml | un
  costo_neto_por_unidad_base_centavos BIGINT NOT NULL DEFAULT 0,
  alicuota_iva NUMERIC(5,2) NOT NULL DEFAULT 21 CHECK (alicuota_iva IN (0,10.5,21,27)),
  factor_correccion NUMERIC(8,4) NOT NULL DEFAULT 1 CHECK (factor_correccion > 0),
  presentacion_desc VARCHAR(120),
  presentacion_cantidad_base NUMERIC(14,4),     -- en unidad base
  presentacion_precio_neto_centavos BIGINT,
  proveedor_habitual_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha_ultimo_precio TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT now(), creado_por UUID,
  modificado_en TIMESTAMPTZ DEFAULT now(), modificado_por UUID
);

-- FACTURAS (con desglose fiscal + saldo + cuadratura)
CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE RESTRICT,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  tipo_comprobante CHAR(1) NOT NULL CHECK (tipo_comprobante IN ('A','B','C')),
  numero_factura VARCHAR(50),
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  neto_gravado_centavos BIGINT NOT NULL DEFAULT 0,
  iva_discriminado_centavos BIGINT NOT NULL DEFAULT 0,
  percepciones_centavos BIGINT NOT NULL DEFAULT 0,
  monto_total_centavos BIGINT NOT NULL DEFAULT 0,
  saldo_pendiente_centavos BIGINT NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','parcial','pagada','anulada')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  -- Regla 5.4 de la app: cuadratura obligatoria
  CONSTRAINT chk_cuadratura
    CHECK (neto_gravado_centavos + iva_discriminado_centavos
           + percepciones_centavos = monto_total_centavos)
);

-- PAGO ↔ FACTURA (la N:M que la spec omite; imprescindible para FIFO parcial)
CREATE TABLE pago_imputaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pago_id UUID NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE RESTRICT,
  monto_imputado_centavos BIGINT NOT NULL
);
```

Más las **funciones RPC** que reemplazan las transacciones del cliente:

- `registrar_pago(empresa, proveedor, monto, metodo, modo, factura_ids[])`
  → imputa FIFO/manual con `SELECT … FOR UPDATE`, escribe `pago` +
  `pago_imputaciones` + actualiza saldos. Todo en una transacción.
- `anular_pago(pago_id)` → contraasiento (monto negativo) + reversión de
  saldos + marca el original.
- `crear_factura(...)` → valida cuadratura + suma al saldo del proveedor.

Estas funciones son la traducción directa de `pagosRepo.js` y `facturasRepo.js`.

---

## 8. Decisiones abiertas (necesito tu confirmación antes de codear)

1. **Representación del dinero.**
   - **Opción A (recomendada):** conservar **centavos como `BIGINT`** (Regla de
     Oro 3.3). Coherente con toda la lógica y los tests actuales; el frontend
     sigue haciendo aritmética exacta.
   - **Opción B:** usar `NUMERIC(15,2)` como pide el DDL de la spec. En Postgres
     `NUMERIC` **es exacto** (no tiene el bug de float), pero el **frontend en
     JS sí lo tiene**, así que habría que igual normalizar en el cliente. Mezclar
     ambos criterios es la peor opción.
   - *Mi recomendación:* **A**, y adaptar el DDL de la spec a centavos.

2. **¿Backend o 100 % frontend?** Tu preferencia es *frontend sin backend*.
   Con **Supabase** se puede: SQL + Auth + RLS como servicio, y las operaciones
   sensibles como **RPC en la base** (no es "montar un backend", es una función
   SQL). Recomiendo este camino; mantiene tu modelo de trabajo y mejora la
   seguridad respecto de Firestore.

3. **Política de IVA multi-tenant.** Confirmar que el costeo
   (con IVA vs crédito fiscal) pasa a ser **configuración por empresa**. La
   lógica ya existe en `fiscal.js`; solo se parametriza.

4. **Alcance de Fase 5 (inventario).** ¿Entra ahora o se deja como fase
   posterior? Impacta si el esquema debe dejar los ganchos (sectores, stock,
   movimientos, ventas) desde el día uno.

---

## 9. Plan de adaptación sugerido (orden de trabajo)

| # | Paso | Resultado |
|---|---|---|
| 1 | **Fijar decisiones de §8** | Base sólida antes de tocar esquema. |
| 2 | **Escribir el DDL SQL** reconciliado (§4, §7) + `empresa_id` + RLS | Esquema multi-tenant de las Fases 1–4. |
| 3 | **Portar funciones sensibles a RPC** (registrar_pago, anular_pago, crear_factura) | Cierra el agujero de saldo; misma semántica que hoy. |
| 4 | **Reescribir `data/*Repo.js`** sobre Supabase, **respetando firmas** | `ui/` casi intacta. |
| 5 | **Inyectar `empresa_id`/`sucursal_id`** desde la sesión en repos y UI | Multi-tenant funcional. |
| 6 | **Adaptar Auth y roles** (4 roles, alta de empresa en vez de bootstrap por email) | Fase 1 completa. |
| 7 | **Re-correr y ampliar tests de `core/`** | Garantía de que la lógica no cambió. |
| 8 | *(Opcional)* **Fase 5 — Inventario** como módulo nuevo que consume este | Explosión de recetas, stock por sector, mermas. |

Con los pasos 1–7 el módulo de **Compras, Costos y Rentabilidad** queda
funcionando como pieza del SaaS, en SQL y multi-tenant, reutilizando **todo el
núcleo de lógica ya probado**.

---

## 10. Riesgos y notas finales

- **No recortar el modelo a la spec.** El DDL de la especificación es un boceto:
  omite condición fiscal, desglose de IVA, saldo por factura, imputación N:M y
  factor de corrección. Adaptar la app "hacia abajo" perdería funcionalidad que
  hoy funciona. El diagnóstico propone **enriquecer la spec** con lo que la app
  ya tiene.
- **`core/` es el patrimonio.** Está aislado y testeado; es lo que hace barata
  la migración. Cuidar que siga sin conocer la base de datos.
- **Un cliente por proyecto Firebase** (aislamiento actual) **no escala** a
  SaaS. El salto real de esfuerzo no es NoSQL→SQL (es mecánico gracias a las
  capas), sino **mono-tenant → multi-tenant** (Fase 1). Ahí está el grueso del
  trabajo nuevo.
- **Validación contable/impositiva:** como advierte la spec funcional v2, las
  alícuotas y el tratamiento fiscal deben validarse con un contador antes de que
  la dirección tome decisiones de precio.
