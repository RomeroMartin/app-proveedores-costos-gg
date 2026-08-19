// ============================================================
// data/recetasRepo.js — Colección `recetas` (platos y preparaciones)
// ------------------------------------------------------------
// costo_calculado_centavos es un snapshot desnormalizado que se recalcula
// al editar la receta y por lote cuando cambia un insumo (Sección 6.5).
// ============================================================

import {
  db, collection, doc, getDoc, getDocs, query, where,
  addDoc, updateDoc, serverTimestamp,
  camposCreacion, camposModificacion, crearCache, siguienteCodigo,
} from "./_base.js";
import { costoReceta, validarGrafoReceta } from "../core/costeo.js";

const COL = "recetas";
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

/** Índice {id: receta} para resolver referencias en el costeo. */
function indexar(recetas) {
  const m = {};
  for (const r of recetas) m[r.id] = r;
  return m;
}

/**
 * Valida el grafo (ciclos/profundidad) contra las recetas existentes.
 * @returns {{ok:boolean, motivo?:string}}
 */
export async function validarGrafo(recetaCandidata, idExistente = null) {
  const todas = await listar(true);
  const idx = indexar(todas);
  return validarGrafoReceta(recetaCandidata, (id) => idx[id], idExistente);
}

/**
 * Crea una receta. `recalcularCosto` inyecta el costo calculado
 * (la UI arma el contexto de insumos/proveedores y lo pasa ya resuelto).
 */
export async function crear(datos, costoCalculadoCentavos = 0) {
  const existentes = await listar(true);
  const payload = {
    codigo: datos.codigo || siguienteCodigo("REC", existentes),
    nombre: (datos.nombre || "").trim(),
    tipo: datos.tipo === "preparacion" ? "preparacion" : "plato",
    rendimiento_cantidad: Number(datos.rendimiento_cantidad) || 1,
    rendimiento_unidad: datos.rendimiento_unidad || "un",
    precio_venta_publico_centavos: Number(datos.precio_venta_publico_centavos) || 0,
    alicuota_venta: Number(datos.alicuota_venta) || 0,
    // Sector de venta (cocina, parrilla, fríos, …); sólo aplica a platos.
    sector_venta: (datos.sector_venta || "").trim(),
    ingredientes: datos.ingredientes || [],
    costo_calculado_centavos: Math.round(costoCalculadoCentavos) || 0,
    fecha_calculo: serverTimestamp(),
    ...camposCreacion(),
  };
  const ref = await addDoc(collection(db, COL), payload);
  cache.invalidar();
  return ref.id;
}

export async function actualizar(id, datos, costoCalculadoCentavos = 0) {
  const payload = {
    nombre: (datos.nombre || "").trim(),
    tipo: datos.tipo === "preparacion" ? "preparacion" : "plato",
    rendimiento_cantidad: Number(datos.rendimiento_cantidad) || 1,
    rendimiento_unidad: datos.rendimiento_unidad || "un",
    precio_venta_publico_centavos: Number(datos.precio_venta_publico_centavos) || 0,
    alicuota_venta: Number(datos.alicuota_venta) || 0,
    sector_venta: (datos.sector_venta || "").trim(),
    ingredientes: datos.ingredientes || [],
    costo_calculado_centavos: Math.round(costoCalculadoCentavos) || 0,
    fecha_calculo: serverTimestamp(),
    ...camposModificacion(),
  };
  await updateDoc(doc(db, COL, id), payload);
  cache.invalidar();
}

export async function desactivar(id) {
  await updateDoc(doc(db, COL, id), { activo: false, ...camposModificacion() });
  cache.invalidar();
}

/**
 * Recalcula por lote el costo de todas las recetas que dependen (directa o
 * indirectamente) de los insumos dados, y persiste el snapshot (Sección 6.5).
 *
 * @param {object} ctx  { getInsumo, getReceta, contextoInsumo }
 * @returns {Promise<number>} cantidad de recetas actualizadas
 */
export async function recalcularTodas(ctx) {
  const todas = await listar(true);
  const idx = indexar(todas);
  const getReceta = (id) => idx[id];
  let n = 0;
  for (const r of todas) {
    try {
      const costo = Math.round(costoReceta(r, { ...ctx, getReceta }));
      if (costo !== (Number(r.costo_calculado_centavos) || 0)) {
        await updateDoc(doc(db, COL, r.id), {
          costo_calculado_centavos: costo,
          fecha_calculo: serverTimestamp(),
        });
        n++;
      }
    } catch (_e) {
      // Receta con ciclo/insumo faltante: se omite del recálculo por lote.
    }
  }
  cache.invalidar();
  return n;
}

export function invalidarCache() { cache.invalidar(); }
