// ============================================================
// saas/ui/insumos.js — Pantalla de Insumos
// ------------------------------------------------------------
// Alta con presentación de compra → costo por unidad base (core/unidades),
// y muestra el costo con IVA (core/costeo). La UI no calcula: usa core/.
// ============================================================

import * as insumosRepo from "../data/insumosRepo.js";
import { MAGNITUDES, UNIDADES_POR_MAGNITUD, unidadBaseDe, convertirAUnidadBase, costoNetoPorUnidadBase } from "../../core/unidades.js";
import { ALICUOTAS_IVA } from "../../core/fiscal.js";
import { costoRealPorUnidadBase } from "../../core/costeo.js";
import { pesosACentavos, formatearCentavos, formatearPorcentaje } from "../../core/dinero.js";
import { escapar, setMsg } from "./helpers.js";

export async function montar(container, perfil) {
  const magOpts = Object.entries(MAGNITUDES)
    .map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
  const ivaOpts = ALICUOTAS_IVA.map((a) => `<option value="${a}">${a}%</option>`).join("");

  container.innerHTML = `
    <div class="card">
      <div class="topbar">
        <h2 style="margin:0;">Insumos</h2>
        <button id="ins-refrescar" class="secundario">Refrescar</button>
      </div>
      <div id="ins-lista" class="tabla-scroll"></div>
    </div>

    <div class="card">
      <h2 style="margin-top:0;">Nuevo insumo</h2>
      <form id="form-insumo">
        <div class="fila">
          <div><label for="ins-nombre">Nombre *</label><input id="ins-nombre" required placeholder="Ej: Queso Mozzarella" /></div>
          <div><label for="ins-rubro">Rubro</label><input id="ins-rubro" placeholder="Ej: Lácteos" /></div>
        </div>
        <div class="fila">
          <div><label for="ins-magnitud">Magnitud</label><select id="ins-magnitud">${magOpts}</select></div>
          <div><label for="ins-iva">Alícuota IVA</label><select id="ins-iva">${ivaOpts}</select></div>
          <div><label for="ins-factor">Factor de corrección</label><input id="ins-factor" type="number" step="0.0001" value="1" title="1 = sin merma. 0.78 = queda 78% útil." /></div>
        </div>

        <h3 style="font-size:14px;margin:16px 0 4px;color:var(--muted);">Presentación de compra</h3>
        <div class="fila">
          <div><label for="ins-pres-desc">Descripción</label><input id="ins-pres-desc" placeholder="Ej: Barra 5 kg" /></div>
          <div><label for="ins-pres-cant">Cantidad</label><input id="ins-pres-cant" type="number" step="0.0001" placeholder="5" /></div>
          <div><label for="ins-pres-unidad">Unidad</label><select id="ins-pres-unidad"></select></div>
          <div><label for="ins-pres-precio">Precio neto ($)</label><input id="ins-pres-precio" placeholder="34.000,00" /></div>
        </div>

        <p id="ins-preview" class="muted" style="margin-top:10px;"></p>
        <div style="margin-top:12px;"><button type="submit">Guardar insumo</button></div>
        <p id="ins-msg" class="msg" hidden></p>
      </form>
    </div>`;

  const magSel = container.querySelector("#ins-magnitud");
  const uniSel = container.querySelector("#ins-pres-unidad");
  const poblarUnidades = () => {
    const mag = magSel.value;
    uniSel.innerHTML = (UNIDADES_POR_MAGNITUD[mag] || [])
      .map((u) => `<option value="${u}">${u}</option>`).join("");
    actualizarPreview(container);
  };
  magSel.addEventListener("change", poblarUnidades);
  poblarUnidades();

  ["#ins-pres-cant", "#ins-pres-unidad", "#ins-pres-precio", "#ins-iva", "#ins-factor"]
    .forEach((s) => container.querySelector(s).addEventListener("input", () => actualizarPreview(container)));

  container.querySelector("#ins-refrescar").addEventListener("click", () => refrescar(container));
  container.querySelector("#form-insumo").addEventListener("submit", (e) => alta(e, container, perfil));

  await refrescar(container);
}

/** Calcula el costo por unidad base a partir de la presentación (o null si falta dato). */
function calcularCosto(container) {
  const mag = container.querySelector("#ins-magnitud").value;
  const cant = Number(container.querySelector("#ins-pres-cant").value);
  const unidad = container.querySelector("#ins-pres-unidad").value;
  const precioCentavos = pesosACentavos(container.querySelector("#ins-pres-precio").value);
  if (!cant || cant <= 0 || !unidad || precioCentavos <= 0) return null;

  const cantidadBase = convertirAUnidadBase(cant, unidad);
  const costoNetoBase = costoNetoPorUnidadBase(precioCentavos, cantidadBase);
  return {
    unidad_base: unidadBaseDe(mag),
    cantidadBase,
    precioCentavos,
    costoNetoBase, // centavos por unidad base (neto)
  };
}

