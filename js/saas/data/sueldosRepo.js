// ============================================================
// saas/data/sueldosRepo.js — Historial de sueldos. SOLO ADMIN.
// ------------------------------------------------------------
// El sueldo es un HISTORIAL, no un campo: un aumento es un registro nuevo.
// Los montos viajan en CENTAVOS (bigint), como todo el dinero del SaaS.
// La conversión desde/hacia pesos la hace la UI con core/dinero.js.
// ============================================================

import { supabase } from "../../config/supabase.js";

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data && data.user ? data.user.id : null;
}

/** Historial completo de un empleado (más reciente primero). */
export async function listar(empleadoId) {
  const { data, error } = await supabase
    .from("empleados_sueldos")
    .select("*")
    .eq("empleado_id", empleadoId)
    .order("vigencia_desde", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Sueldo vigente hoy (vista vw_sueldo_vigente) o null. */
export async function vigente(empleadoId) {
  const { data, error } = await supabase
    .from("vw_sueldo_vigente")
    .select("*")
    .eq("empleado_id", empleadoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Registra un nuevo sueldo. Recibe monto en CENTAVOS.
 * @param {object} d { monto_centavos, tipo, vigencia_desde, motivo }
 */
export async function registrar(empleadoId, d) {
  if (!empleadoId) throw new Error("Falta el empleado.");
  if (!(d.monto_centavos >= 0)) throw new Error("El monto no es válido.");
  if (!d.vigencia_desde) throw new Error("Indicá desde cuándo rige.");

  const payload = {
    empleado_id: empleadoId,
    monto_centavos: Math.round(d.monto_centavos),
    tipo: d.tipo === "por_hora" ? "por_hora" : "mensual",
    vigencia_desde: d.vigencia_desde,
    motivo: (d.motivo || "").trim() || null,
    creado_por: await uid(),
  };
  const { data, error } = await supabase
    .from("empleados_sueldos")
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya hay un sueldo cargado con esa fecha de vigencia para este empleado.");
    }
    throw error;
  }
  return data;
}
