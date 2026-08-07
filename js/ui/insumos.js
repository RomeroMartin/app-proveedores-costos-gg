// ============================================================
// ui/insumos.js — Pantalla de Insumos / Materia Prima (Sección 7.3)
// ============================================================

import { $, el, limpiar, toast, abrirModal, confirmar, mostrarCargando, fechaCorta, esc, ico } from "./helpers.js";
import { formatearCentavos, formatearPorcentaje, pesosACentavos } from "../core/dinero.js";
import { MAGNITUDES, UNIDADES_POR_MAGNITUD, unidadBaseDe, convertirAUnidadBase, costoNetoPorUnidadBase } from "../core/unidades.js";
import { ALICUOTAS_IVA } from "../core/fiscal.js";
import * as insumosRepo from "../data/insumosRepo.js";
import * as recetasRepo from "../data/recetasRepo.js";
import * as store from "../store.js";

const DIAS_DESACTUALIZADO = 30; // Sección 6.6

function estaDesactualizado(insumo) {
  const f = insumo.fecha_ultimo_precio;
  const d = f && f.toDate ? f.toDate() : null;
  if (!d) return false;
  return (Date.now() - d.getTime()) / 86400000 > DIAS_DESACTUALIZADO;
}

export async function render(main) {
  main.innerHTML = "";
  const header = el("div", { class: "page-header" },
    el("div", {},
      el("div", { class: "page-title" }, "Insumos"),
      el("div", { class: "page-subtitle" }, "Materia prima, costos por unidad base e historial de precios."),
    ),
    el("button", { class: "btn btn-primary", onClick: () => abrirFormInsumo() }, el("span", { html: ico("mas", 16) }), "Nuevo insumo"),
  );
  main.appendChild(header);

  const cont = el("div", {});
  main.appendChild(cont);
  await pintarLista(cont);
}

async function pintarLista(cont) {
  mostrarCargando(cont, "Cargando insumos…");
  await store.cargar(true);
  const { insumos, proveedoresById } = store.get();
  limpiar(cont);

  const buscador = el("input", { class: "form-control buscador", placeholder: "Buscar insumo…", type: "search" });
  const toolbar = el("div", { class: "toolbar" }, buscador,
    el("span", { class: "text-muted", style: "font-size:.8rem" }, `${insumos.length} insumo(s)`));
  cont.appendChild(toolbar);

  const tablaWrap = el("div", { class: "tabla-wrap" });
  cont.appendChild(tablaWrap);

  function dibujar(filtro = "") {
    const f = filtro.toLowerCase();
    const filtrados = insumos.filter((i) => (i.nombre || "").toLowerCase().includes(f) || (i.codigo || "").toLowerCase().includes(f));
    if (!filtrados.length) {
      limpiar(tablaWrap);
      tablaWrap.appendChild(el("div", { class: "empty-state" }, el("p", {}, "No hay insumos que coincidan.")));
      return;
    }
    const filas = filtrados.map((i) => {
      const desact = estaDesactualizado(i);
      const prov = i.proveedor_habitual_id ? proveedoresById[i.proveedor_habitual_id] : null;
      const tr = el("tr", {},
        el("td", {},
          el("div", { class: "celda-principal" }, i.nombre || "—"),
          el("div", { class: "celda-sub" }, `${i.codigo || ""}${prov ? " · " + prov.nombre : ""}`),
        ),
        el("td", { class: "num" }, `${formatearCentavos(i.costo_neto_por_unidad_base_centavos)}/${i.unidad_base}`),
        el("td", { class: "num" }, formatearPorcentaje(i.alicuota_iva, 1)),
        el("td", { class: "num" }, String(i.factor_correccion ?? 1)),
        el("td", {},
          el("span", { class: `badge ${desact ? "badge-warn" : "badge-muted"}` }, fechaCorta(i.fecha_ultimo_precio)),
        ),
        el("td", { class: "text-right" },
          el("button", { class: "btn btn-xs btn-secondary", onClick: () => actualizarPrecioRapido(i) }, "Precio"),
          " ",
          el("button", { class: "btn btn-xs btn-secondary", onClick: () => abrirFormInsumo(i) }, "Editar"),
        ),
      );
      return tr;
    });
    limpiar(tablaWrap);
    tablaWrap.appendChild(el("table", { class: "tabla" },
      el("thead", {}, el("tr", {},
        el("th", {}, "Insumo"),
        el("th", { class: "num" }, "Costo neto / u. base"),
        el("th", { class: "num" }, "IVA"),
        el("th", { class: "num" }, "Factor"),
        el("th", {}, "Últ. precio"),
        el("th", { class: "text-right" }, "Acciones"),
      )),
      el("tbody", {}, ...filas),
    ));
  }
  buscador.addEventListener("input", () => dibujar(buscador.value));
  dibujar();
}

