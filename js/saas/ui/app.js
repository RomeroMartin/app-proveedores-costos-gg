// ============================================================
// saas/ui/app.js — Controlador de la primera versión SaaS
// ------------------------------------------------------------
// Rebanada vertical de prueba: login + pantalla de Proveedores
// contra Supabase (valida auth + RLS de punta a punta).
// La UI no calcula: usa core/ y los repos.
// ============================================================

import { login, logout, sesionActual, miPerfil, onCambioAuth } from "../auth.js";
import * as proveedoresRepo from "../data/proveedoresRepo.js";
import { CONDICIONES_FISCALES } from "../../core/fiscal.js";
import { formatearCentavos } from "../../core/dinero.js";

const $ = (sel) => document.querySelector(sel);

let perfil = null; // { id, empresa_id, rol, nombre, email, empresa: {...} }

// ---------- utilidades de UI ----------
function mostrar(el, visible) { el.hidden = !visible; }
function setMsg(el, texto, tipo = "info") {
  el.textContent = texto || "";
  el.dataset.tipo = tipo;
  mostrar(el, !!texto);
}

// ---------- login ----------
async function manejarLogin(e) {
  e.preventDefault();
  const email = $("#login-email").value;
  const pass = $("#login-pass").value;
  const msg = $("#login-msg");
  setMsg(msg, "Ingresando…");
  try {
    await login(email, pass);
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

  poblarCondiciones();
  await refrescarProveedores();
}

function poblarCondiciones() {
  const sel = $("#prov-condicion");
  sel.innerHTML = "";
  for (const c of CONDICIONES_FISCALES) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c.replace(/_/g, " ");
    sel.appendChild(opt);
  }
}

async function refrescarProveedores() {
  const cont = $("#prov-lista");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    const lista = await proveedoresRepo.listar();
    if (!lista.length) {
      cont.innerHTML = "<p class='muted'>Todavía no hay proveedores. Cargá el primero 👇</p>";
      return;
    }
    const filas = lista.map((p) => `
      <tr>
        <td>${p.codigo || ""}</td>
        <td>${escapar(p.nombre)}</td>
        <td>${(p.condicion_fiscal || "").replace(/_/g, " ")}</td>
        <td>${escapar(p.rubro_principal || "")}</td>
        <td class="num">${formatearCentavos(p.saldo_total_deuda_centavos || 0)}</td>
        <td><button data-id="${p.id}" class="btn-baja">Baja</button></td>
      </tr>`).join("");
    cont.innerHTML = `
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Condición</th><th>Rubro</th><th class="num">Saldo</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
    cont.querySelectorAll(".btn-baja").forEach((b) =>
      b.addEventListener("click", () => darDeBaja(b.dataset.id)));
  } catch (err) {
    cont.innerHTML = `<p class="error">Error al listar: ${escapar(err.message || String(err))}</p>`;
  }
}

async function manejarAltaProveedor(e) {
  e.preventDefault();
  const msg = $("#prov-msg");
  setMsg(msg, "Guardando…");
  try {
    await proveedoresRepo.crear(perfil.empresa_id, {
      nombre: $("#prov-nombre").value,
      cuit: $("#prov-cuit").value,
      condicion_fiscal: $("#prov-condicion").value,
      rubro_principal: $("#prov-rubro").value,
    });
    $("#form-proveedor").reset();
    poblarCondiciones();
    setMsg(msg, "Proveedor creado ✔", "ok");
    await refrescarProveedores();
  } catch (err) {
    setMsg(msg, "No se pudo crear: " + (err.message || err), "error");
  }
}

async function darDeBaja(id) {
  if (!confirm("¿Dar de baja este proveedor?")) return;
  try {
    await proveedoresRepo.desactivar(id);
    await refrescarProveedores();
  } catch (err) {
    alert("Error: " + (err.message || err));
  }
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- arranque ----------
async function init() {
  $("#form-login").addEventListener("submit", manejarLogin);
  $("#btn-logout").addEventListener("click", manejarLogout);
  $("#form-proveedor").addEventListener("submit", manejarAltaProveedor);
  $("#btn-refrescar").addEventListener("click", refrescarProveedores);

  const sesion = await sesionActual();
  if (sesion) {
    await entrarApp();
  } else {
    mostrar($("#login"), true);
  }
}

init();
