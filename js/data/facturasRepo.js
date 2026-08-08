// ============================================================
// data/facturasRepo.js — Colección `facturas`
// ------------------------------------------------------------
// neto_gravado → alimenta el costeo.  monto_total → cuenta corriente.
// Nunca se cruzan. Alta en transacción: crea la factura + suma al saldo
// del proveedor con increment() atómico (Regla 3.5).
// ============================================================

import { db, collection, doc, getDocs, query, where, orderBy, camposCreacion } from "./_base.js";
import {
  runTransaction, increment, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { validarCuadraturaFactura } from "../core/fiscal.js";

const COL = "facturas";

// Nota: consultamos solo por igualdad (proveedor_id) y ordenamos/filtramos en
// memoria. Combinar igualdad + orderBy o + inequality exigiría índices
// compuestos de Firestore; a la escala de esta app (1–3 usuarios) no aportan y
// solo agregan fricción de deploy (Sección 4.2: leer poco, cachear en memoria).

function millis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

/** Facturas de un proveedor (todas, incluidas anuladas), más recientes primero. */
export async function listarPorProveedor(proveedorId) {
  const snap = await getDocs(query(
    collection(db, COL),
    where("proveedor_id", "==", proveedorId),
  ));
  const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  arr.sort((a, b) => millis(b.fecha_emision) - millis(a.fecha_emision));
  return arr;
}

/** Facturas con saldo pendiente de un proveedor, FIFO (más antiguas primero). */
export async function pendientesFIFO(proveedorId) {
  const snap = await getDocs(query(
    collection(db, COL),
    where("proveedor_id", "==", proveedorId),
  ));
  const arr = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => (Number(f.saldo_pendiente_centavos) || 0) > 0 && f.estado !== "anulada" && f.activo !== false);
  arr.sort((a, b) => millis(a.fecha_emision) - millis(b.fecha_emision));
  return arr;
}

/** Todas las facturas con saldo pendiente (para el dashboard global). */
export async function pendientesGlobal() {
  const snap = await getDocs(query(
    collection(db, COL),
    where("saldo_pendiente_centavos", ">", 0),
  ));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => f.estado !== "anulada" && f.activo !== false);
}

/**
 * Crea una factura. Valida la cuadratura antes de escribir.
 * @param {object} datos  importes en centavos ya calculados
 * @returns {Promise<string>} id de la factura
 */
export async function crear(datos) {
  const cuadra = validarCuadraturaFactura({
    netoCentavos: datos.neto_gravado_centavos,
    ivaCentavos: datos.iva_discriminado_centavos,
    percepcionesCentavos: datos.percepciones_centavos || 0,
    totalCentavos: datos.monto_total_centavos,
  });
  if (!cuadra.ok) {
    throw new Error(`La factura no cuadra: neto + IVA + percepciones ≠ total (diferencia ${cuadra.diferenciaCentavos} centavos).`);
  }
  if (!datos.proveedor_id) throw new Error("Falta el proveedor.");

  const facturaRef = doc(collection(db, COL));
  const provRef = doc(db, "proveedores", datos.proveedor_id);

  await runTransaction(db, async (tx) => {
    const total = Number(datos.monto_total_centavos) || 0;
    tx.set(facturaRef, {
      proveedor_id: datos.proveedor_id,
      tipo_comprobante: datos.tipo_comprobante,
      numero_factura: (datos.numero_factura || "").trim(),
      fecha_emision: datos.fecha_emision instanceof Date ? Timestamp.fromDate(datos.fecha_emision) : (datos.fecha_emision || serverTimestamp()),
      fecha_vencimiento: datos.fecha_vencimiento instanceof Date ? Timestamp.fromDate(datos.fecha_vencimiento) : (datos.fecha_vencimiento || null),
      neto_gravado_centavos: Number(datos.neto_gravado_centavos) || 0,
      iva_discriminado_centavos: Number(datos.iva_discriminado_centavos) || 0,
      percepciones_centavos: Number(datos.percepciones_centavos) || 0,
      monto_total_centavos: total,
      saldo_pendiente_centavos: total,
      estado: "pendiente",
      observaciones: (datos.observaciones || "").trim(),
      ...camposCreacion(),
    });
    // El saldo de deuda del proveedor sube el TOTAL (con IVA + percepciones)
    tx.update(provRef, { saldo_total_deuda_centavos: increment(total) });
  });

  return facturaRef.id;
}
