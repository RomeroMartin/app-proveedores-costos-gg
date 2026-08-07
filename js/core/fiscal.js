// ============================================================
// core/fiscal.js — IVA, crédito fiscal y neto ↔ total (Regla 3.2)
// ------------------------------------------------------------
// Green Garden es RESPONSABLE INSCRIPTO: el IVA de compras es crédito
// fiscal recuperable (NO es costo)... EXCEPTO cuando el comprobante no
// discrimina IVA (Factura C de monotributista), donde el total sí es costo.
// El escandallo vive 100 % en NETO.
// Este módulo NO conoce Firebase ni el DOM.
// ============================================================

import { redondearCentavos } from "./dinero.js";

/** Alícuotas de IVA permitidas (%). "mixta" se maneja como caso aparte en la UI. */
export const ALICUOTAS_IVA = [0, 10.5, 21, 27];

/** Condiciones fiscales de un proveedor. */
export const CONDICIONES_FISCALES = ["responsable_inscripto", "monotributo", "exento"];

/** Tipos de comprobante. */
export const TIPOS_COMPROBANTE = ["A", "B", "C"];

/**
 * ¿Este comprobante genera crédito fiscal recuperable?
 * Solo la Factura A emitida por un Responsable Inscripto discrimina IVA
 * recuperable. En cualquier otro caso el IVA no se recupera y el importe
 * completo es costo (Regla 3.2, excepción Factura C).
 *
 * @param {string} tipoComprobante  "A" | "B" | "C"
 * @param {string} condicionFiscalProveedor
 * @returns {boolean}
 */
export function recuperaCreditoFiscal(tipoComprobante, condicionFiscalProveedor) {
  return tipoComprobante === "A" && condicionFiscalProveedor === "responsable_inscripto";
}

/**
 * Calcula el IVA (en centavos) de un neto dado.
 * @param {number} netoCentavos
 * @param {number} alicuota  (%)
 * @returns {number} centavos (entero)
 */
export function calcularIVA(netoCentavos, alicuota) {
  return redondearCentavos((Number(netoCentavos) || 0) * (Number(alicuota) || 0) / 100);
}

/**
 * Neto → Total (con IVA), sin percepciones.
 * @param {number} netoCentavos
 * @param {number} alicuota (%)
 * @returns {number} centavos (entero)
 */
export function netoATotal(netoCentavos, alicuota) {
  return redondearCentavos((Number(netoCentavos) || 0) * (1 + (Number(alicuota) || 0) / 100));
}

/**
 * Total (con IVA) → Neto, sin percepciones.
 * @param {number} totalCentavos
 * @param {number} alicuota (%)
 * @returns {number} centavos (entero)
 */
export function totalANeto(totalCentavos, alicuota) {
  return redondearCentavos((Number(totalCentavos) || 0) / (1 + (Number(alicuota) || 0) / 100));
}

/**
 * Cálculo bidireccional para la carga de facturas (UX 7.5).
 * Contempla percepciones (anticipos de impuesto: van al total pagable pero
 * NO son costo ni crédito fiscal).
 *
 *   total = neto + iva(neto, alícuota) + percepciones
 *
 * Dado uno de los dos lados (neto o total) devuelve el desglose completo.
 *
 * @param {object} p
 * @param {"neto"|"total"} p.desde        cuál de los dos escribió el usuario
 * @param {number} p.montoCentavos        el valor escrito (neto o total, en centavos)
 * @param {number} p.alicuota             (%)
 * @param {number} [p.percepcionesCentavos=0]
 * @returns {{neto:number, iva:number, percepciones:number, total:number}}
 */
export function desglosarFactura({ desde, montoCentavos, alicuota, percepcionesCentavos = 0 }) {
  const percep = Number(percepcionesCentavos) || 0;
  const ali = Number(alicuota) || 0;
  let neto, iva, total;

  if (desde === "neto") {
    neto = Number(montoCentavos) || 0;
    iva = calcularIVA(neto, ali);
    total = neto + iva + percep;
  } else {
    total = Number(montoCentavos) || 0;
    // neto = (total - percepciones) / (1 + alícuota)
    neto = totalANeto(total - percep, ali);
    iva = total - percep - neto; // el IVA absorbe el redondeo para que cierre exacto
  }

  return { neto, iva, percepciones: percep, total };
}

/**
 * Validación obligatoria al guardar una factura (Sección 5.4):
 *   neto_gravado + iva_discriminado + percepciones === monto_total
 *
 * @param {object} f
 * @param {number} f.netoCentavos
 * @param {number} f.ivaCentavos
 * @param {number} f.percepcionesCentavos
 * @param {number} f.totalCentavos
 * @returns {{ok:boolean, diferenciaCentavos:number}}
 */
export function validarCuadraturaFactura({ netoCentavos, ivaCentavos, percepcionesCentavos, totalCentavos }) {
  const suma = (Number(netoCentavos) || 0) + (Number(ivaCentavos) || 0) + (Number(percepcionesCentavos) || 0);
  const diferencia = (Number(totalCentavos) || 0) - suma;
  return { ok: diferencia === 0, diferenciaCentavos: diferencia };
}
