// ============================================================
// tools/cargar-real-consola.js
// Carga REAL de Green Garden: proveedores, insumos (productos + costos) y
// recetas (barra, cocteleria, cafeteria), generada desde las boletas y la
// planilla "COSTOS DE BARRA".
// ------------------------------------------------------------
// USO:
//   1) Logueate en la app como Gerente.
//   2) (Opcional pero recomendado) Antes corré tools/borrar-todo-consola.js
//      para dar de baja lo de prueba.
//   3) Abrí la consola (F12), pegá TODO este archivo y Enter.
//
// Es IDEMPOTENTE: no duplica proveedores/insumos/recetas que ya existan
// (compara por nombre sin mayusculas/acentos). Reejecutable sin miedo.
//
// Notas de costeo (ver CONTEXTO-COSTEO.md):
//  - Los insumos guardan el NETO por unidad base (g/ml/un). El IVA se agrega
//    al costear. Unidades de barra: Oz -> ml (1 oz = 30 ml), Porcion -> unidad.
//  - Las recetas se crean con costo 0 y al final se recalculan con el costeo
//    real del app (recetasRepo.recalcularTodas). Algunos totales daran distinto
//    a la planilla porque esta tenia formulas desactualizadas/erroneas
//    (MIXER DE ANANA, SUNSET, JARRA POMELADA, y los tragos que los usan);
//    el valor del app es el correcto segun las cantidades cargadas.
// ============================================================

