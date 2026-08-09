// ============================================================
// ui/escandallos.js — Recetas / Escandallos y rentabilidad (Sección 7.4)
// ------------------------------------------------------------
// Regla de UI 6.3: nunca un porcentaje suelto. Se muestran siempre los tres
// números juntos y etiquetados: costo (con IVA), precio de carta, costo s/ venta %.
// ============================================================

import { $, el, limpiar, toast, abrirModal, confirmar, mostrarCargando, esc, ico, fechaCorta } from "./helpers.js";
import { formatearCentavos, formatearPorcentaje, pesosACentavos } from "../core/dinero.js";
import { ALICUOTAS_IVA } from "../core/fiscal.js";
import { costoReceta, rentabilidad, precioSugerido, validarGrafoReceta } from "../core/costeo.js";
import * as recetasRepo from "../data/recetasRepo.js";
import * as store from "../store.js";

const UMBRAL_FOODCOST = 35; // % — Sección 6.5

function claseFoodCost(pct) {
  if (pct <= 30) return "foodcost-ok";
  if (pct <= UMBRAL_FOODCOST) return "foodcost-warn";
  return "foodcost-danger";
}

export async function render(main) {
  main.innerHTML = "";
  main.appendChild(el("div", { class: "page-header" },
    el("div", {},
      el("div", { class: "page-title" }, "Costos"),
      el("div", { class: "page-subtitle" }, "Recetas de platos y preparaciones, con costo y rentabilidad en vivo."),
    ),
    el("div", { class: "flex gap-8" },
      el("button", { class: "btn btn-secondary", onClick: () => abrirEditor(null, "preparacion") }, "Nueva preparación"),
      el("button", { class: "btn btn-primary", onClick: () => abrirEditor(null, "plato") }, el("span", { html: ico("mas", 16) }), "Nuevo plato"),
    ),
  ));
  const cont = el("div", {});
  main.appendChild(cont);
  await pintar(cont);
}

async function pintar(cont) {
  mostrarCargando(cont, "Cargando recetas…");
  await store.cargar(true);
  const { recetas } = store.get();
  limpiar(cont);

  const platos = recetas.filter((r) => r.tipo === "plato");
  const preps = recetas.filter((r) => r.tipo === "preparacion");

  cont.appendChild(seccion("Platos (se venden)", platos, true));
  cont.appendChild(seccion("Preparaciones (uso interno)", preps, false));
}

function seccion(titulo, lista, esPlato) {
  const wrap = el("div", { class: "card" });
  wrap.appendChild(el("p", { class: "card-title" }, titulo));
  if (!lista.length) {
    wrap.appendChild(el("div", { class: "empty-state" }, el("p", {}, "Todavía no hay recetas de este tipo.")));
    return wrap;
  }
  const tabla = el("div", { class: "tabla-wrap" });
  const filas = lista.map((r) => {
    const costo = store.costoDeReceta(r);
    let rentCols;
    if (esPlato) {
      const rent = rentabilidad(r, costo || 0);
      rentCols = [
        el("td", { class: "num" }, formatearCentavos(r.precio_venta_publico_centavos)),
        el("td", { class: "num" },
          el("span", { class: `badge ${costo == null ? "badge-muted" : claseFoodCost(rent.foodCostPct).replace("foodcost-", "badge-").replace("badge-ok", "badge-ok")}` },
            costo == null ? "—" : formatearPorcentaje(rent.foodCostPct, 1))),
      ];
    } else {
      rentCols = [
        el("td", { class: "num" }, `${r.rendimiento_cantidad} ${r.rendimiento_unidad}`),
        el("td", { class: "num" }, costo == null ? "—" : `${formatearCentavos(Math.round((costo || 0) / (r.rendimiento_cantidad || 1)))}/${r.rendimiento_unidad}`),
      ];
    }
    return el("tr", {},
      el("td", {}, el("div", { class: "celda-principal" }, r.nombre), el("div", { class: "celda-sub" }, r.codigo || "")),
      el("td", { class: "num" }, costo == null ? el("span", { class: "badge badge-danger" }, "revisar") : formatearCentavos(costo)),
      ...rentCols,
      el("td", { class: "text-right" },
        el("button", { class: "btn btn-xs btn-secondary", onClick: () => abrirEditor(r, r.tipo) }, "Editar"),
        " ",
        el("button", { class: "btn btn-xs btn-secondary", onClick: () => imprimirFicha(r) }, "Ficha"),
      ),
    );
  });
  tabla.appendChild(el("table", { class: "tabla" },
    el("thead", {}, el("tr", {},
      el("th", {}, "Receta"),
      el("th", { class: "num" }, "Costo (c/IVA)"),
      esPlato ? el("th", { class: "num" }, "Precio carta") : el("th", { class: "num" }, "Rinde"),
      esPlato ? el("th", { class: "num" }, "Costo s/ venta") : el("th", { class: "num" }, "Costo / u."),
      el("th", { class: "text-right" }, "Acciones"),
    )),
    el("tbody", {}, ...filas),
  ));
  wrap.appendChild(tabla);
  return wrap;
}

