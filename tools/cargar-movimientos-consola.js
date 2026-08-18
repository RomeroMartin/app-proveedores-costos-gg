// ============================================================
// tools/cargar-movimientos-consola.js
// Genera MOVIMIENTOS de demo para que el Tablero muestre datos en todos los
// KPIs, y HISTORIAL de precios retroactivo para ver la evolución de costos.
// ------------------------------------------------------------
// Crea, sobre los proveedores/insumos ya cargados:
//   1) Facturas en varios estados: impagas, parciales y pagadas, con
//      vencimientos vencidos y próximos  -> enciende: Deuda total, Facturas
//      pendientes, Top proveedores por deuda y Facturas próximas a vencer.
//   2) Pagos (imputación FIFO/manual, en transacción con increment atómico).
//   3) Historial de precios con fechas pasadas para ~15 insumos -> el gráfico
//      de "Evolución de precio" muestra el progreso en el tiempo.
//   4) Marca ~6 insumos con precio "sin actualizar" -> enciende el panel de
//      Alertas del tablero.
//
// USO: logueado como Gerente, abrí la consola (F12), pegá todo y Enter.
// Requiere haber corrido antes tools/cargar-real-consola.js.
//
// IDEMPOTENTE: si un proveedor ya tiene facturas, no le crea más; si un insumo
// ya tiene historial ampliado, no lo duplica. Reejecutable sin inflar la deuda.
// NADA se borra físico. Los importes van en centavos; las facturas cuadran
// (neto + IVA + percepciones = total) vía core/fiscal.desglosarFactura.
// ============================================================

