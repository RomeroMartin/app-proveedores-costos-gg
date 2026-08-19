// ============================================================
// ui/proveedores.js — Proveedores, cuentas corrientes, facturas y pagos
// (Secciones 7.2 y 7.5)
// ============================================================

import { $, el, limpiar, toast, abrirModal, confirmar, mostrarCargando, fechaCorta, esc, ico, iconoAyuda, kpi, tarjetaLista, filaLista } from "./helpers.js";
import { formatearCentavos, pesosACentavos } from "../core/dinero.js";
import { CONDICIONES_FISCALES, TIPOS_COMPROBANTE, ALICUOTAS_IVA, desglosarFactura, validarCuadraturaFactura } from "../core/fiscal.js";
import { puede } from "../roles.js";
import { RUBROS } from "../core/rubros.js";
import * as proveedoresRepo from "../data/proveedoresRepo.js";
import * as facturasRepo from "../data/facturasRepo.js";
import * as pagosRepo from "../data/pagosRepo.js";
import { exportarExcel } from "../export/excel.js";
import * as store from "../store.js";

const LABEL_COND = { responsable_inscripto: "Resp. Inscripto", monotributo: "Monotributo", exento: "Exento" };
const LABEL_METODO = { efectivo: "Efectivo", transferencia: "Transferencia", cheque: "Cheque", echeq: "e-Cheq", otro: "Otro" };
const SIN_RUBRO = "Sin rubro";
const DIAS_POR_VENCER = 7;