// ── Editor de receta ──────────────────────────────────────────
function abrirEditor(receta, tipo) {
  const editar = !!receta;
  const { insumos, recetas } = store.get();
  // Ingredientes disponibles: insumos + preparaciones (no el propio plato)
  const disponibles = [
    ...insumos.map((i) => ({ tipo: "insumo", ref_id: i.id, nombre: i.nombre, unidad: i.unidad_base })),
    ...recetas.filter((r) => r.tipo === "preparacion" && (!receta || r.id !== receta.id))
      .map((r) => ({ tipo: "receta", ref_id: r.id, nombre: `${r.nombre} (prep.)`, unidad: r.rendimiento_unidad })),
  ];

  // Estado local de ingredientes
  let ingredientes = editar ? receta.ingredientes.map((x) => ({ ...x })) : [];

  const inpNombre = el("input", { class: "form-control", value: editar ? receta.nombre : "", placeholder: tipo === "plato" ? "Ej: Pizza Margherita" : "Ej: Salsa de tomate" });
  const inpRendCant = el("input", { class: "form-control", type: "number", step: "any", min: "0", value: editar ? receta.rendimiento_cantidad : (tipo === "plato" ? 1 : "") });
  const inpRendUnidad = el("input", { class: "form-control", value: editar ? receta.rendimiento_unidad : (tipo === "plato" ? "un" : "ml") });
  const inpPrecio = el("input", { class: "form-control", placeholder: "Precio de carta (con IVA)", inputmode: "decimal", value: "" });
  const selAliVenta = el("select", { class: "form-control" },
    ...ALICUOTAS_IVA.filter((a) => a > 0).map((a) => el("option", { value: a, selected: editar && receta.alicuota_venta === a ? "selected" : (a === 21 ? "selected" : null) }, `${a} %`)));

  const listaIng = el("div", {});
  const panelRent = el("div", { class: "card", style: "background:var(--bg-secondary);box-shadow:none" });

  // Selector para agregar ingrediente
  const selAgregar = el("select", { class: "form-control grow" },
    el("option", { value: "" }, "+ Agregar ingrediente…"),
    ...disponibles.map((d, idx) => el("option", { value: idx }, `${d.nombre}`)));
  selAgregar.addEventListener("change", () => {
    if (selAgregar.value === "") return;
    const d = disponibles[Number(selAgregar.value)];
    ingredientes.push({ tipo: d.tipo, ref_id: d.ref_id, cantidad: 0 });
    selAgregar.value = "";
    dibujarIngredientes();
  });

  function costoActual() {
    const recetaTmp = { id: editar ? receta.id : "__tmp__", nombre: inpNombre.value, ingredientes, rendimiento_cantidad: Number(inpRendCant.value) || 1 };
    const ctx = store.ctxCosteo();
    // Inyectar la receta temporal para resolver auto-referencias de preparaciones
    const getReceta = (id) => (id === recetaTmp.id ? recetaTmp : ctx.getReceta(id));
    try {
      return Math.round(costoReceta(recetaTmp, { ...ctx, getReceta }));
    } catch (e) { return null; }
  }

  function dibujarIngredientes() {
    limpiar(listaIng);
    if (!ingredientes.length) {
      listaIng.appendChild(el("p", { class: "form-hint" }, "Sin ingredientes todavía."));
    }
    ingredientes.forEach((ing, idx) => {
      const info = disponibles.find((d) => d.ref_id === ing.ref_id && d.tipo === ing.tipo);
      const inpCant = el("input", { class: "form-control", type: "number", step: "any", min: "0", value: ing.cantidad });
      inpCant.addEventListener("input", () => { ing.cantidad = Number(inpCant.value) || 0; refrescarRent(); });
      const row = el("div", { class: "ingrediente-row" },
        el("div", { class: "ing-nombre" }, info ? info.nombre : "(insumo faltante)", el("small", {}, `en ${info ? info.unidad : "?"}`)),
        inpCant,
        el("div", { class: "text-muted", style: "font-size:.8rem;text-align:right" }, info ? info.unidad : ""),
        el("button", { class: "btn btn-xs btn-danger", onClick: () => { ingredientes.splice(idx, 1); dibujarIngredientes(); } }, "×"),
      );
      listaIng.appendChild(row);
    });
    refrescarRent();
  }

  function refrescarRent() {
    limpiar(panelRent);
    const costo = costoActual();
    panelRent.appendChild(el("p", { class: "card-title" }, "Rentabilidad"));
    if (costo == null) {
      panelRent.appendChild(el("div", { class: "msg msg-error show" }, "No se puede calcular (referencia circular o insumo inválido)."));
      return;
    }
    if (tipo === "plato") {
      const precioPub = pesosACentavos(inpPrecio.value) || (editar ? receta.precio_venta_publico_centavos : 0);
      const rent = rentabilidad({ precio_venta_publico_centavos: precioPub, alicuota_venta: Number(selAliVenta.value) }, costo);
      const cls = claseFoodCost(rent.foodCostPct);
      panelRent.appendChild(el("div", { class: "rent-grid" },
        tile("Costo (c/IVA)", formatearCentavos(costo)),
        tile("Precio carta", formatearCentavos(rent.precioPublicoCentavos)),
        tile("Costo s/ venta", precioPub > 0 ? formatearPorcentaje(rent.foodCostPct, 1) : "—", cls),
      ));
      panelRent.appendChild(el("div", { class: "flex justify-between", style: "margin-top:10px;font-size:.85rem" },
        el("span", { class: "text-muted" }, `Margen bruto: ${formatearCentavos(Math.round(rent.margenBrutoCentavos))} (c/IVA)`),
        el("span", { class: "text-muted" }, `Precio neto: ${formatearCentavos(Math.round(rent.precioNetoCentavos))}`),
      ));
      // Calculadora inversa
      const inpObjetivo = el("input", { class: "form-control", type: "number", value: 30, step: "1", min: "1", style: "max-width:90px" });
      const salida = el("span", { class: "mono" }, "—");
      const calc = () => {
        const s = precioSugerido(costo, Number(inpObjetivo.value) || 0, Number(selAliVenta.value));
        salida.textContent = `${formatearCentavos(Math.round(s.precioPublicoCentavos))} (carta)`;
      };
      inpObjetivo.addEventListener("input", calc); calc();
      panelRent.appendChild(el("div", { class: "flex items-center gap-8", style: "margin-top:12px;flex-wrap:wrap" },
        el("span", { class: "text-muted", style: "font-size:.82rem" }, "Para costo s/ venta"),
        inpObjetivo, el("span", { class: "text-muted", style: "font-size:.82rem" }, "% vender a:"), salida));
    } else {
      const rend = Number(inpRendCant.value) || 1;
      panelRent.appendChild(el("div", { class: "rent-grid" },
        tile("Costo total (c/IVA)", formatearCentavos(costo)),
        tile("Rinde", `${rend} ${inpRendUnidad.value}`),
        tile("Costo / u.", formatearCentavos(Math.round(costo / rend))),
      ));
      panelRent.appendChild(el("p", { class: "form-hint" }, "Esta preparación se puede usar como ingrediente de otras recetas."));
    }
  }
  [inpPrecio, selAliVenta, inpRendCant, inpRendUnidad].forEach((n) => n.addEventListener("input", refrescarRent));
  if (editar && tipo === "plato") inpPrecio.value = (receta.precio_venta_publico_centavos / 100).toString().replace(".", ",");

  const camposPlato = tipo === "plato" ? el("div", { class: "form-row" },
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Precio de carta (con IVA)"), inpPrecio),
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Alícuota de venta"), selAliVenta),
  ) : null;

  const form = el("div", {},
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Nombre"), inpNombre),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, tipo === "plato" ? "Rinde (porciones)" : "Rendimiento"), inpRendCant),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Unidad"), inpRendUnidad),
    ),
    camposPlato,
    el("div", { class: "card", style: "box-shadow:none;border-style:dashed" },
      el("p", { class: "card-title" }, "Ingredientes"),
      listaIng,
      el("div", { class: "flex gap-8", style: "margin-top:10px" }, selAgregar),
    ),
    panelRent,
  );

  abrirModal({
    titulo: editar ? `Editar ${tipo}` : (tipo === "plato" ? "Nuevo plato" : "Nueva preparación"),
    contenido: form, ancho: "lg",
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: editar ? "Guardar" : "Crear", clase: "btn-primary", onClick: async (cerrar) => {
          if (!inpNombre.value.trim()) return toast("Falta el nombre.", "error");
          // Validar grafo (ciclos) antes de escribir
          const idx = Object.fromEntries(recetas.map((r) => [r.id, r]));
          const val = validarGrafoReceta({ ingredientes }, (id) => idx[id], editar ? receta.id : "__nueva__");
          if (!val.ok) return toast(val.motivo || "Receta inválida.", "error");
          const datos = {
            nombre: inpNombre.value, tipo,
            rendimiento_cantidad: Number(inpRendCant.value) || 1,
            rendimiento_unidad: inpRendUnidad.value || "un",
            precio_venta_publico_centavos: tipo === "plato" ? pesosACentavos(inpPrecio.value) : 0,
            alicuota_venta: tipo === "plato" ? Number(selAliVenta.value) : 0,
            ingredientes,
          };
          const costo = costoActual() || 0;
          try {
            if (editar) await recetasRepo.actualizar(receta.id, datos, costo);
            else await recetasRepo.crear(datos, costo);
            cerrar();
            toast("Receta guardada.");
            await render($(".main"));
          } catch (e) { toast(e.message || "Error al guardar.", "error"); }
        } },
    ],
  });
  dibujarIngredientes();
}

