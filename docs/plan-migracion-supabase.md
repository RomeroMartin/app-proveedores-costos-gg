# Plan de acción — Migrar la app a SaaS multi-tenant sobre Supabase (SQL)

> **Objetivo:** convertir `app-proveedores-costos-gg` en el **módulo de Compras,
> Costos y Rentabilidad** del SaaS, re-plataformado a **PostgreSQL (Supabase)**
> y **multi-empresa**, reutilizando todo lo ya construido.
>
> **Alcance de esta etapa:** Fases 1–4 (Core multi-tenant, Proveedores/CxP,
> Insumos/Costos, Rentabilidad/Escandallos). **La Fase 5 (Inventario) queda para
> más adelante** (ya existe en otro repo con Firebase y se readecuará después).
>
> Complementa a `docs/diagnostico-saas-sql.md`.

---

## 1. Cómo nos dividimos el trabajo

| Hace | Qué |
|---|---|
| **VOS (manual)** | Crear la cuenta y el proyecto Supabase, pasarme las claves públicas, ejecutar los scripts SQL que te dejo, y crear el primer usuario. Todo desde el navegador, sin instalar nada. |
| **YO (código)** | Escribir el esquema SQL, las políticas de seguridad (RLS), las funciones de base (RPC), el cliente Supabase del frontend, y reescribir la capa `data/` reutilizando el `core/` intacto. |

**Regla de oro de la división:** vos tocás la **consola de Supabase**; yo toco el
**código del repo**. Las únicas cosas que viajan de vos a mí son **dos claves
públicas** (seguras de compartir, están hechas para ir en el frontend).

---

## 2. TU PASO A PASO MANUAL (hacelo en este orden)

### Paso 1 — Crear la cuenta de Supabase
1. Entrá a **https://supabase.com** y hacé clic en **Start your project**.
2. Registrate con **GitHub** (te conviene, ya tenés cuenta) o con email.
3. Confirmá el email si te lo pide.

### Paso 2 — Crear el proyecto
1. Clic en **New project**.
2. **Name:** `saas-gastronomico` (o el nombre que quieras).
3. **Database Password:** generá una y **guardala en un lugar seguro** (gestor
   de contraseñas). La vas a necesitar y no se puede recuperar, solo resetear.
4. **Region:** elegí **South America (São Paulo)** — es la más cercana a
   Argentina, menor latencia.
5. **Plan:** dejá **Free**. Alcanza de sobra para desarrollar y para los
   primeros clientes.
6. Clic en **Create new project** y esperá ~2 minutos a que se aprovisione.

### Paso 3 — Pasarme las dos claves públicas
1. En el menú lateral: **Project Settings** (el engranaje) → **API**.
2. Copiame estos dos valores y pegámelos en el chat:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public** key (una cadena larga que empieza con `eyJ...`)
3. ⚠️ **NO me pases** la **`service_role` key** ni la **Database Password**.
   Esas son secretas y **nunca** van en el frontend. La `anon` sí es pública y
   está protegida por las reglas de seguridad (RLS) que voy a escribir.

### Paso 4 — Activar el login por email
1. Menú lateral: **Authentication** → **Providers** (o **Sign In / Providers**).
2. Asegurate de que **Email** esté **habilitado**.
3. Para desarrollo, entrá a **Authentication → Sign In / Providers → Email** y
   **desactivá "Confirm email"** (así podés crear usuarios de prueba sin tener
   que confirmar mails). Esto se vuelve a activar antes de salir a producción.

### Paso 5 — Ejecutar el esquema de la base
1. Menú lateral: **SQL Editor** → **New query**.
2. Abrí el archivo **`supabase/schema.sql`** de este repo, copiá **todo** su
   contenido y pegalo en el editor.
3. Clic en **Run** (o Ctrl/Cmd + Enter). Debería decir *Success. No rows returned*.
4. Verificá en **Table Editor** que aparezcan las tablas: `empresas`,
   `sucursales`, `usuarios`, `proveedores`, `facturas`, `pagos`, `insumos`,
   `recetas`, etc.

