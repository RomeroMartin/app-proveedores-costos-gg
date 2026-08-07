// ============================================================
// data/insumosRepo.js — Colección `insumos` + subcolección historial_precios
// ============================================================

import {
  db, collection, doc, getDoc, getDocs, query, where, orderBy,
  addDoc, updateDoc, serverTimestamp,
  camposCreacion, camposModificacion, crearCache, siguienteCodigo, uid,
} from "./_base.js";

const COL = "insumos";
const cache = crearCache();

export async function listar(forzar = false) {
  if (!forzar && cache.vigente()) return cache.get();
  const snap = await getDocs(query(collection(db, COL), where("activo", "==", true)));
  const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  arr.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  return cache.set(arr);
}

export async function obtener(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Crea un insumo. `datos` ya viene con costo_neto_por_unidad_base_centavos
 * calculado desde la presentación de compra (core/unidades.js).
 */
export async function crear(datos) {
  const existentes = await listar(true);
  const payload = {
    codigo: datos.codigo || siguienteCodigo("INS", existentes),
    nombre: (datos.nombre || "").trim(),
    magnitud: datos.magnitud,
    unidad_base: datos.unidad_base,
    costo_neto_por_unidad_base_centavos: datos.costo_neto_por_unidad_base_centavos || 0,
    alicuota_iva: Number(datos.alicuota_iva) || 0,
    factor_correccion: Number(datos.factor_correccion) || 1,
    presentacion_compra: datos.presentacion_compra || null,
    proveedor_habitual_id: datos.proveedor_habitual_id || null,
    fecha_ultimo_precio: serverTimestamp(),
    ...camposCreacion(),
  };
  const ref = await addDoc(collection(db, COL), payload);
  // Registro inicial en el historial
  await addDoc(collection(db, COL, ref.id, "historial_precios"), {
    costo_anterior_centavos: 0,
    costo_nuevo_centavos: payload.costo_neto_por_unidad_base_centavos,
    variacion_porcentual: 0,
    fecha: serverTimestamp(),
    origen: "carga_inicial",
    factura_id: null,
    usuario: payload.creado_por,
  });
  cache.invalidar();
  return ref.id;
}

/** Edita metadatos que no tocan el precio. */
export async function actualizarMeta(id, datos) {
  const permitidos = ["nombre", "magnitud", "unidad_base", "alicuota_iva", "factor_correccion", "presentacion_compra", "proveedor_habitual_id"];
  const payload = {};
  for (const k of permitidos) if (k in datos) payload[k] = datos[k];
  await updateDoc(doc(db, COL, id), { ...payload, ...camposModificacion() });
  cache.invalidar();
}

/**
 * Actualiza el costo por unidad base y registra el historial (Sección 6.5).
 * Devuelve la variación porcentual para que la UI dispare el recálculo de recetas.
 *
 * @param {string} id
 * @param {number} nuevoCostoCentavos
 * @param {object} [meta]  { origen, factura_id }
 */
export async function actualizarCosto(id, nuevoCostoCentavos, meta = {}) {
  const actual = await obtener(id);
  const anterior = actual ? Number(actual.costo_neto_por_unidad_base_centavos) || 0 : 0;
  const variacion = anterior > 0 ? ((nuevoCostoCentavos - anterior) / anterior) * 100 : 0;

  await updateDoc(doc(db, COL, id), {
    costo_neto_por_unidad_base_centavos: nuevoCostoCentavos,
    fecha_ultimo_precio: serverTimestamp(),
    ...camposModificacion(),
  });
  await addDoc(collection(db, COL, id, "historial_precios"), {
    costo_anterior_centavos: anterior,
    costo_nuevo_centavos: nuevoCostoCentavos,
    variacion_porcentual: Number(variacion.toFixed(2)),
    fecha: serverTimestamp(),
    origen: meta.origen || "manual",
    factura_id: meta.factura_id || null,
    usuario: uid(),
  });
  cache.invalidar();
  return variacion;
}

/** Historial de precios ordenado (para el gráfico de evolución). */
export async function historial(id) {
  const snap = await getDocs(query(collection(db, COL, id, "historial_precios"), orderBy("fecha", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function desactivar(id) {
  await updateDoc(doc(db, COL, id), { activo: false, ...camposModificacion() });
  cache.invalidar();
}

export function invalidarCache() { cache.invalidar(); }
