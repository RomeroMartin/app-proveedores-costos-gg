-- ============================================================================
-- SaaS Gastronómico — Tabla `pagos_programados` (Agenda de pagos / flujo de caja)
-- ----------------------------------------------------------------------------
-- Administración agenda los pagos que va a hacer los próximos días para saber
-- cuánto efectivo / dinero en cuenta necesita cada jornada. Es planificación:
-- no mueve la cuenta corriente (eso lo hace el módulo Pagos).
--
-- Ejecutar en Supabase → SQL Editor → Run (después de schema.sql).
-- ============================================================================

create table if not exists pagos_programados (
  id                uuid primary key default uuid_generate_v4(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  proveedor_id      uuid references proveedores(id) on delete set null,
  fecha_programada  date not null,
  monto_centavos    bigint not null check (monto_centavos > 0),
  metodo_pago       varchar(20) not null default 'transferencia'
                    check (metodo_pago in ('efectivo','transferencia','cheque','echeq','otro')),
  estado            varchar(12) not null default 'pendiente'
                    check (estado in ('pendiente','pagado','cancelado')),
  nota              text,
  creado_en         timestamptz not null default now(),
  creado_por        uuid,
  modificado_en     timestamptz not null default now()
);
create index if not exists ix_pagosprog_empresa_fecha on pagos_programados(empresa_id, fecha_programada);

alter table pagos_programados enable row level security;
drop policy if exists tenant_all on pagos_programados;
create policy tenant_all on pagos_programados
  for all to authenticated
  using (empresa_id = mi_empresa())
  with check (empresa_id = mi_empresa());
