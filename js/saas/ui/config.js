// ============================================================
// saas/ui/config.js — Configuración: Empresa, Usuarios y Catálogos
// ============================================================

import * as empresasRepo from "../data/empresasRepo.js";
import * as usuariosRepo from "../data/usuariosRepo.js";
import * as catalogos from "../data/catalogosRepo.js";
import { escapar, setMsg, labelInfo, datalist, toast } from "./helpers.js";

const ROLES = ["ADMIN", "GERENTE", "COCINA", "AUDITOR"];
const $ = (c, s) => c.querySelector(s);
const esAdmin = (perfil) => perfil && perfil.rol === "ADMIN";

// ---------- Empresa ----------
export async function empresa(container, perfil) {
  container.innerHTML = "<p class='muted'>Cargando…</p>";
  let emp;
  try { emp = await empresasRepo.obtener(perfil.empresa_id); }
  catch (err) { container.innerHTML = `<p class="error">${escapar(err.message)}</p>`; return; }
  const admin = esAdmin(perfil);

  container.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Empresa</h2></div>
    <div class="card">
      <form id="emp-form">
        <div>${labelInfo("emp-nombre", "Nombre", "Nombre de tu empresa/negocio.")}
          <input id="emp-nombre" value="${escapar(emp.nombre || "")}" ${admin ? "" : "disabled"} /></div>
        <div>${labelInfo("emp-cuit", "CUIT / RUT", "Identificación fiscal (opcional).")}
          <input id="emp-cuit" value="${escapar(emp.cuit_rut || "")}" ${admin ? "" : "disabled"} /></div>
        <div style="margin-top:10px;">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="emp-iva" style="width:auto;" ${emp.costea_con_iva ? "checked" : ""} ${admin ? "" : "disabled"} />
            Costear con IVA incluido (precio final)
          </label>
          <p class="muted" style="font-size:12px;margin:4px 0 0;">Si está tildado, el costeo usa el precio final con IVA. (Actualmente el cálculo siempre usa "con IVA".)</p>
        </div>
        ${admin ? `<div style="margin-top:16px;"><button type="submit">Guardar</button></div>` : `<p class="muted" style="margin-top:12px;">Solo un ADMIN puede editar estos datos.</p>`}
        <p id="emp-msg" class="msg" hidden></p>
      </form>
    </div>`;

  if (admin) $(container, "#emp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $(container, "#emp-msg");
    setMsg(msg, "Guardando…");
    try {
      await empresasRepo.actualizar(perfil.empresa_id, {
        nombre: $(container, "#emp-nombre").value.trim(),
        cuit_rut: $(container, "#emp-cuit").value.trim(),
        costea_con_iva: $(container, "#emp-iva").checked,
      });
      setMsg(msg, "Guardado ✔ (recargá para ver el nombre en el menú)", "ok");
    } catch (err) { setMsg(msg, "No se pudo guardar: " + (err.message || err), "error"); }
  });
}

// ---------- Usuarios ----------
export async function usuarios(container, perfil) {
  container.innerHTML = "<p class='muted'>Cargando…</p>";
  const admin = esAdmin(perfil);
  let lista;
  try { lista = await usuariosRepo.listar(); }
  catch (err) { container.innerHTML = `<p class="error">${escapar(err.message)}</p>`; return; }

  const filas = lista.map((u) => {
    const rolCtrl = admin && u.id !== perfil.id
      ? `<select data-id="${u.id}" class="u-rol">${ROLES.map((r) => `<option value="${r}" ${u.rol === r ? "selected" : ""}>${r}</option>`).join("")}</select>`
      : escapar(u.rol);
    const activoCtrl = admin && u.id !== perfil.id
      ? `<button class="secundario u-activo" data-id="${u.id}" data-activo="${u.activo}">${u.activo ? "Activo" : "Inactivo"}</button>`
      : (u.activo ? "Activo" : "Inactivo");
    return `<tr>
      <td>${escapar(u.nombre)}${u.id === perfil.id ? ' <span class="muted">(vos)</span>' : ""}<div class="muted" style="font-size:11.5px;">${escapar(u.email)}</div></td>
      <td>${rolCtrl}</td>
      <td>${activoCtrl}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Usuarios y roles</h2></div>
    <div class="card">
      <div class="tabla-scroll"><table>
        <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px;">
        Para <strong>crear</strong> un usuario nuevo: agregalo en Supabase → Authentication → Users, y después
        entrará con su email. ${admin ? "Vos podés cambiarle el rol y activarlo/desactivarlo acá." : "Solo un ADMIN puede cambiar roles."}
      </p>
      <p id="u-msg" class="msg" hidden></p>
    </div>`;

  if (!admin) return;
  container.querySelectorAll(".u-rol").forEach((sel) => sel.addEventListener("change", async () => {
    try { await usuariosRepo.actualizar(sel.dataset.id, { rol: sel.value }); setMsg($(container, "#u-msg"), "Rol actualizado ✔", "ok"); }
    catch (err) { setMsg($(container, "#u-msg"), err.message || "Error", "error"); }
  }));
  container.querySelectorAll(".u-activo").forEach((b) => b.addEventListener("click", async () => {
    const nuevo = b.dataset.activo !== "true";
    try { await usuariosRepo.actualizar(b.dataset.id, { activo: nuevo }); await usuarios(container, perfil); }
    catch (err) { setMsg($(container, "#u-msg"), err.message || "Error", "error"); }
  }));
}

// ---------- Catálogos ----------
export async function catalogosCfg(container, perfil) {
  const admin = esAdmin(perfil);
  const bloques = Object.entries(catalogos.TIPOS_CATALOGO).map(([tipo, titulo]) => {
    const defaults = (catalogos.DEFAULTS[tipo] || []);
    const agregadas = catalogos.agregadas(tipo);
    const chipsDef = defaults.map((v) => `<span class="chip">${escapar(v)}</span>`).join("");
    const chipsAgr = agregadas.map((v) => `<span class="chip">${escapar(v)}${admin ? `<button data-tipo="${tipo}" data-valor="${escapar(v)}" class="cat-del">✕</button>` : ""}</span>`).join("");
    return `<div class="card">
      <h3 style="margin:0 0 6px;">${escapar(titulo)}</h3>
      <div class="muted" style="font-size:12px;">Por defecto</div>
      <div class="chips">${chipsDef || "<span class='muted'>—</span>"}</div>
      <div class="muted" style="font-size:12px;margin-top:10px;">Agregadas por vos</div>
      <div class="chips">${chipsAgr || "<span class='muted'>Ninguna todavía.</span>"}</div>
      ${admin ? `<div class="fila" style="margin-top:8px;">
        <input class="cat-add" list="dl-add-${tipo}" data-tipo="${tipo}" placeholder="Agregar opción…" style="flex:2;" />
        <button type="button" class="secundario cat-add-btn" data-tipo="${tipo}" style="flex:0 0 auto;">Agregar</button>
      </div>${datalist(`dl-add-${tipo}`, catalogos.opciones(tipo))}` : ""}
    </div>`;
  }).join("");

  container.innerHTML = `<div class="topbar" style="margin-bottom:14px;"><h2 style="margin:0;">Catálogos</h2></div>${bloques}`;

  if (!admin) return;
  container.querySelectorAll(".cat-del").forEach((b) => b.addEventListener("click", async () => {
    try { await catalogos.eliminar(perfil.empresa_id, b.dataset.tipo, b.dataset.valor); await catalogosCfg(container, perfil); }
    catch (err) { toast(err.message || "Error", "error"); }
  }));
  const agregar = async (tipo, input) => {
    const v = input.value.trim();
    if (!v) return;
    try { await catalogos.asegurar(perfil.empresa_id, tipo, v); await catalogosCfg(container, perfil); }
    catch (err) { toast(err.message || "Error", "error"); }
  };
  container.querySelectorAll(".cat-add-btn").forEach((b) => b.addEventListener("click", () => {
    agregar(b.dataset.tipo, container.querySelector(`.cat-add[data-tipo="${b.dataset.tipo}"]`));
  }));
  container.querySelectorAll(".cat-add").forEach((inp) => inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); agregar(inp.dataset.tipo, inp); }
  }));
}
