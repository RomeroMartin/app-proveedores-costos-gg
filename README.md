# Green Garden — Costos, Proveedores y Rentabilidad

Aplicación web (100 % frontend + Firebase) para la gestión gastronómica de
**Green Garden**: control de costos de materia prima, cuentas corrientes de
proveedores y análisis de rentabilidad por plato (escandallos).

> App **informativa de gestión**. No mueve dinero real ni emite comprobantes
> fiscales. Green Garden opera como **Responsable Inscripto**, lo que
> determina toda la lógica de costeo (crédito fiscal).

La especificación funcional completa está en [`docs/especificacion-v2.md`](docs/especificacion-v2.md).

---

## Reglas de Oro (resumen)

Estas reglas viven en `js/core/` y están cubiertas por tests:

1. **Toda magnitud física se guarda en unidad base** (`g` / `ml` / `un`). — `core/unidades.js`
2. **El escandallo vive 100 % en NETO.** El IVA de compras A/RI es crédito
   fiscal recuperable; en Factura C (monotributo) el IVA sí es costo. — `core/fiscal.js`, `core/costeo.js`
3. **El dinero se almacena como entero en centavos.** — `core/dinero.js`
4. **Los movimientos contables no se editan: se anulan** por contraasiento. — `data/pagosRepo.js`
5. **Toda operación multi-documento va en transacción** con `increment()` atómico. — `data/pagosRepo.js`, `data/facturasRepo.js`
6. **Las Firestore Rules son el backend.** — `firestore.rules`
7. **Nada se borra físicamente** (soft delete `activo: false`).

---

## Estructura

```
├── index.html            ← login
├── app.html              ← app protegida (SPA con router por hash)
├── firebase.json / .firebaserc / firestore.rules
├── css/                  ← variables · base · componentes · print
├── js/
│   ├── app.js            ← bootstrap y router
│   ├── auth.js · version.js · store.js
│   ├── config/firebase.js
│   ├── core/             ← dinero · unidades · fiscal · costeo  (lógica pura, testeable)
│   ├── data/             ← *Repo.js (Firestore; transacciones + increment)
│   ├── ui/               ← dashboard · proveedores · insumos · escandallos(=Costos) · usuarios · helpers
│   └── export/excel.js   ← SheetJS
└── test/                 ← tests del núcleo (node --test)
```

Separación de responsabilidades: `/core` no conoce Firebase, `/data` no conoce
el DOM, `/ui` no calcula.

---

## Puesta en marcha

### 1. Configurar Firebase (una sola vez)

Esta app usa su **propio** proyecto Firebase (distinto del inventario de Green Garden).

1. En la [consola de Firebase](https://console.firebase.google.com), creá un
   proyecto nuevo (ej. `green-garden-costos`) y una **Web App**.
2. Habilitá **Authentication** (Email/Password), **Firestore** y **Hosting**.
3. Pegá el `firebaseConfig` que te da la consola en `js/config/firebase.js`.
4. Poné el project ID en `.firebaserc`.
5. Creá al menos un usuario en Authentication para poder ingresar.

### 2. Correr los tests del núcleo

```bash
npm test
```

### 3. Probar localmente

Al usar módulos ES nativos, servila por HTTP (no `file://`):

```bash
npx serve .        # o: python3 -m http.server 8080
```

Abrí `http://localhost:8080/`.

### 4. Desplegar

```bash
firebase deploy --only hosting,firestore:rules
```

En Windows, ver el método probado en la Sección 11 de la especificación.

---

## Roles

- **Gerente:** acceso total (Dashboard, Costos/rentabilidad, precios de venta, anulación de pagos, gestión de usuarios, exportación).
- **Cargador:** carga operativa (Insumos y actualización de precios, Proveedores, facturas y pagos). No ve rentabilidad ni gestiona usuarios.

Los perfiles viven en la colección `usuarios/{uid}`. Un usuario sin perfil se
trata como Gerente (bootstrap del dueño); desde la pantalla **Usuarios** el
Gerente crea los perfiles del resto con su rol.

## Estado

`v0.2.0` — Núcleo · Insumos (con historial de precios y gráfico) · Costos
(recetas y rentabilidad) · Proveedores/Facturas/Pagos · Dashboard · Usuarios y
roles · Export.
