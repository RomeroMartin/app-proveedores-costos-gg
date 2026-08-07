// ============================================================
// auth.js — Autenticación y guardián de rutas
// ------------------------------------------------------------
// La app es 100 % frontend; esta capa es UX. La barrera real de
// seguridad son las firestore.rules (Regla 3.6).
// ============================================================

import { auth, db } from "./config/firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Datos del usuario desde Firestore (colección `usuarios/{uid}`).
 * Un usuario debe existir y estar activo para operar.
 */
export async function obtenerDatosUsuario(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (!snap.exists()) return null;
    return { uid, ...snap.data() };
  } catch (_e) {
    // Si no existe la colección/usuario, tratamos como autenticado básico.
    return { uid, activo: true };
  }
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const datos = await obtenerDatosUsuario(cred.user.uid);
  if (datos && datos.activo === false) {
    await signOut(auth);
    throw new Error("Tu cuenta está desactivada. Consultá al administrador.");
  }
  window.location.href = "./app.html";
}

export async function logout() {
  await signOut(auth);
  window.location.href = "./index.html";
}

/**
 * Protege la app: si no hay sesión activa, redirige al login.
 * Emite el evento `usuarioListo` con los datos del usuario cuando valida.
 */
export function protegerApp() {
  document.body.style.visibility = "hidden";
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "./index.html";
      return;
    }
    const datos = await obtenerDatosUsuario(user.uid);
    if (datos && datos.activo === false) {
      await logout();
      return;
    }
    document.body.style.visibility = "visible";
    document.dispatchEvent(new CustomEvent("usuarioListo", { detail: datos || { uid: user.uid } }));
  });
}

/**
 * En el login: si ya hay sesión activa, ir directo a la app.
 * @param {() => void} onSinSesion  se llama cuando se confirma que NO hay sesión.
 */
export function redirigirSiYaLogeado(onSinSesion) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "./app.html";
    } else if (onSinSesion) {
      onSinSesion();
    }
  });
}

export function usuarioActual() {
  return auth.currentUser;
}
