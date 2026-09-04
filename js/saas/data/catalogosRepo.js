// ============================================================
// saas/data/catalogosRepo.js — Opciones de desplegables por empresa
// ------------------------------------------------------------
// Combos "abiertos": muestran opciones por defecto + las que el usuario
// agregó (tabla `catalogos`). Al escribir una opción nueva, se guarda sola.
// Degrada con elegancia: si la tabla no existe todavía, usa solo defaults.
// ============================================================

import { supabase } from "../../config/supabase.js";
import { RUBROS } from "../../core/rubros.js";

/** Opciones por defecto por tipo (siempre presentes). */
const DEFAULTS = {
  rubro: RUBROS,
  sector: ["Cocina", "Parrilla", "Barra", "Fríos", "Pastelería", "Cafetería"],
  unidad_rendimiento: ["un", "porción", "ml", "l", "g", "kg", "docena"],
};

let CACHE = {}; // { tipo: Set<valor> } — valores agregados por el usuario

/** Carga el catálogo de la empresa a memoria. Best-effort. */
export async function cargar() {
  CACHE = {};
  try {
    const { data, error } = await supabase.from("catalogos").select("tipo, valor").eq("activo", true);
    if (error) throw error;
    for (const row of data || []) (CACHE[row.tipo] ||= new Set()).add(row.valor);
  } catch (_e) {
    // La tabla puede no existir aún: seguimos con defaults.
  }
  return CACHE;
}

/** Opciones combinadas (defaults + agregadas), ordenadas. */
export function opciones(tipo) {
  const set = new Set([...(DEFAULTS[tipo] || []), ...(CACHE[tipo] || [])]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** ¿Ya existe ese valor (default o agregado)? Compara sin distinguir mayúsculas. */
function yaExiste(tipo, valor) {
  const v = valor.toLowerCase();
  return opciones(tipo).some((o) => o.toLowerCase() === v);
}

/** Guarda una opción nueva si no existía. Best-effort (no rompe el guardado). */
export async function asegurar(empresaId, tipo, valor) {
  const v = (valor || "").trim();
  if (!v || !empresaId || yaExiste(tipo, v)) return;
  (CACHE[tipo] ||= new Set()).add(v);
  try {
    await supabase.from("catalogos").insert({ empresa_id: empresaId, tipo, valor: v });
  } catch (_e) {
    // Ignorar (tabla inexistente o duplicado): la opción igual queda en memoria.
  }
}
