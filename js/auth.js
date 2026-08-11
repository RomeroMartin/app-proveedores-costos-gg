// ============================================================
// auth.js — Autenticación y guardián de rutas
// ------------------------------------------------------------
// La app es 100 % frontend; esta capa es UX. La barrera real de
// seguridad son las firestore.rules (Regla 3.6).
// ============================================================

import { auth, db, EMAIL_DUENO } from "./config/firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ROLES } from "./roles.js";

/** ¿El email es el del dueño? (comparación robusta, sin mayúsculas/espacios) */
export function esEmailDueno(email) {
  return !!email && email.trim().toLowerCase() === EMAIL_DUENO.trim().toLowerCase();
}

/**
 * Datos del usuario desde Firestore (colección `usuarios/{uid}`).
 * Si todavía no tiene perfil: al DUEÑO se lo trata como Gerente (para poder
 * arrancar), al resto como Cargador (mínimo privilegio). Las firestore.rules
 * son la barrera real: sin perfil de Gerente no se puede gestionar nada.
 */
export async function obtenerDatosUsuario(uid, email) {
  const rolSinPerfil = esEmailDueno(email) ? ROLES.GERENTE : ROLES.CARGADOR;
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (!snap.exists()) return { uid, email: email || "", activo: true, rol: rolSinPerfil, sinPerfil: true };
    const datos = { uid, ...snap.data() };
    if (!datos.rol) datos.rol = rolSinPerfil;
    return datos;
  } catch (_e) {
    return { uid, email: email || "", activo: true, rol: rolSinPerfil, sinPerfil: true };
  }
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // Bootstrap del dueño sin consola: la primera vez (o si perdió su perfil)
  // se crea a sí mismo como Gerente activo. Las reglas solo lo permiten para
  // el email del dueño; nadie más puede escribir su propio perfil.
  if (esEmailDueno(cred.user.email)) {
    const ref = doc(db, "usuarios", cred.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        nombre: "Gerente", email: cred.user.email, rol: ROLES.GERENTE, activo: true,
        creado_en: serverTimestamp(), modificado_en: serverTimestamp(),
      });
    }
  }
  const datos = await obtenerDatosUsuario(cred.user.uid, cred.user.email);
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

/** Envía un correo para restablecer/crear una nueva contraseña. */
export async function recuperarPassword(email) {
  await sendPasswordResetEmail(auth, (email || "").trim());
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
    const datos = await obtenerDatosUsuario(user.uid, user.email);
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
