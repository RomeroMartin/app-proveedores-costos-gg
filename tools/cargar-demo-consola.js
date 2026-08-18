// ============================================================
// tools/cargar-demo-consola.js
// Carga masiva de PROVEEDORES + INSUMOS (productos y costos) para la DEMO.
// ------------------------------------------------------------
// Cómo usarlo:
//   1. Entrá a la app (index.html → login) con un usuario Gerente.
//   2. Abrí la consola del navegador (F12 → pestaña "Consola").
//   3. Editá el bloque DATOS de abajo con lo que leas de las boletas.
//   4. Pegá TODO este archivo en la consola y Enter.
//
// Es SEGURO reejecutarlo: si un proveedor o insumo ya existe (mismo nombre,
// sin distinguir mayúsculas/acentos) NO lo duplica. Los proveedores nuevos
// obtienen su código PROV-00X y los insumos su INS-00X automáticamente, y
// cada insumo queda con su registro inicial en historial_precios (igual que
// si lo cargaras a mano). No toca saldos ni facturas.
//
// Reglas respetadas (ver README):
//   • Dinero en centavos          → core/dinero.js (pesosACentavos)
//   • Magnitud en unidad base     → core/unidades.js
//   • Insumo guarda el NETO por unidad base; el IVA se agrega al costear.
// ============================================================

