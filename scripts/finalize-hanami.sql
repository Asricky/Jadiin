-- Apply once to the existing Final Makrab 02 event, preserving votes and payments.
begin;
do $$
declare
  v_event uuid;
  v_villa uuid;
begin
  select id into v_event from public.events
  where id = 'b11488ee-937b-4275-aa25-e8793a4ec047' and slug = 'final-makrab-02'
  for update;
  if v_event is null then raise exception 'Final Makrab 02 tidak ditemukan'; end if;

  select id into v_villa from public.villas
  where villas.event_id = v_event and name = 'Hanami Castle Villa';
  if v_villa is null then
    insert into public.villas (event_id, name, description, address, google_maps_url, facilities, cover_path, notes)
    values (v_event, 'Hanami Castle Villa', 'Villa bergaya Jepang untuk makrab 2 hari 1 malam.',
      'Jl. Lapangan Pop No.10, RT.01/RW.01, Sukajaya, Kec. Lembang, Bandung, Jawa Barat 40391',
      'https://maps.app.goo.gl/emo1iqoHJs9K91pW7',
      array['Kolam renang', 'Proyektor', 'Area bersantai'],
      '/villas/hanami/pool-projector.jpg',
      'Harga sewa dan kapasitas belum dikonfirmasi. Foto preview bersumber dari halaman Google Maps villa.')
    returning id into v_villa;
  end if;
  insert into public.villa_images (event_id, villa_id, storage_path)
  select v_event, v_villa, path
  from unnest(array['/villas/hanami/pool-projector.jpg', '/villas/hanami/bedroom.jpg', '/villas/hanami/entrance.jpg', '/villas/hanami/pool.jpg']) as path
  where not exists (select 1 from public.villa_images i where i.villa_id = v_villa and i.storage_path = path);

  insert into public.event_dates (event_id, date)
  values (v_event, '2026-09-09'), (v_event, '2026-09-10')
  on conflict (event_id, date) do nothing;
  update public.events set final_villa_id = v_villa, recommended_villa_id = v_villa,
    final_date = '2026-09-09', show_transport_groups = false, updated_at = now()
  where id = v_event;
end $$;
commit;
