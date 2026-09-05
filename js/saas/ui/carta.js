// ============================================================
// saas/ui/carta.js — Carta: platos que se venden, por sector de despacho
// ============================================================

import * as recetasRepo from "../data/recetasRepo.js";
import * as insumosRepo from "../data/insumosRepo.js";
import { costoReceta, rentabilidad } from "../../core/costeo.js";
import { formatearCentavos, formatearPorcentaje } from "../../core/dinero.js";
import { exportarExcel } from "../../export/excel.js";
import { escapar, toast } from "./helpers.js";

const SIN_SECTOR = "Sin sector";

export async function montar(container) {
  container.innerHTML = "<p class='muted'>Cargando carta…</p>";
  let recetas = [], insumos = [];
  try { [recetas, insumos] = await Promise.all([recetasRepo.listar(), insumosRepo.listar()]); }
  catch (err) { container.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`; return; }

  const insMap = Object.fromEntries(insumos.map((i) => [i.id, i]));
  const recMap = Object.fromEntries(recetas.map((r) => [r.id, r]));
  const ctx = { getInsumo: (id) => insMap[id] || null, getReceta: (id) => recMap[id] || null };

  const platos = recetas.filter((r) => r.tipo === "plato").map((r) => {
    let costo = null, foodCost = null;
    try { costo = costoReceta(r, ctx); foodCost = rentabilidad(r, costo).foodCostPct; } catch (_e) {}
    return { nombre: r.nombre, sector: r.sector_venta || SIN_SECTOR, precio: r.precio_venta_publico_centavos || 0, costo, foodCost };
  });

  // Agrupar por sector.
  const porSector = {};
  for (const p of platos) (porSector[p.sector] ||= []).push(p);
  const sectores = Object.keys(porSector).sort((a, b) => (a === SIN_SECTOR ? 1 : b === SIN_SECTOR ? -1 : a.localeCompare(b)));

  const bloques = sectores.map((s) => {
    const filas = porSector[s].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => `<tr>
      <td>${escapar(p.nombre)}</td>
      <td class="num" style="font-weight:600;">${formatearCentavos(p.precio)}</td>
      <td class="num muted no-print">${p.foodCost == null ? "—" : escapar(formatearPorcentaje(p.foodCost))}</td>
    </tr>`).join("");
    return `<div class="card">
      <h3 style="margin:0 0 6px;">${escapar(s)}</h3>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Plato</th><th class="num">Precio</th><th class="num no-print">Food cost</th></tr></thead>
        <tbody>${filas}</tbody></table></div>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;">
      <h2 style="margin:0;">Carta</h2>
      <div class="no-print" style="display:flex;gap:8px;">
        <button id="carta-export" class="secundario">Exportar Excel</button>
        <button id="carta-print" class="secundario">Imprimir</button>
      </div>
    </div>
    ${platos.length ? bloques : `<div class="card"><p class="muted">No hay platos con precio. Cargalos en Platos y preparaciones.</p></div>`}`;

  const btnE = container.querySelector("#carta-export");
  if (btnE) btnE.addEventListener("click", () => exportar(platos));
  const btnP = container.querySelector("#carta-print");
  if (btnP) btnP.addEventListener("click", () => window.print());
}

function exportar(platos) {
  try {
    const filas = platos.map((p) => ({
      Sector: p.sector, Plato: p.nombre,
      "Precio ($)": p.precio / 100,
      "Costo ($)": p.costo == null ? "" : Math.round(p.costo) / 100,
      "Food cost %": p.foodCost == null ? "" : Number(p.foodCost.toFixed(1)),
    }));
    filas.sort((a, b) => a.Sector.localeCompare(b.Sector) || a.Plato.localeCompare(b.Plato));
    exportarExcel(filas, "carta", "Carta");
  } catch (e) { toast(e.message || "No se pudo exportar.", "error"); }
}
