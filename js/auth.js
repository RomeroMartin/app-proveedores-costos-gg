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
import { ROL_POR_DEFECTO } from "./roles.js";

/**
 * Datos del usuario desde Firestore (colección `usuarios/{uid}`).
 * Si todavía no tiene perfil cargado, se asume rol por defecto (Gerente)
 * para no bloquear al dueño en un sistema recién iniciado. El Gerente puede
 * luego crear los perfiles del resto del equipo con rol Cargador.
 */
export async function obtenerDatosUsuario(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (!snap.exists()) return { uid, activo: true, rol: ROL_POR_DEFECTO, sinPerfil: true };
    const datos = { uid, ...snap.data() };
    if (!datos.rol) datos.rol = ROL_POR_DEFECTO;
    return datos;
  } catch (_e) {
    return { uid, activo: true, rol: ROL_POR_DEFECTO, sinPerfil: true };
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