function saldoDe(p) { return Number(p.saldo_total_deuda_centavos) || 0; }
function diasHasta(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
function badgeSaldo(saldo) {
  return saldo > 0 ? "badge-danger" : (saldo < 0 ? "badge-ok" : "badge-muted");
}

export async function render(main) {
  main.innerHTML = "";
  main.appendChild(el("div", { class: "page-header" },
    el("div", {},
      el("div", { class: "page-title" }, "Proveedores"),
      el("div", { class: "page-subtitle" }, "Cuenta corriente por rubro: deuda, facturas y pagos."),
    ),
    el("div", { class: "flex gap-8" },
      el("button", { class: "btn btn-secondary", onClick: () => render(main) }, el("span", { html: ico("refrescar", 16) }), "Refrescar"),
      el("button", { class: "btn btn-primary", onClick: () => abrirFormProveedor() }, el("span", { html: ico("mas", 16) }), "Nuevo proveedor"),
    ),
  ));
  const cont = el("div", {});
  main.appendChild(cont);
  await pintarLista(cont);
}

async function pintarLista(cont) {
  mostrarCargando(cont, "Cargando proveedores…");
  await store.cargar(true);
  const { proveedores } = store.get();
  // Facturas pendientes globales (para los KPI). Puede fallar si la colección
  // está vacía o falta el índice; en ese caso seguimos sin ese dato.
  let pendientes = [];
  try { pendientes = await facturasRepo.pendientesGlobal(); }
  catch (_e) { /* colección vacía o índice faltante */ }
  limpiar(cont);

  // ── KPIs (antes vivían en el Tablero) ──
  const totalDeuda = proveedores.reduce((a, p) => a + saldoDe(p), 0);
  const conDeuda = proveedores.filter((p) => saldoDe(p) > 0).length;
  const porVencer = pendientes
    .map((f) => ({ f, dias: diasHasta(f.fecha_vencimiento) }))
    .filter((x) => x.dias !== null && x.dias <= DIAS_POR_VENCER)
    .sort((a, b) => a.dias - b.dias);

  cont.appendChild(el("div", { class: "kpi-grid", style: "margin-bottom:14px" },
    kpi("Deuda total", formatearCentavos(totalDeuda), `${conDeuda} con deuda`, totalDeuda > 0 ? "danger" : "ok",
      "Total que le debés a tus proveedores (suma de todos los saldos). El subtítulo indica cuántos tienen deuda."),
    kpi("Facturas pendientes", String(pendientes.length), "impagas", "",
      "Cantidad de facturas con saldo total o parcial. No incluye las pagadas ni las anuladas."),
    kpi("Por vencer", String(porVencer.length), "en 7 días o menos", porVencer.length ? "warn" : "ok",
      "Facturas impagas que vencen en 7 días o menos. Incluye las que ya están vencidas."),
    kpi("Proveedores", String(proveedores.length), "activos", "",
      "Cantidad de proveedores activos cargados en el sistema."),
  ));

  // ── Facturas próximas a vencer (detalle) ──
  if (porVencer.length) {
    cont.appendChild(tarjetaLista("Facturas próximas a vencer",
      porVencer.slice(0, 8).map((x) => {
        const prov = store.get().proveedoresById[x.f.proveedor_id];
        return filaLista(
          `${prov ? prov.nombre + " — " : ""}${x.f.tipo_comprobante} ${x.f.numero_factura || ""}`,
          x.dias < 0 ? `vencida hace ${-x.dias}d` : `en ${x.dias}d`,
          x.dias < 0 ? "badge-danger" : "badge-warn",
          formatearCentavos(x.f.saldo_pendiente_centavos));
      }),
      "Facturas impagas que vencen en 7 días o menos (incluye las vencidas). Se muestran las 8 más urgentes."));
  }

  if (!proveedores.length) {
    cont.appendChild(el("div", { class: "empty-state" }, el("p", {}, "Todavía no hay proveedores.")));
    return;
  }

  // ── Barra de filtros ──
  const estiloSel = "flex:0 0 auto;min-width:160px;max-width:240px;font-size:.85rem";
  const buscador = el("input", { class: "form-control buscador", placeholder: "Buscar proveedor…", type: "search" });
  const rubrosPresentes = [...new Set(proveedores.flatMap((p) => Array.isArray(p.rubros) && p.rubros.length ? p.rubros : [SIN_RUBRO]))]
    .sort((a, b) => a === SIN_RUBRO ? 1 : b === SIN_RUBRO ? -1 : a.localeCompare(b));
  const selRubro = el("select", { class: "form-control", style: estiloSel },
    el("option", { value: "" }, "Todos los rubros"),
    ...rubrosPresentes.map((r) => el("option", { value: r }, r)),
  );
  const selOrden = el("select", { class: "form-control", style: estiloSel },
    el("option", { value: "rubro" }, "Agrupar por rubro"),
    el("option", { value: "deuda" }, "Ordenar por deuda (mayor primero)"),
    el("option", { value: "nombre" }, "Ordenar por nombre (A→Z)"),
  );
  const conteo = el("span", { class: "text-muted", style: "font-size:.8rem;margin-left:auto" }, "");
  const botones = [buscador, selRubro, selOrden, conteo];
  if (puede(store.getRol(), "exportar")) {
    const btnExport = el("button", { class: "btn btn-sm btn-secondary", onClick: () => exportarDeuda(proveedores) },
      el("span", { html: ico("excel", 16) }), "Exportar deuda");
    botones.push(btnExport);
  }
  cont.appendChild(el("div", { class: "toolbar" }, ...botones));

  const tablaWrap = el("div", { class: "tabla-wrap" });
  cont.appendChild(tablaWrap);

  function dibujar() {
    const f = buscador.value.toLowerCase().trim();
    const rub = selRubro.value;
    const orden = selOrden.value;

    // Filtro por texto y por rubro.
    const rubrosDe = (p) => (Array.isArray(p.rubros) && p.rubros.length) ? p.rubros : [SIN_RUBRO];
    let filtrados = proveedores.filter((p) => {
      if (f && !((p.nombre || "").toLowerCase().includes(f) || (p.codigo || "").toLowerCase().includes(f) || (p.cuit || "").includes(f))) return false;
      if (rub && !rubrosDe(p).includes(rub)) return false;
      return true;
    });
    conteo.textContent = `${filtrados.length} de ${proveedores.length}`;

    limpiar(tablaWrap);
    if (!filtrados.length) {
      tablaWrap.appendChild(el("div", { class: "empty-state" }, el("p", {}, "No hay proveedores que coincidan.")));
      return;
    }

    if (orden === "rubro") {
      tablaWrap.appendChild(tablaAgrupada(filtrados, rub, rubrosDe));
    } else {
      const ordenados = [...filtrados].sort(orden === "deuda"
        ? (a, b) => saldoDe(b) - saldoDe(a)
        : (a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      tablaWrap.appendChild(tablaPlana(ordenados));
    }
  }

  [buscador, selRubro, selOrden].forEach((elm) => elm.addEventListener("input", dibujar));
  dibujar();
}

// Cabecera de tabla común.
function encabezado(conRubro) {
  return el("thead", {}, el("tr", {},
    conRubro ? el("th", {}, "Rubro") : null,
    el("th", {}, "Proveedor"),
    el("th", {}, "Cond. fiscal"),
    el("th", { class: "num" }, "Saldo deuda"),
    el("th", { class: "text-right" }, "Acciones"),
  ));
}

// Fila de proveedor. `rubroCol` sólo se usa en la tabla plana.
function filaProveedor(p, rubroCol) {
  const saldo = saldoDe(p);
  return el("tr", {},
    rubroCol !== undefined ? el("td", { class: "celda-sub", style: "color:var(--verde)" }, rubroCol || "—") : null,
    el("td", {},
      el("div", { class: "celda-principal" }, p.nombre),
      el("div", { class: "celda-sub" }, `${p.codigo || ""}${p.cuit ? " · " + p.cuit : ""}`),
    ),
    el("td", {}, el("span", { class: "badge badge-info" }, LABEL_COND[p.condicion_fiscal] || p.condicion_fiscal)),
    el("td", { class: "num" }, el("span", { class: "badge " + badgeSaldo(saldo) }, formatearCentavos(saldo))),
    el("td", { class: "text-right", style: "white-space:nowrap" },
      el("button", { class: "btn btn-xs btn-secondary", onClick: () => abrirFicha(p) }, "Ver ficha"),
      " ",
      el("button", { class: "btn btn-xs btn-secondary", onClick: () => abrirFormProveedor(p) }, "Editar"),
    ),
  );
}

// Tabla plana (ordenada por deuda o por nombre): muestra la columna Rubro.
function tablaPlana(proveedores) {
  const rubroTexto = (p) => (Array.isArray(p.rubros) && p.rubros.length) ? p.rubros.join(" · ") : "";
  return el("table", { class: "tabla" },
    encabezado(true),
    el("tbody", {}, ...proveedores.map((p) => filaProveedor(p, rubroTexto(p)))),
  );
}

// Tabla agrupada por rubro. Un proveedor con varios rubros aparece en cada uno.
// Cada grupo lleva un subtotal de deuda (informativo).
function tablaAgrupada(proveedores, rubroFiltrado, rubrosDe) {
  // Armar mapa rubro → proveedores.
  const grupos = new Map();
  for (const p of proveedores) {
    for (const r of rubrosDe(p)) {
      if (rubroFiltrado && r !== rubroFiltrado) continue;
      if (!grupos.has(r)) grupos.set(r, []);
      grupos.get(r).push(p);
    }
  }
  // Orden de los rubros: alfabético, "Sin rubro" al final.
  const nombresRubro = [...grupos.keys()].sort((a, b) =>
    a === SIN_RUBRO ? 1 : b === SIN_RUBRO ? -1 : a.localeCompare(b));

  const tbody = el("tbody", {});
  for (const r of nombresRubro) {
    const lista = grupos.get(r).sort((a, b) => saldoDe(b) - saldoDe(a));
    const subtotal = lista.reduce((a, p) => a + saldoDe(p), 0);
    tbody.appendChild(el("tr", { class: "fila-grupo" },
      el("td", { colspan: "2", style: "font-weight:700;background:var(--bg-secondary)" },
        `${r}  ·  ${lista.length}`),
      el("td", { class: "num", style: "background:var(--bg-secondary)" },
        el("span", { class: "badge " + badgeSaldo(subtotal) }, formatearCentavos(subtotal))),
      el("td", { style: "background:var(--bg-secondary)" }, ""),
    ));
    for (const p of lista) tbody.appendChild(filaProveedor(p));
  }
  return el("table", { class: "tabla" }, encabezado(false), tbody);
}

function exportarDeuda(proveedores) {
  try {
    const filas = [];
    for (const p of proveedores) {
      const rubros = (Array.isArray(p.rubros) && p.rubros.length) ? p.rubros.join(" · ") : "";
      filas.push({
        Rubro: rubros, Codigo: p.codigo || "", Proveedor: p.nombre, CUIT: p.cuit || "",
        "Condicion fiscal": LABEL_COND[p.condicion_fiscal] || p.condicion_fiscal,
        "Saldo deuda ($)": saldoDe(p) / 100,
      });
    }
    // Ordenado por rubro y luego por deuda desc, como el cuadro de administración.
    filas.sort((a, b) => (a.Rubro || "~").localeCompare(b.Rubro || "~") || b["Saldo deuda ($)"] - a["Saldo deuda ($)"]);
    exportarExcel(filas, "deuda-proveedores", "Deuda");
  } catch (e) { toast(e.message, "error"); }
}

// ── Alta / edición de proveedor ───────────────────────────────
function abrirFormProveedor(prov = null) {
  const editar = !!prov;
  const f = (k, ph, val = "") => el("input", { class: "form-control", placeholder: ph, value: prov ? (prov[k] || "") : val });
  const inpNombre = f("nombre", "Razón social");
  const inpCuit = f("cuit", "30-12345678-9");
  const selCond = el("select", { class: "form-control" },
    ...CONDICIONES_FISCALES.map((c) => el("option", { value: c, selected: prov && prov.condicion_fiscal === c ? "selected" : null }, LABEL_COND[c])));
  const inpContacto = f("contacto", "Nombre de contacto");
  const inpTel = f("telefono", "Teléfono");
  const inpEmail = f("email", "email@proveedor.com");

  // Rubros (uno o varios, opcional) — chips seleccionables
  const rubrosSel = new Set(prov && Array.isArray(prov.rubros) ? prov.rubros : []);
  const chipsRubro = RUBROS.map((r) => {
    const chk = el("input", { type: "checkbox", value: r, checked: rubrosSel.has(r) ? "checked" : null, style: "margin:0" });
    chk.addEventListener("change", () => { chk.checked ? rubrosSel.add(r) : rubrosSel.delete(r); });
    return el("label", { style: "display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border:1px solid var(--borde);border-radius:20px;font-size:.82rem;cursor:pointer;background:var(--bg-secondary);user-select:none" }, chk, r);
  });
  const boxRubros = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px" }, ...chipsRubro);

  const form = el("div", {},
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Nombre"), inpNombre),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "CUIT"), inpCuit),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Condición fiscal",
        iconoAyuda("Define cómo factura. Responsable Inscripto → Factura A (IVA discriminado). Monotributo → Factura C (sin IVA discriminado).")), selCond),
    ),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Rubros (opcional)",
      iconoAyuda("Qué tipo(s) de producto te vende. Sirve para sugerir el rubro de sus insumos y para filtrar. Podés elegir varios.")), boxRubros),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Contacto"), inpContacto),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Teléfono"), inpTel),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Email"), inpEmail),
    ),
  );
  abrirModal({
    titulo: editar ? "Editar proveedor" : "Nuevo proveedor", contenido: form,
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: editar ? "Guardar" : "Crear", clase: "btn-primary", onClick: async (cerrar) => {
          if (!inpNombre.value.trim()) return toast("Falta el nombre.", "error");
          const datos = { nombre: inpNombre.value, cuit: inpCuit.value, condicion_fiscal: selCond.value, contacto: inpContacto.value, telefono: inpTel.value, email: inpEmail.value, rubros: Array.from(rubrosSel) };
          try {
            if (editar) await proveedoresRepo.actualizar(prov.id, datos);
            else await proveedoresRepo.crear(datos);
            cerrar(); toast("Proveedor guardado."); await render($(".main"));
          } catch (e) { toast(e.message || "Error.", "error"); }
        } },
    ],
  });
}

