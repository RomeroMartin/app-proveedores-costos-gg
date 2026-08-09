// ============================================================
// ui/dashboard.js — Panel principal (Sección 7.1)
// ------------------------------------------------------------
// Deuda consolidada + top proveedores, facturas por vencer, platos con
// peor costo sobre venta, panel de alertas (precios desactualizados, recetas sobre
// el umbral). Exportación a Excel.
// ============================================================

import { $, el, limpiar, toast, mostrarCargando, fechaCorta, ico } from "./helpers.js";
import { formatearCentavos, formatearPorcentaje } from "../core/dinero.js";
import { rentabilidad } from "../core/costeo.js";
import * as facturasRepo from "../data/facturasRepo.js";
import { exportarExcel } from "../export/excel.js";
import * as store from "../store.js";

const UMBRAL_FOODCOST = 35;
const DIAS_DESACTUALIZADO = 30;
const DIAS_POR_VENCER = 7;

function diasHasta(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
function diasDesde(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  if (!d) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export async function render(main) {
  main.innerHTML = "";
  main.appendChild(el("div", { class: "page-header" },
    el("div", {},
      el("div", { class: "page-title" }, "Tablero"),
      el("div", { class: "page-subtitle" }, "Deuda, vencimientos, rentabilidad y alertas."),
    ),
    el("button", { class: "btn btn-secondary", onClick: () => render(main) }, el("span", { html: ico("refrescar", 16) }), "Refrescar"),
  ));
  const cont = el("div", {});
  main.appendChild(cont);

  mostrarCargando(cont, "Calculando…");
  await store.cargar(true);
  const { proveedores, insumos, recetas } = store.get();
  let pendientes = [];
  try { pendientes = await facturasRepo.pendientesGlobal(); }
  catch (e) { /* colección vacía o índice faltante */ }
  limpiar(cont);

  // ── KPIs ──
  const deudaTotal = proveedores.reduce((a, p) => a + (Number(p.saldo_total_deuda_centavos) || 0), 0);
  const provConDeuda = proveedores.filter((p) => (Number(p.saldo_total_deuda_centavos) || 0) > 0).length;
  const platos = recetas.filter((r) => r.tipo === "plato");
  const rents = platos.map((p) => ({ p, r: rentabilidad(p, store.costoDeReceta(p) || 0) }))
    .filter((x) => x.p.precio_venta_publico_centavos > 0);
  const promFoodCost = rents.length ? rents.reduce((a, x) => a + x.r.foodCostPct, 0) / rents.length : 0;

  cont.appendChild(el("div", { class: "kpi-grid" },
    kpi("Deuda total", formatearCentavos(deudaTotal), `${provConDeuda} con deuda`, deudaTotal > 0 ? "danger" : "ok",
      "Total que le debés a tus proveedores (suma de todos los saldos). El subtítulo indica cuántos proveedores tienen deuda."),
    kpi("Facturas pendientes", String(pendientes.length), "", "",
      "Cantidad de facturas impagas, con saldo total o parcial. No incluye las pagadas ni las anuladas."),
    kpi("Costo promedio %", rents.length ? formatearPorcentaje(promFoodCost, 1) : "—", `${platos.length} platos`, promFoodCost > UMBRAL_FOODCOST ? "warn" : "ok",
      "Promedio del costo (con IVA) sobre el precio de carta de todos tus platos. Cuanto más bajo, más rentable."),
    kpi("Cant. Insumos", String(insumos.length), "materia prima", "",
      "Cantidad de insumos (materia prima) cargados en el sistema."),
  ));

  // ── Columnas ──
  const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:6px" });
  cont.appendChild(grid);

  // Top proveedores por deuda: los 5 con mayor deuda (de mayor a menor).
  const topProv = [...proveedores]
    .sort((a, b) => (Number(b.saldo_total_deuda_centavos) || 0) - (Number(a.saldo_total_deuda_centavos) || 0))
    .slice(0, 5);
  grid.appendChild(tarjetaLista("Top proveedores por deuda", topProv.length
    ? topProv.map((p) => {
        const saldo = Number(p.saldo_total_deuda_centavos) || 0;
        return fila(p.nombre, formatearCentavos(saldo), saldo > 0 ? "badge-danger" : "badge-muted");
      })
    : [vacio("No hay proveedores cargados.")],
    "Los 5 proveedores a los que más les debés, ordenados de mayor a menor deuda."));

  // Facturas próximas a vencer
  // Todas las que vencen en DIAS_POR_VENCER días o menos (incluye vencidas), sin tope.
  const porVencer = pendientes
    .map((f) => ({ f, dias: diasHasta(f.fecha_vencimiento) }))
    .filter((x) => x.dias !== null && x.dias <= DIAS_POR_VENCER)
    .sort((a, b) => a.dias - b.dias);
  grid.appendChild(tarjetaLista("Facturas próximas a vencer", porVencer.length
    ? porVencer.map((x) => fila(
        `${x.f.tipo_comprobante} ${x.f.numero_factura || ""}`,
        `${formatearCentavos(x.f.saldo_pendiente_centavos)}`,
        x.dias < 0 ? "badge-danger" : "badge-warn",
        x.dias < 0 ? `vencida hace ${-x.dias}d` : `en ${x.dias}d`))
    : [vacio("Nada por vencer en los próximos días.")],
    "Facturas impagas que vencen en 7 días o menos. Incluye las que ya están vencidas."));

  // Platos menos rentables: los 10 con mayor costo respecto de su precio de venta.
  const peores = [...rents].sort((a, b) => b.r.foodCostPct - a.r.foodCostPct).slice(0, 10);
  grid.appendChild(tarjetaLista("Platos menos rentables", peores.length
    ? peores.map((x) => fila(x.p.nombre, formatearPorcentaje(x.r.foodCostPct, 1),
        x.r.foodCostPct > UMBRAL_FOODCOST ? "badge-danger" : (x.r.foodCostPct > 30 ? "badge-warn" : "badge-ok")))
    : [vacio("Sin platos con precio cargado.")],
    "Los 10 platos con mayor costo respecto de su precio de venta: los que menos margen te dejan."));

  // Panel de alertas
  const alertas = [];
  for (const i of insumos) {
    if (diasDesde(i.fecha_ultimo_precio) > DIAS_DESACTUALIZADO)
      alertas.push({ txt: `"${i.nombre}": precio sin actualizar hace ${diasDesde(i.fecha_ultimo_precio)} días.`, cls: "badge-warn" });
  }
  for (const x of rents) {
    if (x.r.foodCostPct > UMBRAL_FOODCOST)
      alertas.push({ txt: `"${x.p.nombre}": costo s/ venta ${formatearPorcentaje(x.r.foodCostPct, 1)} supera el ${UMBRAL_FOODCOST}%.`, cls: "badge-danger" });
  }
  grid.appendChild(tarjetaLista(`Alertas (${alertas.length})`, alertas.length
    ? alertas.slice(0, 10).map((a) => el("div", { class: "flex items-center gap-8", style: "padding:8px 0;font-size:.85rem;border-bottom:1px solid var(--borde)" },
        el("span", { class: `badge ${a.cls}` }, "!"), a.txt))
    : [vacio("Todo en orden. Sin alertas.")],
    `Avisos automáticos: insumos con precio sin actualizar hace más de ${DIAS_DESACTUALIZADO} días, y platos con costo sobre venta por encima del ${UMBRAL_FOODCOST}%.`));

  // Exportaciones
  cont.appendChild(el("div", { class: "card", style: "margin-top:14px" },
    ayuda("Descargá a Excel la deuda por proveedor o la rentabilidad de todos los platos."),
    el("p", { class: "card-title" }, "Exportar"),
    el("div", { class: "flex gap-8 wrap" },
      el("button", { class: "btn btn-sm btn-secondary", onClick: () => exportarDeuda(proveedores) }, el("span", { html: ico("excel", 16) }), "Deuda por proveedor"),
      el("button", { class: "btn btn-sm btn-secondary", onClick: () => exportarRent(platos) }, el("span", { html: ico("excel", 16) }), "Rentabilidad de platos"),
    ),
  ));
}

// Icono ⓘ con cartel explicativo. En desktop aparece al pasar el mouse;
// en mobile, al tocarlo (el foco del botón dispara :focus). Ver .ayuda en CSS.
function ayuda(texto) {
  return el("button", { class: "ayuda", type: "button", "aria-label": "Qué muestra esta tarjeta" },
    "i", el("span", { class: "ayuda-tip" }, texto));
}

function kpi(label, valor, sub, tono = "", ayudaTxt = "") {
  return el("div", { class: `kpi ${tono}` },
    ayudaTxt ? ayuda(ayudaTxt) : null,
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value" }, valor),
    sub ? el("div", { class: "kpi-sub" }, sub) : null);
}
function tarjetaLista(titulo, hijos, ayudaTxt = "") {
  return el("div", { class: "card" },
    ayudaTxt ? ayuda(ayudaTxt) : null,
    el("p", { class: "card-title" }, titulo), ...hijos);
}
function fila(nombre, valor, badgeCls, sub) {
  return el("div", { class: "flex items-center justify-between", style: "padding:9px 0;border-bottom:1px solid var(--borde);font-size:.88rem;gap:10px" },
    el("div", { class: "grow" }, el("div", { style: "font-weight:600" }, nombre), sub ? el("div", { class: "celda-sub" }, sub) : null),
    el("span", { class: `badge ${badgeCls || "badge-muted"}` }, valor));
}
function vacio(txt) { return el("p", { class: "form-hint", style: "padding:8px 0" }, txt); }

function exportarDeuda(proveedores) {
  try {
    const filas = proveedores.map((p) => ({
      Codigo: p.codigo || "", Proveedor: p.nombre, CUIT: p.cuit || "",
      "Condicion fiscal": p.condicion_fiscal, "Saldo deuda ($)": (Number(p.saldo_total_deuda_centavos) || 0) / 100,
    }));
    exportarExcel(filas, "deuda-proveedores", "Deuda");
  } catch (e) { toast(e.message, "error"); }
}
function exportarRent(platos) {
  try {
    const filas = platos.map((p) => {
      const costo = store.costoDeReceta(p) || 0;
      const r = rentabilidad(p, costo);
      return {
        Codigo: p.codigo || "", Plato: p.nombre,
        "Costo c/IVA ($)": costo / 100,
        "Precio neto ($)": Math.round(r.precioNetoCentavos) / 100,
        "Precio carta ($)": (p.precio_venta_publico_centavos || 0) / 100,
        "Costo s/ venta %": Number(r.foodCostPct.toFixed(1)),
        "Margen bruto ($)": Math.round(r.margenBrutoCentavos) / 100,
      };
    });
    exportarExcel(filas, "rentabilidad-platos", "Rentabilidad");
  } catch (e) { toast(e.message, "error"); }
}
