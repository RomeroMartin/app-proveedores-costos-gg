// Tests de core/unidades.js — Regla de Oro 3.1 (unidad base)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertirAUnidadBase,
  costoNetoPorUnidadBase,
  unidadBaseDe,
} from "../js/core/unidades.js";

test("unidadBaseDe devuelve la base canónica", () => {
  assert.equal(unidadBaseDe("masa"), "g");
  assert.equal(unidadBaseDe("volumen"), "ml");
  assert.equal(unidadBaseDe("unidad"), "un");
});

test("convertirAUnidadBase: masa", () => {
  assert.equal(convertirAUnidadBase(5, "kg"), 5000);
  assert.equal(convertirAUnidadBase(400, "g"), 400);
  assert.equal(convertirAUnidadBase(500, "mg"), 0.5);
});

test("convertirAUnidadBase: volumen", () => {
  assert.equal(convertirAUnidadBase(5, "l"), 5000);
  assert.equal(convertirAUnidadBase(750, "ml"), 750);
});

test("convertirAUnidadBase: unidad", () => {
  assert.equal(convertirAUnidadBase(1, "docena"), 12);
  assert.equal(convertirAUnidadBase(2, "ciento"), 200);
});

test("convertirAUnidadBase: unidad desconocida lanza", () => {
  assert.throws(() => convertirAUnidadBase(1, "galon"));
});

test("costoNetoPorUnidadBase: barra 5kg a $34.000 → 680 c/g", () => {
  // 3.400.000 centavos / 5000 g = 680 centavos por gramo
  assert.equal(costoNetoPorUnidadBase(3400000, 5000), 680);
});

test("costoNetoPorUnidadBase: redondea a entero de centavos", () => {
  // 100000 / 3 = 33333.33 → 33333
  assert.equal(costoNetoPorUnidadBase(100000, 3), 33333);
});

test("costoNetoPorUnidadBase: cantidad base 0 lanza (evita división por cero)", () => {
  assert.throws(() => costoNetoPorUnidadBase(1000, 0));
});
