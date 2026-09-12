// ============================================================
// core/utilsFecha.js — Helpers de fechas para RRHH (lógica pura)
// ------------------------------------------------------------
// Sin DOM, sin Supabase. Todas las fechas se manejan como strings
// ISO "YYYY-MM-DD" para evitar corrimientos por zona horaria (el
// constructor Date("2024-01-01") interpreta UTC y puede restar un día
// según la TZ del navegador). Acá parseamos a mano.
// ============================================================

/** Parsea "YYYY-MM-DD" a partes numéricas {a, m, d}. Devuelve null si no válida. */
function partes(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return null;
  return { a: +m[1], m: +m[2], d: +m[3] };
}

/** Fecha de hoy en formato ISO "YYYY-MM-DD" (hora local). */
export function hoyISO() {
  const n = new Date();
  const mm = String(n.getMonth() + 1).padStart(2, "0");
  const dd = String(n.getDate()).padStart(2, "0");
  return `${n.getFullYear()}-${mm}-${dd}`;
}

/**
 * Días CORRIDOS entre dos fechas ISO, ambos extremos incluidos.
 *   diasCorridos("2024-01-01", "2024-01-01") === 1
 *   diasCorridos("2024-01-01", "2024-01-10") === 10
 * Devuelve 0 si falta algún dato o el rango es inválido (hasta < desde).
 */
export function diasCorridos(desdeISO, hastaISO) {
  const d = partes(desdeISO), h = partes(hastaISO);
  if (!d || !h) return 0;
  const a = Date.UTC(d.a, d.m - 1, d.d);
  const b = Date.UTC(h.a, h.m - 1, h.d);
  if (b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Antigüedad en años cumplidos entre fecha de ingreso y una fecha de
 * referencia (por defecto hoy). Cuenta años completos.
 */
export function antiguedadAnios(ingresoISO, refISO = hoyISO()) {
  const i = partes(ingresoISO), r = partes(refISO);
  if (!i || !r) return 0;
  let anios = r.a - i.a;
  if (r.m < i.m || (r.m === i.m && r.d < i.d)) anios -= 1;
  return Math.max(0, anios);
}

/**
 * Texto amigable de antigüedad: "2 años y 3 meses", "8 meses", "recién ingresó".
 */
export function antiguedadTexto(ingresoISO, refISO = hoyISO()) {
  const i = partes(ingresoISO), r = partes(refISO);
  if (!i || !r) return "";
  let meses = (r.a - i.a) * 12 + (r.m - i.m);
  if (r.d < i.d) meses -= 1;
  if (meses < 0) meses = 0;
  const anios = Math.floor(meses / 12);
  const rem = meses % 12;
  if (anios === 0 && rem === 0) return "menos de un mes";
  const pa = anios > 0 ? `${anios} ${anios === 1 ? "año" : "años"}` : "";
  const pm = rem > 0 ? `${rem} ${rem === 1 ? "mes" : "meses"}` : "";
  return [pa, pm].filter(Boolean).join(" y ");
}

/**
 * Suma meses a una fecha ISO y devuelve ISO. Ajusta fin de mes (ej. sumar
 * 1 mes a "2024-01-31" da "2024-02-29"). Útil para autocompletar el
 * vencimiento = emisión + vigencia_meses.
 * Devuelve "" si la fecha o los meses no son válidos.
 */
export function sumarMeses(isoBase, meses) {
  const p = partes(isoBase);
  if (!p || meses == null || !Number.isFinite(+meses)) return "";
  const total = p.m - 1 + Math.trunc(+meses);
  const a = p.a + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12; // 0..11
  const ultimoDia = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const d = Math.min(p.d, ultimoDia);
  return `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Formatea "YYYY-MM-DD" como "DD/MM/YYYY". Devuelve "—" si vacío/invalid. */
export function formatearFecha(iso) {
  const p = partes(iso);
  if (!p) return "—";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.a}`;
}
