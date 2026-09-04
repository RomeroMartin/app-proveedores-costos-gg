// ============================================================
// saas/ui/proveedores.js — Pantalla de Proveedores
// ------------------------------------------------------------
// montar(container, perfil): renderiza la pantalla dentro de `container`.
// La UI no calcula: usa los repos y core/.
// ============================================================

import * as proveedoresRepo from "../data/proveedoresRepo.js";
import * as catalogos from "../data/catalogosRepo.js";
import { CONDICIONES_FISCALES } from "../../core/fiscal.js";
import { formatearCentavos } from "../../core/dinero.js";
import { escapar, setMsg, labelInfo, datalist } from "./helpers.js";

export async function montar(container, perfil) {
  container.innerHTML = `
    <div class="card">
      <div class="topbar">
        <h2 style="margin:0;">Proveedores</h2>
        <button id="prov-refrescar" class="secundario">Refrescar</button>
      </div>
      <div id="prov-lista" class="tabla-scroll"></div>
    </div>

    <div class="card">
      <h2 style="margin-top:0;">Nuevo proveedor</h2>
      <form id="form-proveedor">
        <div class="fila">
          <div>${labelInfo("prov-nombre", "Nombre *", "Razón social o nombre con el que identificás al proveedor.")}<input id="prov-nombre" required /></div>
          <div>${labelInfo("prov-cuit", "CUIT", "Número de CUIT del proveedor (opcional). Ej: 30-12345678-9.")}<input id="prov-cuit" placeholder="30-12345678-9" /></div>
        </div>
        <div class="fila">
          <div>${labelInfo("prov-condicion", "Condición fiscal", "Cómo factura el proveedor. Define si el IVA se puede tomar como crédito fiscal.")}<select id="prov-condicion"></select></div>
          <div>${labelInfo("prov-rubro", "Rubro principal", "Categoría del proveedor (ej: Lácteos, Verdulería). Elegí una o escribí una nueva: se guarda para la próxima.")}
            <input id="prov-rubro" list="dl-rubro" placeholder="Elegí o escribí…" /></div>
        </div>
        <div style="margin-top:16px;"><button type="submit">Guardar proveedor</button></div>
        <p id="prov-msg" class="msg" hidden></p>
      </form>
      ${datalist("dl-rubro", catalogos.opciones("rubro"))}
    </div>`;

  const sel = container.querySelector("#prov-condicion");
  poblarCondiciones(sel);

  container.querySelector("#prov-refrescar").addEventListener("click", () => refrescar(container));
  container.querySelector("#form-proveedor").addEventListener("submit", (e) => alta(e, container, perfil));

  await refrescar(container);
}

function refrescarDatalist(container) {
  const dl = container.querySelector("#dl-rubro");
  if (dl) dl.innerHTML = catalogos.opciones("rubro").map((o) => `<option value="${escapar(o)}"></option>`).join("");
}

function poblarCondiciones(sel) {
  sel.innerHTML = "";
  for (const c of CONDICIONES_FISCALES) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c.replace(/_/g, " ");
    sel.appendChild(opt);
  }
}

async function refrescar(container) {
  const cont = container.querySelector("#prov-lista");
  cont.innerHTML = "<p class='muted'>Cargando…</p>";
  try {
    const lista = await proveedoresRepo.listar();
    if (!lista.length) {
      cont.innerHTML = "<p class='muted'>Todavía no hay proveedores. Cargá el primero 👇</p>";
      return;
    }
    const filas = lista.map((p) => `
      <tr>
        <td>${escapar(p.codigo || "")}</td>
        <td>${escapar(p.nombre)}</td>
        <td>${escapar((p.condicion_fiscal || "").replace(/_/g, " "))}</td>
        <td>${escapar(p.rubro_principal || "")}</td>
        <td class="num">${formatearCentavos(p.saldo_total_deuda_centavos || 0)}</td>
        <td><button data-id="${p.id}" class="btn-baja">Baja</button></td>
      </tr>`).join("");
    cont.innerHTML = `
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Condición</th><th>Rubro</th><th class="num">Saldo</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
    cont.querySelectorAll(".btn-baja").forEach((b) =>
      b.addEventListener("click", () => baja(b.dataset.id, container)));
  } catch (err) {
    cont.innerHTML = `<p class="error">Error al listar: ${escapar(err.message || String(err))}</p>`;
  }
}

async function alta(e, container, perfil) {
  e.preventDefault();
  const msg = container.querySelector("#prov-msg");
  const rubro = container.querySelector("#prov-rubro").value.trim();
  setMsg(msg, "Guardando…");
  try {
    await catalogos.asegurar(perfil.empresa_id, "rubro", rubro);
    await proveedoresRepo.crear(perfil.empresa_id, {
      nombre: container.querySelector("#prov-nombre").value,
      cuit: container.querySelector("#prov-cuit").value,
      condicion_fiscal: container.querySelector("#prov-condicion").value,
      rubro_principal: rubro,
    });
    container.querySelector("#form-proveedor").reset();
    poblarCondiciones(container.querySelector("#prov-condicion"));
    refrescarDatalist(container);
    setMsg(msg, "Proveedor creado ✔", "ok");
    await refrescar(container);
  } catch (err) {
    setMsg(msg, "No se pudo crear: " + (err.message || err), "error");
  }
}

async function baja(id, container) {
  if (!confirm("¿Dar de baja este proveedor?")) return;
  try {
    await proveedoresRepo.desactivar(id);
    await refrescar(container);
  } catch (err) {
    alert("Error: " + (err.message || err));
  }
}
