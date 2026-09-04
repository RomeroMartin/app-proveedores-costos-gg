// ============================================================
// saas/data/pagosProgramadosRepo.js — Agenda de pagos (planificación)
// ------------------------------------------------------------
// Pagos futuros que administración planifica. No toca la cuenta corriente.
// ============================================================

import { supabase } from "../../config/supabase.js";

/** Lista pagos programados no cancelados (ordenados por fecha). */
export async function listar() {
  const { data, error } = await supabase
    .from("pagos_programados")
    .select("*")
    .neq("estado", "cancelado")
    .order("fecha_programada", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Crea un pago programado. */
export async function crear(empresaId, datos) {
  if (!empresaId) throw new Error("Falta la empresa.");
  const { data: userData } = await supabase.auth.getUser();
  const payload = {
    empresa_id: empresaId,
    proveedor_id: datos.proveedor_id || null,
    fecha_programada: datos.fecha_programada,
    monto_centavos: datos.monto_centavos,
    metodo_pago: datos.metodo_pago || "transferencia",
    nota: (datos.nota || "").trim() || null,
    creado_por: userData && userData.user ? userData.user.id : null,
  };
  const { data, error } = await supabase.from("pagos_programados").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Cambia el estado: 'pendiente' | 'pagado' | 'cancelado'. */
export async function actualizarEstado(id, estado) {
  const { error } = await supabase
    .from("pagos_programados")
    .update({ estado, modificado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