> Los scripts de **funciones (RPC)** y ajustes finos te los voy a ir dejando en
> `supabase/` a medida que avance el código. El paso será siempre el mismo:
> abrir el archivo, copiar, pegar en SQL Editor, Run.

### Paso 6 — Crear tu empresa y tu primer usuario (te guío cuando lleguemos)
Esto lo hacemos juntos una vez que el esquema esté cargado: se crea el usuario
en **Authentication → Users → Add user**, y una función que te voy a dejar lo
vincula a una **empresa** como **ADMIN**. Te aviso el momento exacto.

### Paso 7 — Avisarme
Cuando tengas hechos los pasos 1–5 y me hayas pasado las dos claves, **yo sigo
con el código**: conecto el frontend a tu Supabase y empiezo a portar las
pantallas.

---

## 3. MI HOJA DE RUTA (código) — en qué orden voy a trabajar

| # | Entrega | Depende de |
|---|---|---|
| 1 | ✅ `supabase/schema.sql` — tablas Fases 1–4, multi-tenant, centavos, RLS base | — |
| 2 | `supabase/functions.sql` — RPC: `registrar_pago`, `anular_pago`, `crear_factura`, `crear_empresa_y_admin` (cierra el hueco de seguridad del saldo) | esquema cargado |
| 3 | `js/config/supabase.js` — cliente Supabase (con tu URL + anon key) | tus 2 claves |
| 4 | `js/data/_base.js` reescrito sobre Supabase (misma filosofía de caché) | cliente listo |
| 5 | `js/data/*Repo.js` — un repo por tabla, **respetando las firmas actuales** | _base listo |
| 6 | Inyección de `empresa_id` desde la sesión en repos y UI | repos listos |
| 7 | Auth y roles (ADMIN/GERENTE/COCINA/AUDITOR) + alta de empresa | RPC + repos |
| 8 | Ajustes de UI (timestamps, sucursal, config de IVA por empresa) | todo lo anterior |

**Lo que NO cambia:** `js/core/` (dinero, unidades, fiscal, costeo, rubros).
Es lógica pura y testeada; se reutiliza tal cual. Ese es el gran ahorro.

---

## 4. Decisiones ya tomadas (por defecto, avisá si querés cambiarlas)

1. **Dinero = entero en centavos (`BIGINT`).** Coherente con la app y sus tests.
2. **Multi-tenant por tabla `usuarios`.** Cada usuario pertenece a una empresa;
   las reglas RLS filtran por esa empresa (sin necesidad de configurar "custom
   claims" en el JWT, que es más avanzado). Función `mi_empresa()` en la base.
3. **Roles:** ADMIN, GERENTE, COCINA, AUDITOR (los 4 del spec del SaaS).
4. **Política de IVA por empresa:** el costeo "con IVA" vs "crédito fiscal" será
   una **configuración de cada empresa** (columna en `empresas`). La lógica ya
   existe en `core/fiscal.js`.
5. **Fase 5 (Inventario): fuera de esta etapa.**

---

## 5. Preguntas frecuentes

- **¿Es gratis?** Sí, el plan Free de Supabase alcanza para desarrollar y
  arrancar. Se paga solo al escalar.
- **¿Sigo sin backend?** Sí. Supabase es "backend como servicio": la base, el
  login y la seguridad son de ellos. Vos seguís haciendo solo frontend. Las
  operaciones delicadas (imputar pagos, saldos) van como **funciones dentro de
  la base** (RPC), que no es "montar un backend": es una función SQL que el
  frontend invoca.
- **¿Pierdo lo hecho en Firebase?** No. El corazón de la lógica (`core/`) se
  reutiliza igual. Se cambia la "cañería" de datos, no el cerebro.
- **¿Y la app vieja de Firebase?** Queda como está; esto es una evolución en
  paralelo. Cuando el SaaS esté listo, se decide la transición.
