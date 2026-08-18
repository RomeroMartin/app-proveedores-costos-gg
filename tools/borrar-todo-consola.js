// ============================================================
// tools/borrar-todo-consola.js
// Da de baja TODO lo cargado (proveedores, insumos y recetas) para dejar la
// demo limpia antes de cargar los datos reales.
// ------------------------------------------------------------
// La app NUNCA borra físico (Regla de Oro 7): esto hace soft-delete
// (activo:false), así que los documentos siguen en Firestore pero dejan de
// aparecer en la app. NO toca saldos, facturas ni pagos.
//
// USO:
//   1) Logueate como Gerente.
//   2) Abrí la consola (F12), pegá TODO este archivo y Enter.
//   3) Confirmá el prompt escribiendo BORRAR.
// ============================================================

(async () => {
  const j = (p) => new URL(p, location.origin + "/").href;
  const proveedoresRepo = await import(j("js/data/proveedoresRepo.js"));
  const insumosRepo     = await import(j("js/data/insumosRepo.js"));
  const recetasRepo     = await import(j("js/data/recetasRepo.js"));

  const [prov, ins, rec] = await Promise.all([
    proveedoresRepo.listar(true), insumosRepo.listar(true), recetasRepo.listar(true),
  ]);
  console.log(`A dar de baja: ${prov.length} proveedores, ${ins.length} insumos, ${rec.length} recetas.`);
  const ok = window.prompt('Esto da de baja TODOS los proveedores, insumos y recetas activos. Escribí BORRAR para confirmar:');
  if ((ok || "").trim().toUpperCase() !== "BORRAR") { console.log("Cancelado."); return; }

  let n = 0, err = 0;
  const baja = async (repo, arr, label) => {
    for (const x of arr) {
      try { await repo.desactivar(x.id); n++; }
      catch (e) { err++; console.error(`✖ ${label}`, x.nombre, e); }
    }
    console.log(`${label}: ${arr.length} dados de baja.`);
  };
  await baja(recetasRepo, rec, "recetas");        // recetas primero (dependen de insumos)
  await baja(insumosRepo, ins, "insumos");
  await baja(proveedoresRepo, prov, "proveedores");

  console.log("%c✔ Limpieza completa", "font-weight:bold;color:green", `${n} documentos, ${err} errores.`);
})();
