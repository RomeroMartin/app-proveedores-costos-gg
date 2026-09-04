-- ============================================================================
-- SaaS Gastronómico — Tabla `catalogos` (opciones de desplegables por empresa)
-- ----------------------------------------------------------------------------
-- Guarda las opciones que el usuario agrega desde los formularios (rubros,
-- sectores, unidades de rendimiento, etc.), por empresa. Los combos de la app
-- muestran: opciones por defecto (en el código) + las de esta tabla.
--
-- Ejecutar en Supabase → SQL Editor → Run (después de schema.sql).
-- ============================================================================

create table if not exists catalogos (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  tipo        varchar(40) not null,      -- 'rubro' | 'sector' | 'unidad_rendimiento' | ...
  valor       varchar(120) not null,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint uq_catalogo unique (empresa_id, tipo, valor)
);
create index if not exists ix_catalogos_empresa_tipo on catalogos(empresa_id, tipo);

alter table catalogos enable row level security;
drop policy if exists tenant_all on catalogos;
create policy tenant_all on catalogos
  for all to authenticated
  using (empresa_id = mi_empresa())
  with check (empresa_id = mi_empresa());
