-- ============================================================================
-- SaaS Gastronómico — Bootstrap del PRIMER usuario y empresa (una sola vez)
-- ----------------------------------------------------------------------------
-- Crea tu empresa y te vincula como ADMIN. Necesario porque, sin un ADMIN
-- previo, las políticas RLS no dejan crear el primer perfil desde la app.
--
-- PASOS:
--   1) Antes de correr esto, creá tu usuario en:
--        Supabase → Authentication → Users → Add user
--        (email + password; para dev, con "Confirm email" desactivado).
--   2) Cambiá abajo los dos valores marcados con <<< ... >>>.
--   3) Pegá este script en Supabase → SQL Editor → Run.
--
-- Es seguro correrlo una sola vez. Si el usuario ya tiene empresa, avisa y no
-- hace nada.
-- ============================================================================

do $$
declare
  v_email  text := '<<< PONÉ ACÁ EL EMAIL DE TU USUARIO >>>';
  v_empresa_nombre text := '<<< PONÉ ACÁ EL NOMBRE DE TU RESTAURANTE >>>';
  v_uid    uuid;
  v_empresa uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);
  if v_uid is null then
    raise exception 'No existe un usuario con el email %. Crealo primero en Authentication → Users.', v_email;
  end if;

  if exists (select 1 from public.usuarios where id = v_uid) then
    raise notice 'El usuario % ya pertenece a una empresa. No se hace nada.', v_email;
    return;
  end if;

  insert into public.empresas (nombre) values (v_empresa_nombre)
    returning id into v_empresa;

  insert into public.usuarios (id, empresa_id, email, nombre, rol)
    values (v_uid, v_empresa, v_email, 'Administrador', 'ADMIN');

  raise notice 'Listo: empresa "%" creada y usuario % es ADMIN.', v_empresa_nombre, v_email;
end $$;
