// ============================================================
// core/costeo.js — Costeo, escandallos y rentabilidad (Sección 6)
// ------------------------------------------------------------
// Función única y centralizada usada en TODO el sistema.
// El escandallo vive 100 % en NETO (Regla 3.2).
// Este módulo NO conoce Firebase ni el DOM: recibe los datos ya cargados.
// ============================================================

/** Profundidad máxima de anidamiento de sub-recetas (Sección 5.6). */
export const MAX_PROFUNDIDAD_RECETA = 4;

/**
 * Costo REAL por unidad base útil de un insumo, en centavos.
 *
 * ⚠️ POLÍTICA DE COSTEO (decisión de la administración del restaurante,
 *    2026-08): el costo se calcula por el PRECIO FINAL pagado al proveedor,
 *    con IVA INCLUIDO. NO se descuenta el IVA como crédito fiscal, aunque el
 *    comprobante sea Factura A de un Responsable Inscripto.
 *
 *    Antes: la Factura A costeaba por el NETO (IVA = crédito fiscal). Ese
 *    criterio quedó DESACTIVADO a pedido del restaurante. Para volver a él,
 *    reponer la rama con recuperaCreditoFiscal() (ver git / core/fiscal.js).
 *
 *    Nota: las FACTURAS siguen guardando el desglose neto/IVA/total (realidad
 *    fiscal para AFIP). Esto solo cambia cómo se COSTEAN los insumos/recetas.
 *
 * - costo = neto * (1 + alícuota_iva/100)   → precio final con IVA.
 * - el factor de corrección encarece el gramo útil: costo / factor.
 *
 * Los parámetros `proveedor` y `tipoComprobante` se conservan por
 * compatibilidad de firma, pero YA NO afectan el costo.
 *
 * @param {object} insumo
 * @param {number} insumo.costo_neto_por_unidad_base_centavos
 * @param {number} insumo.alicuota_iva
 * @param {number} [insumo.factor_correccion=1]
 * @param {object} [_proveedor]        (ignorado) se mantiene por compatibilidad
 * @param {string} [_tipoComprobante]  (ignorado) se mantiene por compatibilidad
 * @returns {number} centavos por unidad base útil (puede ser fraccionario)
 */
export function costoRealPorUnidadBase(insumo, _proveedor, _tipoComprobante) {
  const neto = Number(insumo.costo_neto_por_unidad_base_centavos) || 0;
  // Precio final: el IVA es costo (no crédito fiscal), siempre se suma.
  const base = neto * (1 + (Number(insumo.alicuota_iva) || 0) / 100);

  const factor = Number(insumo.factor_correccion) || 1;
  return base / factor;
}

/**
 * Costo total de una receta, en centavos (recursivo, con caché y control de ciclos).
 *
 * @param {object} receta  documento de receta (con `ingredientes`)
 * @param {object} ctx
 * @param {(id:string)=>object|null} ctx.getInsumo    resuelve un insumo por id
 * @param {(id:string)=>object|null} ctx.getReceta    resuelve una receta por id
 * @param {(insumo:object)=>{proveedor:object, tipoComprobante:string}} [ctx.contextoInsumo]
 *        devuelve el proveedor y tipo de comprobante a usar para costear el insumo.
 *        Por defecto asume Factura A + Responsable Inscripto (caso más común).
 * @param {Map} [ctx._cache]   caché de costos de receta dentro del ciclo de cálculo
 * @param {Set} [ctx._enCurso] set de ids en la pila de recursión (detección de ciclos)
 * @param {number} [ctx._profundidad=0]
 * @returns {number} centavos (fraccionario; redondear en la capa de presentación)
 */
export function costoReceta(receta, ctx) {
  const {
    getInsumo,
    getReceta,
    contextoInsumo = () => ({
      proveedor: { condicion_fiscal: "responsable_inscripto" },
      tipoComprobante: "A",
    }),
    _cache = new Map(),
    _enCurso = new Set(),
    _profundidad = 0,
  } = ctx;

  if (!receta) return 0;

  if (_profundidad > MAX_PROFUNDIDAD_RECETA) {
    throw new Error(`Se superó la profundidad máxima de sub-recetas (${MAX_PROFUNDIDAD_RECETA}).`);
  }

  const recetaId = receta.id;
  if (recetaId) {
    if (_enCurso.has(recetaId)) {
      throw new Error(`Ciclo de sub-recetas detectado en la receta "${receta.nombre || recetaId}".`);
    }
    if (_cache.has(recetaId)) return _cache.get(recetaId);
    _enCurso.add(recetaId);
  }

  let total = 0;
  for (const ing of receta.ingredientes || []) {
    const cantidad = Number(ing.cantidad) || 0;

    if (ing.tipo === "insumo") {
      const insumo = getInsumo(ing.ref_id);
      if (!insumo) continue; // insumo faltante/inactivo: se ignora (se reporta en la UI)
      const { proveedor, tipoComprobante } = contextoInsumo(insumo);
      total += cantidad * costoRealPorUnidadBase(insumo, proveedor, tipoComprobante);
    } else if (ing.tipo === "receta") {
      const sub = getReceta(ing.ref_id);
      if (!sub) continue;
      const subCosto = costoReceta(sub, {
        ...ctx,
        _cache,
        _enCurso,
        _profundidad: _profundidad + 1,
      });
      const rend = Number(sub.rendimiento_cantidad) || 1;
      const costoUnitarioSub = subCosto / rend;
      total += cantidad * costoUnitarioSub;
    }
  }

  if (recetaId) {
    _enCurso.delete(recetaId);
    _cache.set(recetaId, total);
  }
  return total;
}

