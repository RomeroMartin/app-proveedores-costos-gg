// ============================================================
// data/pagosRepo.js — Colección `pagos` (imputación FIFO/manual + anulación)
// ------------------------------------------------------------
// Lo más delicado del sistema. Reglas 3.4 (no se edita, se anula) y
// 3.5 (todo multi-documento en transacción, saldos con increment()).
// En una transacción de Firestore TODAS las lecturas van antes que las
// escrituras: por eso los ids candidatos se resuelven fuera y adentro
// se releen por referencia para trabajar con saldos frescos.
// ============================================================

import { db, collection, doc, getDocs, query, where, orderBy } from "./_base.js";
import {
  runTransaction, increment, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uid } from "./_base.js";
import { pendientesFIFO } from "./facturasRepo.js";

const COL = "pagos";

/** Historial de pagos de un proveedor, más recientes primero. */
export async function listarPorProveedor(proveedorId) {
  const snap = await getDocs(query(
    collection(db, COL),
    where("proveedor_id", "==", proveedorId),
    orderBy("fecha_pago", "desc"),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function estadoPorSaldo(saldo, total) {
  if (saldo <= 0) return "pagada";
  if (saldo >= total) return "pendiente";
  return "parcial";
}

/**
 * Registra un pago e imputa a facturas (FIFO o manual) en una transacción.
 *
 * @param {object} p
 * @param {string} p.proveedorId
 * @param {number} p.montoCentavos
 * @param {string} p.metodoPago       efectivo|transferencia|cheque|echeq|otro
 * @param {string} [p.referencia]
 * @param {Date}   [p.fechaPago]
 * @param {"fifo"|"manual"} [p.modoImputacion="fifo"]
 * @param {string[]} [p.facturaIdsManual]  orden de imputación en modo manual
 * @returns {Promise<{pagoId:string, imputadoCentavos:number, excedenteCentavos:number}>}
 */
export async function registrarPago(p) {
  const monto = Number(p.montoCentavos) || 0;
  if (monto <= 0) throw new Error("El monto del pago debe ser mayor a cero.");

  // Resolver el orden de facturas candidatas FUERA de la transacción.
  let idsOrden;
  if (p.modoImputacion === "manual" && Array.isArray(p.facturaIdsManual) && p.facturaIdsManual.length) {
    idsOrden = p.facturaIdsManual.slice();
  } else {
    const pend = await pendientesFIFO(p.proveedorId);
    idsOrden = pend.map((f) => f.id);
  }

  const pagoRef = doc(collection(db, COL));
  const provRef = doc(db, "proveedores", p.proveedorId);
  let imputado = 0;

  await runTransaction(db, async (tx) => {
    // 1) Lecturas: proveedor + cada factura candidata (saldos frescos)
    const provSnap = await tx.get(provRef);
    if (!provSnap.exists()) throw new Error("El proveedor no existe.");

    const facturas = [];
    for (const id of idsOrden) {
      const ref = doc(db, "facturas", id);
      const snap = await tx.get(ref);
      if (snap.exists()) facturas.push({ ref, id, ...snap.data() });
    }

    // 2) Allocación FIFO/manual
    let restante = monto;
    const afectadas = [];
    for (const f of facturas) {
      if (restante <= 0) break;
      if (f.estado === "anulada" || f.activo === false) continue;
      const saldo = Number(f.saldo_pendiente_centavos) || 0;
      if (saldo <= 0) continue;
      const aplica = Math.min(restante, saldo);
      const nuevoSaldo = saldo - aplica;
      afectadas.push({ factura_id: f.id, monto_imputado_centavos: aplica });
      // 3) Escrituras a facturas
      tx.update(f.ref, {
        saldo_pendiente_centavos: nuevoSaldo,
        estado: estadoPorSaldo(nuevoSaldo, Number(f.monto_total_centavos) || 0),
      });
      restante -= aplica;
    }
    imputado = monto - restante;

    // 4) Escritura del pago
    tx.set(pagoRef, {
      proveedor_id: p.proveedorId,
      fecha_pago: p.fechaPago instanceof Date ? Timestamp.fromDate(p.fechaPago) : serverTimestamp(),
      monto_pagado_centavos: monto,
      metodo_pago: p.metodoPago || "transferencia",
      referencia: (p.referencia || "").trim(),
      modo_imputacion: p.modoImputacion === "manual" ? "manual" : "fifo",
      facturas_afectadas: afectadas,
      estado: "activo",
      anula_a_pago_id: null,
      anulado_por_pago_id: null,
      creado_en: serverTimestamp(),
      creado_por: uid(),
    });

    // 5) Saldo del proveedor: baja el monto completo (el excedente queda como saldo a favor → deuda negativa)
    tx.update(provRef, { saldo_total_deuda_centavos: increment(-monto) });
  });

  return { pagoId: pagoRef.id, imputadoCentavos: imputado, excedenteCentavos: monto - imputado };
}

/**
 * Anula un pago por contraasiento (Regla 3.4 / Sección 5.5).
 * Genera un pago negativo que revierte imputaciones y saldos, marca el
 * original como anulado. Todo en la misma transacción.
 *
 * @param {string} pagoOriginalId
 * @returns {Promise<{contraasientoId:string}>}
 */
export async function anularPago(pagoOriginalId) {
  const originalRef = doc(db, COL, pagoOriginalId);
  const contraRef = doc(collection(db, COL));

  await runTransaction(db, async (tx) => {
    // 1) Lecturas
    const origSnap = await tx.get(originalRef);
    if (!origSnap.exists()) throw new Error("El pago no existe.");
    const orig = origSnap.data();
    if (orig.estado === "anulado") throw new Error("El pago ya está anulado.");

    const provRef = doc(db, "proveedores", orig.proveedor_id);
    const afectadas = orig.facturas_afectadas || [];
    const facturas = [];
    for (const a of afectadas) {
      const ref = doc(db, "facturas", a.factura_id);
      const snap = await tx.get(ref);
      if (snap.exists()) facturas.push({ ref, monto: Number(a.monto_imputado_centavos) || 0, ...snap.data() });
    }

    // 2) Revertir cada factura (devolver lo imputado al saldo pendiente)
    for (const f of facturas) {
      const nuevoSaldo = (Number(f.saldo_pendiente_centavos) || 0) + f.monto;
      tx.update(f.ref, {
        saldo_pendiente_centavos: nuevoSaldo,
        estado: estadoPorSaldo(nuevoSaldo, Number(f.monto_total_centavos) || 0),
      });
    }

    const monto = Number(orig.monto_pagado_centavos) || 0;

    // 3) Crear contraasiento (pago negativo)
    tx.set(contraRef, {
      proveedor_id: orig.proveedor_id,
      fecha_pago: serverTimestamp(),
      monto_pagado_centavos: -monto,
      metodo_pago: orig.metodo_pago,
      referencia: `ANULACIÓN de pago ${pagoOriginalId}`,
      modo_imputacion: orig.modo_imputacion,
      facturas_afectadas: afectadas.map((a) => ({ factura_id: a.factura_id, monto_imputado_centavos: -(Number(a.monto_imputado_centavos) || 0) })),
      estado: "activo",
      anula_a_pago_id: pagoOriginalId,
      anulado_por_pago_id: null,
      creado_en: serverTimestamp(),
      creado_por: uid(),
    });

    // 4) Marcar el original como anulado
    tx.update(originalRef, { estado: "anulado", anulado_por_pago_id: contraRef.id });

    // 5) Revertir el saldo del proveedor
    tx.update(provRef, { saldo_total_deuda_centavos: increment(monto) });
  });

  return { contraasientoId: contraRef.id };
}
