// ============================================================
// saas/ui/historial.js — Historial de precios por insumo
// ============================================================

import * as insumosRepo from "../data/insumosRepo.js";
import { formatearCentavos, formatearPorcentaje } from "../../core/dinero.js";
import { escapar } from "./helpers.js";

let INSUMOS = [];
const $ = (c, s) => c.querySelector(s);
const fmtFecha = (iso) => (iso ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(iso)) : "—");

export async function montar(container) {
  container.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Historial de precios</h2>
      <label for="hp-insumo">Insumo</label>
      <select id="hp-insumo"><option value="">— elegí un insumo —</option></select>
    </div>
    <div id="hp-detalle"></div>`;
  try {
    INSUMOS = await insumosRepo.listar();
  } catch (err) {
    $(container, "#hp-detalle").innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`;
    return;
  }
  const sel = $(container, "#hp-insumo");
  sel.innerHTML += INSUMOS.map((i) => `<option value="${i.id}">${escapar(i.nombre)}</option>`).join("");
  sel.addEventListener("change", () => seleccionar(container, sel.value));
  if (!INSUMOS.length) $(container, "#hp-detalle").innerHTML = `<div class="card"><p class="muted">No hay insumos cargados.</p></div>`;
}

async function seleccionar(container, id) {
  const det = $(container, "#hp-detalle");
  if (!id) { det.innerHTML = ""; return; }
  det.innerHTML = "<p class='muted'>Cargando…</p>";
  const insumo = INSUMOS.find((i) => i.id === id);
  let hist = [];
  try { hist = await insumosRepo.historial(id); } catch (err) { det.innerHTML = `<p class="error">${escapar(err.message)}</p>`; return; }

  if (!hist.length) { det.innerHTML = `<div class="card"><p class="muted">Sin historial para ${escapar(insumo.nombre)}.</p></div>`; return; }

  const primero = hist[0].costo_nuevo_centavos;
  const ultimo = hist[hist.length - 1].costo_nuevo_centavos;
  const variacionTotal = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;

  const filas = [...hist].reverse().map((h) => `<tr>
    <td>${fmtFecha(h.fecha)}</td>
    <td class="num">${formatearCentavos(h.costo_nuevo_centavos)}</td>
    <td class="num" style="color:${h.variacion_porcentual > 0 ? "var(--error)" : h.variacion_porcentual < 0 ? "var(--ok)" : "var(--muted)"};">
      ${h.variacion_porcentual > 0 ? "+" : ""}${escapar(formatearPorcentaje(h.variacion_porcentual))}</td>
    <td class="muted">${escapar(h.origen)}</td>
  </tr>`).join("");

  det.innerHTML = `
    <div class="card">
      <div class="topbar"><h2 style="margin:0;">${escapar(insumo.nombre)}</h2>
        <div class="muted">Variación total:
          <strong style="color:${variacionTotal > 0 ? "var(--error)" : "var(--ok)"};">${variacionTotal > 0 ? "+" : ""}${escapar(formatearPorcentaje(variacionTotal))}</strong>
          <span style="font-size:12px;">(${formatearCentavos(primero)} → ${formatearCentavos(ultimo)} por ${escapar(insumo.unidad_base)})</span>
        </div>
      </div>
      ${grafico(hist)}
      <div class="tabla-scroll" style="margin-top:12px;"><table>
        <thead><tr><th>Fecha</th><th class="num">Costo (${escapar(insumo.unidad_base)})</th><th class="num">Variación</th><th>Origen</th></tr></thead>
        <tbody>${filas}</tbody></table></div>
    </div>`;
}

/** Mini gráfico de líneas (SVG) de la evolución del costo. */
function grafico(hist) {
  if (hist.length < 2) return "";
  const W = 640, H = 120, P = 8;
  const vals = hist.map((h) => Number(h.costo_nuevo_centavos) || 0);
  const min = Math.min(...vals), max = Math.max(...vals);
  const rango = max - min || 1;
  const puntos = vals.map((v, i) => {
    const x = P + (i * (W - 2 * P)) / (vals.length - 1);
    const y = H - P - ((v - min) / rango) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<div class="tabla-scroll"><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:${H}px;">
    <polyline fill="none" stroke="var(--tinta)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${puntos.join(" ")}" />
    ${puntos.map((p) => { const [x, y] = p.split(","); return `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--tinta)" />`; }).join("")}
  </svg></div>`;
}
