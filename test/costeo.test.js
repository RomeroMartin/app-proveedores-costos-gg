// Tests de core/costeo.js — Sección 6 (costeo, escandallos, rentabilidad)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  costoRealPorUnidadBase,
  costoReceta,
  validarGrafoReceta,
  rentabilidad,
  precioSugerido,
} from "../js/core/costeo.js";

const provRI = { condicion_fiscal: "responsable_inscripto" };
const provMono = { condicion_fiscal: "monotributo" };

test("costoReal: SIEMPRE suma el IVA (precio final pagado al proveedor)", () => {
  // Política nueva: el IVA es costo, no crédito fiscal. 1000 * 1.21 = 1210
  const insumo = { costo_neto_por_unidad_base_centavos: 1000, alicuota_iva: 21, factor_correccion: 1 };
  assert.equal(Math.round(costoRealPorUnidadBase(insumo, provRI, "A")), 1210);
});

test("costoReal: el tipo de comprobante ya NO cambia el costo", () => {
  // Factura A + RI y Factura C dan lo mismo: ambos incluyen IVA.
  const insumo = { costo_neto_por_unidad_base_centavos: 1000, alicuota_iva: 21, factor_correccion: 1 };
  assert.equal(
    Math.round(costoRealPorUnidadBase(insumo, provRI, "A")),
    Math.round(costoRealPorUnidadBase(insumo, provMono, "C")),
  );
  assert.equal(Math.round(costoRealPorUnidadBase(insumo, provMono, "C")), 1210);
});

test("costoReal: factor de corrección encarece el gramo útil", () => {
  // Con IVA 0 se aísla el efecto del factor: 780 / 0.78 = 1000
  const insumo = { costo_neto_por_unidad_base_centavos: 780, alicuota_iva: 0, factor_correccion: 0.78 };
  assert.equal(costoRealPorUnidadBase(insumo, provRI, "A"), 1000);
});

test("costoReceta: suma insumos (Factura A por defecto)", () => {
  const insumos = {
    harina: { id: "harina", costo_neto_por_unidad_base_centavos: 100, alicuota_iva: 21, factor_correccion: 1 },
    queso: { id: "queso", costo_neto_por_unidad_base_centavos: 680, alicuota_iva: 21, factor_correccion: 1 },
  };
  const receta = {
    id: "pizza",
    ingredientes: [
      { tipo: "insumo", ref_id: "harina", cantidad: 250 }, // 250*100 = 25000 (neto)
      { tipo: "insumo", ref_id: "queso", cantidad: 220 }, // 220*680 = 149600 (neto)
    ],
  };
  const total = costoReceta(receta, {
    getInsumo: (id) => insumos[id],
    getReceta: () => null,
  });
  // Ambos insumos con IVA 21% → el costo de receta también lo incluye.
  assert.equal(Math.round(total), Math.round((25000 + 149600) * 1.21)); // 211266
});

test("costoReceta: sub-receta se prorratea por su rendimiento", () => {
  const insumos = {
    tomate: { id: "tomate", costo_neto_por_unidad_base_centavos: 50, alicuota_iva: 21, factor_correccion: 1 },
  };
  const recetas = {
    salsa: {
      id: "salsa",
      rendimiento_cantidad: 4000, // 4000 ml de salsa
      ingredientes: [{ tipo: "insumo", ref_id: "tomate", cantidad: 2000 }], // 2000*50 = 100000
    },
    plato: {
      id: "plato",
      ingredientes: [{ tipo: "receta", ref_id: "salsa", cantidad: 120 }], // usa 120 ml de salsa
    },
  };
  // Neto: costo salsa = 100000; por ml = 25; 120 ml → 3000.
  // Con IVA 21% incluido → 3000 * 1.21 = 3630.
  const total = costoReceta(recetas.plato, {
    getInsumo: (id) => insumos[id],
    getReceta: (id) => recetas[id],
  });
  assert.equal(Math.round(total), Math.round(3000 * 1.21)); // 3630
});

test("costoReceta: detecta ciclo A→B→A", () => {
  const recetas = {
    A: { id: "A", ingredientes: [{ tipo: "receta", ref_id: "B", cantidad: 1 }] },
    B: { id: "B", ingredientes: [{ tipo: "receta", ref_id: "A", cantidad: 1 }] },
  };
  assert.throws(
    () => costoReceta(recetas.A, { getInsumo: () => null, getReceta: (id) => recetas[id] }),
    /[Cc]iclo/
  );
});

test("validarGrafoReceta: rechaza ciclo antes de escribir", () => {
  const recetas = {
    B: { id: "B", ingredientes: [{ tipo: "receta", ref_id: "A", cantidad: 1 }] },
  };
  const candidataA = { ingredientes: [{ tipo: "receta", ref_id: "B", cantidad: 1 }] };
  const r = validarGrafoReceta(candidataA, (id) => recetas[id], "A");
  assert.equal(r.ok, false);
});

test("validarGrafoReceta: grafo válido pasa", () => {
  const recetas = { B: { id: "B", ingredientes: [] } };
  const candidataA = { ingredientes: [{ tipo: "receta", ref_id: "B", cantidad: 1 }] };
  const r = validarGrafoReceta(candidataA, (id) => recetas[id], "A");
  assert.equal(r.ok, true);
});

test("rentabilidad: food cost % sobre precio NETO", () => {
  // precio público 1210 (con 21%) → neto 1000; costo 300 → food cost 30%
  const plato = { precio_venta_publico_centavos: 1210, alicuota_venta: 21 };
  const r = rentabilidad(plato, 300);
  assert.equal(Math.round(r.precioNetoCentavos), 1000);
  assert.equal(Math.round(r.foodCostPct), 30);
  assert.equal(Math.round(r.margenBrutoCentavos), 700);
});

test("precioSugerido: inversa del food cost objetivo", () => {
  // costo 300, objetivo 30% → neto 1000 → público 1210 (21%)
  const r = precioSugerido(300, 30, 21);
  assert.equal(Math.round(r.precioNetoCentavos), 1000);
  assert.equal(Math.round(r.precioPublicoCentavos), 1210);
});
