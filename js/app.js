// ============================================================
// app.js — Bootstrap y router de la app protegida (Sección 9)
// ============================================================

import { protegerApp, logout } from "./auth.js";
import { $, el, ico } from "./ui/helpers.js";
import { puede, badgeRol } from "./roles.js";
import * as store from "./store.js";
import * as dashboard from "./ui/dashboard.js";
import * as proveedores from "./ui/proveedores.js";
import * as insumos from "./ui/insumos.js";
import * as escandallos from "./ui/escandallos.js";
import * as usuarios from "./ui/usuarios.js";

// Cada ruta declara la capacidad que exige (roles.js decide quién la ve).
const RUTAS = [
  { hash: "dashboard", label: "Dashboard", icono: "dashboard", cap: "ver_dashboard", render: dashboard.render },
  { hash: "costos", label: "Costos", icono: "costos", cap: "ver_costos", render: escandallos.render },
  { hash: "insumos", label: "Insumos", icono: "insumos", cap: "ver_insumos", render: insumos.render },
  { hash: "proveedores", label: "Proveedores", icono: "proveedores", cap: "ver_proveedores", render: proveedores.render },
  { hash: "usuarios", label: "Usuarios", icono: "usuarios", cap: "gestionar_usuarios", render: usuarios.render },
];

function construirShell(usuario) {
  store.setUsuario(usuario);
  const rol = usuario.rol;
  const rutas = RUTAS.filter((r) => puede(rol, r.cap));

  const app = $("#app");
  app.innerHTML = "";

  const nav = el("nav", { class: "sidebar" });
  nav.appendChild(el("div", { class: "sidebar-brand" },
    el("span", { class: "marca-icon", html: ico("hoja", 18) }),
    el("span", {}, "GG Costos")));

  const links = rutas.map((r) => el("button", {
    class: "nav-link", dataset: { hash: r.hash },
    onClick: () => { location.hash = r.hash; },
  }, el("span", { html: ico(r.icono, 18) }), el("span", { class: "label" }, r.label)));
  links.forEach((l) => nav.appendChild(l));

  const b = badgeRol(rol);
  nav.appendChild(el("div", { class: "sidebar-footer" },
    el("div", { class: "flex items-center gap-8", style: "padding:8px 12px" },
      el("span", { class: "badge " + b.clase }, b.label),
      el("span", { class: "text-muted", style: "font-size:.72rem;overflow:hidden;text-overflow:ellipsis" }, usuario.nombre || usuario.email || "")),
    el("button", { class: "nav-link", onClick: async () => { await logout(); } },
      el("span", { html: ico("salir", 18) }), el("span", { class: "label" }, "Salir"))));

  const main = el("main", { class: "main" });
  app.appendChild(el("div", { class: "layout" }, nav, main));

  const inicio = rutas.length ? rutas[0].hash : "dashboard";

  function marcarActivo(hash) {
    links.forEach((l) => l.classList.toggle("active", l.dataset.hash === hash));
  }

  async function router() {
    let hash = (location.hash || "#" + inicio).replace("#", "");
    let ruta = rutas.find((r) => r.hash === hash);
    if (!ruta) {
      // Ruta inexistente o no permitida para el rol → ir al inicio permitido.
      if (location.hash.replace("#", "") !== inicio) { location.hash = inicio; return; }
      ruta = rutas[0];
    }
    if (!ruta) { main.innerHTML = ""; main.appendChild(el("div", { class: "empty-state" }, el("p", {}, "Tu rol no tiene pantallas asignadas."))); return; }
    marcarActivo(ruta.hash);
    try {
      await ruta.render(main);
    } catch (e) {
      console.error(e);
      main.innerHTML = "";
      main.appendChild(el("div", { class: "card" },
        el("p", { class: "card-title" }, "Error"),
        el("p", { class: "text-muted" }, e.message || "No se pudo cargar la vista."),
        el("p", { class: "form-hint" }, "Si es la primera vez, revisá que el proyecto Firebase esté configurado en js/config/firebase.js.")));
    }
  }
  window.addEventListener("hashchange", router);
  if (!location.hash) location.hash = inicio;
  router();
}

document.addEventListener("usuarioListo", (e) => construirShell(e.detail));
protegerApp();