// ── Ficha de proveedor con cuenta corriente ───────────────────
async function abrirFicha(prov) {
  const { body } = abrirModal({ titulo: prov.nombre, contenido: el("div", { class: "cargando" }, el("span", { class: "spinner spinner-verde" }), "Cargando cuenta corriente…"), ancho: "lg", botones: [{ texto: "Cerrar", clase: "btn-secondary" }] });
  await renderFicha(body, prov);
}

async function renderFicha(body, prov) {
  const [facturas, pagos] = await Promise.all([
    facturasRepo.listarPorProveedor(prov.id),
    pagosRepo.listarPorProveedor(prov.id),
  ]);
  const provFresco = await proveedoresRepo.obtener(prov.id) || prov;
  limpiar(body);

  const saldo = Number(provFresco.saldo_total_deuda_centavos) || 0;
  // Totales del cuadro (como en el Excel de administración): facturado vs pagado.
  const totalFacturado = facturas
    .filter((fc) => fc.estado !== "anulada")
    .reduce((a, fc) => a + (Number(fc.monto_total_centavos) || 0), 0);
  const totalPagado = pagos
    .filter((pg) => pg.estado === "activo")
    .reduce((a, pg) => a + (Number(pg.monto_pagado_centavos) || 0), 0);

  const rubrosTxt = (Array.isArray(prov.rubros) && prov.rubros.length) ? prov.rubros.join(" · ") : "";
  body.appendChild(el("div", { class: "flex justify-between items-center wrap gap-12", style: "margin-bottom:14px" },
    el("div", {},
      el("div", { class: "text-muted", style: "font-size:.8rem" },
        `${LABEL_COND[prov.condicion_fiscal] || prov.condicion_fiscal}${prov.cuit ? " · " + prov.cuit : ""}${rubrosTxt ? " · " + rubrosTxt : ""}`),
      el("div", { style: "font-size:1.4rem;font-weight:700;color:" + (saldo > 0 ? "var(--danger-txt)" : "var(--ok-txt)") }, `Deuda: ${formatearCentavos(saldo)}`),
    ),
    el("div", { class: "flex gap-8" },
      el("button", { class: "btn btn-sm btn-secondary", onClick: () => abrirFormFactura(prov, () => renderFicha(body, prov)) }, "Cargar factura"),
      el("button", { class: "btn btn-sm btn-primary", onClick: () => abrirFormPago(prov, facturas, () => renderFicha(body, prov)) }, "Registrar pago"),
    ),
  ));

  // Dos columnas: Facturas | Pagos (como el cuadro que llevan en administración).
  const colFacturas = el("div", {});
  colFacturas.appendChild(el("p", { class: "card-title" }, "Facturas"));
  if (!facturas.length) colFacturas.appendChild(el("p", { class: "form-hint" }, "Sin facturas."));
  else colFacturas.appendChild(el("div", { class: "tabla-wrap" },
    el("table", { class: "tabla" },
      el("thead", {}, el("tr", {}, el("th", {}, "Fecha"), el("th", {}, "Comprobante"), el("th", { class: "num" }, "Importe"), el("th", { class: "num" }, "Saldo"))),
      el("tbody", {}, ...facturas.map((fc) => el("tr", {},
        el("td", {}, fechaCorta(fc.fecha_emision), el("div", { class: "celda-sub" }, el("span", { class: "badge " + badgeEstado(fc.estado) }, fc.estado))),
        el("td", {}, el("div", { class: "celda-principal" }, `${fc.tipo_comprobante} ${fc.numero_factura || ""}`), el("div", { class: "celda-sub" }, `neto ${formatearCentavos(fc.neto_gravado_centavos)}`)),
        el("td", { class: "num" }, formatearCentavos(fc.monto_total_centavos)),
        el("td", { class: "num" }, formatearCentavos(fc.saldo_pendiente_centavos)),
      ))),
      el("tfoot", {}, el("tr", { class: "fila-total" },
        el("td", { colspan: "2", style: "font-weight:700" }, "Total facturado"),
        el("td", { class: "num", style: "font-weight:700" }, formatearCentavos(totalFacturado)),
        el("td", {}, ""))),
    )));

  const colPagos = el("div", {});
  colPagos.appendChild(el("p", { class: "card-title" }, "Pagos"));
  if (!pagos.length) colPagos.appendChild(el("p", { class: "form-hint" }, "Sin pagos."));
  else colPagos.appendChild(el("div", { class: "tabla-wrap" },
    el("table", { class: "tabla" },
      el("thead", {}, el("tr", {}, el("th", {}, "Fecha"), el("th", {}, "Método"), el("th", { class: "num" }, "Pago"), el("th", { class: "text-right" }, ""))),
      el("tbody", {}, ...pagos.map((pg) => el("tr", {},
        el("td", {}, fechaCorta(pg.fecha_pago), el("div", { class: "celda-sub" }, esc(pg.referencia || ""))),
        el("td", {}, LABEL_METODO[pg.metodo_pago] || pg.metodo_pago,
          pg.estado === "anulado" ? el("div", { class: "celda-sub" }, el("span", { class: "badge badge-muted" }, "anulado")) : null),
        el("td", { class: "num" }, formatearCentavos(pg.monto_pagado_centavos)),
        el("td", { class: "text-right" },
          pg.estado === "activo" && pg.monto_pagado_centavos > 0 && puede(store.getRol(), "anular_pago")
            ? el("button", { class: "btn btn-xs btn-danger", onClick: () => anular(pg, prov, body) }, "Anular")
            : "",
        ),
      ))),
      el("tfoot", {}, el("tr", { class: "fila-total" },
        el("td", { style: "font-weight:700" }, "Total pagado"),
        el("td", {}, ""),
        el("td", { class: "num", style: "font-weight:700" }, formatearCentavos(totalPagado)),
        el("td", {}, ""))),
    )));

  body.appendChild(el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start" }, colFacturas, colPagos));

  // Cierre del cuadro: facturado − pagado (deuda). Es el recuadro final del Excel.
  body.appendChild(el("div", { class: "flex justify-between items-center wrap gap-12", style: "margin-top:14px;padding:12px 16px;border-radius:var(--radio);background:var(--bg-secondary);border:1px solid var(--borde)" },
    el("span", { class: "text-muted", style: "font-size:.85rem" }, `Facturado ${formatearCentavos(totalFacturado)} − Pagado ${formatearCentavos(totalPagado)}`),
    el("span", { style: "font-size:1.15rem;font-weight:700;color:" + (saldo > 0 ? "var(--danger-txt)" : "var(--ok-txt)") }, `Deuda: ${formatearCentavos(saldo)}`),
  ));
}

function badgeEstado(estado) {
  return { pendiente: "badge-danger", parcial: "badge-warn", pagada: "badge-ok", anulada: "badge-muted" }[estado] || "badge-muted";
}

async function anular(pago, prov, body) {
  const ok = await confirmar({ titulo: "Anular pago", mensaje: "Se generará un contraasiento que revierte las imputaciones. El pago original quedará como anulado (no se borra). ¿Confirmás?", textoOk: "Anular pago" });
  if (!ok) return;
  try {
    await pagosRepo.anularPago(pago.id);
    proveedoresRepo.invalidarCache();
    toast("Pago anulado por contraasiento.");
    await renderFicha(body, prov);
  } catch (e) { toast(e.message || "Error al anular.", "error"); }
}

// ── Carga de factura con cálculo bidireccional (UX 7.5) ───────
function abrirFormFactura(prov, onDone) {
  const selTipo = el("select", { class: "form-control" }, ...TIPOS_COMPROBANTE.map((t) => el("option", { value: t, selected: t === (prov.condicion_fiscal === "responsable_inscripto" ? "A" : "C") ? "selected" : null }, `Factura ${t}`)));
  const inpNumero = el("input", { class: "form-control", placeholder: "A-0002-000841" });
  const inpEmision = el("input", { class: "form-control", type: "date", value: new Date().toISOString().slice(0, 10) });
  const inpVenc = el("input", { class: "form-control", type: "date" });
  const selAli = el("select", { class: "form-control" }, ...ALICUOTAS_IVA.map((a) => el("option", { value: a, selected: a === 21 ? "selected" : null }, `${a} %`)));
  const inpNeto = el("input", { class: "form-control", inputmode: "decimal", placeholder: "0,00" });
  const inpPercep = el("input", { class: "form-control", inputmode: "decimal", placeholder: "0,00", value: "" });
  const inpTotal = el("input", { class: "form-control", inputmode: "decimal", placeholder: "0,00" });
  const cuadro = el("div", { class: "form-hint" }, "Escribí el neto o el total: el otro se completa solo.");
  const inpObs = el("input", { class: "form-control", placeholder: "Observaciones (opcional)" });

  let ultimoLado = "neto";
  function recalcular(desde) {
    ultimoLado = desde;
    const ali = Number(selAli.value);
    const percep = pesosACentavos(inpPercep.value);
    if (desde === "neto") {
      const r = desglosarFactura({ desde: "neto", montoCentavos: pesosACentavos(inpNeto.value), alicuota: ali, percepcionesCentavos: percep });
      inpTotal.value = (r.total / 100).toFixed(2).replace(".", ",");
      mostrarCuadro(r);
    } else {
      const r = desglosarFactura({ desde: "total", montoCentavos: pesosACentavos(inpTotal.value), alicuota: ali, percepcionesCentavos: percep });
      inpNeto.value = (r.neto / 100).toFixed(2).replace(".", ",");
      mostrarCuadro(r);
    }
  }
  function mostrarCuadro(r) {
    cuadro.innerHTML = `Neto ${formatearCentavos(r.neto)} + IVA ${formatearCentavos(r.iva)} + Percep. ${formatearCentavos(r.percepciones)} = <b>${formatearCentavos(r.total)}</b>`;
  }
  inpNeto.addEventListener("input", () => recalcular("neto"));
  inpTotal.addEventListener("input", () => recalcular("total"));
  inpPercep.addEventListener("input", () => recalcular(ultimoLado));
  selAli.addEventListener("change", () => recalcular(ultimoLado));

  const form = el("div", {},
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Comprobante",
        iconoAyuda("Tipo de factura. La A (de Responsable Inscripto) discrimina IVA; la B/C no.")), selTipo),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Número"), inpNumero),
    ),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Emisión"), inpEmision),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Vencimiento"), inpVenc),
    ),
    el("div", { class: "form-row-3" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Neto gravado",
        iconoAyuda("El importe SIN IVA. Escribí el neto o el total: el otro se completa solo.")), inpNeto),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Alícuota"), selAli),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Percepciones",
        iconoAyuda("Anticipos de impuesto (IVA/IIBB) de facturas grandes. Suman al total a pagar, pero NO son costo ni crédito fiscal.")), inpPercep),
    ),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Total (impreso en la factura)"), inpTotal),
    cuadro,
    el("div", { class: "form-group", style: "margin-top:12px" }, el("label", { class: "form-label" }, "Observaciones"), inpObs),
  );

  abrirModal({
    titulo: `Cargar factura — ${prov.nombre}`, contenido: form, ancho: "lg",
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: "Guardar factura", clase: "btn-primary", onClick: async (cerrar) => {
          const ali = Number(selAli.value);
          const percep = pesosACentavos(inpPercep.value);
          const r = desglosarFactura({ desde: ultimoLado, montoCentavos: ultimoLado === "neto" ? pesosACentavos(inpNeto.value) : pesosACentavos(inpTotal.value), alicuota: ali, percepcionesCentavos: percep });
          if (r.total <= 0) return toast("Ingresá los importes de la factura.", "error");
          const cuadra = validarCuadraturaFactura({ netoCentavos: r.neto, ivaCentavos: r.iva, percepcionesCentavos: r.percepciones, totalCentavos: r.total });
          if (!cuadra.ok) return toast(`No cuadra por ${formatearCentavos(Math.abs(cuadra.diferenciaCentavos))}.`, "error");
          try {
            await facturasRepo.crear({
              proveedor_id: prov.id, tipo_comprobante: selTipo.value, numero_factura: inpNumero.value,
              fecha_emision: inpEmision.value ? new Date(inpEmision.value + "T12:00:00") : new Date(),
              fecha_vencimiento: inpVenc.value ? new Date(inpVenc.value + "T12:00:00") : null,
              neto_gravado_centavos: r.neto, iva_discriminado_centavos: r.iva, percepciones_centavos: r.percepciones,
              monto_total_centavos: r.total, observaciones: inpObs.value,
            });
            proveedoresRepo.invalidarCache();
            cerrar(); toast("Factura cargada."); if (onDone) onDone();
          } catch (e) { toast(e.message || "Error al guardar.", "error"); }
        } },
    ],
  });
  recalcular("neto");
}

