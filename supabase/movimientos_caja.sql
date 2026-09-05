-- ============================================================================
-- SaaS Gastronómico — Tabla `movimientos_caja` (Flujo de caja diario)
-- ----------------------------------------------------------------------------
-- Libro de caja: lo que ENTRA (efectivo, tarjeta, QR, transferencia…) y lo que
-- SALE (pagos, gastos, sueldos, mantenimiento…) por día, para ver el balance.
--
-- Ejecutar en Supabase → SQL Editor → Run (después de schema.sql).
-- ============================================================================

create table if not exists movimientos_caja (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  fecha           date not null,
  tipo            varchar(8) not null check (tipo in ('ingreso','egreso')),
  categoria       varchar(60),
  medio           varchar(20) not null default 'efectivo'
                  check (medio in ('efectivo','tarjeta','qr','transferencia','cheque','otro')),
  monto_centavos  bigint not null check (monto_centavos > 0),
  nota            text,
  creado_en       timestamptz not null default now(),
  creado_por      uuid
);
create index if not exists ix_movcaja_empresa_fecha on movimientos_caja(empresa_id, fecha);

alter table movimientos_caja enable row level security;
drop policy if exists tenant_all on movimientos_caja;
create policy tenant_all on movimientos_caja
  for all to authenticated
  using (empresa_id = mi_empresa())
  with check (empresa_id = mi_empresa());
