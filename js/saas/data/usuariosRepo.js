// ============================================================
// saas/data/usuariosRepo.js — Usuarios de la empresa (Configuración)
// ------------------------------------------------------------
// Alta de cuentas nuevas se hace desde Supabase (Authentication) o por
// auto-registro; acá gestionamos rol y estado (solo ADMIN, por RLS).
// ============================================================

import { supabase } from "../../config/supabase.js";

/** Lista los usuarios de la empresa. */
export async function listar() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Actualiza rol y/o estado de un usuario. */
export async function actualizar(id, datos) {
  const permitidos = ["rol", "activo", "nombre"];
  const payload = {};
  for (const k of permitidos) if (k in datos) payload[k] = datos[k];
  payload.modificado_en = new Date().toISOString();
  const { error } = await supabase.from("usuarios").update(payload).eq("id", id);
  if (error) throw error;
}
