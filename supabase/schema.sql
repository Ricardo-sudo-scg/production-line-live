-- Production Line Live - esquema mínimo para Supabase
-- Ejecuta este archivo en Supabase > SQL Editor > New query > Run.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  team text not null,
  round integer not null default 1,
  product text not null check (product in ('Bicolor', 'Amarillo', 'Rojo')),
  status text not null default 'pendiente' check (
    status in (
      'pendiente',
      'montaje1',
      'montaje1_terminado',
      'montaje2',
      'montaje2_terminado',
      'listo_para_entrega',
      'error',
      'entregado'
    )
  ),
  requested_by text,
  current_station text,
  created_at timestamptz not null default now(),
  montaje1_start timestamptz,
  montaje1_end timestamptz,
  montaje2_start timestamptz,
  montaje2_end timestamptz,
  quality_start timestamptz,
  quality text check (quality in ('OK', 'Error')),
  delivered_at timestamptz,
  error_count integer not null default 0,
  notes text
);

create index if not exists idx_orders_room_round_team
on public.orders (room_code, round, team, created_at);

-- Para prototipo en aula: permite que el link público lea/escriba pedidos.
-- No usar así si luego habrá datos sensibles.
alter table public.orders enable row level security;

drop policy if exists "prototype_select_orders" on public.orders;
drop policy if exists "prototype_insert_orders" on public.orders;
drop policy if exists "prototype_update_orders" on public.orders;
drop policy if exists "prototype_delete_orders" on public.orders;

create policy "prototype_select_orders"
on public.orders
for select
to anon, authenticated
using (true);

create policy "prototype_insert_orders"
on public.orders
for insert
to anon, authenticated
with check (true);

create policy "prototype_update_orders"
on public.orders
for update
to anon, authenticated
using (true)
with check (true);

create policy "prototype_delete_orders"
on public.orders
for delete
to anon, authenticated
using (true);

-- Activa realtime para la tabla.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
