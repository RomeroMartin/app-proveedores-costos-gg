// ============================================================
// version.js — Fuente única de la versión de la app.
// El sello se auto-estiliza (no depende del CSS del proyecto).
// ============================================================

export const APP_VERSION = "0.5.0";

function aplicarVersion() {
  // Rellena SOLO los sellos existentes (ej. el del login). Ya no crea uno
  // flotante por su cuenta: en la app, la versión se muestra en la barra
  // lateral (ver js/app.js), leyendo APP_VERSION de este mismo archivo.
  const sellos = document.querySelectorAll(".app-version");
  sellos.forEach((el) => {
    el.textContent = "v" + APP_VERSION;
    el.style.cssText =
      "position:fixed;bottom:8px;right:10px;" +
      "font:600 11px/1 ui-monospace,monospace;color:#9a7f43;" +
      "background:rgba(248,244,234,0.92);border:1px solid #ddd0b8;" +
      "padding:3px 9px;border-radius:20px;z-index:99999;" +
      "pointer-events:none;letter-spacing:0.5px;box-shadow:0 1px 4px rgba(0,0,0,0.08);";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aplicarVersion);
} else {
  aplicarVersion();
}

console.log(
  "%c🌿 Green Garden — Costos y Proveedores v" + APP_VERSION,
  "color:#157A50;font-weight:bold;font-size:13px;"
);
