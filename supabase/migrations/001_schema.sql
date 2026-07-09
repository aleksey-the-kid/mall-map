-- malls
create table if not exists public.malls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  created_at timestamptz not null default now()
);

-- floors
create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  status text not null default 'empty'
    check (status in ('empty', 'processing', 'ready', 'error')),
  plan_image_path text,
  glb_path text,
  floor_json jsonb,
  footprint_height float not null default 2.4,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists floors_mall_id_idx on public.floors(mall_id);

-- storage bucket for plan images and GLB files
insert into storage.buckets (id, name, public)
values ('floor-assets', 'floor-assets', true)
on conflict (id) do nothing;

-- RLS
alter table public.malls enable row level security;
alter table public.floors enable row level security;

-- Public read access
create policy "malls_public_read" on public.malls
  for select using (true);

create policy "floors_public_read" on public.floors
  for select using (true);

-- Authenticated users can manage malls and floors
create policy "malls_auth_write" on public.malls
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "floors_auth_write" on public.floors
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Storage: public read
create policy "floor_assets_public_read" on storage.objects
  for select using (bucket_id = 'floor-assets');

-- Storage: authenticated write
create policy "floor_assets_auth_write" on storage.objects
  for all using (bucket_id = 'floor-assets' and auth.role() = 'authenticated')
  with check (bucket_id = 'floor-assets' and auth.role() = 'authenticated');
