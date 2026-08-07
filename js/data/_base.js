// ============================================================
// data/_base.js — Utilidades compartidas de la capa de datos
// ------------------------------------------------------------
// /data no conoce el DOM. Encapsula Firestore y expone repos.
// Estrategia de lectura (Sección 4.2): getDocs() + caché en memoria
// con refresco manual. Sin onSnapshot por defecto.
// ============================================================

import { db, auth } from "../config/firebase.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy,
  addDoc, updateDoc, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export { db, collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, updateDoc, serverTimestamp, Timestamp };

/** UID del usuario actual (para campos de auditoría). */
export function uid() {
  return auth.currentUser ? auth.currentUser.uid : "desconocido";
}

/** Campos de auditoría para una creación. */
export function camposCreacion() {
  const u = uid();
  return {
    activo: true,
    creado_en: serverTimestamp(),
    creado_por: u,
    modificado_en: serverTimestamp(),
    modificado_por: u,
  };
}

/** Campos de auditoría para una modificación. */
export function camposModificacion() {
  return {
    modificado_en: serverTimestamp(),
    modificado_por: uid(),
  };
}

/**
 * Caché simple en memoria por colección, con invalidación manual.
 * Evita relecturas costosas de Firestore (que factura por documento).
 */
export function crearCache() {
  let datos = null;
  return {
    get: () => datos,
    set: (v) => { datos = v; return v; },
    invalidar: () => { datos = null; },
    vigente: () => datos !== null,
  };
}

/** Genera el próximo código legible tipo "PROV-001" a partir de los existentes. */
export function siguienteCodigo(prefijo, existentes) {
  let max = 0;
  const re = new RegExp(`^${prefijo}-(\\d+)$`);
  for (const it of existentes || []) {
    const m = re.exec(it.codigo || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefijo}-${String(max + 1).padStart(3, "0")}`;
}

/** Convierte un Timestamp de Firestore (o Date/valor) a Date, tolerante a nulos. */
export function aFecha(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

/** Días transcurridos desde una fecha hasta hoy. */
export function diasDesde(ts) {
  const f = aFecha(ts);
  if (!f) return Infinity;
  return Math.floor((Date.now() - f.getTime()) / 86400000);
}