// ── Registro de pago (FIFO / manual) ──────────────────────────
function abrirFormPago(prov, facturas, onDone) {
  const pendientes = facturas.filter((f) => (Number(f.saldo_pendiente_centavos) || 0) > 0 && f.estado !== "anulada");
  const inpMonto = el("input", { class: "form-control", inputmode: "decimal", placeholder: "0,00" });
  const selMetodo = el("select", { class: "form-control" }, ...Object.entries(LABEL_METODO).map(([k, v]) => el("option", { value: k, selected: k === "transferencia" ? "selected" : null }, v)));
  const inpRef = el("input", { class: "form-control", placeholder: "Referencia (transf., cheque…)" });
  const inpFecha = el("input", { class: "form-control", type: "date", value: new Date().toISOString().slice(0, 10) });
  const selModo = el("select", { class: "form-control" }, el("option", { value: "fifo" }, "FIFO (más antiguas primero)"), el("option", { value: "manual" }, "Manual (elegir facturas)"));

  const listaManual = el("div", { class: "hidden" });
  const seleccion = new Set();
  pendientes.forEach((f) => {
    const chk = el("input", { type: "checkbox", value: f.id });
    chk.addEventListener("change", () => { chk.checked ? seleccion.add(f.id) : seleccion.delete(f.id); });
    listaManual.appendChild(el("label", { class: "flex items-center gap-8", style: "padding:6px 0;font-size:.85rem" },
      chk, `${f.tipo_comprobante} ${f.numero_factura || ""} — saldo ${formatearCentavos(f.saldo_pendiente_centavos)}`));
  });
  selModo.addEventListener("change", () => listaManual.classList.toggle("hidden", selModo.value !== "manual"));

  const form = el("div", {},
    el("div", { class: "form-hint", style: "margin-bottom:10px" }, `Saldo actual del proveedor: ${formatearCentavos(prov.saldo_total_deuda_centavos)}. Facturas pendientes: ${pendientes.length}.`),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Monto"), inpMonto),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Fecha"), inpFecha),
    ),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Método"), selMetodo),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Imputación"), selModo),
    ),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Referencia"), inpRef),
    listaManual,
  );

  abrirModal({
    titulo: `Registrar pago — ${prov.nombre}`, contenido: form,
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: "Registrar", clase: "btn-primary", onClick: async (cerrar) => {
          const monto = pesosACentavos(inpMonto.value);
          if (monto <= 0) return toast("Ingresá un monto válido.", "error");
          const manualIds = selModo.value === "manual" ? Array.from(seleccion) : [];
          if (selModo.value === "manual" && !manualIds.length) return toast("Elegí al menos una factura.", "error");
          try {
            const r = await pagosRepo.registrarPago({
              proveedorId: prov.id, montoCentavos: monto, metodoPago: selMetodo.value,
              referencia: inpRef.value, fechaPago: inpFecha.value ? new Date(inpFecha.value + "T12:00:00") : new Date(),
              modoImputacion: selModo.value, facturaIdsManual: manualIds,
            });
            proveedoresRepo.invalidarCache();
            cerrar();
            if (r.excedenteCentavos > 0) toast(`Pago registrado. Excedente ${formatearCentavos(r.excedenteCentavos)} queda como saldo a favor.`, "warn", 5000);
            else toast("Pago registrado e imputado.");
            if (onDone) onDone();
          } catch (e) { toast(e.message || "Error al registrar.", "error"); }
        } },
    ],
  });
}
