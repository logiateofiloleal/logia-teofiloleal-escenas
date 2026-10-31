-- Aspirantes: solicitudes del formulario /aspirantes y su gestión en /panel.
-- Ejecutar una vez en Supabase → SQL Editor (o con `supabase db push`).

create table if not exists public.aspirantes (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text        not null check (char_length(nombre) between 3 and 120),
  edad                 smallint    not null check (edad between 18 and 99),
  telefono             text        not null,
  email                text        not null check (char_length(email) <= 254),
  descripcion          text        not null check (char_length(descripcion) between 20 and 2000),
  estado               text        not null default 'Nuevo'
                       check (estado in ('Nuevo', 'Contactado', 'En proceso', 'Aprobado', 'Rechazado')),
  historial_estados    jsonb       not null default '[]'::jsonb,
  consentimiento_fecha timestamptz not null default now(),
  creado_en            timestamptz not null default now(),
  -- email y teléfono ya llegan normalizados (aspiranteValidation.ts); la
  -- unicidad la garantiza Postgres, también ante envíos simultáneos.
  constraint aspirantes_email_key    unique (email),
  constraint aspirantes_telefono_key unique (telefono)
);

create index if not exists aspirantes_creado_en_idx on public.aspirantes (creado_en desc);

-- Datos personales: RLS activada y sin políticas, sin acceso para anon ni
-- authenticated. Solo el servidor (clave service_role) lee y escribe.
alter table public.aspirantes enable row level security;
revoke all on public.aspirantes from anon, authenticated;

-- Cambio de estado atómico: una sola sentencia bloquea la fila, cambia el
-- estado y AÑADE la entrada al historial, así que dos cambios simultáneos no
-- se pisan. Devuelve null si el id no existe; `cambiado` es false si el
-- estado ya era ese.
create or replace function public.cambiar_estado_aspirante(p_id uuid, p_estado text, p_nota text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fila public.aspirantes;
begin
  select * into fila from public.aspirantes where id = p_id for update;
  if not found then
    return null;
  end if;

  if fila.estado = p_estado then
    return jsonb_build_object('cambiado', false, 'aspirante', to_jsonb(fila));
  end if;

  update public.aspirantes
     set estado = p_estado,
         historial_estados = historial_estados
           || jsonb_build_array(jsonb_build_object('estado', p_estado, 'fecha', now(), 'nota', p_nota))
   where id = p_id
   returning * into fila;

  return jsonb_build_object('cambiado', true, 'aspirante', to_jsonb(fila));
end;
$$;

revoke all on function public.cambiar_estado_aspirante(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cambiar_estado_aspirante(uuid, text, text) to service_role;
