// ============================================================
// store.js — Estado en memoria de la app (Sección 4.2)
// ------------------------------------------------------------
// Carga los datos con getDocs (sin onSnapshot) y los cachea. La UI pide
// refrescos manuales. Arma el contexto de costeo (proveedor + tipo de
// comprobante) de cada insumo.
// NOTA: por decisión de la administración (2026-08) el costo se calcula por
// el PRECIO FINAL con IVA incluido, así que el tipo de comprobante ya NO
// afecta el costo (ver core/costeo.js → costoRealPorUnidadBase). El contexto
// se mantiene por compatibilidad y para posibles usos futuros.
// ============================================================

import * as proveedoresRepo from "./data/proveedoresRepo.js";
import * as insumosRepo from "./data/insumosRepo.js";
import * as recetasRepo from "./data/recetasRepo.js";
import { costoReceta } from "./core/costeo.js";

const state = {
  proveedores: [],
  insumos: [],
  recetas: [],
  proveedoresById: {},
  insumosById: {},
  recetasById: {},
  cargado: false,
  usuario: null, // { uid, nombre, email, rol, activo }
};

/** Guarda el usuario autenticado (con su rol) para el gating de la UI. */
export function setUsuario(u) { state.usuario = u; }
export function getUsuario() { return state.usuario; }
export function getRol() { return state.usuario ? state.usuario.rol : null; }

function reindexar() {
  state.proveedoresById = Object.fromEntries(state.proveedores.map((p) => [p.id, p]));
  state.insumosById = Object.fromEntries(state.insumos.map((i) => [i.id, i]));
  state.recetasById = Object.fromEntries(state.recetas.map((r) => [r.id, r]));
}

/** Carga (o recarga) todas las colecciones base en paralelo. */
export async function cargar(forzar = false) {
  const [prov, ins, rec] = await Promise.all([
    proveedoresRepo.listar(forzar),
    insumosRepo.listar(forzar),
    recetasRepo.listar(forzar),
  ]);
  state.proveedores = prov;
  state.insumos = ins;
  state.recetas = rec;
  reindexar();
  state.cargado = true;
  return state;
}

export function get() { return state; }

/** Resuelve, para un insumo, el proveedor y comprobante a usar en el costeo. */
export function contextoInsumo(insumo) {
  const prov = insumo && insumo.proveedor_habitual_id
    ? state.proveedoresById[insumo.proveedor_habitual_id]
    : null;
  if (!prov) {
    // Sin proveedor asignado: se asume el caso más común (Factura A + RI).
    return { proveedor: { condicion_fiscal: "responsable_inscripto" }, tipoComprobante: "A" };
  }
  const tipoComprobante = prov.condicion_fiscal === "responsable_inscripto" ? "A" : "C";
  return { proveedor: prov, tipoComprobante };
}

/** Contexto listo para pasar a core/costeo. */
export function ctxCosteo() {
  return {
    getInsumo: (id) => state.insumosById[id],
    getReceta: (id) => state.recetasById[id],
    contextoInsumo,
  };
}

/** Costo (centavos, redondeado) de una receta con el estado actual. */
export function costoDeReceta(receta) {
  try {
    return Math.round(costoReceta(receta, ctxCosteo()));
  } catch (_e) {
    return null; // ciclo o insumo faltante
  }
}
