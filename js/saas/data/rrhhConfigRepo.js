// ============================================================
// saas/data/rrhhConfigRepo.js — Config del módulo RRHH
// ------------------------------------------------------------
// Tipos de documento y tramos de vacaciones, ambos por empresa.
// Lectura: ADMIN + GERENTE. Escritura: solo ADMIN (lo aplica la RLS).
// El seed inicial lo hace la RPC seed_rrhh_empresa() (idempotente).
// ============================================================

import { supabase } from "../../config/supabase.js";

// ---------- Tipos de documento ----------

/** Lista los tipos de documento de la empresa (activos primero, por orden). */
export async function listarTipos({ soloActivos = false } = {}) {
  let q = supabase.from("tipos_documento").select("*");
  if (soloActivos) q = q.eq("activo", true);
  q = q.order("orden", { ascending: true }).order("nombre", { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Crea un tipo de documento. */
export async function crearTipo(empresaId, d) {
  if (!empresaId) throw new Error("Falta la empresa.");
  if (!d.nombre || !d.nombre.trim()) throw new Error("El nombre es obligatorio.");
  const payload = {
    empresa_id: empresaId,
    nombre: d.nombre.trim(),
    vigencia_meses: d.vigencia_meses === "" || d.vigencia_meses == null ? null : Math.round(+d.vigencia_meses),
    obligatorio: !!d.obligatorio,
    orden: d.orden != null ? Math.round(+d.orden) : 0,
  };
  const { data, error } = await supabase.from("tipos_documento").insert(payload).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un tipo de documento con ese nombre.");
    throw error;
  }
  return data;
}

/** Actualiza un tipo de documento. */
export async function actualizarTipo(id, d) {
  const payload = {};
  if ("nombre" in d) payload.nombre = (d.nombre || "").trim();
  if ("vigencia_meses" in d)
    payload.vigencia_meses = d.vigencia_meses === "" || d.vigencia_meses == null ? null : Math.round(+d.vigencia_meses);
  if ("obligatorio" in d) payload.obligatorio = !!d.obligatorio;
  if ("orden" in d) payload.orden = Math.round(+d.orden) || 0;
  if ("activo" in d) payload.activo = !!d.activo;
  const { error } = await supabase.from("tipos_documento").update(payload).eq("id", id);
  if (error) throw error;
}

// ---------- Tramos de vacaciones ----------

/** Lista los tramos de vacaciones (por antigüedad ascendente). */
export async function listarTramosVacaciones() {
  const { data, error } = await supabase
    .from("config_vacaciones")
    .select("*")
    .order("antiguedad_desde_anios", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Crea o actualiza un tramo (PK = empresa_id + antiguedad_desde_anios). */
export async function guardarTramo(empresaId, antiguedad, dias) {
  if (!empresaId) throw new Error("Falta la empresa.");
  const payload = {
    empresa_id: empresaId,
    antiguedad_desde_anios: Math.round(+antiguedad),
    dias_corridos: Math.round(+dias),
  };
  const { error } = await supabase
    .from("config_vacaciones")
    .upsert(payload, { onConflict: "empresa_id,antiguedad_desde_anios" });
  if (error) throw error;
}

/** Elimina un tramo de vacaciones. */
export async function eliminarTramo(empresaId, antiguedad) {
  const { error } = await supabase
    .from("config_vacaciones")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("antiguedad_desde_anios", antiguedad);
  if (error) throw error;
}

// ---------- Activación del módulo ----------

/**
 * ¿La empresa ya tiene el módulo sembrado? (al menos un tipo de documento).
 * Sirve para mostrar el botón "Activar RRHH" cuando todavía no hay nada.
 */
export async function estaSembrado() {
  const { count, error } = await supabase
    .from("tipos_documento")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return (count || 0) > 0;
}

/** Siembra tipos de documento y tramos de vacaciones sugeridos (idempotente). */
export async function activarModulo() {
  const { error } = await supabase.rpc("seed_rrhh_empresa");
  if (error) throw error;
}
