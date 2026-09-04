// ============================================================
// saas/ui/app.js — Shell de la app SaaS (auth + navegación)
// ------------------------------------------------------------
// Orquesta login/logout y monta cada pantalla dentro de #screen.
// Cada pantalla vive en su propio módulo y expone montar(container, perfil).
// ============================================================

import { login, logout, sesionActual, miPerfil } from "../auth.js";
import { mostrar, setMsg } from "./helpers.js";
import * as proveedores from "./proveedores.js";
import * as insumos from "./insumos.js";

const $ = (sel) => document.querySelector(sel);

let perfil = null;

const PANTALLAS = {
  proveedores: { titulo: "Proveedores", montar: proveedores.montar },
  insumos: { titulo: "Insumos", montar: insumos.montar },
};
const ORDEN = ["proveedores", "insumos"];

// ---------- login ----------
async function manejarLogin(e) {
  e.preventDefault();
  const msg = $("#login-msg");
  setMsg(msg, "Ingresando…");
  try {
    await login($("#login-email").value, $("#login-pass").value);
    setMsg(msg, "");
    await entrarApp();
  } catch (err) {
    setMsg(msg, "No se pudo iniciar sesión: " + (err.message || err), "error");
  }
}

async function manejarLogout() {
  await logout();
  perfil = null;
  mostrar($("#app"), false);
  mostrar($("#login"), true);
}

// ---------- app ----------
async function entrarApp() {
  perfil = await miPerfil();
  if (!perfil) {
    setMsg($("#login-msg"),
      "Tu usuario no tiene empresa asignada. Corré supabase/bootstrap.sql.", "error");
    return;
  }
  mostrar($("#login"), false);
  mostrar($("#app"), true);
  $("#empresa-nombre").textContent = perfil.empresa ? perfil.empresa.nombre : "(sin empresa)";
  $("#usuario-info").textContent = `${perfil.nombre} · ${perfil.rol}`;

  construirNav();
  await irA(ORDEN[0]);
}

function construirNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  for (const clave of ORDEN) {
    const btn = document.createElement("button");
    btn.className = "nav-btn";
    btn.dataset.pantalla = clave;
    btn.textContent = PANTALLAS[clave].titulo;
    btn.addEventListener("click", () => irA(clave));
    nav.appendChild(btn);
  }
}

async function irA(clave) {
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("activo", b.dataset.pantalla === clave));
  const cont = $("#screen");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    await PANTALLAS[clave].montar(cont, perfil);
  } catch (err) {
    cont.innerHTML = `<p class="error">Error: ${err.message || err}</p>`;
  }
}

// ---------- arranque ----------
async function init() {
  $("#form-login").addEventListener("submit", manejarLogin);
  $("#btn-logout").addEventListener("click", manejarLogout);

  const sesion = await sesionActual();
  if (sesion) await entrarApp();
  else mostrar($("#login"), true);
}

init();
