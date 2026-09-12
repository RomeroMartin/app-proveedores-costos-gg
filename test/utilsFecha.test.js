// Tests de core/utilsFecha.js — cálculos de fechas de RRHH (lógica pura)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasCorridos,
  antiguedadAnios,
  antiguedadTexto,
  sumarMeses,
  formatearFecha,
} from "../js/core/utilsFecha.js";

test("diasCorridos: ambos extremos incluidos", () => {
  assert.equal(diasCorridos("2024-01-01", "2024-01-01"), 1);
  assert.equal(diasCorridos("2024-01-01", "2024-01-10"), 10);
  assert.equal(diasCorridos("2024-02-28", "2024-03-01"), 3); // 2024 bisiesto
});

test("diasCorridos: rango inválido o vacío → 0", () => {
  assert.equal(diasCorridos("2024-01-10", "2024-01-01"), 0);
  assert.equal(diasCorridos("", "2024-01-01"), 0);
  assert.equal(diasCorridos("2024-01-01", null), 0);
});

test("antiguedadAnios: años cumplidos", () => {
  assert.equal(antiguedadAnios("2020-06-15", "2024-06-15"), 4);
  assert.equal(antiguedadAnios("2020-06-15", "2024-06-14"), 3); // aún no cumple
  assert.equal(antiguedadAnios("2024-06-15", "2024-06-15"), 0);
});

test("antiguedadTexto: legible", () => {
  assert.equal(antiguedadTexto("2022-01-01", "2024-04-01"), "2 años y 3 meses");
  assert.equal(antiguedadTexto("2023-08-01", "2024-04-01"), "8 meses");
  assert.equal(antiguedadTexto("2024-03-20", "2024-04-01"), "menos de un mes");
});

test("sumarMeses: vencimiento = emisión + vigencia", () => {
  assert.equal(sumarMeses("2024-01-15", 12), "2025-01-15");
  assert.equal(sumarMeses("2024-01-31", 1), "2024-02-29"); // ajusta fin de mes
  assert.equal(sumarMeses("2024-06-01", 36), "2027-06-01");
  assert.equal(sumarMeses("2024-06-01", null), "");
});

test("formatearFecha: ISO → DD/MM/YYYY", () => {
  assert.equal(formatearFecha("2024-03-09"), "09/03/2024");
  assert.equal(formatearFecha(""), "—");
  assert.equal(formatearFecha("basura"), "—");
});
