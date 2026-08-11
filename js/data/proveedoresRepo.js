// ============================================================
// data/proveedoresRepo.js — Colección `proveedores`
// ------------------------------------------------------------
// El saldo (saldo_total_deuda_centavos) NO se escribe desde acá:
// lo maneja el flujo de facturas/pagos con increment() atómico.
// ============================================================

import {
  db, collection, doc, getDoc, getDocs, query, where,
  addDoc, updateDoc, camposCreacion, camposModificacion,
  crearCache, siguienteCodigo,
} from "./_base.js";

const COL = "proveedores";
const cache = crearCache();

/** Lista de proveedores activos (con caché; forzar=true relee). */
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

/** Crea un proveedor. Devuelve el id nuevo. */
export async function crear(datos) {
  const existentes = await listar(true);
  const payload = {
    codigo: datos.codigo || siguienteCodigo("PROV", existentes),
    nombre: (datos.nombre || "").trim(),
    cuit: (datos.cuit || "").trim(),
    condicion_fiscal: datos.condicion_fiscal || "responsable_inscripto",
    contacto: (datos.contacto || "").trim(),
    telefono: (datos.telefono || "").trim(),
    email: (datos.email || "").trim(),
    rubros: Array.isArray(datos.rubros) ? datos.rubros : [],
    saldo_total_deuda_centavos: 0,
    ...camposCreacion(),
  };
  const ref = await addDoc(collection(db, COL), payload);
  cache.invalidar();
  return ref.id;
}

/** Edita datos de contacto/fiscales (nunca el saldo). */
export async function actualizar(id, datos) {
  const permitidos = ["nombre", "cuit", "condicion_fiscal", "contacto", "telefono", "email", "rubros"];
  const payload = {};
  for (const k of permitidos) if (k in datos) payload[k] = datos[k];
  await updateDoc(doc(db, COL, id), { ...payload, ...camposModificacion() });
  cache.invalidar();
}

/** Soft delete (Regla 3.7). */
export async function desactivar(id) {
  await updateDoc(doc(db, COL, id), { activo: false, ...camposModificacion() });
  cache.invalidar();
}

export function invalidarCache() { cache.invalidar(); }
