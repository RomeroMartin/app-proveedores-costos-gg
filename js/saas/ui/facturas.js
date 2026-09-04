// ============================================================
// saas/ui/facturas.js — Facturas de compra por proveedor
// ------------------------------------------------------------
// Carga bidireccional neto↔total (core/fiscal.desglosarFactura) + cuadratura.
// El alta va por RPC (facturasRepo.crear). La UI no calcula: usa el core.
// ============================================================

import * as facturasRepo from "../data/facturasRepo.js";
import * as proveedoresRepo from "../data/proveedoresRepo.js";
import { ALICUOTAS_IVA, desglosarFactura } from "../../core/fiscal.js";
import { pesosACentavos, formatearCentavos } from "../../core/dinero.js";
import { escapar, setMsg, labelInfo } from "./helpers.js";

let PERFIL = null;
let PROVEEDORES = [];
let provSel = null;
let ladoEditado = "total"; // "neto" | "total"

const hoy = () => new Date().toISOString().slice(0, 10);
const $ = (c, s) => c.querySelector(s);

export async function montar(container, perfil) {
  PERFIL = perfil;
  container.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Facturas de compra</h2>
      <label for="fac-prov">Proveedor</label>
      <select id="fac-prov"><option value="">— elegí un proveedor —</option></select>
    </div>
    <div id="fac-detalle"></div>`;

  try {
    PROVEEDORES = await proveedoresRepo.listar();
  } catch (err) {
    $(container, "#fac-detalle").innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`;
    return;
  }
  const sel = $(container, "#fac-prov");
  sel.innerHTML += PROVEEDORES.map((p) => `<option value="${p.id}">${escapar(p.nombre)}</option>`).join("");
  sel.addEventListener("change", () => seleccionar(container, sel.value));

  if (!PROVEEDORES.length) {
    $(container, "#fac-detalle").innerHTML = `<div class="card"><p class="muted">Primero cargá un proveedor en el módulo Proveedores.</p></div>`;
  }
}

async function seleccionar(container, id) {
  provSel = PROVEEDORES.find((p) => p.id === id) || null;
  const det = $(container, "#fac-detalle");
  if (!provSel) { det.innerHTML = ""; return; }
  det.innerHTML = `
    <div class="card">
      <div class="topbar">
        <h2 style="margin:0;">${escapar(provSel.nombre)}</h2>
        <div class="muted">Deuda: <strong>${formatearCentavos(provSel.saldo_total_deuda_centavos || 0)}</strong></div>
      </div>
      <div id="fac-lista" class="tabla-scroll"></div>
    </div>
    ${formNuevaFactura()}`;

  wireForm(container);
  await refrescarLista(container);
}

function formNuevaFactura() {
  const ivaOpts = ALICUOTAS_IVA.map((a) => `<option value="${a}" ${a === 21 ? "selected" : ""}>${a}%</option>`).join("");
  return `
    <div class="card">
      <h2 style="margin-top:0;">Nueva factura</h2>
      <form id="form-factura">
        <div class="fila">
          <div>${labelInfo("fac-tipo", "Comprobante", "Tipo de factura: A (discrimina IVA), B o C (monotributo, sin IVA discriminado).")}
            <select id="fac-tipo"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></div>
          <div>${labelInfo("fac-numero", "Número", "Número del comprobante tal como figura en el papel. Ej: A-0002-000841.")}
            <input id="fac-numero" placeholder="A-0002-000841" /></div>
        </div>
        <div class="fila">
          <div>${labelInfo("fac-emision", "Fecha emisión", "Fecha en que se emitió la factura.")}
            <input id="fac-emision" type="date" value="${hoy()}" /></div>
          <div>${labelInfo("fac-venc", "Vencimiento", "Fecha límite de pago (opcional). Se usa para alertas de vencimientos.")}
            <input id="fac-venc" type="date" /></div>
        </div>

        <h3 class="muted" style="margin:16px 0 4px;">Importes</h3>
        <div class="fila">
          <div>${labelInfo("fac-alicuota", "Alícuota IVA", "IVA de la factura (21% general, 10,5% muchos alimentos).")}
            <select id="fac-alicuota">${ivaOpts}</select></div>
          <div>${labelInfo("fac-neto", "Neto ($)", "Importe sin IVA. Si cargás el total, el neto se calcula solo (y viceversa).")}
            <input id="fac-neto" placeholder="0,00" /></div>
          <div>${labelInfo("fac-percep", "Percepciones ($)", "Percepciones de IVA/IIBB (opcional). Se pagan pero no son costo ni crédito fiscal.")}
            <input id="fac-percep" placeholder="0,00" /></div>
          <div>${labelInfo("fac-total", "Total ($)", "Importe final a pagar (neto + IVA + percepciones). Es lo que va a la cuenta corriente.")}
            <input id="fac-total" placeholder="0,00" /></div>
        </div>
        <p id="fac-desglose" class="muted" style="margin-top:8px;"></p>

        <div style="margin-top:8px;">${labelInfo("fac-obs", "Observaciones", "Nota libre (opcional).")}
          <input id="fac-obs" placeholder="Opcional" /></div>

        <div style="margin-top:16px;"><button type="submit">Guardar factura</button></div>
        <p id="fac-msg" class="msg" hidden></p>
      </form>
    </div>`;
}