// ── Alta / edición ────────────────────────────────────────────
function abrirFormInsumo(insumo = null) {
  const editar = !!insumo;
  const { proveedores } = store.get();
  const magnitudInicial = insumo ? insumo.magnitud : "masa";

  const selMagnitud = el("select", { class: "form-control" },
    ...Object.entries(MAGNITUDES).map(([k, v]) => el("option", { value: k, selected: k === magnitudInicial ? "selected" : null }, v.nombre)));
  const selUnidadPres = el("select", { class: "form-control" });
  const inpNombre = el("input", { class: "form-control", value: insumo ? insumo.nombre : "", placeholder: "Ej: Queso Mozzarella Barra" });
  const inpPresDesc = el("input", { class: "form-control", value: insumo && insumo.presentacion_compra ? insumo.presentacion_compra.descripcion : "", placeholder: "Ej: Barra 5 kg" });
  const inpPresCant = el("input", { class: "form-control", type: "number", step: "any", min: "0", placeholder: "Ej: 5", value: "" });
  const selPresUnidad = el("select", { class: "form-control" });
  const inpPresPrecio = el("input", { class: "form-control", placeholder: "Ej: 34000,00", inputmode: "decimal" });
  const selAlicuota = el("select", { class: "form-control" },
    ...ALICUOTAS_IVA.map((a) => el("option", { value: a, selected: insumo && insumo.alicuota_iva === a ? "selected" : null }, `${a} %`)));
  const inpFactor = el("input", { class: "form-control", type: "number", step: "0.01", min: "0.01", max: "1", value: insumo ? (insumo.factor_correccion ?? 1) : 1 });
  const selProv = el("select", { class: "form-control" },
    el("option", { value: "" }, "— Sin proveedor —"),
    ...proveedores.map((p) => el("option", { value: p.id, selected: insumo && insumo.proveedor_habitual_id === p.id ? "selected" : null }, p.nombre)));
  const preview = el("div", { class: "form-hint" }, "El costo por unidad base se calcula desde la presentación.");

  function actualizarUnidades() {
    const mag = selMagnitud.value;
    limpiar(selUnidadPres); limpiar(selPresUnidad);
    for (const u of UNIDADES_POR_MAGNITUD[mag]) {
      selPresUnidad.appendChild(el("option", { value: u }, u));
    }
    calcularPreview();
  }
  function calcularPreview() {
    try {
      const cantBase = convertirAUnidadBase(Number(inpPresCant.value) || 0, selPresUnidad.value);
      const precioC = pesosACentavos(inpPresPrecio.value);
      if (cantBase > 0 && precioC > 0) {
        const c = costoNetoPorUnidadBase(precioC, cantBase);
        preview.textContent = `≈ ${formatearCentavos(c)} por ${unidadBaseDe(selMagnitud.value)} (neto).`;
      } else {
        preview.textContent = "Ingresá cantidad y precio neto de la presentación.";
      }
    } catch (_e) { preview.textContent = "Revisá los datos de la presentación."; }
  }
  selMagnitud.addEventListener("change", actualizarUnidades);
  [inpPresCant, selPresUnidad, inpPresPrecio].forEach((n) => n.addEventListener("input", calcularPreview));
  actualizarUnidades();

  const form = el("div", {},
    el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Nombre"), inpNombre),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Magnitud"), selMagnitud),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Alícuota IVA"), selAlicuota),
    ),
    el("div", { class: "card", style: "background:var(--bg-secondary);box-shadow:none" },
      el("p", { class: "card-title" }, "Presentación de compra"),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Descripción"), inpPresDesc),
      el("div", { class: "form-row-3" },
        el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Cantidad"), inpPresCant),
        el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Unidad"), selPresUnidad),
        el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Precio neto"), inpPresPrecio),
      ),
      preview,
    ),
    el("div", { class: "form-row" },
      el("div", { class: "form-group" },
        el("label", { class: "form-label" }, "Factor de corrección"),
        inpFactor,
        el("div", { class: "form-hint" }, "1 = sin merma. Ej: lomo 0,78."),
      ),
      el("div", { class: "form-group" }, el("label", { class: "form-label" }, "Proveedor habitual"), selProv),
    ),
  );

  const { cerrar } = abrirModal({
    titulo: editar ? "Editar insumo" : "Nuevo insumo",
    contenido: form,
    ancho: "lg",
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: editar ? "Guardar" : "Crear", clase: "btn-primary", onClick: async (cerrarModal) => {
          if (!inpNombre.value.trim()) return toast("Falta el nombre.", "error");
          const cantBase = convertirAUnidadBase(Number(inpPresCant.value) || 0, selPresUnidad.value);
          const precioC = pesosACentavos(inpPresPrecio.value);
          const magnitud = selMagnitud.value;
          const base = {
            nombre: inpNombre.value,
            magnitud,
            unidad_base: unidadBaseDe(magnitud),
            alicuota_iva: Number(selAlicuota.value),
            factor_correccion: Number(inpFactor.value) || 1,
            proveedor_habitual_id: selProv.value || null,
            presentacion_compra: cantBase > 0 ? {
              descripcion: inpPresDesc.value.trim(),
              cantidad_base: cantBase,
              precio_neto_centavos: precioC,
            } : null,
          };
          try {
            if (editar) {
              await insumosRepo.actualizarMeta(insumo.id, base);
              if (cantBase > 0 && precioC > 0) {
                const nuevoCosto = costoNetoPorUnidadBase(precioC, cantBase);
                if (nuevoCosto !== insumo.costo_neto_por_unidad_base_centavos) {
                  await insumosRepo.actualizarCosto(insumo.id, nuevoCosto, { origen: "manual" });
                  await recetasRepo.recalcularTodas(store.ctxCosteo());
                }
              }
              toast("Insumo actualizado.");
            } else {
              if (cantBase <= 0 || precioC <= 0) return toast("Completá la presentación de compra.", "error");
              base.costo_neto_por_unidad_base_centavos = costoNetoPorUnidadBase(precioC, cantBase);
              await insumosRepo.crear(base);
              toast("Insumo creado.");
            }
            cerrarModal();
            await render($(".main"));
          } catch (e) { toast(e.message || "Error al guardar.", "error"); }
        } },
    ],
  });
}

