// ============================================================
// data/usuariosRepo.js — Colección `usuarios` (perfiles y roles)
// ------------------------------------------------------------
// El documento se identifica por el UID de Firebase Authentication.
// Las firestore.rules restringen la escritura de otros perfiles al Gerente.
// ============================================================

import { db, collection, doc, getDoc, getDocs } from "./_base.js";
import { setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uid as uidActual } from "./_base.js";

const COL = "usuarios";

export async function listar() {
  const snap = await getDocs(collection(db, COL));
  const arr = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  arr.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  return arr;
}

export async function obtener(uid) {
  const snap = await getDoc(doc(db, COL, uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * Crea o actualiza el perfil de un usuario (merge).
 * @param {string} uid   UID de Firebase Authentication
 * @param {object} datos { nombre, email, rol, activo }
 */
export async function guardar(uid, datos) {
  const payload = {
    nombre: (datos.nombre || "").trim(),
    email: (datos.email || "").trim(),
    rol: datos.rol,
    activo: datos.activo !== false,
    modificado_en: serverTimestamp(),
    modificado_por: uidActual(),
  };
  await setDoc(doc(db, COL, uid), payload, { merge: true });
}
