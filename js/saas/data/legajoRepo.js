// ============================================================
// saas/data/legajoRepo.js — Legajo (datos sensibles). SOLO ADMIN.
// ------------------------------------------------------------
// Relación 1:1 con empleados (misma PK = empleado_id). La RLS solo deja
// leer/escribir a ADMIN; para GERENTE estas queries devuelven vacío.
// ============================================================

import { supabase } from "../../config/supabase.js";

const CAMPOS = [
  "dni", "cuil", "fecha_nacimiento", "domicilio", "localidad",
  "contacto_emergencia", "tel_emergencia", "obra_social", "modalidad",
  "cbu", "observaciones",
];

/** Trae el legajo de un empleado (o null si no existe / sin permiso). */
export async function obtener(empleadoId) {
  const { data, error } = await supabase
    .from("empleados_legajo")
    .select("*")
    .eq("empleado_id", empleadoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Guarda el legajo (upsert por empleado_id). Solo campos permitidos.
 * Las fechas y campos vacíos se guardan como null.
 */
export async function guardar(empleadoId, datos) {
  if (!empleadoId) throw new Error("Falta el empleado.");
  const payload = { empleado_id: empleadoId };
  for (const k of CAMPOS) {
    if (k in datos) {
      const v = datos[k];
      payload[k] = typeof v === "string" ? v.trim() || null : (v === "" ? null : v);
    }
  }
  const { error } = await supabase
    .from("empleados_legajo")
    .upsert(payload, { onConflict: "empleado_id" });
  if (error) throw error;
}
