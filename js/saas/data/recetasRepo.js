// ============================================================
// saas/data/recetasRepo.js — Recetas y sus ingredientes (Supabase)
// ------------------------------------------------------------
// Una receta puede ser un PLATO (se vende) o una PREPARACIÓN (sub-receta).
// Los ingredientes se guardan en ingredientes_receta (insumo XOR sub-receta).
// El costo se calcula con core/costeo.js; acá solo persistimos el snapshot.
// /data no conoce el DOM.
// ============================================================

import { supabase } from "../../config/supabase.js";
import * as insumosRepo from "./insumosRepo.js";
import { costoReceta } from "../../core/costeo.js";

/** Genera el próximo código legible tipo "REC-001". */
function siguienteCodigo(prefijo, existentes) {
  let max = 0;
  const re = new RegExp(`^${prefijo}-(\\d+)$`);
  for (const it of existentes || []) {
    const m = re.exec(it.codigo || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefijo}-${String(max + 1).padStart(3, "0")}`;
}

/** Convierte una fila de ingredientes_receta al shape que espera core/costeo. */
function mapIngrediente(row) {
  return {
    id: row.id,
    tipo: row.insumo_id ? "insumo" : "receta",
    ref_id: row.insumo_id || row.subreceta_hija_id,
    cantidad: Number(row.cantidad) || 0,
    porcentaje_merma: Number(row.porcentaje_merma) || 0,
  };
}

/**
 * Lista recetas activas de la empresa, cada una con su array `ingredientes`
 * ya en el shape de core (para poder costear directo).
 */
export async function listar() {
  const [{ data: recetas, error: e1 }, { data: ingredientes, error: e2 }] = await Promise.all([
    supabase.from("recetas").select("*").eq("activo", true).order("nombre", { ascending: true }),
    supabase.from("ingredientes_receta").select("*"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const porReceta = {};
  for (const row of ingredientes || []) {
    (porReceta[row.receta_padre_id] ||= []).push(row);
  }
  return (recetas || []).map((r) => ({
    ...r,
    ingredientes: (porReceta[r.id] || [])
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(mapIngrediente),
  }));
}

function payloadReceta(empresaId, datos, costoCalculadoCentavos, creadoPor) {
  const esPlato = datos.tipo !== "preparacion";
  return {
    empresa_id: empresaId,
    nombre: (datos.nombre || "").trim(),
    tipo: esPlato ? "plato" : "preparacion",
    rendimiento_cantidad: Number(datos.rendimiento_cantidad) || 1,
    rendimiento_unidad: (datos.rendimiento_unidad || "un").trim() || "un",
    precio_venta_publico_centavos: esPlato ? (Number(datos.precio_venta_publico_centavos) || 0) : 0,
    alicuota_venta: esPlato ? (Number(datos.alicuota_venta) || 0) : 0,
    sector_venta: esPlato ? ((datos.sector_venta || "").trim() || null) : null,
    costo_calculado_centavos: Math.round(costoCalculadoCentavos) || 0,
    fecha_calculo: new Date().toISOString(),
    creado_por: creadoPor || null,
  };
}

/** Filas de ingredientes_receta a insertar para una receta dada. */
function filasIngredientes(empresaId, recetaId, ingredientes) {
  return (ingredientes || []).map((ing, i) => ({
    empresa_id: empresaId,
    receta_padre_id: recetaId,
    insumo_id: ing.tipo === "insumo" ? ing.ref_id : null,
    subreceta_hija_id: ing.tipo === "receta" ? ing.ref_id : null,
    cantidad: Number(ing.cantidad) || 0,
    porcentaje_merma: Number(ing.porcentaje_merma) || 0,
    orden: i,
  }));
}

/** Crea una receta + sus ingredientes. Devuelve el id. */
export async function crear(empresaId, datos, ingredientes, costoCalculadoCentavos = 0) {
  if (!empresaId) throw new Error("Falta la empresa del usuario.");
  if (!datos.nombre || !datos.nombre.trim()) throw new Error("El nombre es obligatorio.");

  const { data: userData } = await supabase.auth.getUser();
  const creadoPor = userData && userData.user ? userData.user.id : null;

  const { data: existentes } = await supabase.from("recetas").select("codigo");
  const codigo = (datos.codigo || "").trim() || siguienteCodigo("REC", existentes || []);

  const payload = { ...payloadReceta(empresaId, datos, costoCalculadoCentavos, creadoPor), codigo };
  const { data: receta, error } = await supabase.from("recetas").insert(payload).select().single();
  if (error) throw error;

  const filas = filasIngredientes(empresaId, receta.id, ingredientes);
  if (filas.length) {
    const { error: e2 } = await supabase.from("ingredientes_receta").insert(filas);
    if (e2) throw e2;
  }
  return receta.id;
}

/** Actualiza una receta: reemplaza sus datos e ingredientes. */
export async function actualizar(empresaId, id, datos, ingredientes, costoCalculadoCentavos = 0) {
  const payload = payloadReceta(empresaId, datos, costoCalculadoCentavos);
  delete payload.creado_por;
  const { error } = await supabase.from("recetas").update(payload).eq("id", id);
  if (error) throw error;

  const { error: eDel } = await supabase.from("ingredientes_receta").delete().eq("receta_padre_id", id);
  if (eDel) throw eDel;

  const filas = filasIngredientes(empresaId, id, ingredientes);
  if (filas.length) {
    const { error: eIns } = await supabase.from("ingredientes_receta").insert(filas);
    if (eIns) throw eIns;
  }
}

/** Persiste solo el snapshot de costo (recálculo por lote). */
export async function guardarCosto(id, costoCalculadoCentavos) {
  const { error } = await supabase.from("recetas")
    .update({ costo_calculado_centavos: Math.round(costoCalculadoCentavos) || 0, fecha_calculo: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Recalcula el costo (snapshot) de TODAS las recetas de la empresa y persiste
 * las que cambiaron. Se usa tras actualizar precios de insumos.
 * @returns {number} cantidad de recetas actualizadas
 */
export async function recalcularTodas() {
  const [recetas, insumos] = await Promise.all([listar(), insumosRepo.listar()]);
  const insMap = Object.fromEntries(insumos.map((i) => [i.id, i]));
  const recMap = Object.fromEntries(recetas.map((r) => [r.id, r]));
  const ctx = { getInsumo: (id) => insMap[id] || null, getReceta: (id) => recMap[id] || null };
  let n = 0;
  for (const r of recetas) {
    try {
      const costo = Math.round(costoReceta(r, ctx));
      if (costo !== (Number(r.costo_calculado_centavos) || 0)) { await guardarCosto(r.id, costo); n++; }
    } catch (_e) { /* ciclo/insumo faltante: se omite */ }
  }
  return n;
}

/** Baja lógica. */
export async function desactivar(id) {
  const { error } = await supabase.from("recetas").update({ activo: false }).eq("id", id);
  if (error) throw error;
}
