// ============================================================
// saas/ui/rrhhConfig.js — Configuración del módulo RRHH (solo ADMIN).
// Activación (seed), ABM de tipos de documento y tramos de vacaciones.
// ============================================================

import * as rrhhConfigRepo from "../data/rrhhConfigRepo.js";
import { escapar, setMsg, labelInfo, abrirModal, cerrarModal, toast, confirmar } from "./helpers.js";

let CONT = null, PERFIL = null;
const esAdmin = () => PERFIL && PERFIL.rol === "ADMIN";

export async function montar(container, perfil) {
  CONT = container; PERFIL = perfil;
  if (!esAdmin()) {
    CONT.innerHTML = `<div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Configuración de RRHH</h2></div>
      <div class="card"><p class="muted" style="margin:0;">Solo el dueño puede configurar el módulo de RRHH.</p></div>`;
    return;
  }
  await cargar();
}

async function cargar() {
  CONT.innerHTML = "<p class='muted'>Cargando…</p>";
  let sembrado;
  try { sembrado = await rrhhConfigRepo.estaSembrado(); }
  catch (err) { CONT.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`; return; }

  if (!sembrado) { renderActivar(); return; }

  let tipos, tramos;
  try {
    [tipos, tramos] = await Promise.all([
      rrhhConfigRepo.listarTipos(),
      rrhhConfigRepo.listarTramosVacaciones(),
    ]);
  } catch (err) { CONT.innerHTML = `<p class="error">Error: ${escapar(err.message || String(err))}</p>`; return; }
  render(tipos, tramos);
}

function renderActivar() {
  CONT.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Configuración de RRHH</h2></div>
    <div class="card">
      <h3 style="margin:0 0 8px;">Activá el módulo de RRHH</h3>
      <p class="muted" style="margin:0 0 14px;">Cargamos tipos de documento sugeridos para gastronomía (libreta sanitaria, curso de manipulación, etc.) y los tramos de vacaciones de la LCT. Después los editás como quieras.</p>
      <button id="cfg-activar">Activar módulo</button>
      <p id="cfg-msg" class="msg" hidden></p>
    </div>`;
  CONT.querySelector("#cfg-activar").addEventListener("click", async () => {
    const msg = CONT.querySelector("#cfg-msg");
    setMsg(msg, "Activando…");
    try { await rrhhConfigRepo.activarModulo(); toast("Módulo RRHH activado ✔"); await cargar(); }
    catch (err) { setMsg(msg, "No se pudo activar: " + (err.message || err), "error"); }
  });
}

function render(tipos, tramos) {
  const filasTipos = tipos.length ? tipos.map((t) => `<tr ${t.activo ? "" : 'style="opacity:.5;"'}>
      <td>${escapar(t.nombre)}</td>
      <td>${t.vigencia_meses == null ? '<span class="muted">No vence</span>' : t.vigencia_meses + " meses"}</td>
      <td>${t.obligatorio ? "Sí" : "No"}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button class="secundario td-editar" data-id="${t.id}">Editar</button>
        <button class="secundario td-toggle" data-id="${t.id}" data-activo="${t.activo}">${t.activo ? "Desactivar" : "Activar"}</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="4" class="muted">Sin tipos de documento.</td></tr>`;

  const filasTramos = tramos.map((t) => `<tr>
      <td>Desde ${t.antiguedad_desde_anios} año(s)</td>
      <td class="num">${t.dias_corridos} días</td>
      <td style="text-align:right;"><button class="btn-baja tramo-del" data-a="${t.antiguedad_desde_anios}">Eliminar</button></td>
    </tr>`).join("");

  CONT.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Configuración de RRHH</h2></div>

    <div class="card">
      <div class="topbar" style="margin-bottom:6px;">
        <h3 style="margin:0;font-size:14px;">Tipos de documento</h3>
        <button id="td-nuevo">+ Nuevo tipo</button>
      </div>
      <p class="muted" style="font-size:12px;margin:0 0 8px;">Los documentos con vigencia generan alertas de vencimiento. Cada municipio pide cosas distintas: editá según lo tuyo.</p>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Nombre</th><th>Vigencia</th><th>Obligatorio</th><th></th></tr></thead>
        <tbody>${filasTipos}</tbody></table></div>
    </div>

    <div class="card">
      <div class="topbar" style="margin-bottom:6px;">
        <h3 style="margin:0;font-size:14px;">Tramos de vacaciones</h3>
        <button id="tramo-nuevo">+ Nuevo tramo</button>
      </div>
      <p class="muted" style="font-size:12px;margin:0 0 8px;">Días corridos según antigüedad. Base LCT art. 150; ajustá si tu convenio da más.</p>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Antigüedad</th><th class="num">Días</th><th></th></tr></thead>
        <tbody>${filasTramos || '<tr><td colspan="3" class="muted">Sin tramos.</td></tr>'}</tbody></table></div>
    </div>`;

  CONT.querySelector("#td-nuevo").addEventListener("click", () => modalTipo(null));
  CONT.querySelectorAll(".td-editar").forEach((b) =>
    b.addEventListener("click", () => modalTipo(tipos.find((t) => t.id === b.dataset.id))));
  CONT.querySelectorAll(".td-toggle").forEach((b) => b.addEventListener("click", async () => {
    try { await rrhhConfigRepo.actualizarTipo(b.dataset.id, { activo: b.dataset.activo !== "true" }); await cargar(); }
    catch (err) { toast("Error: " + (err.message || err), "error"); }
  }));

  CONT.querySelector("#tramo-nuevo").addEventListener("click", () => modalTramo());
  CONT.querySelectorAll(".tramo-del").forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmar({ titulo: "Eliminar tramo", mensaje: "¿Eliminar este tramo de vacaciones?", textoOk: "Eliminar", peligro: true }))) return;
    try { await rrhhConfigRepo.eliminarTramo(PERFIL.empresa_id, b.dataset.a); await cargar(); }
    catch (err) { toast("Error: " + (err.message || err), "error"); }
  }));
}

function modalTipo(tipo) {
  const editar = !!tipo;
  const body = abrirModal(editar ? "Editar tipo de documento" : "Nuevo tipo de documento");
  body.innerHTML = `
    <form id="tf">
      <div>${labelInfo("tf-nombre", "Nombre *", "Ej: Libreta sanitaria.")}<input id="tf-nombre" value="${escapar(tipo?.nombre || "")}" required /></div>
      <div class="fila">
        <div>${labelInfo("tf-venc", "Vigencia (meses)", "Vacío = no vence (ej. copia de DNI).")}<input id="tf-venc" type="number" min="1" value="${tipo?.vigencia_meses ?? ""}" placeholder="No vence" /></div>
        <div>${labelInfo("tf-orden", "Orden", "Para ordenar la lista.")}<input id="tf-orden" type="number" value="${tipo?.orden ?? 0}" /></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <input type="checkbox" id="tf-oblig" style="width:auto;" ${tipo?.obligatorio ? "checked" : ""} /> Obligatorio
      </label>
      <div style="margin-top:16px;display:flex;gap:8px;"><button type="submit">${editar ? "Guardar" : "Crear"}</button><button type="button" id="tf-cancelar" class="secundario">Cancelar</button></div>
      <p id="tf-msg" class="msg" hidden></p>
    </form>`;
  const g = (s) => body.querySelector(s);
  g("#tf-cancelar").addEventListener("click", cerrarModal);
  g("#tf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = g("#tf-msg");
    const datos = {
      nombre: g("#tf-nombre").value.trim(),
      vigencia_meses: g("#tf-venc").value,
      orden: g("#tf-orden").value,
      obligatorio: g("#tf-oblig").checked,
    };
    if (!datos.nombre) { setMsg(msg, "El nombre es obligatorio.", "error"); return; }
    setMsg(msg, "Guardando…");
    try {
      if (editar) await rrhhConfigRepo.actualizarTipo(tipo.id, datos);
      else await rrhhConfigRepo.crearTipo(PERFIL.empresa_id, datos);
      cerrarModal(); await cargar(); toast("Guardado ✔");
    } catch (err) { setMsg(msg, "No se pudo guardar: " + (err.message || err), "error"); }
  });
}

function modalTramo() {
  const body = abrirModal("Nuevo tramo de vacaciones");
  body.innerHTML = `
    <form id="trf">
      <div class="fila">
        <div>${labelInfo("trf-ant", "Antigüedad desde (años) *", "A partir de cuántos años aplica.")}<input id="trf-ant" type="number" min="0" value="0" /></div>
        <div>${labelInfo("trf-dias", "Días corridos *", "Días de vacaciones para ese tramo.")}<input id="trf-dias" type="number" min="1" value="14" /></div>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;"><button type="submit">Guardar</button><button type="button" id="trf-cancelar" class="secundario">Cancelar</button></div>
      <p id="trf-msg" class="msg" hidden></p>
    </form>`;
  const g = (s) => body.querySelector(s);
  g("#trf-cancelar").addEventListener("click", cerrarModal);
  g("#trf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = g("#trf-msg");
    const ant = parseInt(g("#trf-ant").value, 10);
    const dias = parseInt(g("#trf-dias").value, 10);
    if (!(ant >= 0) || !(dias > 0)) { setMsg(msg, "Revisá los valores.", "error"); return; }
    setMsg(msg, "Guardando…");
    try {
      await rrhhConfigRepo.guardarTramo(PERFIL.empresa_id, ant, dias);
      cerrarModal(); await cargar(); toast("Tramo guardado ✔");
    } catch (err) { setMsg(msg, "No se pudo guardar: " + (err.message || err), "error"); }
  });
}
