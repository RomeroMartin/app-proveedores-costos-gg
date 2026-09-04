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

/** Ícono "i" de ayuda con tooltip propio (hover en desktop, click/tap en mobile). */
export function iconoInfo(texto) {
  const t = escapar(texto);
  return `<span class="hint" tabindex="0" role="button" aria-label="Ayuda: ${t}">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ` +
    `stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/>` +
    `<line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>` +
    `<span class="hint-bubble" role="tooltip">${t}</span></span>`;
}

/** Label con ícono de ayuda opcional. */
export function labelInfo(idFor, texto, hint) {
  return `<label for="${idFor}">${escapar(texto)}${hint ? " " + iconoInfo(hint) : ""}</label>`;
}

/** <datalist> con las opciones dadas (para inputs tipo combo: elegir o escribir). */
export function datalist(id, opciones) {
  return `<datalist id="${id}">` +
    (opciones || []).map((o) => `<option value="${escapar(o)}"></option>`).join("") +
    `</datalist>`;
}

/** Tarjeta KPI (HTML). tono: '' | 'ok' | 'danger' | 'warn'. hint: ayuda opcional. */
export function kpiHTML(titulo, valor, sub = "", tono = "", hint = "") {
  const color = tono === "danger" ? "var(--error)" : tono === "ok" ? "var(--ok)"
    : tono === "warn" ? "#b45309" : "var(--tinta)";
  return `<div class="kpi"><div class="kpi-t">${escapar(titulo)}${hint ? " " + iconoInfo(hint) : ""}</div>` +
    `<div class="kpi-v" style="color:${color}">${escapar(valor)}</div>` +
    `<div class="kpi-s">${escapar(sub)}</div></div>`;
}

/** Abre un modal y devuelve su cuerpo (elemento) para llenar. */
export function abrirModal(titulo, { ancho } = {}) {
  cerrarModal();
  const ov = document.createElement("div");
  ov.className = "modal-ov";
  ov.id = "modal-ov";
  ov.innerHTML =
    `<div class="modal"${ancho === "lg" ? ' style="max-width:780px"' : ""}>` +
    `<div class="modal-head"><h2>${escapar(titulo)}</h2>` +
    `<button class="modal-x" aria-label="Cerrar">✕</button></div>` +
    `<div class="modal-body"></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) cerrarModal(); });
  ov.querySelector(".modal-x").addEventListener("click", cerrarModal);
  return ov.querySelector(".modal-body");
}

/** Cierra el modal abierto (si hay). */
export function cerrarModal() {
  const m = document.getElementById("modal-ov");
  if (m) m.remove();
}
