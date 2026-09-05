// ============================================================
// saas/ui/pagos.js — Pagos y cuenta corriente por proveedor
// ------------------------------------------------------------
// Registro (FIFO/manual) y anulación por contraasiento vía RPC.
// Muestra saldo, facturas pendientes e historial de pagos.
// ============================================================

import * as pagosRepo from "../data/pagosRepo.js";
import * as facturasRepo from "../data/facturasRepo.js";
import * as proveedoresRepo from "../data/proveedoresRepo.js";
import { pesosACentavos, formatearCentavos } from "../../core/dinero.js";
import { escapar, setMsg, labelInfo, toast, confirmar } from "./helpers.js";

let PROVEEDORES = [];
let provSel = null;

const hoy = () => new Date().toISOString().slice(0, 10);
const $ = (c, s) => c.querySelector(s);

const METODOS = [
  ["transferencia", "Transferencia"], ["efectivo", "Efectivo"],
  ["cheque", "Cheque"], ["echeq", "e-Cheq"], ["otro", "Otro"],
];

export async function montar(container, perfil) {
  container.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Pagos a proveedores</h2>
      <label for="pag-prov">Proveedor</label>
      <select id="pag-prov"><option value="">— elegí un proveedor —</option></select>
    </div>
    <div id="pag-detalle"></div>`;

  try {
    PROVEEDORES = await proveedoresRepo.listar();
  } catch (err) {
    $(container, "#pag-detalle").innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`;
    return;
  }
  const sel = $(container, "#pag-prov");
  sel.innerHTML += PROVEEDORES.map((p) => `<option value="${p.id}">${escapar(p.nombre)}</option>`).join("");
  sel.addEventListener("change", () => seleccionar(container, sel.value));

  if (!PROVEEDORES.length) {
    $(container, "#pag-detalle").innerHTML = `<div class="card"><p class="muted">Primero cargá un proveedor.</p></div>`;
  }
}

async function seleccionar(container, id) {
  provSel = PROVEEDORES.find((p) => p.id === id) || null;
  const det = $(container, "#pag-detalle");
  if (!provSel) { det.innerHTML = ""; return; }

  const metodoOpts = METODOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  det.innerHTML = `
    <div class="card">
      <div class="topbar">
        <h2 style="margin:0;">${escapar(provSel.nombre)}</h2>
        <div class="muted">Deuda actual: <strong>${formatearCentavos(provSel.saldo_total_deuda_centavos || 0)}</strong></div>
      </div>
      <h3 class="muted" style="margin:12px 0 4px;">Facturas pendientes</h3>
      <div id="pag-pendientes" class="tabla-scroll"></div>
    </div>

    <div class="card">
      <h2 style="margin-top:0;">Registrar pago</h2>
      <form id="form-pago">
        <div class="fila">
          <div>${labelInfo("pag-monto", "Monto ($)", "Cuánto pagás. Se imputa a las facturas pendientes según el modo elegido.")}
            <input id="pag-monto" placeholder="0,00" /></div>
          <div>${labelInfo("pag-metodo", "Método", "Cómo se paga.")}
            <select id="pag-metodo">${metodoOpts}</select></div>
          <div>${labelInfo("pag-fecha", "Fecha", "Fecha del pago.")}
            <input id="pag-fecha" type="date" value="${hoy()}" /></div>
        </div>
        <div class="fila">
          <div style="flex:2;">${labelInfo("pag-ref", "Referencia", "Nº de transferencia, cheque, etc. (opcional).")}
            <input id="pag-ref" placeholder="Opcional" /></div>
          <div>${labelInfo("pag-modo", "Imputación", "FIFO: paga primero las facturas más viejas. Manual: elegís cuáles con los tildes de arriba.")}
            <select id="pag-modo"><option value="fifo">FIFO (más antiguas primero)</option><option value="manual">Manual (tildadas)</option></select></div>
        </div>
        <div style="margin-top:16px;"><button type="submit">Registrar pago</button></div>
        <p id="pag-msg" class="msg" hidden></p>
      </form>
    </div>

    <div class="card">
      <h2 style="margin-top:0;">Historial de pagos</h2>
      <div id="pag-historial" class="tabla-scroll"></div>
    </div>`;

  $(container, "#form-pago").addEventListener("submit", (e) => registrar(e, container));
  await Promise.all([refrescarPendientes(container), refrescarHistorial(container)]);
}