(async () => {
  // --- 0. Resolver la base de los módulos (paths absolutos /js/...) ---
  const j = (p) => new URL(p, location.origin + "/").href;

  const dinero    = await import(j("js/core/dinero.js"));
  const unidades  = await import(j("js/core/unidades.js"));
  const proveedoresRepo = await import(j("js/data/proveedoresRepo.js"));
  const insumosRepo     = await import(j("js/data/insumosRepo.js"));

  const { pesosACentavos } = dinero;
  const { convertirAUnidadBase, costoNetoPorUnidadBase, unidadBaseDe } = unidades;

  // Normaliza un texto para comparar nombres (sin acentos, minúsculas, sin dobles espacios).
  const norm = (s) => (s || "")
    .toString().trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

  // ==========================================================
  // 1. DATOS — EDITÁ ESTO CON LAS BOLETAS
  // ----------------------------------------------------------
  // condicion_fiscal: "responsable_inscripto" | "monotributo" | "exento"
  // rubros (proveedor): array de rubros del catálogo (core/rubros.js).
  // Para cada producto:
  //   nombre        : nombre del insumo
  //   magnitud      : "masa" | "volumen" | "unidad"
  //   rubro         : un rubro del catálogo
  //   alicuota_iva  : 0 | 10.5 | 21 | 27
  //   factor_correccion (opcional): merma/rendimiento, default 1
  //   presentacion  : { cantidad, unidad, descripcion }
  //       unidad ∈ masa:  g | kg | mg
  //              ∈ volumen: ml | l | cc
  //              ∈ unidad:  un | docena | ciento
  //   precio        : precio de la PRESENTACIÓN según la boleta ($, admite "34.000,00")
  //   iva_incluido  : true si el precio de la boleta ya trae IVA (se pasa a neto);
  //                   false si el precio ya es neto (default false).
  // ==========================================================
  const DATOS = [
    {
      nombre: "Proveedor Ejemplo S.A.",
      cuit: "30-11111111-9",
      condicion_fiscal: "responsable_inscripto",
      contacto: "",
      telefono: "",
      email: "",
      rubros: ["Lácteos", "Fiambres y quesos"],
      productos: [
        {
          nombre: "Queso Mozzarella Barra",
          magnitud: "masa",
          rubro: "Fiambres y quesos",
          alicuota_iva: 21,
          presentacion: { cantidad: 5, unidad: "kg", descripcion: "Barra 5 kg" },
          precio: "34000,00",
          iva_incluido: false,
        },
        // { nombre: "...", magnitud: "volumen", rubro: "Lácteos", alicuota_iva: 21,
        //   presentacion: { cantidad: 1, unidad: "l", descripcion: "Botella 1 L" },
        //   precio: "2500", iva_incluido: true },
      ],
    },
    // ... más proveedores acá
  ];

  // ==========================================================
  // 2. EJECUCIÓN — no hace falta tocar de acá para abajo
  // ==========================================================
  console.log("%c▶ Cargando demo…", "font-weight:bold;font-size:14px");

  const provsExistentes = await proveedoresRepo.listar(true);
  const insExistentes   = await insumosRepo.listar(true);
  const provPorNombre = new Map(provsExistentes.map((p) => [norm(p.nombre), p]));
  const insPorNombre  = new Set(insExistentes.map((i) => norm(i.nombre)));

  const resumen = { provCreados: 0, provReusados: 0, insCreados: 0, insOmitidos: 0, errores: 0 };

  for (const prov of DATOS) {
    let provId, provNombre = prov.nombre;
    const yaProv = provPorNombre.get(norm(prov.nombre));
    try {
      if (yaProv) {
        provId = yaProv.id;
        resumen.provReusados++;
        console.log(`↺ Proveedor ya existía: ${provNombre} (${yaProv.codigo})`);
      } else {
        provId = await proveedoresRepo.crear({
          nombre: prov.nombre,
          cuit: prov.cuit,
          condicion_fiscal: prov.condicion_fiscal,
          contacto: prov.contacto,
          telefono: prov.telefono,
          email: prov.email,
          rubros: prov.rubros,
        });
        // Registrar en el mapa para no duplicar si aparece de nuevo en DATOS
        provPorNombre.set(norm(prov.nombre), { id: provId, nombre: prov.nombre });
        resumen.provCreados++;
        console.log(`✔ Proveedor creado: ${provNombre}`);
      }
    } catch (e) {
      resumen.errores++;
      console.error(`✖ Error creando proveedor ${provNombre}:`, e);
      continue; // sin proveedor no cargamos sus productos
    }

    for (const p of prov.productos || []) {
      try {
        if (insPorNombre.has(norm(p.nombre))) {
          resumen.insOmitidos++;
          console.log(`  ↺ Insumo ya existía, omitido: ${p.nombre}`);
          continue;
        }
        const cantBase = convertirAUnidadBase(Number(p.presentacion.cantidad) || 0, p.presentacion.unidad);
        if (cantBase <= 0) throw new Error("cantidad/unidad de presentación inválida");

        const alic = Number(p.alicuota_iva) || 0;
        let precioC = pesosACentavos(p.precio);
        if (p.iva_incluido) precioC = Math.round(precioC / (1 + alic / 100)); // boleta con IVA → neto
        if (precioC <= 0) throw new Error("precio inválido");

        const costoUnidadBase = costoNetoPorUnidadBase(precioC, cantBase);

        await insumosRepo.crear({
          nombre: p.nombre,
          magnitud: p.magnitud,
          unidad_base: unidadBaseDe(p.magnitud),
          alicuota_iva: alic,
          factor_correccion: Number(p.factor_correccion) || 1,
          proveedor_habitual_id: provId,
          rubro: p.rubro || "",
          presentacion_compra: {
            descripcion: (p.presentacion.descripcion || "").trim(),
            cantidad_base: cantBase,
            precio_neto_centavos: precioC,
          },
          costo_neto_por_unidad_base_centavos: costoUnidadBase,
        });
        insPorNombre.add(norm(p.nombre));
        resumen.insCreados++;
        console.log(`  ✔ Insumo: ${p.nombre} → ${dinero.formatearCentavos(costoUnidadBase)}/${unidadBaseDe(p.magnitud)} (neto)`);
      } catch (e) {
        resumen.errores++;
        console.error(`  ✖ Error con insumo ${p.nombre}:`, e);
      }
    }
  }

  console.log(
    "%c✔ Listo.",
    "font-weight:bold;color:green",
    `Proveedores: +${resumen.provCreados} nuevos, ${resumen.provReusados} reusados · ` +
    `Insumos: +${resumen.insCreados} nuevos, ${resumen.insOmitidos} omitidos · ` +
    `Errores: ${resumen.errores}`
  );
  console.log("Refrescá las pantallas de Proveedores e Insumos para verlos.");
})();
