// ============================================================
// core/dinero.js — Helpers de dinero (Regla de Oro 3.3)
// ------------------------------------------------------------
// TODO importe se almacena como ENTERO en CENTAVOS.
// La conversión a decimal ocurre SOLO en la capa de presentación,
// siempre a través de estos helpers centralizados.
// Este módulo NO conoce Firebase ni el DOM.
// ============================================================

/**
 * Redondea a un entero de centavos. Centraliza el criterio de redondeo
 * (redondeo comercial: 0.5 hacia arriba) para todo el sistema.
 * @param {number} x
 * @returns {number} entero
 */
export function redondearCentavos(x) {
  return Math.round(x);
}

/**
 * Convierte un valor en pesos (número o string escrito por el usuario)
 * a un entero de centavos.
 *
 * Acepta formatos comunes en Argentina:
 *   "6.800,00"  → 680000
 *   "6800,50"   → 680050
 *   "6800.50"   → 680050   (punto decimal simple)
 *   6800.5      → 680050
 *   "$ 1.234,5" → 123450
 *
 * Heurística de separadores: si aparecen tanto "." como ",", el ÚLTIMO
 * que aparezca se considera el separador decimal y el otro, de miles.
 * Si aparece solo uno, se decide por la cantidad de dígitos que le siguen
 * (2 dígitos → decimal; de lo contrario → miles).
 *
 * @param {string|number} valor
 * @returns {number} entero de centavos
 */
export function pesosACentavos(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return 0;
    return redondearCentavos(valor * 100);
  }

  let s = String(valor).trim();
  const negativo = /^-|-\s*$/.test(s) || s.includes("(");
  // Dejar solo dígitos, "." y ","
  s = s.replace(/[^0-9.,]/g, "");
  if (s === "") return 0;

  const tienePunto = s.includes(".");
  const tieneComa = s.includes(",");

  let entero, decimales;

  if (tienePunto && tieneComa) {
    // El separador decimal es el que aparece más a la derecha.
    const sepDecimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const sepMiles = sepDecimal === "," ? "." : ",";
    s = s.split(sepMiles).join("");
    [entero, decimales = ""] = s.split(sepDecimal);
  } else if (tieneComa) {
    const partes = s.split(",");
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || ultima.length === 3) {
      // Coma como separador de miles (ej. "6,800" o "1,000,000")
      entero = partes.join("");
      decimales = "";
    } else {
      entero = partes.slice(0, -1).join("");
      decimales = ultima;
    }
  } else if (tienePunto) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || ultima.length === 3) {
      // Punto como separador de miles (ej. "6.800" o "1.000.000")
      entero = partes.join("");
      decimales = "";
    } else {
      entero = partes.slice(0, -1).join("");
      decimales = ultima;
    }
  } else {
    entero = s;
    decimales = "";
  }

  entero = entero || "0";
  decimales = (decimales + "00").slice(0, 2); // exactamente 2 dígitos

  const centavos = parseInt(entero, 10) * 100 + parseInt(decimales, 10);
  return negativo ? -centavos : centavos;
}

/**
 * Convierte centavos (entero) a un número de pesos.
 * Uso: solo presentación / cálculos que necesiten decimal.
 * @param {number} centavos
 * @returns {number}
 */
export function centavosAPesos(centavos) {
  return (centavos || 0) / 100;
}

/**
 * Formatea centavos como string de moneda argentina: "$6.800,00".
 * @param {number} centavos
 * @param {object} [opts]
 * @param {boolean} [opts.simbolo=true] incluir "$"
 * @returns {string}
 */
export function formatearCentavos(centavos, opts = {}) {
  const { simbolo = true } = opts;
  const valor = centavosAPesos(centavos || 0);
  const str = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
  return simbolo ? `$${str}` : str;
}

/**
 * Formatea un porcentaje con una cantidad fija de decimales: "34,5 %".
 * @param {number} pct
 * @param {number} [decimales=1]
 * @returns {string}
 */
export function formatearPorcentaje(pct, decimales = 1) {
  const str = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(pct || 0);
  return `${str} %`;
}

/**
 * Suma una lista de importes en centavos con seguridad de tipos.
 * @param {number[]} lista
 * @returns {number}
 */
export function sumarCentavos(lista) {
  return (lista || []).reduce((acc, n) => acc + (Number(n) || 0), 0);
}