async function refrescarPendientes(container) {
  const cont = $(container, "#pag-pendientes");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    const facturas = await facturasRepo.pendientes(provSel.id);
    if (!facturas.length) { cont.innerHTML = "<p class='muted'>No hay facturas pendientes 🎉</p>"; return; }
    const filas = facturas.map((f) => `
      <tr>
        <td><input type="checkbox" class="pag-check" value="${f.id}" /></td>
        <td>${escapar(f.numero_factura || "—")}</td>
        <td>${escapar(f.fecha_emision)}</td>
        <td class="num">${formatearCentavos(f.monto_total_centavos)}</td>
        <td class="num">${formatearCentavos(f.saldo_pendiente_centavos)}</td>
      </tr>`).join("");
    cont.innerHTML = `<table>
      <thead><tr><th></th><th>Número</th><th>Emisión</th><th class="num">Total</th><th class="num">Saldo</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <p class="muted" style="margin-top:6px;">Tildá facturas y elegí "Manual" para imputar a esas; si no, se usa FIFO.</p>`;
  } catch (err) {
    cont.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`;
  }
}

async function refrescarHistorial(container) {
  const cont = $(container, "#pag-historial");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    const pagos = await pagosRepo.listarPorProveedor(provSel.id);
    if (!pagos.length) { cont.innerHTML = "<p class='muted'>Sin pagos todavía.</p>"; return; }
    const filas = pagos.map((p) => {
      const anulable = p.estado === "activo" && (p.monto_pagado_centavos || 0) > 0;
      return `<tr>
        <td>${escapar(p.fecha_pago)}</td>
        <td class="num">${formatearCentavos(p.monto_pagado_centavos)}</td>
        <td>${escapar(p.metodo_pago)}</td>
        <td>${escapar(p.referencia || "")}</td>
        <td><span style="color:${p.estado === "anulado" ? "var(--muted)" : "var(--ok)"}">${escapar(p.estado)}</span></td>
        <td>${anulable ? `<button class="btn-baja btn-anular" data-id="${p.id}">Anular</button>` : ""}</td>
      </tr>`;
    }).join("");
    cont.innerHTML = `<table>
      <thead><tr><th>Fecha</th><th class="num">Monto</th><th>Método</th><th>Ref.</th><th>Estado</th><th></th></tr></thead>
      <tbody>${filas}</tbody></table>`;
    cont.querySelectorAll(".btn-anular").forEach((b) =>
      b.addEventListener("click", () => anular(container, b.dataset.id)));
  } catch (err) {
    cont.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`;
  }
}

async function registrar(e, container) {
  e.preventDefault();
  const msg = $(container, "#pag-msg");
  const monto = pesosACentavos($(container, "#pag-monto").value);
  if (monto <= 0) { setMsg(msg, "Ingresá un monto mayor a cero.", "error"); return; }

  const modo = $(container, "#pag-modo").value;
  const facturaIds = [...container.querySelectorAll(".pag-check:checked")].map((c) => c.value);
  if (modo === "manual" && !facturaIds.length) {
    setMsg(msg, "En modo manual, tildá al menos una factura.", "error"); return;
  }

  setMsg(msg, "Registrando…");
  try {
    await pagosRepo.registrar({
      proveedorId: provSel.id,
      montoCentavos: monto,
      metodoPago: $(container, "#pag-metodo").value,
      referencia: $(container, "#pag-ref").value,
      fechaPago: $(container, "#pag-fecha").value || hoy(),
      modoImputacion: modo,
      facturaIds,
    });
    provSel.saldo_total_deuda_centavos = (provSel.saldo_total_deuda_centavos || 0) - monto;
    setMsg(msg, "Pago registrado ✔", "ok");
    await seleccionar(container, provSel.id);
  } catch (err) {
    setMsg(msg, "No se pudo registrar: " + (err.message || err), "error");
  }
}

async function anular(container, pagoId) {
  const ok = await confirmar({ titulo: "Anular pago", mensaje: "Se revierten las imputaciones y el saldo. El pago queda anulado (no se borra).", textoOk: "Anular", peligro: true });
  if (!ok) return;
  try {
    const pagos = await pagosRepo.listarPorProveedor(provSel.id);
    const p = pagos.find((x) => x.id === pagoId);
    await pagosRepo.anular(pagoId);
    if (p) provSel.saldo_total_deuda_centavos = (provSel.saldo_total_deuda_centavos || 0) + (p.monto_pagado_centavos || 0);
    await seleccionar(container, provSel.id);
    toast("Pago anulado ✔");
  } catch (err) {
    toast("Error: " + (err.message || err), "error");
  }
}
