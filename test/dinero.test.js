// Tests de core/dinero.js — Regla de Oro 3.3 (enteros en centavos)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pesosACentavos,
  centavosAPesos,
  formatearCentavos,
  redondearCentavos,
  sumarCentavos,
} from "../js/core/dinero.js";

test("pesosACentavos: número entero y decimal", () => {
  assert.equal(pesosACentavos(6800), 680000);
  assert.equal(pesosACentavos(6800.5), 680050);
  assert.equal(pesosACentavos(0.1), 10);
});

test("pesosACentavos: formato AR con miles y decimales", () => {
  assert.equal(pesosACentavos("6.800,00"), 680000);
  assert.equal(pesosACentavos("6.800,50"), 680050);
  assert.equal(pesosACentavos("1.000.000,00"), 100000000);
  assert.equal(pesosACentavos("$ 1.234,5"), 123450);
});

test("pesosACentavos: punto como decimal simple", () => {
  assert.equal(pesosACentavos("6800.50"), 680050);
  assert.equal(pesosACentavos("6800.5"), 680050);
});

test("pesosACentavos: separador de miles ambiguo se resuelve por longitud", () => {
  assert.equal(pesosACentavos("6.800"), 680000); // miles
  assert.equal(pesosACentavos("6,800"), 680000); // miles
  assert.equal(pesosACentavos("6,80"), 680); // decimal
});

test("pesosACentavos: vacío y basura → 0", () => {
  assert.equal(pesosACentavos(""), 0);
  assert.equal(pesosACentavos(null), 0);
  assert.equal(pesosACentavos(undefined), 0);
});

test("0.1 + 0.2 en centavos cierra exacto (por qué existe la regla)", () => {
  const a = pesosACentavos(0.1);
  const b = pesosACentavos(0.2);
  assert.equal(a + b, pesosACentavos(0.3));
});

test("centavosAPesos y formateo", () => {
  assert.equal(centavosAPesos(680000), 6800);
  assert.equal(formatearCentavos(680000), "$6.800,00");
  assert.equal(formatearCentavos(680050), "$6.800,50");
  assert.equal(formatearCentavos(0), "$0,00");
});

test("redondearCentavos redondea a entero", () => {
  assert.equal(redondearCentavos(680.4), 680);
  assert.equal(redondearCentavos(680.5), 681);
});

test("sumarCentavos ignora no-números", () => {
  assert.equal(sumarCentavos([100, 200, null, undefined, "50"]), 350);
});
