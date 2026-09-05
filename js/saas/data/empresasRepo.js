// ============================================================
// saas/data/empresasRepo.js — Datos de la empresa (Configuración)
// ============================================================

import { supabase } from "../../config/supabase.js";

/** Trae la empresa por id. */
export async function obtener(id) {
  const { data, error } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Actualiza nombre / CUIT / preferencia de costeo. */
export async function actualizar(id, datos) {
  const permitidos = ["nombre", "cuit_rut", "costea_con_iva"];
  const payload = {};
  for (const k of permitidos) if (k in datos) payload[k] = datos[k];
  const { error } = await supabase.from("empresas").update(payload).eq("id", id);
  if (error) throw error;
}
