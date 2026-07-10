-- Normalized zones and scene objects for vector search indexing

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  external_id text not null,
  name text not null default '',
  category text not null default 'shop',
  description text not null default '',
  tags text[] not null default '{}',
  geometry jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (floor_id, external_id)
);

create index if not exists zones_floor_id_idx on public.zones(floor_id);

create table if not exists public.scene_objects (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  external_id text not null,
  asset_id text not null,
  position jsonb not null default '[0, 0]',
  name text not null default '',
  category text not null default 'poi',
  description text not null default '',
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (floor_id, external_id)
);

create index if not exists scene_objects_floor_id_idx on public.scene_objects(floor_id);

alter table public.zones enable row level security;
alter table public.scene_objects enable row level security;

create policy "zones_public_read" on public.zones
  for select using (true);

create policy "scene_objects_public_read" on public.scene_objects
  for select using (true);

create policy "zones_auth_write" on public.zones
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "scene_objects_auth_write" on public.scene_objects
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Backfill from existing floor_json
insert into public.zones (floor_id, external_id, name, category, description, tags, geometry)
select
  f.id,
  z->>'id',
  coalesce(z->>'name', ''),
  coalesce(z->>'category', 'shop'),
  coalesce(z->>'description', ''),
  coalesce(
    (select array_agg(value) from jsonb_array_elements_text(z->'tags')),
    '{}'::text[]
  ),
  z - 'id' - 'name' - 'category' - 'description' - 'tags'
from public.floors f
cross join lateral jsonb_array_elements(coalesce(f.floor_json->'zones', '[]'::jsonb)) as z
where f.floor_json is not null
on conflict (floor_id, external_id) do nothing;

insert into public.scene_objects (
  floor_id, external_id, asset_id, position, name, category, description, tags
)
select
  f.id,
  o->>'id',
  coalesce(o->>'assetId', ''),
  coalesce(o->'position', '[0, 0]'::jsonb),
  coalesce(o->>'name', ''),
  coalesce(o->>'category', 'poi'),
  coalesce(o->>'description', ''),
  coalesce(
    (select array_agg(value) from jsonb_array_elements_text(o->'tags')),
    '{}'::text[]
  )
from public.floors f
cross join lateral jsonb_array_elements(coalesce(f.floor_json->'objects', '[]'::jsonb)) as o
where f.floor_json is not null
  and o->>'id' is not null
on conflict (floor_id, external_id) do nothing;
