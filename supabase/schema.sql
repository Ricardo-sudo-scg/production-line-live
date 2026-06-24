-- Production Line Live v2 - Ejecuta en Supabase SQL Editor
create extension if not exists "pgcrypto";

drop table if exists public.nps_responses cascade;
drop table if exists public.oven_batches cascade;
drop table if exists public.orders cascade;
drop table if exists public.players cascade;
drop table if exists public.rooms cascade;

create table public.rooms (
  id text primary key,
  status text not null default 'waiting' check (status in ('waiting','prep','running','paused','finished')),
  demand_interval_sec integer not null default 20,
  demand_sequence jsonb not null default '[]',
  oven_a_batch integer not null default 8,
  oven_b_batch integer not null default 4,
  oven_duration_sec integer not null default 80,
  prep_time_sec integer not null default 60,
  started_at timestamptz,
  paused_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  name text not null,
  line text not null check (line in ('A','B')),
  role text not null,
  connected_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  line text not null check (line in ('A','B')),
  sequence_number integer not null,
  product text not null check (product in ('Bicolor','Amarillo','Rojo')),
  status text not null default 'pendiente' check (status in (
    'pendiente','en_planificacion','ensamble1','ensamble1_listo',
    'ensamble2','ensamble2_listo','esperando_horno','en_horno',
    'en_almacen','entregado_ok','entregado_tarde','no_entregado'
  )),
  requested_at timestamptz not null default now(),
  planificacion_start timestamptz,
  ensamble1_start timestamptz,
  ensamble1_end timestamptz,
  ensamble2_start timestamptz,
  ensamble2_end timestamptz,
  horno_entry timestamptz,
  horno_exit timestamptz,
  almacen_entry timestamptz,
  delivered_at timestamptz,
  client_verdict text check (client_verdict in ('ok','tarde','no_entregado')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.oven_batches (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  line text not null check (line in ('A','B')),
  batch_number integer not null,
  status text not null default 'cargando' check (status in ('cargando','procesando','listo','liberado')),
  started_at timestamptz,
  ready_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  line text not null check (line in ('A','B')),
  score integer not null check (score in (0,1,2)),
  submitted_at timestamptz not null default now()
);

create index idx_orders_room_line on public.orders(room_id, line, sequence_number);
create index idx_players_room on public.players(room_id);
create index idx_batches_room_line on public.oven_batches(room_id, line);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.orders enable row level security;
alter table public.oven_batches enable row level security;
alter table public.nps_responses enable row level security;

create policy "proto_all_rooms" on public.rooms for all to anon, authenticated using (true) with check (true);
create policy "proto_all_players" on public.players for all to anon, authenticated using (true) with check (true);
create policy "proto_all_orders" on public.orders for all to anon, authenticated using (true) with check (true);
create policy "proto_all_batches" on public.oven_batches for all to anon, authenticated using (true) with check (true);
create policy "proto_all_nps" on public.nps_responses for all to anon, authenticated using (true) with check (true);

do $$ declare t text;
begin
  foreach t in array array['rooms','players','orders','oven_batches','nps_responses'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