function actualizarPreview(container) {
  const el = container.querySelector("#ins-preview");
  const c = calcularCosto(container);
  if (!c) { el.textContent = "Completá la presentación para ver el costo por unidad base."; return; }
  const iva = Number(container.querySelector("#ins-iva").value) || 0;
  const factor = Number(container.querySelector("#ins-factor").value) || 1;
  const conIva = costoRealPorUnidadBase(
    { costo_neto_por_unidad_base_centavos: c.costoNetoBase, alicuota_iva: iva, factor_correccion: factor });
  el.innerHTML =
    `Costo neto: <strong>${formatearCentavos(c.costoNetoBase)}</strong> por ${c.unidad_base} · ` +
    `con IVA y merma: <strong>${formatearCentavos(conIva)}</strong> por ${c.unidad_base}`;
}

async function refrescar(container) {
  const cont = container.querySelector("#ins-lista");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    const lista = await insumosRepo.listar();
    if (!lista.length) {
      cont.innerHTML = "<p class='muted'>Todavía no hay insumos. Cargá el primero 👇</p>";
      return;
    }
    const filas = lista.map((i) => {
      const conIva = costoRealPorUnidadBase(i);
      return `<tr>
        <td>${escapar(i.codigo || "")}</td>
        <td>${escapar(i.nombre)}</td>
        <td>${escapar(i.rubro || "")}</td>
        <td>${escapar(i.unidad_base)}</td>
        <td class="num">${formatearCentavos(i.costo_neto_por_unidad_base_centavos || 0)}</td>
        <td class="num">${escapar(formatearPorcentaje(Number(i.alicuota_iva) || 0, 1))}</td>
        <td class="num">${formatearCentavos(conIva)}</td>
        <td><button data-id="${i.id}" class="btn-baja">Baja</button></td>
      </tr>`;
    }).join("");
    cont.innerHTML = `
      <table>
        <thead><tr>
          <th>Código</th><th>Nombre</th><th>Rubro</th><th>U. base</th>
          <th class="num">Costo neto</th><th class="num">IVA</th><th class="num">Costo c/IVA</th><th></th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p class="muted" style="margin-top:6px;">Costos por unidad base (g / ml / un).</p>`;
    cont.querySelectorAll(".btn-baja").forEach((b) =>
      b.addEventListener("click", () => baja(b.dataset.id, container)));
  } catch (err) {
    cont.innerHTML = `<p class="error">Error al listar: ${escapar(err.message || String(err))}</p>`;
  }
}

async function alta(e, container, perfil) {
  e.preventDefault();
  const msg = container.querySelector("#ins-msg");
  const c = calcularCosto(container);
  if (!c) { setMsg(msg, "Completá la presentación de compra (cantidad, unidad y precio).", "error"); return; }

  setMsg(msg, "Guardando…");
  try {
    await insumosRepo.crear(perfil.empresa_id, {
      nombre: container.querySelector("#ins-nombre").value,
      rubro: container.querySelector("#ins-rubro").value,
      magnitud: container.querySelector("#ins-magnitud").value,
      unidad_base: c.unidad_base,
      costo_neto_por_unidad_base_centavos: c.costoNetoBase,
      alicuota_iva: Number(container.querySelector("#ins-iva").value) || 0,
      factor_correccion: Number(container.querySelector("#ins-factor").value) || 1,
      presentacion_desc: container.querySelector("#ins-pres-desc").value,
      presentacion_cantidad_base: c.cantidadBase,
      presentacion_precio_neto_centavos: c.precioCentavos,
    });
    container.querySelector("#form-insumo").reset();
    container.querySelector("#ins-factor").value = "1";
    container.querySelector("#ins-magnitud").dispatchEvent(new Event("change"));
    setMsg(msg, "Insumo creado ✔", "ok");
    await refrescar(container);
  } catch (err) {
    setMsg(msg, "No se pudo crear: " + (err.message || err), "error");
  }
}

async function baja(id, container) {
  if (!confirm("¿Dar de baja este insumo?")) return;
  try {
    await insumosRepo.desactivar(id);
    await refrescar(container);
  } catch (err) {
    alert("Error: " + (err.message || err));
  }
}
