// ============================================================
// ui/usuarios.js — Gestión de usuarios y roles (solo Gerente)
// ============================================================

import { $, el, limpiar, toast, abrirModal, confirmar, mostrarCargando, esc, ico } from "./helpers.js";
import { ROLES, badgeRol } from "../roles.js";
import * as usuariosRepo from "../data/usuariosRepo.js";
import * as store from "../store.js";

export async function render(main) {
  main.innerHTML = "";
  main.appendChild(el("div", { class: "page-header" },
    el("div", {},
      el("div", { class: "page-title" }, "Usuarios"),
      el("div", { class: "page-subtitle" }, "Perfiles y roles del equipo."),
    ),
    el("button", { class: "btn btn-primary", onClick: () => abrirForm() }, el("span", { html: ico("mas", 16) }), "Nuevo usuario"),
  ));
  const cont = el("div", {});
  main.appendChild(cont);
  await pintar(cont);
}

async function pintar(cont) {
  mostrarCargando(cont, "Cargando usuarios…");
  let usuarios = [];
  try { usuarios = await usuariosRepo.listar(); } catch (_e) {}
  limpiar(cont);

  const yo = store.getUsuario();
  const tengoPerfil = usuarios.some((u) => u.uid === (yo && yo.uid));

  // Aviso de bootstrap: si el dueño todavía no tiene perfil propio.
  if (yo && !tengoPerfil) {
    cont.appendChild(el("div", { class: "card", style: "border-color:var(--warn-txt)" },
      el("p", { class: "card-title" }, "Configurá tu perfil"),
      el("p", { class: "text-muted", style: "font-size:.88rem;margin-bottom:12px" },
        "Todavía no tenés un perfil guardado, así que la app te trata como Gerente por defecto. Creá tu perfil de Gerente para poder asignar roles al resto del equipo."),
      el("button", { class: "btn btn-primary btn-sm", onClick: async () => {
          try {
            await usuariosRepo.guardar(yo.uid, { nombre: yo.nombre || yo.email || "Gerente", email: yo.email || "", rol: ROLES.GERENTE, activo: true });
            toast("Perfil de Gerente creado.");
            await pintar(cont);
          } catch (e) { toast(e.message || "Error.", "error"); }
        } }, "Crear mi perfil de Gerente"),
    ));
  }

  // Instrucción para agregar compañeros.
  cont.appendChild(el("div", { class: "card", style: "background:var(--bg-secondary);box-shadow:none" },
    el("p", { class: "card-title" }, "Cómo agregar a alguien del equipo"),
    el("ol", { style: "font-size:.85rem;color:var(--texto-2);padding-left:18px;line-height:1.7" },
      el("li", {}, "En la consola de Firebase → Authentication → Users, creá el usuario (email + contraseña) y copiá su UID."),
      el("li", {}, "Acá tocá “Nuevo usuario”, pegá ese UID, poné el nombre y elegí el rol."),
      el("li", {}, "Listo: esa persona entra con su email y ve solo lo que su rol permite."),
    ),
  ));

  if (!usuarios.length) {
    cont.appendChild(el("div", { class: "empty-state" }, el("p", {}, "Todavía no hay perfiles cargados.")));
    return;
  }
  cont.appendChild(el("div", { class: "tabla-wrap" },
    el("table", { class: "tabla" },
      el("thead", {}, el("tr", {}, el("th", {}, "Usuario"), el("th", {}, "Rol"), el("th", {}, "Estado"), el("th", { class: "text-right" }, "Acciones"))),
      el("tbody", {}, ...usuarios.map((u) => {
        const b = badgeRol(u.rol);
        return el("tr", {},
          el("td", {}, el("div", { class: "celda-principal" }, u.nombre || "—"), el("div", { class: "celda-sub" }, `${u.email || ""}`), el("div", { class: "celda-sub mono", style: "font-size:.68rem" }, u.uid)),
          el("td", {}, el("span", { class: "badge " + b.clase }, b.label)),
          el("td", {}, el("span", { class: "badge " + (u.activo !== false ? "badge-ok" : "badge-muted") }, u.activo !== false ? "activo" : "inactivo")),
          el("td", { class: "text-right" }, el("button", { class: "btn btn-xs btn-secondary", onClick: () => abrirForm(u) }, "Editar")),
        );
      })),
    )));
}

function abrirForm(usuario = null) {
  const editar = !!usuario;
  const inpUid = el("input", { class: "form-control mono", value: usuario ? usuario.uid : "", placeholder: "UID de Firebase Authentication", disabled: editar ? "disabled" : null });
  const inpNombre = el("input", { class: "form-control", value: usuario ? (usuario.nombre || "") : "", placeholder: "Nombre y apellido" });
  const inpEmail = el("input", { class: "form-control", value: usuario ? (usuario.email || "") : "", placeholder: "email@greengarden.com" });
  const selRol = el("select", { class: "form-control" },
    ...Object.values(ROLES).map((r) => el("option", { value: r, selected: usuario && usuario.rol === r ? "selected" : null }, r)));
  const selActivo = el("select", { class: "form-control" },
    el("option", { value: "true", selected: !usuario || usuario.activo !== false ? "selected" : null }, "Activo"),
    el("option", { value: "false", selected: usuario && usuario.activo === false ? "selected" : null }, "Inactivo"));

  const form = el("div", {},
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "UID"), inpUid,
      el("div", { class: "form-hint" }, "Firebase console → Authentication → Users → copiar UID.")),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Nombre"), inpNombre),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Email"), inpEmail),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Rol"), selRol),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Estado"), selActivo),
    ),
  );

  abrirModal({
    titulo: editar ? "Editar usuario" : "Nuevo usuario", contenido: form,
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: editar ? "Guardar" : "Crear", clase: "btn-primary", onClick: async (cerrar) => {
          const uid = inpUid.value.trim();
          if (!uid) return toast("Falta el UID.", "error");
          try {
            await usuariosRepo.guardar(uid, { nombre: inpNombre.value, email: inpEmail.value, rol: selRol.value, activo: selActivo.value === "true" });
            cerrar(); toast("Usuario guardado."); await render($(".main"));
          } catch (e) { toast(e.message || "Error. ¿Tenés rol Gerente con perfil creado?", "error"); }
        } },
    ],
  });
}
