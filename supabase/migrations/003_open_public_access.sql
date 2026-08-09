-- Open access: no user auth required. Anyone can read/write via anon or API.

-- malls / floors
drop policy if exists "malls_auth_write" on public.malls;
drop policy if exists "floors_auth_write" on public.floors;

create policy "malls_public_write" on public.malls
  for all using (true)
  with check (true);

create policy "floors_public_write" on public.floors
  for all using (true)
  with check (true);

-- zones / scene_objects
drop policy if exists "zones_auth_write" on public.zones;
drop policy if exists "scene_objects_auth_write" on public.scene_objects;

create policy "zones_public_write" on public.zones
  for all using (true)
  with check (true);

create policy "scene_objects_public_write" on public.scene_objects
  for all using (true)
  with check (true);

-- storage
drop policy if exists "floor_assets_auth_write" on storage.objects;

create policy "floor_assets_public_write" on storage.objects
  for all using (bucket_id = 'floor-assets')
  with check (bucket_id = 'floor-assets');