function wireForm(container) {
  const neto = $(container, "#fac-neto");
  const total = $(container, "#fac-total");
  neto.addEventListener("input", () => { ladoEditado = "neto"; recomputar(container); });
  total.addEventListener("input", () => { ladoEditado = "total"; recomputar(container); });
  $(container, "#fac-alicuota").addEventListener("change", () => recomputar(container));
  $(container, "#fac-percep").addEventListener("input", () => recomputar(container));
  $(container, "#form-factura").addEventListener("submit", (e) => guardar(e, container));
}

function desgloseActual(container) {
  const alicuota = Number($(container, "#fac-alicuota").value) || 0;
  const percep = pesosACentavos($(container, "#fac-percep").value);
  const monto = pesosACentavos($(container, ladoEditado === "neto" ? "#fac-neto" : "#fac-total").value);
  return desglosarFactura({ desde: ladoEditado, montoCentavos: monto, alicuota, percepcionesCentavos: percep });
}

function recomputar(container) {
  const d = desgloseActual(container);
  // Completar el lado que NO editó el usuario (sin disparar input).
  if (ladoEditado === "neto") $(container, "#fac-total").value = formatearCentavos(d.total, { simbolo: false });
  else $(container, "#fac-neto").value = formatearCentavos(d.neto, { simbolo: false });

  $(container, "#fac-desglose").innerHTML =
    `Neto ${formatearCentavos(d.neto)} · IVA ${formatearCentavos(d.iva)} · ` +
    `Percep. ${formatearCentavos(d.percepciones)} · <strong>Total ${formatearCentavos(d.total)}</strong>`;
}

async function refrescarLista(container) {
  const cont = $(container, "#fac-lista");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    const facturas = await facturasRepo.listarPorProveedor(provSel.id);
    if (!facturas.length) { cont.innerHTML = "<p class='muted'>Sin facturas todavía.</p>"; return; }
    const filas = facturas.map((f) => `
      <tr>
        <td>${escapar(f.numero_factura || "—")}</td>
        <td>${escapar(f.tipo_comprobante)}</td>
        <td>${escapar(f.fecha_emision)}</td>
        <td class="num">${formatearCentavos(f.monto_total_centavos)}</td>
        <td class="num">${formatearCentavos(f.saldo_pendiente_centavos)}</td>
        <td>${estadoPill(f.estado)}</td>
      </tr>`).join("");
    cont.innerHTML = `<table>
      <thead><tr><th>Número</th><th>Tipo</th><th>Emisión</th><th class="num">Total</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody></table>`;
  } catch (err) {
    cont.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`;
  }
}

function estadoPill(estado) {
  const map = { pendiente: "var(--error)", parcial: "#b45309", pagada: "var(--ok)", anulada: "var(--muted)" };
  return `<span style="color:${map[estado] || "var(--muted)"}">${escapar(estado)}</span>`;
}

async function guardar(e, container) {
  e.preventDefault();
  const msg = $(container, "#fac-msg");
  const d = desgloseActual(container);
  if (d.total <= 0) { setMsg(msg, "Cargá el importe de la factura.", "error"); return; }

  setMsg(msg, "Guardando…");
  try {
    await facturasRepo.crear({
      proveedor_id: provSel.id,
      tipo_comprobante: $(container, "#fac-tipo").value,
      numero_factura: $(container, "#fac-numero").value,
      fecha_emision: $(container, "#fac-emision").value || hoy(),
      fecha_vencimiento: $(container, "#fac-venc").value || null,
      neto_gravado_centavos: d.neto,
      iva_discriminado_centavos: d.iva,
      percepciones_centavos: d.percepciones,
      monto_total_centavos: d.total,
      observaciones: $(container, "#fac-obs").value,
    });
    // Actualizar saldo en memoria + refrescar.
    provSel.saldo_total_deuda_centavos = (provSel.saldo_total_deuda_centavos || 0) + d.total;
    setMsg(msg, "Factura guardada ✔", "ok");
    await seleccionar(container, provSel.id);
  } catch (err) {
    setMsg(msg, "No se pudo guardar: " + (err.message || err), "error");
  }
}