(async () => {
  const j = (p) => new URL(p, location.origin + "/").href;
  const base            = await import(j("js/data/_base.js"));
  const proveedoresRepo = await import(j("js/data/proveedoresRepo.js"));
  const insumosRepo     = await import(j("js/data/insumosRepo.js"));
  const facturasRepo    = await import(j("js/data/facturasRepo.js"));
  const pagosRepo       = await import(j("js/data/pagosRepo.js"));
  const fiscal          = await import(j("js/core/fiscal.js"));
  const { db, collection, doc, addDoc, updateDoc, getDocs, Timestamp } = base;

  const norm = (s) => (s || "").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const diaMs = 86400000;
  const haceDias = (n) => new Date(Date.now() - n * diaMs);
  const enDias   = (n) => new Date(Date.now() + n * diaMs);
  const c = (pesos) => Math.round(pesos * 100);

  // ==========================================================
  // 1) FACTURAS + PAGOS
  //    emiAgo: días atrás de emisión | venc: días desde HOY (negativo = vencida)
  //    pay: "none" | "full" | fracción (0..1)
  // ==========================================================
  const FACTURAS = [
    // El Ave Fénix
    { prov: "El Ave Fénix S.A.", tipo: "A", num: "0004-00119412", emiAgo: 75, venc: -45, total: 214438, alic: 21, pay: "full" },
    { prov: "El Ave Fénix S.A.", tipo: "A", num: "0004-00120880", emiAgo: 40, venc: -10, total: 198500, alic: 21, pay: 0.4 },
    { prov: "El Ave Fénix S.A.", tipo: "A", num: "0004-00121533", emiAgo: 6,  venc: 4,   total: 231000, alic: 21, pay: "none" },
    // C&B Distribuidora
    { prov: "C&B Distribuidora", tipo: "A", num: "0003-00051997", emiAgo: 50, venc: -20, total: 229098, alic: 21, pay: 0.6 },
    { prov: "C&B Distribuidora", tipo: "A", num: "0003-00052540", emiAgo: 5,  venc: 5,   total: 187000, alic: 21, pay: "none" },
    // Navacerrada
    { prov: "Navacerrada S.A.",  tipo: "A", num: "0003-00055733", emiAgo: 20, venc: -10, total: 165649, alic: 21, pay: "none" },
    { prov: "Navacerrada S.A.",  tipo: "A", num: "0003-00056001", emiAgo: 3,  venc: 7,   total: 142000, alic: 21, pay: 0.5 },
    // La Campiña del Sur
    { prov: "La Campiña del Sur S.A.", tipo: "A", num: "0001-00035418", emiAgo: 12, venc: -5, total: 543200, alic: 10.5, pay: "none" },
    { prov: "La Campiña del Sur S.A.", tipo: "A", num: "0001-00035640", emiAgo: 2,  venc: 6,  total: 388000, alic: 10.5, pay: 0.3 },
    // Olliari (bebidas con alcohol)
    { prov: "Olliari",  tipo: "A", num: "0007-00004521", emiAgo: 60, venc: -30, total: 890000,  alic: 21, pay: "full" },
    { prov: "Olliari",  tipo: "A", num: "0007-00004988", emiAgo: 25, venc: 5,   total: 1250000, alic: 21, pay: "none" },
    { prov: "Olliari",  tipo: "A", num: "0007-00005210", emiAgo: 8,  venc: 22,  total: 640000,  alic: 21, pay: 0.5 },
    // Heineken (cervezas y sidras)
    { prov: "Heineken", tipo: "A", num: "0002-00018765", emiAgo: 35, venc: -5,  total: 720000, alic: 21, pay: 0.7 },
    { prov: "Heineken", tipo: "A", num: "0002-00019030", emiAgo: 4,  venc: 3,   total: 505000, alic: 21, pay: "none" },
  ];

  const prov = await proveedoresRepo.listar(true);
  const provId = new Map(prov.map((p) => [norm(p.nombre), p.id]));
  const MARCA = "carga-demo-movimientos";
  const R = { fact: 0, pagos: 0, skipProv: 0, err: 0 };

  // proveedores que YA tienen facturas de esta demo -> se saltean (idempotencia)
  const yaConFacturas = new Set();
  for (const p of prov) {
    try {
      const fs = await facturasRepo.listarPorProveedor(p.id);
      if (fs.some((f) => (f.observaciones || "").includes(MARCA))) yaConFacturas.add(p.id);
    } catch (_e) {}
  }

  for (const f of FACTURAS) {
    const pid = provId.get(norm(f.prov));
    if (!pid) { console.warn("proveedor no encontrado:", f.prov); continue; }
    if (yaConFacturas.has(pid)) { R.skipProv++; continue; }
    try {
      const totalC = c(f.total);
      const d = fiscal.desglosarFactura({ desde: "total", montoCentavos: totalC, alicuota: f.alic, percepcionesCentavos: 0 });
      const fid = await facturasRepo.crear({
        proveedor_id: pid, tipo_comprobante: f.tipo, numero_factura: f.num,
        fecha_emision: haceDias(f.emiAgo), fecha_vencimiento: enDias(f.venc),
        neto_gravado_centavos: d.neto, iva_discriminado_centavos: d.iva,
        percepciones_centavos: 0, monto_total_centavos: totalC,
        observaciones: MARCA,
      });
      R.fact++;
      let montoPago = 0;
      if (f.pay === "full") montoPago = totalC;
      else if (typeof f.pay === "number" && f.pay > 0) montoPago = Math.round(totalC * f.pay);
      if (montoPago > 0) {
        await pagosRepo.registrarPago({
          proveedorId: pid, montoCentavos: montoPago,
          metodoPago: "transferencia", referencia: "Pago demo",
          fechaPago: haceDias(Math.max(0, f.emiAgo - 3)),
          modoImputacion: "manual", facturaIdsManual: [fid],
        });
        R.pagos++;
      }
    } catch (e) { R.err++; console.error("factura ✖", f.prov, f.num, e); }
  }
  console.log(`Facturas: +${R.fact} · Pagos: +${R.pagos} · Proveedores ya cargados (saltados): ${R.skipProv}`);

  // ==========================================================
  // 2) HISTORIAL DE PRECIOS retroactivo (evolución de costos)
  //    Se agregan 6 puntos mensuales anteriores (más baratos) que suben hasta
  //    el costo actual. Refleja la inflación típica.
  // ==========================================================
  const ins = await insumosRepo.listar(true);
  const insByName = new Map(ins.map((i) => [norm(i.nombre), i]));
  const HIST = ["AZUCAR","CAFE","LECHE","APEROL","FERNET BRANCA","HEINEKEN","JACK DANIELS",
    "QUESO FINLANDIA CLASICO","ARROZ CARNAROLI GALLO","GASEOSA COCA COLA","CAMPARI","GORDONS",
    "HIELO","NARANJA","CHOCOLATE AGUILA"];
  const FACTORES = [0.50, 0.58, 0.67, 0.78, 0.88, 0.95]; // fracción del costo actual
  const DIAS_ATRAS = [180, 150, 120, 90, 60, 30];
  let histN = 0;
  for (const nombre of HIST) {
    const it = insByName.get(norm(nombre));
    if (!it) { console.warn("insumo no encontrado (historial):", nombre); continue; }
    try {
      const col = collection(db, "insumos", it.id, "historial_precios");
      const snap = await getDocs(col);
      if (snap.size > 1) continue; // ya tiene historial ampliado
      const actual = Number(it.costo_neto_por_unidad_base_centavos) || 0;
      let anterior = 0;
      for (let k = 0; k < FACTORES.length; k++) {
        const nuevo = Math.max(1, Math.round(actual * FACTORES[k]));
        const varPct = anterior > 0 ? ((nuevo - anterior) / anterior) * 100 : 0;
        await addDoc(col, {
          costo_anterior_centavos: anterior, costo_nuevo_centavos: nuevo,
          variacion_porcentual: Number(varPct.toFixed(2)),
          fecha: Timestamp.fromDate(haceDias(DIAS_ATRAS[k])),
          origen: "manual", factura_id: null, usuario: "demo",
        });
        anterior = nuevo;
        histN++;
      }
    } catch (e) { R.err++; console.error("historial ✖", nombre, e); }
  }
  console.log(`Historial de precios: +${histN} puntos en ${HIST.length} insumos.`);

  // ==========================================================
  // 3) Insumos con precio "sin actualizar" (dispara el panel de Alertas)
  // ==========================================================
  const DESACT = { "VAINILLA": 95, "GRANADINA": 120, "AVELLANA": 80, "PULPA DE DURAZNO": 150,
    "TE INT ZEN": 70, "CACAO SEGAFREDO": 110 };
  let desN = 0;
  for (const [nombre, dias] of Object.entries(DESACT)) {
    const it = insByName.get(norm(nombre));
    if (!it) continue;
    try {
      await updateDoc(doc(db, "insumos", it.id), { fecha_ultimo_precio: Timestamp.fromDate(haceDias(dias)) });
      desN++;
    } catch (e) { R.err++; console.error("desactualizar ✖", nombre, e); }
  }
  insumosRepo.invalidarCache();
  console.log(`Insumos marcados sin actualizar: ${desN}`);

  console.log("%c✔ Movimientos de demo cargados", "font-weight:bold;color:green",
    `Facturas ${R.fact} · Pagos ${R.pagos} · Historial ${histN} · Alertas ${desN} · Errores ${R.err}`);
  console.log("Abrí el Tablero (Refrescar) y la evolución de precio de un insumo para verlo.");
})();
