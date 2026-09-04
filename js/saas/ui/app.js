// ============================================================
// saas/ui/app.js — Shell de la app SaaS (auth + menú lateral)
// ------------------------------------------------------------
// Sidebar con módulos desplegables (estilo Supabase/Firebase).
// Cada pantalla es un módulo con montar(container, perfil).
// Para agregar una pantalla: sumá una entrada a MENU con su montar.
// ============================================================

import { login, logout, sesionActual, miPerfil } from "../auth.js";
import { mostrar, setMsg } from "./helpers.js";
import * as proveedores from "./proveedores.js";
import * as insumos from "./insumos.js";

const $ = (sel) => document.querySelector(sel);

let perfil = null;

// Placeholder para módulos aún no construidos.
function proximamente(titulo) {
  return (container) => {
    container.innerHTML =
      `<div class="card"><h2 style="margin-top:0;">${titulo}</h2>
       <p class="muted">Módulo en construcción 🚧</p></div>`;
  };
}

// Registro del menú: grupos (módulos) → items (pantallas).
const MENU = [
  {
    id: "compras", titulo: "Compras", icono: "🧾",
    items: [
      { clave: "proveedores", titulo: "Proveedores", montar: proveedores.montar },
      { clave: "facturas", titulo: "Facturas", montar: proximamente("Facturas") },
      { clave: "pagos", titulo: "Pagos", montar: proximamente("Pagos") },
    ],
  },
  {
    id: "costos", titulo: "Costos", icono: "📦",
    items: [
      { clave: "insumos", titulo: "Insumos", montar: insumos.montar },
      { clave: "historial", titulo: "Historial de precios", montar: proximamente("Historial de precios") },
    ],
  },
  {
    id: "rentabilidad", titulo: "Rentabilidad", icono: "📈",
    items: [
      { clave: "recetas", titulo: "Escandallos / Recetas", montar: proximamente("Escandallos / Recetas") },
    ],
  },
];

const ITEMS = Object.fromEntries(MENU.flatMap((g) => g.items.map((it) => [it.clave, it])));
const CLAVE_INICIAL = "proveedores";
const LS_ULTIMA = "saas_ultima_pantalla";

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

  $("#marca-empresa").textContent = perfil.empresa ? perfil.empresa.nombre : "(sin empresa)";
  $("#marca-empresa-top").textContent = perfil.empresa ? perfil.empresa.nombre : "";
  $("#user-nombre").textContent = perfil.nombre;
  $("#user-rol").textContent = perfil.rol;
  $("#avatar").textContent = (perfil.nombre || "?").trim().charAt(0).toUpperCase() || "·";

  construirMenu();

  let inicial = CLAVE_INICIAL;
  try { const g = localStorage.getItem(LS_ULTIMA); if (g && ITEMS[g]) inicial = g; } catch (_e) {}
  await irA(inicial);
}

function grupoDe(clave) {
  return MENU.find((g) => g.items.some((it) => it.clave === clave));
}

function construirMenu() {
  const nav = $("#menu");
  nav.innerHTML = "";
  for (const grupo of MENU) {
    const sec = document.createElement("div");
    sec.className = "menu-grupo";
    sec.dataset.grupo = grupo.id;

    const header = document.createElement("button");
    header.className = "menu-grupo-head";
    header.innerHTML =
      `<span class="menu-ico">${grupo.icono}</span>
       <span class="menu-titulo">${grupo.titulo}</span>
       <span class="menu-chevron">›</span>`;
    header.addEventListener("click", () => sec.classList.toggle("abierto"));
    sec.appendChild(header);

    const ul = document.createElement("div");
    ul.className = "menu-items";
    for (const it of grupo.items) {
      const b = document.createElement("button");
      b.className = "menu-item";
      b.dataset.clave = it.clave;
      b.textContent = it.titulo;
      b.addEventListener("click", () => irA(it.clave));
      ul.appendChild(b);
    }
    sec.appendChild(ul);
    nav.appendChild(sec);
  }
}

async function irA(clave) {
  const item = ITEMS[clave];
  if (!item) return;
  try { localStorage.setItem(LS_ULTIMA, clave); } catch (_e) {}

  // Abrir el grupo del item activo y marcar el item.
  const grupo = grupoDe(clave);
  document.querySelectorAll(".menu-grupo").forEach((s) =>
    s.classList.toggle("abierto", grupo && s.dataset.grupo === grupo.id));
  document.querySelectorAll(".menu-item").forEach((b) =>
    b.classList.toggle("activo", b.dataset.clave === clave));

  cerrarSidebarMobile();

  const cont = $("#screen");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    await item.montar(cont, perfil);
  } catch (err) {
    cont.innerHTML = `<p class="error">Error: ${err.message || err}</p>`;
  }
}

// ---------- sidebar mobile ----------
function abrirSidebarMobile() { $("#app").classList.add("sidebar-abierta"); }
function cerrarSidebarMobile() { $("#app").classList.remove("sidebar-abierta"); }

// ---------- arranque ----------
async function init() {
  $("#form-login").addEventListener("submit", manejarLogin);
  document.querySelectorAll(".btn-logout").forEach((b) => b.addEventListener("click", manejarLogout));
  $("#btn-menu").addEventListener("click", abrirSidebarMobile);
  $("#overlay").addEventListener("click", cerrarSidebarMobile);

  const sesion = await sesionActual();
  if (sesion) await entrarApp();
  else mostrar($("#login"), true);
}

init();