/**
 * Detecta ciclos y profundidad excesiva ANTES de escribir una receta (DFS).
 * Se usa al guardar (Sección 5.6). No calcula costos.
 *
 * @param {object} receta       receta candidata (puede no tener id todavía)
 * @param {(id:string)=>object|null} getReceta
 * @param {string} [recetaIdCandidata]  id que tendrá/tiene la receta (para autoreferencia)
 * @returns {{ok:boolean, motivo?:string}}
 */
export function validarGrafoReceta(receta, getReceta, recetaIdCandidata) {
  function dfs(nodo, enPila, profundidad) {
    if (profundidad > MAX_PROFUNDIDAD_RECETA) {
      return { ok: false, motivo: `Máximo ${MAX_PROFUNDIDAD_RECETA} niveles de sub-recetas.` };
    }
    for (const ing of (nodo && nodo.ingredientes) || []) {
      if (ing.tipo !== "receta") continue;
      const hijoId = ing.ref_id;
      if (enPila.has(hijoId)) {
        return { ok: false, motivo: "Referencia circular entre sub-recetas." };
      }
      const hijo = getReceta(hijoId);
      if (!hijo) continue;
      enPila.add(hijoId);
      const r = dfs(hijo, enPila, profundidad + 1);
      enPila.delete(hijoId);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  const pila = new Set();
  if (recetaIdCandidata) pila.add(recetaIdCandidata);
  return dfs(receta, pila, 1);
}

/**
 * Rentabilidad de un plato (Sección 6.3).
 *
 * ⚠️ POLÍTICA (2026-08): TODO se compara "con IVA". El costo ya incluye IVA
 *    (ver costoRealPorUnidadBase) y el precio de carta se carga con IVA
 *    incluido. Por eso:
 *      food cost % = costo (c/IVA) / precio de carta (c/IVA)
 *      margen bruto = precio de carta − costo (ambos c/IVA)
 *    `precioNetoCentavos` se sigue devolviendo, pero solo como dato
 *    informativo (el neto del precio de carta).
 *
 * @param {object} plato  con `precio_venta_publico_centavos` y `alicuota_venta`
 * @param {number} costoRecetaCentavos  costo de la receta con IVA (centavos)
 * @returns {{precioNetoCentavos:number, foodCostPct:number, margenBrutoCentavos:number, precioPublicoCentavos:number}}
 */
export function rentabilidad(plato, costoRecetaCentavos) {
  const precioPublico = Number(plato.precio_venta_publico_centavos) || 0;
  const ali = Number(plato.alicuota_venta) || 0;
  const precioNeto = precioPublico / (1 + ali / 100); // informativo
  const costo = Number(costoRecetaCentavos) || 0;
  // Food cost y margen contra el PRECIO DE CARTA (con IVA), no contra el neto.
  const foodCostPct = precioPublico > 0 ? (costo / precioPublico) * 100 : 0;
  const margenBruto = precioPublico - costo;
  return {
    precioNetoCentavos: precioNeto,
    foodCostPct,
    margenBrutoCentavos: margenBruto,
    precioPublicoCentavos: precioPublico,
  };
}

/**
 * Calculadora inversa (UX 7.4): ¿a qué PRECIO DE CARTA (con IVA) hay que
 * vender un plato para alcanzar un food cost % objetivo?
 *
 * Como el food cost se mide contra el precio de carta (con IVA):
 *   precio_carta = costo / (foodCostObjetivo/100)
 *   precio_neto  = precio_carta / (1 + alícuota_venta/100)   (informativo)
 *
 * @param {number} costoRecetaCentavos  costo de la receta con IVA (centavos)
 * @param {number} foodCostObjetivoPct  (%) ej. 30
 * @param {number} alicuotaVenta        (%) ej. 21 (solo para el neto informativo)
 * @returns {{precioNetoCentavos:number, precioPublicoCentavos:number}}
 */
export function precioSugerido(costoRecetaCentavos, foodCostObjetivoPct, alicuotaVenta) {
  const costo = Number(costoRecetaCentavos) || 0;
  const objetivo = Number(foodCostObjetivoPct) || 0;
  if (objetivo <= 0) return { precioNetoCentavos: 0, precioPublicoCentavos: 0 };
  const precioPublico = costo / (objetivo / 100);
  const precioNeto = precioPublico / (1 + (Number(alicuotaVenta) || 0) / 100); // informativo
  return {
    precioNetoCentavos: precioNeto,
    precioPublicoCentavos: precioPublico,
  };
}
