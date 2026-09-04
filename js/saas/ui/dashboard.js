// ============================================================
// saas/ui/dashboard.js — Tablero general (resumen de todos los módulos)
// ------------------------------------------------------------
// Solo lectura. Tolerante a fallos: si falta una tabla (p. ej. agenda),
// esa sección se omite sin romper el resto.
// ============================================================

import * as proveedoresRepo from "../data/proveedoresRepo.js";
import * as facturasRepo from "../data/facturasRepo.js";
import * as agendaRepo from "../data/pagosProgramadosRepo.js";
import * as recetasRepo from "../data/recetasRepo.js";
import * as insumosRepo from "../data/insumosRepo.js";
import { costoReceta, rentabilidad } from "../../core/costeo.js";
import { formatearCentavos, formatearPorcentaje } from "../../core/dinero.js";
import { escapar, kpiHTML } from "./helpers.js";

const UMBRAL_FOODCOST = 35;   // %
const DIAS_PRECIO_VIEJO = 30; // días
const DIAS_VENCER = 7;

const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function addDias(fechaStr, n) { const d = new Date(fechaStr + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function diasHasta(fechaStr) { if (!fechaStr) return null; return Math.ceil((new Date(fechaStr + "T12:00:00").getTime() - Date.now()) / 86400000); }
function diasDesde(iso) { if (!iso) return Infinity; return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
const fondoDe = (m) => (m === "efectivo" || m === "otro" ? "efectivo" : "cuenta");
const val = (r) => (r.status === "fulfilled" ? r.value : []);

export async function montar(container) {
  container.innerHTML = "<p class='muted'>Cargando tablero…</p>";
  const [prov, pend, prog, recetas, insumos] = await Promise.allSettled([
    proveedoresRepo.listar(),
    facturasRepo.pendientesGlobal(),
    agendaRepo.listar(),
    recetasRepo.listar(),
    insumosRepo.listar(),
  ]);
  render(container, {
    proveedores: val(prov), pendientes: val(pend), programados: val(prog),
    recetas: val(recetas), insumos: val(insumos),
  });
}

function render(container, d) {
  const hoy = hoyStr();
  const provMap = Object.fromEntries(d.proveedores.map((p) => [p.id, p]));

  // Deuda
  const deudaTotal = d.proveedores.reduce((a, p) => a + (Number(p.saldo_total_deuda_centavos) || 0), 0);
  const topDeuda = [...d.proveedores].filter((p) => (p.saldo_total_deuda_centavos || 0) > 0)
    .sort((a, b) => b.saldo_total_deuda_centavos - a.saldo_total_deuda_centavos).slice(0, 5);

  // Facturas por vencer
  const porVencer = d.pendientes
    .map((f) => ({ f, dias: diasHasta(f.fecha_vencimiento) }))
    .filter((x) => x.dias !== null && x.dias <= DIAS_VENCER)
    .sort((a, b) => a.dias - b.dias);

  // Agenda próximos 7 días (pendientes)
  const prog = d.programados.filter((p) => p.estado === "pendiente");
  const limite = addDias(hoy, 7);
  const progRango = prog.filter((p) => p.fecha_programada <= limite); // incluye vencidos
  const efectivo7 = progRango.filter((p) => fondoDe(p.metodo_pago) === "efectivo").reduce((a, p) => a + p.monto_centavos, 0);
  const cuenta7 = progRango.filter((p) => fondoDe(p.metodo_pago) === "cuenta").reduce((a, p) => a + p.monto_centavos, 0);

  // Food cost de platos
  const insMap = Object.fromEntries(d.insumos.map((i) => [i.id, i]));
  const recMap = Object.fromEntries(d.recetas.map((r) => [r.id, r]));
  const ctx = { getInsumo: (id) => insMap[id] || null, getReceta: (id) => recMap[id] || null };
  const platos = [];
  for (const r of d.recetas.filter((x) => x.tipo === "plato" && (x.precio_venta_publico_centavos || 0) > 0)) {
    try {
      const costo = costoReceta(r, ctx);
      const rent = rentabilidad(r, costo);
      platos.push({ nombre: r.nombre, foodCost: rent.foodCostPct, margen: rent.margenBrutoCentavos });
    } catch (_e) { /* ciclo/insumo faltante: se omite */ }
  }
  const peores = [...platos].sort((a, b) => b.foodCost - a.foodCost).slice(0, 5);
  const sobreUmbral = platos.filter((p) => p.foodCost > UMBRAL_FOODCOST).length;

  // Insumos con precio desactualizado
  const desactualizados = d.insumos
    .map((i) => ({ i, dias: diasDesde(i.fecha_ultimo_precio) }))
    .filter((x) => x.dias > DIAS_PRECIO_VIEJO)
    .sort((a, b) => b.dias - a.dias);

  container.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;">
      <h2 style="margin:0;">Tablero</h2>
      <button id="dash-refrescar" class="secundario">Refrescar</button>
    </div>

    <div class="kpi-grid">
      ${kpiHTML("Deuda total", formatearCentavos(deudaTotal), `${topDeuda.length ? topDeuda.length + " con deuda" : "sin deuda"}`, deudaTotal > 0 ? "danger" : "ok",
        "Suma de todos los saldos que le debés a proveedores.")}
      ${kpiHTML("Facturas por vencer", String(porVencer.length), "en 7 días o menos", porVencer.length ? "warn" : "ok",
        "Facturas impagas que vencen en 7 días o menos (incluye vencidas).")}
      ${kpiHTML("A pagar (7 días)", formatearCentavos(efectivo7 + cuenta7), "según la agenda", (efectivo7 + cuenta7) ? "warn" : "ok",
        "Total agendado a pagar en los próximos 7 días (más lo vencido de la agenda).")}
      ${kpiHTML("Platos caros", String(sobreUmbral), `food cost > ${UMBRAL_FOODCOST}%`, sobreUmbral ? "danger" : "ok",
        "Cantidad de platos cuyo food cost supera el umbral objetivo (" + UMBRAL_FOODCOST + "%).")}
    </div>

    <div class="dos-col">
      ${cardTopDeuda(topDeuda)}
      ${cardPorVencer(porVencer, provMap)}
    </div>
    <div class="dos-col">
      ${cardFlujo(efectivo7, cuenta7, progRango.length)}
      ${cardFoodCost(peores)}
    </div>
    ${cardAlertas(desactualizados)}`;

  container.querySelector("#dash-refrescar").addEventListener("click", () => montar(container));
}

function tabla(cabeceras, filas, vacio) {
  if (!filas.length) return `<p class="muted">${vacio}</p>`;
  return `<div class="tabla-scroll"><table>
    <thead><tr>${cabeceras.map((c) => `<th${c.num ? ' class="num"' : ""}>${escapar(c.t)}</th>`).join("")}</tr></thead>
    <tbody>${filas.join("")}</tbody></table></div>`;
}

function cardTopDeuda(top) {
  const filas = top.map((p) => `<tr>
    <td>${escapar(p.nombre)}</td>
    <td class="num" style="color:var(--error);font-weight:600;">${formatearCentavos(p.saldo_total_deuda_centavos)}</td></tr>`);
  return `<div class="card"><h3 style="margin:0 0 8px;">Top deuda por proveedor</h3>
    ${tabla([{ t: "Proveedor" }, { t: "Saldo", num: true }], filas, "Sin deuda registrada.")}</div>`;
}

function cardPorVencer(porVencer, provMap) {
  const filas = porVencer.slice(0, 8).map(({ f, dias }) => {
    const prov = provMap[f.proveedor_id];
    const etq = dias < 0 ? `<span style="color:var(--error)">vencida hace ${-dias}d</span>` : dias === 0 ? `<span style="color:var(--error)">vence hoy</span>` : `en ${dias}d`;
    return `<tr>
      <td>${escapar(prov ? prov.nombre : "—")}<div class="muted" style="font-size:11.5px;">${escapar(f.numero_factura || "")}</div></td>
      <td>${etq}</td>
      <td class="num">${formatearCentavos(f.saldo_pendiente_centavos)}</td></tr>`;
  });
  return `<div class="card"><h3 style="margin:0 0 8px;">Próximas a vencer</h3>
    ${tabla([{ t: "Proveedor" }, { t: "Vence" }, { t: "Saldo", num: true }], filas, "Nada por vencer en 7 días. 🎉")}</div>`;
}

function cardFlujo(efectivo, cuenta, n) {
  return `<div class="card"><h3 style="margin:0 0 8px;">Flujo de caja (7 días)</h3>
    ${n ? `<div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div><div class="muted" style="font-size:12px;">Efectivo</div><div style="font-size:20px;font-weight:700;">${formatearCentavos(efectivo)}</div></div>
      <div><div class="muted" style="font-size:12px;">En cuenta</div><div style="font-size:20px;font-weight:700;">${formatearCentavos(cuenta)}</div></div>
      <div><div class="muted" style="font-size:12px;">Total</div><div style="font-size:20px;font-weight:700;">${formatearCentavos(efectivo + cuenta)}</div></div>
    </div><p class="muted" style="margin:8px 0 0;font-size:12px;">${n} pago(s) agendado(s). Detalle en Caja → Agenda de pagos.</p>`
    : `<p class="muted">No hay pagos agendados. Cargalos en Caja → Agenda de pagos.</p>`}</div>`;
}

function cardFoodCost(peores) {
  const filas = peores.map((p) => `<tr>
    <td>${escapar(p.nombre)}</td>
    <td class="num" style="color:${p.foodCost > UMBRAL_FOODCOST ? "var(--error)" : "var(--ok)"};font-weight:600;">${escapar(formatearPorcentaje(p.foodCost))}</td>
    <td class="num">${formatearCentavos(p.margen)}</td></tr>`);
  return `<div class="card"><h3 style="margin:0 0 8px;">Peor food cost (platos)</h3>
    ${tabla([{ t: "Plato" }, { t: "Food cost", num: true }, { t: "Margen", num: true }], filas, "Cargá platos con precio en Recetas y costos.")}</div>`;
}

function cardAlertas(desactualizados) {
  if (!desactualizados.length) return "";
  const filas = desactualizados.slice(0, 10).map(({ i, dias }) => `<tr>
    <td>${escapar(i.nombre)}</td>
    <td class="num">${dias === Infinity ? "sin fecha" : dias + " días"}</td></tr>`);
  return `<div class="card">
    <h3 style="margin:0 0 4px;">⚠ Precios desactualizados</h3>
    <p class="muted" style="margin:0 0 8px;font-size:12.5px;">Estos insumos no se actualizan hace más de ${DIAS_PRECIO_VIEJO} días. La rentabilidad mostrada puede ser optimista.</p>
    ${tabla([{ t: "Insumo" }, { t: "Última actualización", num: true }], filas, "")}</div>`;
}
