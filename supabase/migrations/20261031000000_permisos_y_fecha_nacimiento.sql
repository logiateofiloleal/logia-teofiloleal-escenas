-- 1) Permisos: este proyecto no concede privilegios automáticos sobre las
--    tablas nuevas, así que service_role (la clave que usa el servidor) debe
--    recibirlos de forma explícita. No se concede delete: el panel no borra.
grant select, insert, update on public.aspirantes to service_role;

-- 2) La edad se sustituye por la fecha de nacimiento. La tabla aún no tiene
--    solicitudes. La edad mínima (21) y máxima (99) se validan en el servidor
--    (aspiranteValidation.ts); aquí solo se descarta una fecha absurda.
alter table public.aspirantes drop column edad;
alter table public.aspirantes
  add column fecha_nacimiento date not null
  check (fecha_nacimiento >= date '1900-01-01');
