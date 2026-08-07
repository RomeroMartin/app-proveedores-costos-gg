// ============================================================
// ui/helpers.js — Utilidades de presentación (DOM, toasts, modales)
// ------------------------------------------------------------
// /ui no calcula (usa /core) ni conoce Firebase (usa /data).
// ============================================================

/** querySelector corto. */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/**
 * Crea un elemento con atributos e hijos.
 * el("div", { class: "card" }, "texto", otroEl)
 */
export function el(tag, attrs = {}, ...hijos) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    node.appendChild(typeof h === "string" || typeof h === "number" ? document.createTextNode(String(h)) : h);
  }
  return node;
}

/** Vacía un contenedor. */
export function limpiar(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/** Escapa texto para innerHTML seguro. */
export function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Toasts ───────────────────────────────────────────────────
function stackToasts() {
  let s = $(".toast-stack");
  if (!s) { s = el("div", { class: "toast-stack" }); document.body.appendChild(s); }
  return s;
}
export function toast(mensaje, tipo = "ok", ms = 3200) {
  const t = el("div", { class: `toast ${tipo}` }, mensaje);
  stackToasts().appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, ms);
}

// ── Modal ─────────────────────────────────────────────────────
/**
 * Abre un modal. `contenido` es un nodo o string HTML para el body.
 * botones: [{ texto, clase, onClick(cerrar) }]. Devuelve una fn cerrar().
 */
export function abrirModal({ titulo, contenido, botones = [], ancho = "" }) {
  const overlay = el("div", { class: "modal-overlay" });
  const cerrar = () => overlay.remove();
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) cerrar(); });

  const body = el("div", { class: "modal-body" });
  if (typeof contenido === "string") body.innerHTML = contenido;
  else if (contenido) body.appendChild(contenido);

  const footer = el("div", { class: "modal-footer" });
  for (const b of botones) {
    footer.appendChild(el("button", {
      class: `btn ${b.clase || "btn-secondary"}`,
      onClick: () => b.onClick ? b.onClick(cerrar) : cerrar(),
    }, b.texto));
  }

  const modal = el("div", { class: `modal ${ancho === "lg" ? "modal-lg" : ""}` },
    el("div", { class: "modal-header" },
      el("h3", {}, titulo || ""),
      el("button", { class: "modal-close", onClick: cerrar, "aria-label": "Cerrar" }, "×"),
    ),
    body,
    botones.length ? footer : null,
  );
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { cerrar(); document.removeEventListener("keydown", onEsc); }
  });
  return { cerrar, body, overlay };
}

/** Diálogo de confirmación (promesa booleana). */
export function confirmar({ titulo = "Confirmar", mensaje, textoOk = "Confirmar", claseOk = "btn-danger" }) {
  return new Promise((resolve) => {
    abrirModal({
      titulo,
      contenido: el("p", { class: "text-muted" }, mensaje),
      botones: [
        { texto: "Cancelar", clase: "btn-secondary", onClick: (cerrar) => { cerrar(); resolve(false); } },
        { texto: textoOk, clase: claseOk, onClick: (cerrar) => { cerrar(); resolve(true); } },
      ],
    });
  });
}

/** Estado de carga dentro de un contenedor. */
export function mostrarCargando(node, texto = "Cargando…") {
  limpiar(node);
  node.appendChild(el("div", { class: "cargando" },
    el("span", { class: "spinner spinner-verde" }), texto));
}

/** Formatea una fecha (Timestamp/Date) como dd/mm/aaaa. */
export function fechaCorta(ts) {
  if (!ts) return "—";
  const d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Íconos SVG inline (stroke, estilo Green Garden) ──────────
const ICONOS = {
  dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  proveedores: 'M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 11l2 2 4-4',
  insumos: 'M20 7 12 3 4 7l8 4 8-4zM4 7v10l8 4 8-4V7M12 11v10',
  escandallos: 'M4 3h16v4H4zM4 10h10M4 14h10M4 18h6M17 11l4 4-4 4',
  hoja: 'M5.5 20C5 12.5 9.8 5.5 20 4.5c1 10-5 15.5-14.5 15.5ZM8.5 17c2.2-4.3 5.4-7 9.5-8.2',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  refrescar: 'M23 4v6h-6M1 20v-6h6M20.5 9A9 9 0 0 0 5.6 5.6L1 10M23 14l-4.6 4.4A9 9 0 0 1 3.5 15',
  mas: 'M12 5v14M5 12h14',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  excel: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13l6 6M15 13l-6 6',
};
/** Devuelve un SVG como string. */
export function ico(nombre, size = 18) {
  const d = ICONOS[nombre] || ICONOS.dashboard;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