function tile(label, valor, cls = "") {
  return el("div", { class: `rent-tile ${cls}` },
    el("div", { class: "rlabel" }, label),
    el("div", { class: "rval" }, valor));
}

// ── Ficha técnica imprimible ──────────────────────────────────
function imprimirFicha(receta) {
  const { insumos, recetas } = store.get();
  const costo = store.costoDeReceta(receta) || 0;
  const filas = (receta.ingredientes || []).map((ing) => {
    let nombre = "?", unidad = "";
    if (ing.tipo === "insumo") { const i = insumos.find((x) => x.id === ing.ref_id); if (i) { nombre = i.nombre; unidad = i.unidad_base; } }
    else { const r = recetas.find((x) => x.id === ing.ref_id); if (r) { nombre = r.nombre + " (prep.)"; unidad = r.rendimiento_unidad; } }
    return el("tr", {}, el("td", {}, nombre), el("td", { class: "num" }, `${ing.cantidad} ${unidad}`));
  });

  let extra = "";
  if (receta.tipo === "plato") {
    const rent = rentabilidad(receta, costo);
    extra = el("div", { class: "rent-grid", style: "margin-top:16px" },
      tile("Costo (c/IVA)", formatearCentavos(costo)),
      tile("Precio carta", formatearCentavos(rent.precioPublicoCentavos)),
      tile("Costo s/ venta", formatearPorcentaje(rent.foodCostPct, 1)),
    );
  }

  const contenido = el("div", {},
    el("div", { class: "print-header print-only" },
      el("span", { class: "marca" }, "Green Garden · Ficha técnica"),
      el("span", { class: "fecha" }, fechaCorta(new Date())),
    ),
    el("h2", { style: "margin-bottom:4px" }, receta.nombre),
    el("p", { class: "text-muted", style: "margin-bottom:14px" }, `${receta.codigo || ""} · ${receta.tipo} · rinde ${receta.rendimiento_cantidad} ${receta.rendimiento_unidad}`),
    el("div", { class: "tabla-wrap" },
      el("table", { class: "tabla" },
        el("thead", {}, el("tr", {}, el("th", {}, "Ingrediente"), el("th", { class: "num" }, "Cantidad"))),
        el("tbody", {}, ...filas))),
    extra || "",
  );

  abrirModal({
    titulo: "Ficha técnica", contenido, ancho: "lg",
    botones: [
      { texto: "Cerrar", clase: "btn-secondary" },
      { texto: "Imprimir / PDF", clase: "btn-primary", onClick: () => window.print() },
    ],
  });
}