// ── Actualización rápida de precio ────────────────────────────
function actualizarPrecioRapido(insumo) {
  const inp = el("input", { class: "form-control", placeholder: "Nuevo precio neto de la presentación", inputmode: "decimal" });
  const hint = el("div", { class: "form-hint" },
    insumo.presentacion_compra
      ? `Presentación: ${esc(insumo.presentacion_compra.descripcion || "")} (${insumo.presentacion_compra.cantidad_base} ${insumo.unidad_base}). Actual: ${formatearCentavos(insumo.costo_neto_por_unidad_base_centavos)}/${insumo.unidad_base}.`
      : "Este insumo no tiene presentación de compra: ingresá el costo por unidad base directamente.");
  abrirModal({
    titulo: `Actualizar precio — ${insumo.nombre}`,
    contenido: el("div", {}, el("div", { class: "form-group" }, inp, hint)),
    botones: [
      { texto: "Cancelar", clase: "btn-secondary" },
      { texto: "Actualizar", clase: "btn-primary", onClick: async (cerrar) => {
          const precioC = pesosACentavos(inp.value);
          if (precioC <= 0) return toast("Ingresá un precio válido.", "error");
          let nuevoCosto;
          if (insumo.presentacion_compra && insumo.presentacion_compra.cantidad_base > 0) {
            nuevoCosto = costoNetoPorUnidadBase(precioC, insumo.presentacion_compra.cantidad_base);
          } else {
            nuevoCosto = precioC; // se interpretó como costo por unidad base
          }
          try {
            const variacion = await insumosRepo.actualizarCosto(insumo.id, nuevoCosto, { origen: "manual" });
            const n = await recetasRepo.recalcularTodas(store.ctxCosteo());
            cerrar();
            toast(`Precio actualizado (${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)}%). ${n} receta(s) recalculada(s).`);
            await render($(".main"));
          } catch (e) { toast(e.message || "Error.", "error"); }
        } },
    ],
  });
}
