// ============================================================
// saas/ui/rentabilidad.js — Rentabilidad de carta (por plato y por sector)
// ============================================================

import * as recetasRepo from "../data/recetasRepo.js";
import * as insumosRepo from "../data/insumosRepo.js";
import { costoReceta, rentabilidad } from "../../core/costeo.js";
import { formatearCentavos, formatearPorcentaje } from "../../core/dinero.js";
import { escapar, kpiHTML } from "./helpers.js";

const SIN_SECTOR = "Sin sector";
const UMBRAL = 35; // %

// Semáforo por food cost.
function semaforo(fc) {
  if (fc == null) return "var(--muted)";
  if (fc <= 30) return "var(--ok)";
  if (fc <= UMBRAL) return "#b45309";
  return "var(--error)";
}

export async function montar(container) {
  container.innerHTML = "<p class='muted'>Calculando rentabilidad…</p>";
  let recetas = [], insumos = [];
  try { [recetas, insumos] = await Promise.all([recetasRepo.listar(), insumosRepo.listar()]); }
  catch (err) { container.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`; return; }

  const insMap = Object.fromEntries(insumos.map((i) => [i.id, i]));
  const recMap = Object.fromEntries(recetas.map((r) => [r.id, r]));
  const ctx = { getInsumo: (id) => insMap[id] || null, getReceta: (id) => recMap[id] || null };

  const platos = [];
  for (const r of recetas.filter((x) => x.tipo === "plato" && (x.precio_venta_publico_centavos || 0) > 0)) {
    try {
      const costo = costoReceta(r, ctx);
      const rent = rentabilidad(r, costo);
      platos.push({
        nombre: r.nombre, sector: r.sector_venta || SIN_SECTOR,
        costo, precio: r.precio_venta_publico_centavos || 0,
        foodCost: rent.foodCostPct, margen: rent.margenBrutoCentavos,
      });
    } catch (_e) {}
  }

  if (!platos.length) {
    container.innerHTML = `<div class="topbar"><h2 style="margin:0;">Rentabilidad de carta</h2></div>
      <div class="card"><p class="muted">No hay platos con precio para analizar. Cargalos en Platos y preparaciones.</p></div>`;
    return;
  }

  const fcProm = platos.reduce((a, p) => a + p.foodCost, 0) / platos.length;
  const margenTotal = platos.reduce((a, p) => a + p.margen, 0);
  const sobre = platos.filter((p) => p.foodCost > UMBRAL).length;

  // Por sector.
  const porSector = {};
  for (const p of platos) {
    const s = (porSector[p.sector] ||= { costo: 0, precio: 0, margen: 0, n: 0 });
    s.costo += p.costo; s.precio += p.precio; s.margen += p.margen; s.n++;
  }
  const filasSector = Object.entries(porSector).sort((a, b) => a[0].localeCompare(b[0])).map(([s, d]) => {
    const fc = d.precio > 0 ? (d.costo / d.precio) * 100 : 0;
    return `<tr>
      <td>${escapar(s)}</td><td class="num">${d.n}</td>
      <td class="num" style="color:${semaforo(fc)};font-weight:600;">${escapar(formatearPorcentaje(fc))}</td>
      <td class="num">${formatearCentavos(d.margen)}</td>
    </tr>`;
  }).join("");

  const filasPlato = [...platos].sort((a, b) => b.foodCost - a.foodCost).map((p) => `<tr>
    <td>${escapar(p.nombre)}</td>
    <td class="muted">${escapar(p.sector)}</td>
    <td class="num">${formatearCentavos(p.costo)}</td>
    <td class="num">${formatearCentavos(p.precio)}</td>
    <td class="num" style="color:${semaforo(p.foodCost)};font-weight:600;">${escapar(formatearPorcentaje(p.foodCost))}</td>
    <td class="num">${formatearCentavos(p.margen)}</td>
  </tr>`).join("");

  container.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Rentabilidad de carta</h2></div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);">
      ${kpiHTML("Food cost promedio", formatearPorcentaje(fcProm), `${platos.length} platos`, fcProm > UMBRAL ? "danger" : "ok",
        "Promedio del food cost de todos los platos con precio. Cuanto más bajo, mejor.")}
      ${kpiHTML("Platos sobre umbral", String(sobre), `food cost > ${UMBRAL}%`, sobre ? "danger" : "ok",
        "Platos cuyo costo se lleva más del " + UMBRAL + "% del precio. Conviene revisar receta o precio.")}
      ${kpiHTML("Margen total (unitario)", formatearCentavos(margenTotal), "suma por 1 unidad c/u", "",
        "Suma del margen (precio − costo) de una unidad de cada plato. Referencia, no ventas reales.")}
    </div>

    <div class="card">
      <h3 style="margin:0 0 6px;">Por sector de despacho</h3>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Sector</th><th class="num">Platos</th><th class="num">Food cost</th><th class="num">Margen</th></tr></thead>
        <tbody>${filasSector}</tbody></table></div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 6px;">Por plato (peor food cost primero)</h3>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Plato</th><th>Sector</th><th class="num">Costo</th><th class="num">Precio</th><th class="num">Food cost</th><th class="num">Margen</th></tr></thead>
        <tbody>${filasPlato}</tbody></table></div>
      <p class="muted" style="margin:8px 0 0;font-size:12px;">🟢 ≤ 30% · 🟡 30–${UMBRAL}% · 🔴 > ${UMBRAL}%</p>
    </div>`;
}
