// ============================================================
// app.js — Bootstrap y router de la app protegida (Sección 9)
// ============================================================

import { protegerApp, logout } from "./auth.js";
import { $, el, toast, ico } from "./ui/helpers.js";
import * as dashboard from "./ui/dashboard.js";
import * as proveedores from "./ui/proveedores.js";
import * as insumos from "./ui/insumos.js";
import * as escandallos from "./ui/escandallos.js";

const RUTAS = [
  { hash: "dashboard", label: "Dashboard", icono: "dashboard", render: dashboard.render },
  { hash: "proveedores", label: "Proveedores", icono: "proveedores", render: proveedores.render },
  { hash: "insumos", label: "Insumos", icono: "insumos", render: insumos.render },
  { hash: "escandallos", label: "Escandallos", icono: "escandallos", render: escandallos.render },
];

function construirShell(usuario) {
  const app = $("#app");
  app.innerHTML = "";

  const nav = el("nav", { class: "sidebar" });
  nav.appendChild(el("div", { class: "sidebar-brand" },
    el("span", { class: "marca-icon", html: ico("hoja", 18) }),
    el("span", {}, "GG Costos")));

  const links = RUTAS.map((r) => el("button", {
    class: "nav-link", dataset: { hash: r.hash },
    onClick: () => { location.hash = r.hash; },
  }, el("span", { html: ico(r.icono, 18) }), el("span", { class: "label" }, r.label)));
  links.forEach((l) => nav.appendChild(l));

  nav.appendChild(el("div", { class: "sidebar-footer" },
    el("button", { class: "nav-link", onClick: async () => { await logout(); } },
      el("span", { html: ico("salir", 18) }), el("span", { class: "label" }, "Salir"))));

  const main = el("main", { class: "main" });
  app.appendChild(el("div", { class: "layout" }, nav, main));

  function marcarActivo(hash) {
    links.forEach((l) => l.classList.toggle("active", l.dataset.hash === hash));
  }

  async function router() {
    let hash = (location.hash || "#dashboard").replace("#", "");
    const ruta = RUTAS.find((r) => r.hash === hash) || RUTAS[0];
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
  if (!location.hash) location.hash = "dashboard";
  router();
}

// Arranque: proteger y, cuando el usuario esté listo, construir la app.
document.addEventListener("usuarioListo", (e) => construirShell(e.detail));
protegerApp();
