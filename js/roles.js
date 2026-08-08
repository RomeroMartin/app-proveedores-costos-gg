// ============================================================
// roles.js — Roles de usuario y permisos (UI)
// ------------------------------------------------------------
// Dos roles:
//   Gerente  → acceso total (rentabilidad, precios, anulaciones, usuarios).
//   Cargador → carga operativa (insumos, proveedores, facturas, pagos).
//
// Este gating es de UX. La barrera real son las firestore.rules; las de la
// colección `usuarios` ya restringen la gestión de roles al Gerente.
// ============================================================

export const ROLES = { GERENTE: "Gerente", CARGADOR: "Cargador" };

export const ROL_POR_DEFECTO = ROLES.GERENTE;

// Capacidad → roles que la tienen.
const PERMISOS = {
  ver_dashboard: [ROLES.GERENTE],
  ver_costos: [ROLES.GERENTE],
  ver_insumos: [ROLES.GERENTE, ROLES.CARGADOR],
  editar_insumo: [ROLES.GERENTE, ROLES.CARGADOR],
  ver_proveedores: [ROLES.GERENTE, ROLES.CARGADOR],
  gestionar_proveedor: [ROLES.GERENTE, ROLES.CARGADOR],
  cargar_factura: [ROLES.GERENTE, ROLES.CARGADOR],
  registrar_pago: [ROLES.GERENTE, ROLES.CARGADOR],
  anular_pago: [ROLES.GERENTE],
  editar_receta: [ROLES.GERENTE],
  exportar: [ROLES.GERENTE],
  gestionar_usuarios: [ROLES.GERENTE],
};

/** ¿El rol tiene la capacidad indicada? */
export function puede(rol, capacidad) {
  const permitidos = PERMISOS[capacidad];
  if (!permitidos) return false;
  return permitidos.includes(rol);
}

/** Etiqueta amigable + clase de badge para un rol. */
export function badgeRol(rol) {
  return rol === ROLES.GERENTE
    ? { clase: "badge-ok", label: "Gerente" }
    : { clase: "badge-info", label: "Cargador" };
}
