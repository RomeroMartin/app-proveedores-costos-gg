// ============================================================
// ui/usuarios.js — Gestión de usuarios y roles (solo Gerente)
// ------------------------------------------------------------
// Alta de usuarios DESDE la app, sin pasar por la consola de Firebase ni
// copiar UIDs a mano: se usa una SEGUNDA instancia de Firebase para crear
// la cuenta de Authentication sin desloguear al Gerente. El UID sale solo
// de la cuenta creada (cred.user.uid) y con eso se guarda su perfil.
// ============================================================

import { $, el, limpiar, toast, abrirModal, confirmar, mostrarCargando, esc, ico } from "./helpers.js";
import { ROLES, badgeRol } from "../roles.js";
import * as usuariosRepo from "../data/usuariosRepo.js";
import * as store from "../store.js";
import { firebaseConfig } from "../config/firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSec } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Segunda instancia de Firebase: crea la cuenta SIN tocar la sesión del
// Gerente (la instancia principal). Se cierra apenas termina.
const appSec = initializeApp(firebaseConfig, "secondary-usuarios");
const authSec = getAuth(appSec);

function mensajeAuth(err) {
  const cod = (err && err.code) || "";
  if (cod.includes("email-already-in-use")) return "Ese email ya tiene una cuenta.";
  if (cod.includes("invalid-email")) return "El email no es válido.";
  if (cod.includes("weak-password")) return "La contraseña es muy débil (mínimo 6).";
  return (err && err.message) || "No se pudo crear el usuario.";
}

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
  // (Normalmente ya no aparece: el dueño se autoconfigura al iniciar sesión.)
  if (yo && !tengoPerfil) {
    cont.appendChild(el("div", { class: "card", style: "border-color:var(--warn-txt)" },
      el("p", { class: "card-title" }, "Configurá tu perfil"),
      el("p", { class: "text-muted", style: "font-size:.88rem;margin-bottom:12px" },
        "Todavía no tenés un perfil guardado. Creá tu perfil de Gerente para poder asignar roles al resto del equipo."),
      el("button", { class: "btn btn-primary btn-sm", onClick: async () => {
          try {
            await usuariosRepo.guardar(yo.uid, { nombre: yo.nombre || yo.email || "Gerente", email: yo.email || "", rol: ROLES.GERENTE, activo: true });
            toast("Perfil de Gerente creado.");
            await pintar(cont);
          } catch (e) { toast(e.message || "Error.", "error"); }
        } }, "Crear mi perfil de Gerente"),
    ));
  }

  // Cómo agregar compañeros (ya no hace falta la consola de Firebase).
  cont.appendChild(el("div", { class: "card", style: "background:var(--bg-secondary);box-shadow:none" },
    el("p", { class: "card-title" }, "Cómo agregar a alguien del equipo"),
    el("ol", { style: "font-size:.85rem;color:var(--texto-2);padding-left:18px;line-height:1.7" },
      el("li", {}, "Tocá “Nuevo usuario” y cargá nombre, email, una contraseña temporal y el rol."),
      el("li", {}, "La cuenta se crea sola desde acá: no hay que entrar a Firebase ni copiar ningún UID."),
      el("li", {}, "Pasale a esa persona su email y la contraseña temporal. Entra y ve solo lo que su rol permite."),
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
  const inpNombre = el("input", { class: "form-control", value: usuario ? (usuario.nombre || "") : "", placeholder: "Nombre y apellido" });
  const inpEmail = el("input", { class: "form-control", type: "email", value: usuario ? (usuario.email || "") : "", placeholder: "email@greengarden.com", disabled: editar ? "disabled" : null });
  const inpPass = el("input", { class: "form-control", type: "password", placeholder: "Contraseña temporal (mínimo 6)" });
  const selRol = el("select", { class: "form-control" },
    ...Object.values(ROLES).map((r) => el("option", { value: r, selected: usuario && usuario.rol === r ? "selected" : null }, r)));
  const selActivo = el("select", { class: "form-control" },
    el("option", { value: "true", selected: !usuario || usuario.activo !== false ? "selected" : null }, "Activo"),
    el("option", { value: "false", selected: usuario && usuario.activo === false ? "selected" : null }, "Inactivo"));

  const form = el("div", {},
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Nombre"), inpNombre),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Email"), inpEmail,
      editar ? el("div", { class: "form-hint" }, "El email de acceso no se cambia desde acá.") : null),
    editar ? null : el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Contraseña temporal"), inpPass,
      el("div", { class: "form-hint" }, "La usa para entrar la primera vez; después puede cambiarla.")),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Rol"), selRol),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Estado"), selActivo),
    ),
  );

  let enCurso = false;
  abrirModal({
    titulo: editar ? "Editar usuario" : "Nuevo usuario", contenido: form,
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: editar ? "Guardar" : "Crear", clase: "btn-primary", onClick: async (cerrar) => {
          if (enCurso) return;
          const nombre = inpNombre.value.trim();
          const email = inpEmail.value.trim();
          const rol = selRol.value;
          const activo = selActivo.value === "true";
          if (!nombre) return toast("Falta el nombre.", "error");

          if (editar) {
            try {
              await usuariosRepo.guardar(usuario.uid, { nombre, email: usuario.email || email, rol, activo });
              cerrar(); toast("Usuario guardado."); await render($(".main"));
            } catch (e) { toast(e.message || "Error al guardar.", "error"); }
            return;
          }

          // Alta nueva: crear la cuenta de Authentication con la 2da instancia.
          const password = inpPass.value;
          if (!email) return toast("Falta el email.", "error");
          if (!password || password.length < 6) return toast("La contraseña necesita al menos 6 caracteres.", "error");
          enCurso = true;
          try {
            const cred = await createUserWithEmailAndPassword(authSec, email, password);
            // El UID sale de la cuenta recién creada: nunca se copia a mano.
            await usuariosRepo.guardar(cred.user.uid, { nombre, email, rol, activo });
            await signOutSec(authSec);
            cerrar(); toast(`Usuario creado como ${rol}.`); await render($(".main"));
          } catch (e) {
            enCurso = false;
            toast(mensajeAuth(e), "error");
          }
        } },
    ],
  });
}
