// ============================================================
// saas/ui/helpers.js — utilidades chicas de UI compartidas
// ============================================================

/** Muestra u oculta un elemento (usa el atributo hidden). */
export function mostrar(el, visible) { el.hidden = !visible; }

/** Escapa texto para insertarlo seguro como HTML. */
export function escapar(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Escribe un mensaje con tipo (info|ok|error) y lo muestra/oculta. */
export function setMsg(el, texto, tipo = "info") {
  el.textContent = texto || "";
  el.dataset.tipo = tipo;
  el.hidden = !texto;
}
