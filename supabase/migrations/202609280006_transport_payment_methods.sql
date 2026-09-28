-- Event-owned additional accounts inherit event RLS; payment destinations are immutable snapshots.
create function public.valid_payment_methods(methods jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare m jsonb; begin
 if methods is null or jsonb_typeof(methods)<>'array' then return false; end if;
 if jsonb_array_length(methods)>9 then return false; end if;
 for m in select value from jsonb_array_elements(methods) loop
 if jsonb_typeof(m)<>'object' or coalesce(length(trim(m->>'bank_name')),0) not between 1 and 100
 or coalesce(m->>'bank_account_number','') !~ '^[0-9]{5,30}$'
 or coalesce(length(trim(m->>'bank_account_holder')),0) not between 2 and 120 then return false; end if;
 end loop; return true; end $$;
alter table public.events add column additional_payment_methods jsonb not null default '[]' check(public.valid_payment_methods(additional_payment_methods));
alter table public.participants alter column stage1_submitted_at drop not null;
alter table public.upload_intents add column payment_method text check(length(payment_method)<=500);
alter table public.payments add column payment_method text check(length(payment_method)<=500);
create or replace function public.admin_action(p_event uuid,p_action text,p_data jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; result uuid; d date; g public.transport_groups; pid uuid; next_status public.event_status; begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if p_action='create' then insert into public.events(owner_id,name,slug,description,stage1_deadline) values(auth.uid(),p_data->>'name',p_data->>'slug',coalesce(p_data->>'description',''),nullif(p_data->>'stage1_deadline','')::timestamptz) returning id into result; return result; end if;
 select * into e from public.events where id=p_event and owner_id=auth.uid() for update;
 if e.id is null then raise exception 'Event tidak ditemukan'; end if;
 result:=e.id;
 if p_action='delete_event' then if p_data->>'confirmation' <> e.name then raise exception 'Nama konfirmasi tidak cocok'; end if; delete from public.events where id=e.id; return result; end if;
 if p_action='status' then
 next_status:=(p_data->>'status')::public.event_status;
 if abs(array_position(enum_range(null::public.event_status),e.status)-array_position(enum_range(null::public.event_status),next_status))<>1 then raise exception 'Pindahkan satu fase setiap kali'; end if;
 if next_status='STAGE_1_OPEN' and (not exists(select 1 from public.event_dates d join public.event_dates n on n.event_id=d.event_id and n.date=d.date+1 where d.event_id=e.id) or not exists(select 1 from public.villas where event_id=e.id and active)) then raise exception 'Tambahkan dua tanggal berurutan dan villa aktif terlebih dahulu'; end if;
 if next_status='STAGE_2_OPEN' and (not exists(select 1 from public.villas where id=e.final_villa_id and event_id=e.id and active) or not exists(select 1 from public.event_dates where event_id=e.id and date=e.final_date+1) or e.final_villa_id is null or e.final_date is null or e.cost_per_person is null or coalesce(e.bank_name,'')='' or coalesce(e.bank_account_number,'')='' or coalesce(e.bank_account_holder,'')='') then raise exception 'Lengkapi villa, tanggal, biaya, dan bank; peserta memilih kursi saat Stage 2'; end if;
 insert into public.event_phase_history(event_id,from_status,to_status,changed_by) values(e.id,e.status,next_status,auth.uid());
 update public.events set status=next_status, stage1_deadline=case when next_status='STAGE_1_OPEN' and stage1_deadline<now() then null else stage1_deadline end,updated_at=now() where id=e.id; return result; end if;
 if e.status in ('COMPLETED','ARCHIVED') then raise exception 'Event hanya dapat dibaca'; end if;
 if p_action='settings' then update public.events set name=p_data->>'name',slug=p_data->>'slug',description=p_data->>'description',stage1_deadline=nullif(p_data->>'stage1_deadline','')::timestamptz,show_participant_list=(p_data->>'show_participant_list')::boolean,show_transport_groups=(p_data->>'show_transport_groups')::boolean,updated_at=now() where id=e.id;
 elsif p_action='dates' then
 if e.status <> 'DRAFT' then raise exception 'Tanggal hanya dapat diubah saat draft'; end if;
 if exists(select 1 from public.event_dates d join public.participant_availability a on a.event_date_id=d.id where d.event_id=e.id and not (p_data->'dates' ? d.date::text)) then raise exception 'Tanggal yang sudah dijawab peserta tidak dapat dihapus'; end if;
 update public.events set final_date=null where id=e.id and not (p_data->'dates' ? final_date::text);
 delete from public.event_dates where event_id=e.id and not (p_data->'dates' ? date::text);
 for d in select value::date from jsonb_array_elements_text(p_data->'dates') loop insert into public.event_dates(event_id,date) values(e.id,d) on conflict(event_id,date) do nothing; end loop;
 elsif p_action in ('villa','delete_villa') then
 if e.status not in ('DRAFT','STAGE_1_OPEN','STAGE_1_CLOSED') then raise exception 'Villa sudah dikunci'; end if;
 if p_action='delete_villa' then delete from public.villas where event_id=e.id and id=(p_data->>'id')::uuid;
 else
 result:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from public.villas where id=result and event_id<>e.id) then raise exception 'Villa tidak ditemukan'; end if;
 insert into public.villas(id,event_id,name,description,price,capacity,address,google_maps_url,facilities,notes,active,sort_order) values(result,e.id,p_data->>'name',p_data->>'description',(p_data->>'price')::numeric,(p_data->>'capacity')::int,p_data->>'address',p_data->>'google_maps_url',array(select jsonb_array_elements_text(p_data->'facilities')),p_data->>'notes',(p_data->>'active')::boolean,(p_data->>'sort_order')::int)
 on conflict(id) do update set name=excluded.name,description=excluded.description,price=excluded.price,capacity=excluded.capacity,address=excluded.address,google_maps_url=excluded.google_maps_url,facilities=excluded.facilities,notes=excluded.notes,active=excluded.active,sort_order=excluded.sort_order,updated_at=now(); end if;
 elsif p_action in ('delete_image','cover_image') then
 if e.status not in ('DRAFT','STAGE_1_OPEN','STAGE_1_CLOSED') then raise exception 'Galeri sudah dikunci'; end if;
 if not exists(select 1 from public.villa_images where id=(p_data->>'id')::uuid and event_id=e.id) then raise exception 'Foto tidak ditemukan'; end if;
 if p_action='cover_image' then update public.villas v set cover_path=i.storage_path from public.villa_images i where i.id=(p_data->>'id')::uuid and i.event_id=e.id and v.id=i.villa_id;
 else update public.villas v set cover_path=null from public.villa_images i where i.id=(p_data->>'id')::uuid and i.event_id=e.id and v.id=i.villa_id and v.cover_path=i.storage_path;
 delete from public.villa_images where id=(p_data->>'id')::uuid and event_id=e.id; end if;
 elsif p_action='add_participant' then
 if e.status not in ('STAGE_1_CLOSED','STAGE_2_OPEN') then raise exception 'Peserta susulan hanya saat finalisasi atau Stage 2'; end if;
 insert into public.participants(event_id,name,whatsapp,vehicle_type,access_token_hash,stage1_submitted_at,vehicle_owner,vehicle_driver,vehicle_capacity)
 values(e.id,trim(p_data->>'name'),p_data->>'whatsapp',(p_data->>'vehicle_type')::public.vehicle_type,p_data->>'hash',null,
 case when p_data->>'vehicle_type'<>'NONE' then trim(p_data->>'name') end,
 case when p_data->>'vehicle_type'<>'NONE' then trim(p_data->>'name') end,
 case when p_data->>'vehicle_type'='CAR' then 5 when p_data->>'vehicle_type'='MOTORCYCLE' then 2 end) returning id into result;
 elsif p_action='payment_methods' then
 update public.events set additional_payment_methods=p_data->'methods',updated_at=now() where id=e.id;
 elsif p_action='billing' then
 if e.status not in ('DRAFT','STAGE_1_OPEN','STAGE_1_CLOSED','STAGE_2_OPEN') then raise exception 'Pengaturan pembayaran dikunci'; end if;
 update public.events set cost_per_person=(p_data->>'cost_per_person')::numeric,bank_name=p_data->>'bank_name',bank_account_number=p_data->>'bank_account_number',bank_account_holder=p_data->>'bank_account_holder',payment_note=coalesce(p_data->>'payment_note',''),stage2_deadline=nullif(p_data->>'stage2_deadline','')::timestamptz,updated_at=now() where id=e.id;
 elsif p_action='finalize' then
 if e.status<>'STAGE_1_CLOSED' then raise exception 'Tutup Stage 1 terlebih dahulu'; end if;
 if not exists(select 1 from public.event_dates where event_id=e.id and date=(p_data->>'final_date')::date+1) then raise exception 'Pilih dua tanggal berurutan untuk 2 hari 1 malam'; end if;
 if not exists(select 1 from public.villas where id=(p_data->>'final_villa_id')::uuid and event_id=e.id and active) then raise exception 'Villa tidak tersedia'; end if;
 update public.events set final_villa_id=(p_data->>'final_villa_id')::uuid,final_date=(p_data->>'final_date')::date,updated_at=now() where id=e.id;
 elsif p_action in ('group','delete_group','assign') then
 if e.status not in ('STAGE_1_CLOSED','STAGE_2_OPEN') then raise exception 'Transport dapat diatur saat finalisasi dan Stage 2'; end if;
 if p_action='group' then
 insert into public.transport_groups(event_id,type,label,owner_participant_id,driver_participant_id,capacity) values(e.id,(p_data->>'type')::public.transport_type,p_data->>'label',nullif(p_data->>'owner_participant_id','')::uuid,nullif(p_data->>'driver_participant_id','')::uuid,(p_data->>'capacity')::int) returning id into result;
 if nullif(p_data->>'driver_participant_id','') is not null then insert into public.transport_members(event_id,transport_group_id,participant_id,role) values(e.id,result,(p_data->>'driver_participant_id')::uuid,'DRIVER'); end if;
 elsif p_action='delete_group' then delete from public.transport_groups where id=(p_data->>'id')::uuid and event_id=e.id;
 else
 pid:=(p_data->>'participant_id')::uuid;
 if not exists(select 1 from public.participants where id=pid and event_id=e.id) then raise exception 'Peserta tidak ditemukan'; end if;
 if exists(select 1 from public.transport_members where participant_id=pid and role='DRIVER') then raise exception 'Hapus kendaraan terlebih dahulu untuk memindahkan driver'; end if;
 delete from public.transport_members where participant_id=pid;
 if nullif(p_data->>'group_id','') is not null then
 select * into g from public.transport_groups where id=(p_data->>'group_id')::uuid and event_id=e.id;
 if g.id is null then raise exception 'Kendaraan tidak ditemukan'; end if;
 if (select count(*) from public.transport_members where transport_group_id=g.id)>=g.capacity then raise exception 'Kendaraan sudah penuh'; end if;
 insert into public.transport_members(event_id,transport_group_id,participant_id,role) values(e.id,g.id,pid,'PASSENGER'); end if; end if;
 elsif p_action='rotate_token' then update public.participants set access_token_hash=p_data->>'hash' where event_id=e.id and id=(p_data->>'id')::uuid;
 elsif p_action='participant' then update public.participants set name=p_data->>'name',whatsapp=p_data->>'whatsapp',vehicle_type=(p_data->>'vehicle_type')::public.vehicle_type,vehicle_capacity=case when p_data->>'vehicle_type'='NONE' then null when p_data->>'vehicle_type'='MOTORCYCLE' then least(coalesce(vehicle_capacity,2),2) else coalesce(vehicle_capacity,5) end,vehicle_owner=case when p_data->>'vehicle_type'='NONE' then null else coalesce(vehicle_owner,p_data->>'name') end,vehicle_driver=case when p_data->>'vehicle_type'='NONE' then null else coalesce(vehicle_driver,p_data->>'name') end where event_id=e.id and id=(p_data->>'id')::uuid;
 elsif p_action='delete_participant' then delete from public.participants where event_id=e.id and id=(p_data->>'id')::uuid;
 elsif p_action='payment_review' then
 if e.status<>'STAGE_2_OPEN' then raise exception 'Stage 2 belum dibuka'; end if;
 if p_data->>'status' not in ('VERIFIED','REJECTED') then raise exception 'Status tidak valid'; end if;
 update public.payments set status=(p_data->>'status')::public.payment_status,admin_note=p_data->>'admin_note',verified_at=case when p_data->>'status'='VERIFIED' then now() else null end,updated_at=now() where event_id=e.id and id=(p_data->>'id')::uuid and status='PENDING';
 if not found then raise exception 'Pembayaran sudah diproses atau tidak ditemukan'; end if;
 else raise exception 'Aksi tidak dikenal'; end if;
 return result; end $$;

create or replace function public.commit_upload(p_intent uuid,p_hash text default null,p_villa uuid default null,p_owner uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare u public.upload_intents; e public.events; begin
 select * into u from public.upload_intents where id=p_intent;
 select * into e from public.events where id=u.event_id for update;
 select * into u from public.upload_intents where id=p_intent for update;
 if u.id is null or u.used or u.expires_at<now() then raise exception 'Upload kedaluwarsa atau sudah digunakan'; end if;
 if u.kind='payment' then
 if e.status<>'STAGE_2_OPEN' or e.stage2_deadline<now() then raise exception 'Pembayaran ditutup'; end if;
 if not exists(select 1 from public.participants where id=u.participant_id and event_id=e.id and access_token_hash=p_hash) then raise exception 'Sesi tidak valid'; end if;
 if u.payment_method is not null and not (
 u.payment_method=concat(e.bank_name,' · ',e.bank_account_number,' · ',e.bank_account_holder)
 or exists(select 1 from jsonb_array_elements(e.additional_payment_methods) m where u.payment_method=concat(m->>'bank_name',' · ',m->>'bank_account_number',' · ',m->>'bank_account_holder'))
 ) then raise exception 'Rekening berubah. Muat ulang dan periksa tujuan transfer'; end if;
 if u.amount is distinct from e.cost_per_person then raise exception 'Nominal berubah. Muat ulang halaman dan periksa tagihan sebelum mengunggah kembali'; end if;
 if exists(select 1 from public.payments where participant_id=u.participant_id and status in ('PENDING','VERIFIED')) then raise exception 'Pembayaran sudah diterima'; end if;
 insert into public.payments(event_id,participant_id,amount,proof_storage_path,payment_method) values(e.id,u.participant_id,e.cost_per_person,u.path,u.payment_method) on conflict(participant_id) do update set payment_method=excluded.payment_method,amount=excluded.amount,proof_storage_path=excluded.proof_storage_path,status='PENDING',admin_note=null,submitted_at=now(),updated_at=now(),verified_at=null;
 update public.participants set stage2_submitted_at=now() where id=u.participant_id;
 else
 if e.owner_id is distinct from p_owner or e.status not in ('DRAFT','STAGE_1_OPEN','STAGE_1_CLOSED') then raise exception 'Tidak diizinkan'; end if;
 if p_villa is null then update public.events set cover_path=u.path where id=e.id;
 else insert into public.villa_images(event_id,villa_id,storage_path) values(e.id,p_villa,u.path); update public.villas set cover_path=coalesce(cover_path,u.path) where id=p_villa and event_id=e.id; end if;
 end if;
 update public.upload_intents set used=true where id=u.id;
 end $$;