(async () => {
  const j = (p) => new URL(p, location.origin + "/").href;
  const proveedoresRepo = await import(j("js/data/proveedoresRepo.js"));
  const insumosRepo     = await import(j("js/data/insumosRepo.js"));
  const recetasRepo     = await import(j("js/data/recetasRepo.js"));
  const store           = await import(j("js/store.js"));

  const norm = (s) => (s || "").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

  const PROVEEDORES = [
  {
    "nombre": "El Ave Fénix S.A.",
    "cuit": "30-64931119-2",
    "condicion_fiscal": "responsable_inscripto",
    "rubros": [
      "Almacén",
      "Lácteos",
      "Fiambres y quesos"
    ]
  },
  {
    "nombre": "C&B Distribuidora",
    "cuit": "20-14417789-5",
    "condicion_fiscal": "responsable_inscripto",
    "rubros": [
      "Limpieza",
      "Descartables"
    ]
  },
  {
    "nombre": "Navacerrada S.A.",
    "cuit": "30-71447130-5",
    "condicion_fiscal": "responsable_inscripto",
    "rubros": [
      "Panadería"
    ]
  },
  {
    "nombre": "La Campiña del Sur S.A.",
    "cuit": "",
    "condicion_fiscal": "responsable_inscripto",
    "rubros": [
      "Verdulería",
      "Frutas"
    ]
  },
  {
    "nombre": "Olliari",
    "cuit": "",
    "condicion_fiscal": "responsable_inscripto",
    "rubros": [
      "Bebidas con alcohol"
    ]
  },
  {
    "nombre": "Heineken",
    "cuit": "",
    "condicion_fiscal": "responsable_inscripto",
    "rubros": [
      "Bebidas con alcohol",
      "Bebidas sin alcohol"
    ]
  }
];
  const INSUMOS = [
  {
    "nombre": "AGUA CON GAS",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": null,
    "presentacion": {
      "descripcion": "500cc (Agua)",
      "cantidad_base": 12,
      "precio_neto_centavos": 1101411
    },
    "costo_neto_por_unidad_base_centavos": 91784
  },
  {
    "nombre": "AGUA SIN GAS",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": null,
    "presentacion": {
      "descripcion": "500cc (Agua)",
      "cantidad_base": 12,
      "precio_neto_centavos": 1101411
    },
    "costo_neto_por_unidad_base_centavos": 91784
  },
  {
    "nombre": "ANANA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "820gr (Enlatado)",
      "cantidad_base": 1,
      "precio_neto_centavos": 513212
    },
    "costo_neto_por_unidad_base_centavos": 513212
  },
  {
    "nombre": "APEROL",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Aperitivo)",
      "cantidad_base": 750,
      "precio_neto_centavos": 788608
    },
    "costo_neto_por_unidad_base_centavos": 1051
  },
  {
    "nombre": "AVELLANA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1000cc (Almibar)",
      "cantidad_base": 990,
      "precio_neto_centavos": 2263000
    },
    "costo_neto_por_unidad_base_centavos": 2263
  },
  {
    "nombre": "AZUCAR",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "25kg (Azucar)",
      "cantidad_base": 25000,
      "precio_neto_centavos": 3223140
    },
    "costo_neto_por_unidad_base_centavos": 129
  },
  {
    "nombre": "AZUCAR IMPALPABLE",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "10000.0 (Azucar)",
      "cantidad_base": 10000,
      "precio_neto_centavos": 1157020
    },
    "costo_neto_por_unidad_base_centavos": 116
  },
  {
    "nombre": "BACARDI BLANCO",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "980cc (Ron)",
      "cantidad_base": 990,
      "precio_neto_centavos": 1804300
    },
    "costo_neto_por_unidad_base_centavos": 1841
  },
  {
    "nombre": "BAILEYS",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Licor)",
      "cantidad_base": 750,
      "precio_neto_centavos": 2476804
    },
    "costo_neto_por_unidad_base_centavos": 3302
  },
  {
    "nombre": "BANANA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "1Kg (Fruta)",
      "cantidad_base": 6,
      "precio_neto_centavos": 289256
    },
    "costo_neto_por_unidad_base_centavos": 48209
  },
  {
    "nombre": "BARON B BRUT NATURE",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Espumante)",
      "cantidad_base": 1,
      "precio_neto_centavos": 3492700
    },
    "costo_neto_por_unidad_base_centavos": 3492700
  },
  {
    "nombre": "BARON B EXTRA BRUT",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Espumante)",
      "cantidad_base": 1,
      "precio_neto_centavos": 2652800
    },
    "costo_neto_por_unidad_base_centavos": 2652800
  },
  {
    "nombre": "BARON B ROSE",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Espumante)",
      "cantidad_base": 1,
      "precio_neto_centavos": 3518300
    },
    "costo_neto_por_unidad_base_centavos": 3518300
  },
  {
    "nombre": "BLENDERS",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Blend de malta y granos)",
      "cantidad_base": 990,
      "precio_neto_centavos": 935300
    },
    "costo_neto_por_unidad_base_centavos": 935
  },
  {
    "nombre": "BLUE MOON",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "355cc (Cerveza)",
      "cantidad_base": 1,
      "precio_neto_centavos": 207261
    },
    "costo_neto_por_unidad_base_centavos": 207261
  },
  {
    "nombre": "CACAO SEGAFREDO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "25U (Cacao)",
      "cantidad_base": 25,
      "precio_neto_centavos": 3990000
    },
    "costo_neto_por_unidad_base_centavos": 159600
  },
  {
    "nombre": "CAFE",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1kg (Cafe)",
      "cantidad_base": 1000,
      "precio_neto_centavos": 4706523
    },
    "costo_neto_por_unidad_base_centavos": 4707
  },
  {
    "nombre": "CAMPARI",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Aperitivo)",
      "cantidad_base": 990,
      "precio_neto_centavos": 1060265
    },
    "costo_neto_por_unidad_base_centavos": 1060
  },
  {
    "nombre": "CARAMELO",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1000cc (Concentrado)",
      "cantidad_base": 990,
      "precio_neto_centavos": 2370000
    },
    "costo_neto_por_unidad_base_centavos": 2370
  },
  {
    "nombre": "CHANDON EXTRA BRUT",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Espumante)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1273250
    },
    "costo_neto_por_unidad_base_centavos": 1273250
  },
  {
    "nombre": "CHANDON ROSE",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Espumante)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1270500
    },
    "costo_neto_por_unidad_base_centavos": 1270500
  },
  {
    "nombre": "CHOCOLATE AGUILA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "5Kg (Cacao)",
      "cantidad_base": 228,
      "precio_neto_centavos": 10495870
    },
    "costo_neto_por_unidad_base_centavos": 46035
  },
  {
    "nombre": "CINZANO PRO SPRITZ",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Espumante)",
      "cantidad_base": 750,
      "precio_neto_centavos": 699800
    },
    "costo_neto_por_unidad_base_centavos": 933
  },
  {
    "nombre": "CINZZANO ROSSO",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Vermout)",
      "cantidad_base": 990,
      "precio_neto_centavos": 632599
    },
    "costo_neto_por_unidad_base_centavos": 633
  },
  {
    "nombre": "CORDERO CON PIEL DE LOBO MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 320860
    },
    "costo_neto_por_unidad_base_centavos": 320860
  },
  {
    "nombre": "CREMA MILKAUT",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Lácteos",
    "proveedor": null,
    "presentacion": {
      "descripcion": "5000cc (Lacteo)",
      "cantidad_base": 5000,
      "precio_neto_centavos": 4978017
    },
    "costo_neto_por_unidad_base_centavos": 996
  },
  {
    "nombre": "CRIOS CHARDONNAY",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 446200
    },
    "costo_neto_por_unidad_base_centavos": 446200
  },
  {
    "nombre": "CRIOS MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 442860
    },
    "costo_neto_por_unidad_base_centavos": 442860
  },
  {
    "nombre": "CRIOS ROSE OF MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 449500
    },
    "costo_neto_por_unidad_base_centavos": 449500
  },
  {
    "nombre": "CYNAR",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Aperitivo)",
      "cantidad_base": 750,
      "precio_neto_centavos": 725448
    },
    "costo_neto_por_unidad_base_centavos": 967
  },
  {
    "nombre": "D.V. CATENA ZAPATA MB-MB",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1413100
    },
    "costo_neto_por_unidad_base_centavos": 1413100
  },
  {
    "nombre": "DURAZNO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "820gr (Enlatado)",
      "cantidad_base": 5,
      "precio_neto_centavos": 179012
    },
    "costo_neto_por_unidad_base_centavos": 35802
  },
  {
    "nombre": "EL ENEMIGO MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1648548
    },
    "costo_neto_por_unidad_base_centavos": 1648548
  },
  {
    "nombre": "FAMILIA GASCON CABERNET",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 367768
    },
    "costo_neto_por_unidad_base_centavos": 367769
  },
  {
    "nombre": "FAMILIA GASCON CHARDONNAY",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 367768
    },
    "costo_neto_por_unidad_base_centavos": 367769
  },
  {
    "nombre": "FAMILIA GASCON DULCE COSECHA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 367768
    },
    "costo_neto_por_unidad_base_centavos": 367769
  },
  {
    "nombre": "FAMILIA GASCON DULCE ROSE",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 367768
    },
    "costo_neto_por_unidad_base_centavos": 367769
  },
  {
    "nombre": "FAMILIA GASCON MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 367768
    },
    "costo_neto_por_unidad_base_centavos": 367769
  },
  {
    "nombre": "FERNET BRANCA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Aperitivo)",
      "cantidad_base": 990,
      "precio_neto_centavos": 1650346
    },
    "costo_neto_por_unidad_base_centavos": 1650
  },
  {
    "nombre": "FRUTILLA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "Kg (Fruta)",
      "cantidad_base": 7,
      "precio_neto_centavos": 702479
    },
    "costo_neto_por_unidad_base_centavos": 105372
  },
  {
    "nombre": "FRUTOS ROJOS",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Congelados",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1kg (Congelado)",
      "cantidad_base": 1000,
      "precio_neto_centavos": 1181818
    },
    "costo_neto_por_unidad_base_centavos": 1182
  },
  {
    "nombre": "GANCIA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "950cc (Aperitivo)",
      "cantidad_base": 960,
      "precio_neto_centavos": 609700
    },
    "costo_neto_por_unidad_base_centavos": 642
  },
  {
    "nombre": "GAS COMPRIMIDO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "24U (Gas comprimido)",
      "cantidad_base": 24,
      "precio_neto_centavos": 2495868
    },
    "costo_neto_por_unidad_base_centavos": 103994
  },
  {
    "nombre": "GASEOSA COCA COLA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": null,
    "presentacion": {
      "descripcion": "24u (Gaseosa)",
      "cantidad_base": 24,
      "precio_neto_centavos": 2684421
    },
    "costo_neto_por_unidad_base_centavos": 111851
  },
  {
    "nombre": "GORDONS",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "700cc (Gin)",
      "cantidad_base": 690,
      "precio_neto_centavos": 1058100
    },
    "costo_neto_por_unidad_base_centavos": 1512
  },
  {
    "nombre": "GRANADINA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "750cc (Jarabe)",
      "cantidad_base": 750,
      "precio_neto_centavos": 320600
    },
    "costo_neto_por_unidad_base_centavos": 427
  },
  {
    "nombre": "HEINEKEN",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Cerveza)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 18585934
    },
    "costo_neto_por_unidad_base_centavos": 620
  },
  {
    "nombre": "HEINEKEN SIN ALCOHOL",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "355cc (Cerveza)",
      "cantidad_base": 1,
      "precio_neto_centavos": 160259
    },
    "costo_neto_por_unidad_base_centavos": 160259
  },
  {
    "nombre": "HESPERIDINA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Licor)",
      "cantidad_base": 990,
      "precio_neto_centavos": 1061500
    },
    "costo_neto_por_unidad_base_centavos": 1061
  },
  {
    "nombre": "HIELO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "15kg (Hielo)",
      "cantidad_base": 75,
      "precio_neto_centavos": 578512
    },
    "costo_neto_por_unidad_base_centavos": 7713
  },
  {
    "nombre": "IMPERIAL IPA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Cerveza)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 12503262
    },
    "costo_neto_por_unidad_base_centavos": 417
  },
  {
    "nombre": "IMPERIAL LAGGER",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Cerveza)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 12503262
    },
    "costo_neto_por_unidad_base_centavos": 417
  },
  {
    "nombre": "IMPERIAL ROJA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Cerveza)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 12503262
    },
    "costo_neto_por_unidad_base_centavos": 417
  },
  {
    "nombre": "IMPERIAL STOUT",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Cerveza)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 12503262
    },
    "costo_neto_por_unidad_base_centavos": 417
  },
  {
    "nombre": "JACK DANIELS",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Whiskey)",
      "cantidad_base": 990,
      "precio_neto_centavos": 4198920
    },
    "costo_neto_por_unidad_base_centavos": 4199
  },
  {
    "nombre": "JAGGERMAINSTER",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "700cc (Licor)",
      "cantidad_base": 690,
      "precio_neto_centavos": 2726400
    },
    "costo_neto_por_unidad_base_centavos": 3895
  },
  {
    "nombre": "JENGIBRE",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "1kg (Tuberculo)",
      "cantidad_base": 1000,
      "precio_neto_centavos": 537190
    },
    "costo_neto_por_unidad_base_centavos": 537
  },
  {
    "nombre": "JOHNNIE WALKER BLACK LABEL",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Whisky)",
      "cantidad_base": 990,
      "precio_neto_centavos": 4538766
    },
    "costo_neto_por_unidad_base_centavos": 4539
  },
  {
    "nombre": "JOHNNIE WALKER RED LABEL",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "1000cc (Whisky)",
      "cantidad_base": 990,
      "precio_neto_centavos": 2885625
    },
    "costo_neto_por_unidad_base_centavos": 2886
  },
  {
    "nombre": "JOSE CUERVO SILVER",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Tequila)",
      "cantidad_base": 750,
      "precio_neto_centavos": 3595200
    },
    "costo_neto_por_unidad_base_centavos": 4794
  },
  {
    "nombre": "JUGO PURA FRUTTA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": null,
    "presentacion": {
      "descripcion": "250cc (Jugo)",
      "cantidad_base": 1,
      "precio_neto_centavos": 81250
    },
    "costo_neto_por_unidad_base_centavos": 81250
  },
  {
    "nombre": "JUGOS TANG",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": null,
    "presentacion": {
      "descripcion": "U (Jugo en polvo)",
      "cantidad_base": 6,
      "precio_neto_centavos": 33058
    },
    "costo_neto_por_unidad_base_centavos": 5950
  },
  {
    "nombre": "LATITUD 33 CHARDONNAY",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 538000
    },
    "costo_neto_por_unidad_base_centavos": 538000
  },
  {
    "nombre": "LATITUD 33 MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 538000
    },
    "costo_neto_por_unidad_base_centavos": 538000
  },
  {
    "nombre": "LECHE",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Lácteos",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1000cc (Lacteo)",
      "cantidad_base": 1000,
      "precio_neto_centavos": 156821
    },
    "costo_neto_por_unidad_base_centavos": 157
  },
  {
    "nombre": "LIMA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "1kg (Fruta)",
      "cantidad_base": 15,
      "precio_neto_centavos": 396694
    },
    "costo_neto_por_unidad_base_centavos": 26446
  },
  {
    "nombre": "LIMON",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "15kg (Fruta)",
      "cantidad_base": 4000,
      "precio_neto_centavos": 1818182
    },
    "costo_neto_por_unidad_base_centavos": 455
  },
  {
    "nombre": "LOS CARDOS DULCE",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 385500
    },
    "costo_neto_por_unidad_base_centavos": 385500
  },
  {
    "nombre": "LOS CARDOS MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 385000
    },
    "costo_neto_por_unidad_base_centavos": 385000
  },
  {
    "nombre": "LOS CARDOS SAUV BLANC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 385000
    },
    "costo_neto_por_unidad_base_centavos": 385000
  },
  {
    "nombre": "LUIGI BOSCA MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1070662
    },
    "costo_neto_por_unidad_base_centavos": 1070662
  },
  {
    "nombre": "MARACUYA",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Congelados",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1kg (Congelado)",
      "cantidad_base": 1000,
      "precio_neto_centavos": 752066
    },
    "costo_neto_por_unidad_base_centavos": 752
  },
  {
    "nombre": "MENTA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "Atado (Hierba aromatica)",
      "cantidad_base": 62,
      "precio_neto_centavos": 181818
    },
    "costo_neto_por_unidad_base_centavos": 2909
  },
  {
    "nombre": "MILLER",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Cerveza)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 15003921
    },
    "costo_neto_por_unidad_base_centavos": 500
  },
  {
    "nombre": "NARANJA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "15Kg (Fruta)",
      "cantidad_base": 3750,
      "precio_neto_centavos": 1487603
    },
    "costo_neto_por_unidad_base_centavos": 397
  },
  {
    "nombre": "NESQUIK",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "2kg (Cacao)",
      "cantidad_base": 80,
      "precio_neto_centavos": 1968200
    },
    "costo_neto_por_unidad_base_centavos": 24602
  },
  {
    "nombre": "PEQUEÑAS PRODUCCIONES CABERNET",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1652892
    },
    "costo_neto_por_unidad_base_centavos": 1652893
  },
  {
    "nombre": "PEQUEÑAS PRODUCCIONES MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1652892
    },
    "costo_neto_por_unidad_base_centavos": 1652893
  },
  {
    "nombre": "POMELO",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur",
    "presentacion": {
      "descripcion": "15Kg (Fruta)",
      "cantidad_base": 6000,
      "precio_neto_centavos": 1983471
    },
    "costo_neto_por_unidad_base_centavos": 331
  },
  {
    "nombre": "PULPA DE DURAZNO",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "880gr (Enlatado)",
      "cantidad_base": 810,
      "precio_neto_centavos": 321149
    },
    "costo_neto_por_unidad_base_centavos": 401
  },
  {
    "nombre": "PUNT E MES",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vermout)",
      "cantidad_base": 750,
      "precio_neto_centavos": 567910
    },
    "costo_neto_por_unidad_base_centavos": 757
  },
  {
    "nombre": "RUTINI CABERNET-MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1135000
    },
    "costo_neto_por_unidad_base_centavos": 1135000
  },
  {
    "nombre": "SABORIZADA ACUARIUS",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas sin alcohol",
    "proveedor": null,
    "presentacion": {
      "descripcion": "500cc (Agua saborizada)",
      "cantidad_base": 8,
      "precio_neto_centavos": 937390
    },
    "costo_neto_por_unidad_base_centavos": 117174
  },
  {
    "nombre": "SAINT FELICIEN MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 757000
    },
    "costo_neto_por_unidad_base_centavos": 757000
  },
  {
    "nombre": "SANTA JULIA CHENIN DULCE",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 495072
    },
    "costo_neto_por_unidad_base_centavos": 495072
  },
  {
    "nombre": "SIDRA 1888",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Heineken",
    "presentacion": {
      "descripcion": "30Lt (Espumante)",
      "cantidad_base": 30000,
      "precio_neto_centavos": 3782834
    },
    "costo_neto_por_unidad_base_centavos": 126
  },
  {
    "nombre": "SKYY",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vodka)",
      "cantidad_base": 750,
      "precio_neto_centavos": 635400
    },
    "costo_neto_por_unidad_base_centavos": 847
  },
  {
    "nombre": "SMOOTHIES",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Congelados",
    "proveedor": null,
    "presentacion": {
      "descripcion": "14U (Congelado)",
      "cantidad_base": 14,
      "precio_neto_centavos": 1821041
    },
    "costo_neto_por_unidad_base_centavos": 130074
  },
  {
    "nombre": "TANQUERAY",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "700cc (Gin)",
      "cantidad_base": 690,
      "precio_neto_centavos": 2383100
    },
    "costo_neto_por_unidad_base_centavos": 3404
  },
  {
    "nombre": "TE INT ZEN",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "15U (Te)",
      "cantidad_base": 15,
      "precio_neto_centavos": 261883
    },
    "costo_neto_por_unidad_base_centavos": 17459
  },
  {
    "nombre": "TERRAZAS RESERVA MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 1327700
    },
    "costo_neto_por_unidad_base_centavos": 1327700
  },
  {
    "nombre": "TRUMPETER MALBEC",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "750cc (Vino)",
      "cantidad_base": 1,
      "precio_neto_centavos": 631000
    },
    "costo_neto_por_unidad_base_centavos": 631000
  },
  {
    "nombre": "VAINILLA",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1000cc (Concentrado)",
      "cantidad_base": 990,
      "precio_neto_centavos": 2370000
    },
    "costo_neto_por_unidad_base_centavos": 2370
  },
  {
    "nombre": "VAINILLIN",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": null,
    "presentacion": {
      "descripcion": "1000cc (Concentrado)",
      "cantidad_base": 1000,
      "precio_neto_centavos": 167741
    },
    "costo_neto_por_unidad_base_centavos": 168
  },
  {
    "nombre": "VELHO BARREIRO",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "910cc (Bebida blanca)",
      "cantidad_base": 900,
      "precio_neto_centavos": 742970
    },
    "costo_neto_por_unidad_base_centavos": 816
  },
  {
    "nombre": "malibu",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21.0,
    "factor_correccion": 1,
    "rubro": "Bebidas con alcohol",
    "proveedor": "Olliari",
    "presentacion": {
      "descripcion": "700cc (Ron)",
      "cantidad_base": 700,
      "precio_neto_centavos": 1156000
    },
    "costo_neto_por_unidad_base_centavos": 1651
  },
  {
    "nombre": "ARROZ CARNAROLI GALLO",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Bolsa 5 kg",
      "cantidad_base": 5000,
      "precio_neto_centavos": 2298595
    },
    "costo_neto_por_unidad_base_centavos": 460
  },
  {
    "nombre": "FIDEOS TALLARIN LUCCHETTI",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Paquete 500 g",
      "cantidad_base": 500,
      "precio_neto_centavos": 119835
    },
    "costo_neto_por_unidad_base_centavos": 240
  },
  {
    "nombre": "LENTEJAS",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Bolsa 1 kg",
      "cantidad_base": 1000,
      "precio_neto_centavos": 271312
    },
    "costo_neto_por_unidad_base_centavos": 271
  },
  {
    "nombre": "VINAGRE DE ALCOHOL BARONESE",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 578760
    },
    "costo_neto_por_unidad_base_centavos": 116
  },
  {
    "nombre": "SALSA DE SOJA TAHITI",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Almacén",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 1833967
    },
    "costo_neto_por_unidad_base_centavos": 367
  },
  {
    "nombre": "LECHE ENTERA LARGA VIDA ILOLAY",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Lácteos",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Brick 1 L",
      "cantidad_base": 1000,
      "precio_neto_centavos": 177686
    },
    "costo_neto_por_unidad_base_centavos": 178
  },
  {
    "nombre": "QUESO FINLANDIA CLASICO",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Fiambres y quesos",
    "proveedor": "El Ave Fénix S.A.",
    "presentacion": {
      "descripcion": "Sachet 2 kg",
      "cantidad_base": 2000,
      "precio_neto_centavos": 2266033
    },
    "costo_neto_por_unidad_base_centavos": 1133
  },
  {
    "nombre": "DETERGENTE CP 130 AL 15% SEIQ",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 1189835
    },
    "costo_neto_por_unidad_base_centavos": 238
  },
  {
    "nombre": "LAVANDINA FRONTIER",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 371074
    },
    "costo_neto_por_unidad_base_centavos": 74
  },
  {
    "nombre": "DESODORANTE FRONTIER",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 309091
    },
    "costo_neto_por_unidad_base_centavos": 62
  },
  {
    "nombre": "LIMPIADOR MI3 DESENGRASANTE MOIMLIN",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 896033
    },
    "costo_neto_por_unidad_base_centavos": 179
  },
  {
    "nombre": "ALCOHOL 96%",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Bidón 5 L",
      "cantidad_base": 5000,
      "precio_neto_centavos": 1239752
    },
    "costo_neto_por_unidad_base_centavos": 248
  },
  {
    "nombre": "BOBINA D/H 20 CM PETRO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Descartables",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Bobina",
      "cantidad_base": 1,
      "precio_neto_centavos": 641157
    },
    "costo_neto_por_unidad_base_centavos": 641157
  },
  {
    "nombre": "TRAPO DE PISO GRIS 50x60",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Unidad",
      "cantidad_base": 1,
      "precio_neto_centavos": 104876
    },
    "costo_neto_por_unidad_base_centavos": 104876
  },
  {
    "nombre": "TRAPO DE PISO GRIS 50x60 LA MAGA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Unidad",
      "cantidad_base": 1,
      "precio_neto_centavos": 191901
    },
    "costo_neto_por_unidad_base_centavos": 191901
  },
  {
    "nombre": "GUANTES NITRILO NEGRO PRINTEX",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Descartables",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Caja x 100",
      "cantidad_base": 100,
      "precio_neto_centavos": 891901
    },
    "costo_neto_por_unidad_base_centavos": 8919
  },
  {
    "nombre": "SMELL AROMATIZADOR TEXTIL",
    "magnitud": "volumen",
    "unidad_base": "ml",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Botella 200 ml",
      "cantidad_base": 200,
      "precio_neto_centavos": 386777
    },
    "costo_neto_por_unidad_base_centavos": 1934
  },
  {
    "nombre": "TRAPO REJILLA PESADA COCINA",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Limpieza",
    "proveedor": "C&B Distribuidora",
    "presentacion": {
      "descripcion": "Unidad",
      "cantidad_base": 1,
      "precio_neto_centavos": 120826
    },
    "costo_neto_por_unidad_base_centavos": 120826
  },
  {
    "nombre": "PETIT PAN",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Panadería",
    "proveedor": "Navacerrada S.A.",
    "presentacion": {
      "descripcion": "Caja 7 kg x 136",
      "cantidad_base": 136,
      "precio_neto_centavos": 2685398
    },
    "costo_neto_por_unidad_base_centavos": 19746
  },
  {
    "nombre": "CIRIOLA PETIT PAN CON SALVADO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 21,
    "factor_correccion": 1,
    "rubro": "Panadería",
    "proveedor": "Navacerrada S.A.",
    "presentacion": {
      "descripcion": "Caja x 140",
      "cantidad_base": 140,
      "precio_neto_centavos": 2928414
    },
    "costo_neto_por_unidad_base_centavos": 20917
  },
  {
    "nombre": "PEPINO",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Precio por kg",
      "cantidad_base": 1000,
      "precio_neto_centavos": 217195
    },
    "costo_neto_por_unidad_base_centavos": 217
  },
  {
    "nombre": "CEBOLLA (BOLSA)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Bolsa",
      "cantidad_base": 1,
      "precio_neto_centavos": 2533937
    },
    "costo_neto_por_unidad_base_centavos": 2533937
  },
  {
    "nombre": "PAPA (BOLSA)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Bolsa",
      "cantidad_base": 1,
      "precio_neto_centavos": 2714932
    },
    "costo_neto_por_unidad_base_centavos": 2714932
  },
  {
    "nombre": "TOMATE PERITA (CAJÓN)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Cajón",
      "cantidad_base": 1,
      "precio_neto_centavos": 3076923
    },
    "costo_neto_por_unidad_base_centavos": 3076923
  },
  {
    "nombre": "CHERRY",
    "magnitud": "masa",
    "unidad_base": "g",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Precio por kg",
      "cantidad_base": 1000,
      "precio_neto_centavos": 380090
    },
    "costo_neto_por_unidad_base_centavos": 380
  },
  {
    "nombre": "VERDEO (ATADO)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Atado",
      "cantidad_base": 1,
      "precio_neto_centavos": 542986
    },
    "costo_neto_por_unidad_base_centavos": 542986
  },
  {
    "nombre": "NARANJA (CAJÓN)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Cajón",
      "cantidad_base": 1,
      "precio_neto_centavos": 1628959
    },
    "costo_neto_por_unidad_base_centavos": 1628959
  },
  {
    "nombre": "MORRÓN ROJO (CAJÓN)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Cajón",
      "cantidad_base": 1,
      "precio_neto_centavos": 2895928
    },
    "costo_neto_por_unidad_base_centavos": 2895928
  },
  {
    "nombre": "RÚCULA (ATADO)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Atado",
      "cantidad_base": 1,
      "precio_neto_centavos": 45249
    },
    "costo_neto_por_unidad_base_centavos": 45249
  },
  {
    "nombre": "LECHUGA FRANCESA (CAJÓN)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Cajón",
      "cantidad_base": 1,
      "precio_neto_centavos": 1266968
    },
    "costo_neto_por_unidad_base_centavos": 1266968
  },
  {
    "nombre": "ALBAHACA (ATADO)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Atado",
      "cantidad_base": 1,
      "precio_neto_centavos": 135747
    },
    "costo_neto_por_unidad_base_centavos": 135747
  },
  {
    "nombre": "ROMERO (ATADO)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Atado",
      "cantidad_base": 1,
      "precio_neto_centavos": 361991
    },
    "costo_neto_por_unidad_base_centavos": 361991
  },
  {
    "nombre": "TOMILLO (ATADO)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Atado",
      "cantidad_base": 1,
      "precio_neto_centavos": 361991
    },
    "costo_neto_por_unidad_base_centavos": 361991
  },
  {
    "nombre": "PUERRO (ATADO)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Atado",
      "cantidad_base": 1,
      "precio_neto_centavos": 497738
    },
    "costo_neto_por_unidad_base_centavos": 497738
  },
  {
    "nombre": "POMELO (CAJÓN)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Cajón",
      "cantidad_base": 1,
      "precio_neto_centavos": 2171946
    },
    "costo_neto_por_unidad_base_centavos": 2171946
  },
  {
    "nombre": "REPOLLO BLANCO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Unidad",
      "cantidad_base": 1,
      "precio_neto_centavos": 144796
    },
    "costo_neto_por_unidad_base_centavos": 144796
  },
  {
    "nombre": "REPOLLO COLORADO",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Verdulería",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Unidad",
      "cantidad_base": 1,
      "precio_neto_centavos": 162896
    },
    "costo_neto_por_unidad_base_centavos": 162896
  },
  {
    "nombre": "LIMÓN (CAJA)",
    "magnitud": "unidad",
    "unidad_base": "un",
    "alicuota_iva": 10.5,
    "factor_correccion": 1,
    "rubro": "Frutas",
    "proveedor": "La Campiña del Sur S.A.",
    "presentacion": {
      "descripcion": "Caja",
      "cantidad_base": 1,
      "precio_neto_centavos": 1990950
    },
    "costo_neto_por_unidad_base_centavos": 1990950
  }
];
  const RECETAS = [
  {
    "nombre": "ALMIBAR SIMPLE",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      }
    ]
  },
  {
    "nombre": "ALMIBAR DE JENGIBRE",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "JENGIBRE",
        "cantidad": 1.5
      }
    ]
  },
  {
    "nombre": "ALMIBAR DE FRUTOS ROJOS",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "FRUTOS ROJOS",
        "cantidad": 3.0
      }
    ]
  },
  {
    "nombre": "ALMIBAR DE MARACUYA",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "MARACUYA",
        "cantidad": 3.0
      }
    ]
  },
  {
    "nombre": "MIXER DE ANANA",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "ANANA",
        "cantidad": 0.03
      },
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 3.0
      },
      {
        "tipo": "insumo",
        "nombre": "LIMON",
        "cantidad": 3.0
      }
    ]
  },
  {
    "nombre": "COLD BREW",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 1.5
      }
    ]
  },
  {
    "nombre": "CREMA",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Rulo",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR IMPALPABLE",
        "cantidad": 6.5
      },
      {
        "tipo": "insumo",
        "nombre": "CREMA MILKAUT",
        "cantidad": 23.0
      },
      {
        "tipo": "insumo",
        "nombre": "GAS COMPRIMIDO",
        "cantidad": 0.08
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 8.0
      }
    ]
  },
  {
    "nombre": "EXPRIMIDO DE NARANJA",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "NARANJA",
        "cantidad": 30.0
      }
    ]
  },
  {
    "nombre": "EXPRIMIDO DE LIMON",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "LIMON",
        "cantidad": 30.0
      }
    ]
  },
  {
    "nombre": "EXPRIMIDO DE POMELO",
    "tipo": "preparacion",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "Oz",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "POMELO",
        "cantidad": 30.0
      }
    ]
  },
  {
    "nombre": "APEROL SPRITZ",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "APEROL",
        "cantidad": 90.0
      },
      {
        "tipo": "insumo",
        "nombre": "CINZANO PRO SPRITZ",
        "cantidad": 180.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 900000
  },
  {
    "nombre": "BAILEYS",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BAILEYS",
        "cantidad": 90.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  },
  {
    "nombre": "BROMELIA PUNCH",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BACARDI BLANCO",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LIMON",
        "cantidad": 30.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "MIXER DE ANANA",
        "cantidad": 2.0
      }
    ],
    "precio_venta_publico_centavos": 850000
  },
  {
    "nombre": "CAIPIRINHA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LIMA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "VELHO BARREIRO",
        "cantidad": 60.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "CAIPORSKA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LIMA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "SKYY",
        "cantidad": 60.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "CAMPARI ORANGE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAMPARI",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE NARANJA",
        "cantidad": 4.0
      }
    ],
    "precio_venta_publico_centavos": 750000
  },
  {
    "nombre": "CUBA LIBRE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BACARDI BLANCO",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LIMON",
        "cantidad": 10.0
      }
    ],
    "precio_venta_publico_centavos": 790000
  },
  {
    "nombre": "CYNAR JULEP",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CYNAR",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "MENTA",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE POMELO",
        "cantidad": 2.0
      }
    ],
    "precio_venta_publico_centavos": 790000
  },
  {
    "nombre": "CYNARA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CYNAR",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "MIXER DE ANANA",
        "cantidad": 2.0
      }
    ],
    "precio_venta_publico_centavos": 850000
  },
  {
    "nombre": "DAIQUIRI DURAZNO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BACARDI BLANCO",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "DURAZNO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "DAIQUIRI FRUTILLA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BACARDI BLANCO",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "FRUTILLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "DON CORLEONE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "APEROL",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "JAGGERMAINSTER",
        "cantidad": 60.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE POMELO",
        "cantidad": 2.0
      }
    ],
    "precio_venta_publico_centavos": 1100000
  },
  {
    "nombre": "FERNET",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "FERNET BRANCA",
        "cantidad": 75.0
      },
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "GANCIA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GANCIA",
        "cantidad": 120.0
      },
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "GIN TONIC NACIONAL",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "GORDONS",
        "cantidad": 90.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 950000
  },
  {
    "nombre": "GIN TONIC IMPORTADO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "TANQUERAY",
        "cantidad": 90.0
      }
    ],
    "precio_venta_publico_centavos": 1400000
  },
  {
    "nombre": "GRAN LIRIO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CINZZANO ROSSO",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "SKYY",
        "cantidad": 60.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE MARACUYA",
        "cantidad": 1.5
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE NARANJA",
        "cantidad": 1.5
      }
    ],
    "precio_venta_publico_centavos": 850000
  },
  {
    "nombre": "JACK DANIELS",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "JACK DANIELS",
        "cantidad": 90.0
      }
    ],
    "precio_venta_publico_centavos": 1400000
  },
  {
    "nombre": "JOHNNIE WALKER BLACK LABEL",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "JOHNNIE WALKER BLACK LABEL",
        "cantidad": 90.0
      }
    ],
    "precio_venta_publico_centavos": 1600000
  },
  {
    "nombre": "JOHNNIE WALKER RED LABEL",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "JOHNNIE WALKER RED LABEL",
        "cantidad": 90.0
      }
    ],
    "precio_venta_publico_centavos": 1300000
  },
  {
    "nombre": "LA QUINA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HESPERIDINA",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE NARANJA",
        "cantidad": 2.0
      }
    ],
    "precio_venta_publico_centavos": 850000
  },
  {
    "nombre": "MARGARITA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HESPERIDINA",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "JOSE CUERVO SILVER",
        "cantidad": 60.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 950000
  },
  {
    "nombre": "MOJITO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BACARDI BLANCO",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LIMON",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "MENTA",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 800000
  },
  {
    "nombre": "MORELLA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GORDONS",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE FRUTOS ROJOS",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE POMELO",
        "cantidad": 3.0
      }
    ],
    "precio_venta_publico_centavos": 850000
  },
  {
    "nombre": "NEGRONI",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAMPARI",
        "cantidad": 45.0
      },
      {
        "tipo": "insumo",
        "nombre": "CINZZANO ROSSO",
        "cantidad": 45.0
      },
      {
        "tipo": "insumo",
        "nombre": "GORDONS",
        "cantidad": 45.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 750000
  },
  {
    "nombre": "ROSS TONIC",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GASEOSA COCA COLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "GORDONS",
        "cantidad": 60.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE POMELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 850000
  },
  {
    "nombre": "VERMOUTH AMERICANO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAMPARI",
        "cantidad": 45.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "PUNT E MES",
        "cantidad": 45.0
      }
    ],
    "precio_venta_publico_centavos": 750000
  },
  {
    "nombre": "VERMOUTH ROSSO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CINZZANO ROSSO",
        "cantidad": 120.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 750000
  },
  {
    "nombre": "JARRA LIMONADA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 5.0
      },
      {
        "tipo": "insumo",
        "nombre": "MENTA",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 5.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 5.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  },
  {
    "nombre": "VASO LIMONADA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "MENTA",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 1.33
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 1.33
      }
    ],
    "precio_venta_publico_centavos": 600000
  },
  {
    "nombre": "LIMONADA FROZZEN",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "MENTA",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR DE JENGIBRE",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE LIMON",
        "cantidad": 2.0
      }
    ],
    "precio_venta_publico_centavos": 600000
  },
  {
    "nombre": "EXPRIMIDO NARANAJA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE NARANJA",
        "cantidad": 5.0
      }
    ],
    "precio_venta_publico_centavos": 650000
  },
  {
    "nombre": "SMOOTHIES",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "JUGOS TANG",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "SMOOTHIES",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 700000
  },
  {
    "nombre": "LICUADO FRUTILLA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "FRUTILLA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 200.0
      }
    ],
    "precio_venta_publico_centavos": 700000
  },
  {
    "nombre": "LICUADO DURAZON",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "DURAZNO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 200.0
      }
    ]
  },
  {
    "nombre": "LICUADO BANANA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BANANA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 200.0
      }
    ],
    "precio_venta_publico_centavos": 700000
  },
  {
    "nombre": "JARRA POMELADA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 5.0
      },
      {
        "tipo": "insumo",
        "nombre": "MENTA",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 8.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE POMELO",
        "cantidad": 10.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  },
  {
    "nombre": "SUNSET",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "GRANADINA",
        "cantidad": 22.5
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "ALMIBAR SIMPLE",
        "cantidad": 1.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE NARANJA",
        "cantidad": 3.0
      },
      {
        "tipo": "receta",
        "nombre": "EXPRIMIDO DE POMELO",
        "cantidad": 3.0
      }
    ]
  },
  {
    "nombre": "RISTRETTO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 8.0
      }
    ],
    "precio_venta_publico_centavos": 400000
  },
  {
    "nombre": "POCILLO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 8.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 30.0
      }
    ],
    "precio_venta_publico_centavos": 400000
  },
  {
    "nombre": "AMERICANO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 8.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 30.0
      }
    ],
    "precio_venta_publico_centavos": 400000
  },
  {
    "nombre": "TAZON LATTE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 180.0
      }
    ],
    "precio_venta_publico_centavos": 750000
  },
  {
    "nombre": "CAPUCCINO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 150.0
      }
    ],
    "precio_venta_publico_centavos": 650000
  },
  {
    "nombre": "CAFE DOBLE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 60.0
      }
    ],
    "precio_venta_publico_centavos": 550000
  },
  {
    "nombre": "CHOCOLATADA",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 270.0
      },
      {
        "tipo": "insumo",
        "nombre": "NESQUIK",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 600000
  },
  {
    "nombre": "SUBMARINO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CHOCOLATE AGUILA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 270.0
      }
    ],
    "precio_venta_publico_centavos": 600000
  },
  {
    "nombre": "TE INTI ZEN",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "TE INT ZEN",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 600000
  },
  {
    "nombre": "VAINILLA ICE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 120.0
      },
      {
        "tipo": "insumo",
        "nombre": "VAINILLA",
        "cantidad": 30.0
      },
      {
        "tipo": "receta",
        "nombre": "COLD BREW",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "CREMA",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  },
  {
    "nombre": "CARAMEL LATTE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "insumo",
        "nombre": "CARAMELO",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 120.0
      },
      {
        "tipo": "receta",
        "nombre": "CREMA",
        "cantidad": 1.0
      }
    ]
  },
  {
    "nombre": "MOKACCINO",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "insumo",
        "nombre": "CHOCOLATE AGUILA",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 150.0
      },
      {
        "tipo": "receta",
        "nombre": "CREMA",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 750000
  },
  {
    "nombre": "ICE NUTS ROCKS",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AVELLANA",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "HIELO",
        "cantidad": 1.0
      },
      {
        "tipo": "insumo",
        "nombre": "LECHE",
        "cantidad": 120.0
      },
      {
        "tipo": "receta",
        "nombre": "COLD BREW",
        "cantidad": 2.0
      },
      {
        "tipo": "receta",
        "nombre": "CREMA",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  },
  {
    "nombre": "CAFE IRLANDES",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "AZUCAR",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "BLENDERS",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "receta",
        "nombre": "CREMA",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  },
  {
    "nombre": "BAILEYS COFFE",
    "tipo": "plato",
    "rendimiento_cantidad": 1,
    "rendimiento_unidad": "un",
    "ingredientes": [
      {
        "tipo": "insumo",
        "nombre": "BAILEYS",
        "cantidad": 30.0
      },
      {
        "tipo": "insumo",
        "nombre": "CAFE",
        "cantidad": 16.0
      },
      {
        "tipo": "receta",
        "nombre": "CREMA",
        "cantidad": 1.0
      }
    ],
    "precio_venta_publico_centavos": 1000000
  }
];

  const R = { provNuevos:0, provReuso:0, insNuevos:0, insReuso:0, recNuevos:0, recReuso:0, err:0 };

  // ---- Proveedores ----
  const provExist = await proveedoresRepo.listar(true);
  const provId = new Map(provExist.map(p => [norm(p.nombre), p.id]));
  for (const p of PROVEEDORES) {
    try {
      if (provId.has(norm(p.nombre))) { R.provReuso++; continue; }
      const id = await proveedoresRepo.crear(p);
      provId.set(norm(p.nombre), id); R.provNuevos++;
      console.log("proveedor +", p.nombre);
    } catch (e) { R.err++; console.error("proveedor ✖", p.nombre, e); }
  }

  // ---- Insumos ----
  const insExist = await insumosRepo.listar(true);
  const insId = new Map(insExist.map(i => [norm(i.nombre), i.id]));
  for (const it of INSUMOS) {
    try {
      if (insId.has(norm(it.nombre))) { R.insReuso++; continue; }
      const id = await insumosRepo.crear({
        nombre: it.nombre, magnitud: it.magnitud, unidad_base: it.unidad_base,
        alicuota_iva: it.alicuota_iva, factor_correccion: it.factor_correccion,
        rubro: it.rubro,
        proveedor_habitual_id: it.proveedor ? (provId.get(norm(it.proveedor)) || null) : null,
        presentacion_compra: it.presentacion,
        costo_neto_por_unidad_base_centavos: it.costo_neto_por_unidad_base_centavos,
      });
      insId.set(norm(it.nombre), id); R.insNuevos++;
    } catch (e) { R.err++; console.error("insumo ✖", it.nombre, e); }
  }
  console.log(`Insumos: +${R.insNuevos} nuevos, ${R.insReuso} ya existian`);

  // ---- Recetas (preparaciones primero, ya vienen ordenadas) ----
  const recExist = await recetasRepo.listar(true);
  const recId = new Map(recExist.map(r => [norm(r.nombre), r.id]));
  for (const rc of RECETAS) {
    try {
      if (recId.has(norm(rc.nombre))) { R.recReuso++; continue; }
      const ingredientes = [];
      let falto = false;
      for (const ing of rc.ingredientes) {
        const ref = ing.tipo === "receta" ? recId.get(norm(ing.nombre)) : insId.get(norm(ing.nombre));
        if (!ref) { console.warn("  falta ref", ing.tipo, ing.nombre, "para", rc.nombre); falto = true; continue; }
        ingredientes.push({ tipo: ing.tipo, ref_id: ref, cantidad: ing.cantidad });
      }
      const id = await recetasRepo.crear({
        nombre: rc.nombre, tipo: rc.tipo,
        rendimiento_cantidad: rc.rendimiento_cantidad, rendimiento_unidad: rc.rendimiento_unidad,
        precio_venta_publico_centavos: rc.precio_venta_publico_centavos || 0,
        alicuota_venta: 21, ingredientes,
      }, 0);
      recId.set(norm(rc.nombre), id); R.recNuevos++;
      if (falto) console.warn("  receta creada con ingredientes faltantes:", rc.nombre);
    } catch (e) { R.err++; console.error("receta ✖", rc.nombre, e); }
  }
  console.log(`Recetas: +${R.recNuevos} nuevas, ${R.recReuso} ya existian`);

  // ---- Recalcular costos de todas las recetas con el costeo real ----
  await store.cargar(true);
  const n = await recetasRepo.recalcularTodas(store.ctxCosteo());
  console.log(`Costos de receta recalculados: ${n}`);

  console.log("%c✔ Carga real completa", "font-weight:bold;color:green",
    `Prov +${R.provNuevos}/${R.provReuso} · Insumos +${R.insNuevos}/${R.insReuso} · Recetas +${R.recNuevos}/${R.recReuso} · Errores ${R.err}`);
  console.log("Refrescá Proveedores, Insumos y Costos para verlo.");
})();
