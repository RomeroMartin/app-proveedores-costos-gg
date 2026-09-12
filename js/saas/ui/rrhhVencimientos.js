// ============================================================
// saas/ui/rrhhVencimientos.js — Tablero de vencimientos de documentación.
// Agrupa por empleado, vencidos primero. Click abre la ficha del empleado.
// ============================================================

import * as documentosRepo from "../data/documentosRepo.js";
import { formatearFecha } from "../../core/utilsFecha.js";
import { escapar, kpiHTML } from "./helpers.js";
import { abrirFicha } from "./rrhhFicha.js";

let CONT = null, PERFIL = null;

export async function montar(container, perfil) {
  CONT = container; PERFIL = perfil;
  await cargar();
}

async function cargar() {
  CONT.innerHTML = "<p class='muted'>Cargando…</p>";
  let items;
  try { items = await documentosRepo.listarVencimientos(); }
  catch (err) { CONT.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`; return; }
  render(items);
}

function render(items) {
  const vencidos = items.filter((d) => d.estado === "vencido");
  const porVencer = items.filter((d) => d.estado === "por_vencer");

  // Agrupar por empleado, respetando el orden (vencidos primero → dias_restantes asc).
  const grupos = new Map();
  for (const d of items) {
    if (!grupos.has(d.empleado_id)) grupos.set(d.empleado_id, { nombre: d.empleado, docs: [] });
    grupos.get(d.empleado_id).docs.push(d);
  }

  const bloques = [...grupos.entries()].map(([empId, g]) => {
    const filas = g.docs.map((d) => {
      const rojo = d.estado === "vencido";
      const etiqueta = rojo
        ? `<span class="rrhh-badge rojo">Vencido</span>`
        : `<span class="rrhh-badge ambar">Por vencer</span>`;
      const detalle = rojo
        ? `venció el ${escapar(formatearFecha(d.fecha_vencimiento))}`
        : `vence el ${escapar(formatearFecha(d.fecha_vencimiento))} · en ${d.dias_restantes} día${d.dias_restantes === 1 ? "" : "s"}`;
      return `<tr>
        <td>${escapar(d.tipo)}</td>
        <td>${etiqueta} <span class="muted" style="font-size:12px;">${detalle}</span></td>
      </tr>`;
    }).join("");
    return `<div class="card">
      <div class="topbar" style="margin-bottom:6px;">
        <h3 style="margin:0;font-size:14px;">${escapar(g.nombre)}</h3>
        <button class="secundario venc-ficha" data-id="${empId}">Ver ficha</button>
      </div>
      <div class="tabla-scroll"><table><tbody>${filas}</tbody></table></div>
    </div>`;
  }).join("");

  CONT.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Vencimientos de documentación</h2></div>
    <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);">
      ${kpiHTML("Vencidos", String(vencidos.length), "requieren acción ya", vencidos.length ? "danger" : "ok",
        "Documentos cuya fecha de vencimiento ya pasó (empleados activos).")}
      ${kpiHTML("Por vencer", String(porVencer.length), "en 30 días", porVencer.length ? "warn" : "ok",
        "Documentos que vencen dentro de los próximos 30 días.")}
    </div>
    ${items.length ? bloques : `<div class="card"><p class="muted" style="margin:0;">Todo al día. No hay documentos vencidos ni próximos a vencer. 🎉</p></div>`}`;

  CONT.querySelectorAll(".venc-ficha").forEach((b) =>
    b.addEventListener("click", () => abrirFicha(CONT, PERFIL, b.dataset.id, () => cargar(), "documentos")));
}
