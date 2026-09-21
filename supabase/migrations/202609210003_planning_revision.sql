-- Preserve existing responses and payment history when moving between phases.
alter table public.participants add column vehicle_owner text check(length(vehicle_owner)<=80), add column vehicle_driver text check(length(vehicle_driver)<=80), add column vehicle_capacity int check(vehicle_capacity between 1 and 50);
alter table public.participants add constraint motorcycle_seats check(vehicle_type<>'MOTORCYCLE' or vehicle_capacity<=2);
update public.participants set vehicle_owner=name,vehicle_driver=name,vehicle_capacity=case when vehicle_type='MOTORCYCLE' then 2 else 5 end where vehicle_type<>'NONE';
alter table public.events add column final_end_date date generated always as (final_date+1) stored;
create table public.event_phase_history(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events on delete cascade,from_status public.event_status not null,to_status public.event_status not null,changed_by uuid not null references public.profiles,created_at timestamptz not null default now());
create index phase_history_event on public.event_phase_history(event_id,created_at);
alter table public.event_phase_history enable row level security;
create policy phase_owner_read on public.event_phase_history for select to authenticated using(public.owns_event(event_id));
revoke all on public.event_phase_history from anon,authenticated;
grant select on public.event_phase_history to authenticated;

create or replace function public.submit_stage1(p_event uuid,p_hash text,p_existing_hash text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; pid uuid; d uuid; begin
 select * into e from public.events where id=p_event for update;
 if e.status is distinct from 'STAGE_1_OPEN' or e.stage1_deadline<now() then raise exception 'Pendaftaran sudah ditutup'; end if;
 if p_existing_hash is not null then select id into pid from public.participants where event_id=p_event and access_token_hash=p_existing_hash; if pid is null then raise exception 'Sesi tidak valid'; end if; end if;
 if not exists(select 1 from public.villas where id=(p_data->>'villa_id')::uuid and event_id=p_event and active) then raise exception 'Villa tidak tersedia'; end if;
 if pid is null then insert into public.participants(event_id,name,whatsapp,vehicle_type,access_token_hash) values(p_event,trim(p_data->>'name'),p_data->>'whatsapp',(p_data->>'vehicle_type')::public.vehicle_type,p_hash) returning id into pid;
 else update public.participants set name=trim(p_data->>'name'),whatsapp=p_data->>'whatsapp',vehicle_type=(p_data->>'vehicle_type')::public.vehicle_type,vehicle_capacity=null,updated_at=now() where id=pid; end if;
 delete from public.participant_availability where participant_id=pid;
 for d in select value::uuid from jsonb_array_elements_text(p_data->'dates') loop insert into public.participant_availability values(p_event,pid,d); end loop;
 insert into public.villa_votes values(p_event,pid,(p_data->>'villa_id')::uuid) on conflict(participant_id) do update set villa_id=excluded.villa_id;
 update public.participants set
 vehicle_owner=case when vehicle_type='NONE' then null else coalesce(nullif(trim(p_data->>'vehicle_owner'),''),name) end,
 vehicle_driver=case when vehicle_type='NONE' then null else coalesce(nullif(trim(p_data->>'vehicle_driver'),''),name) end,
 vehicle_capacity=case when vehicle_type='NONE' then null else coalesce((p_data->>'vehicle_capacity')::int,case when vehicle_type='MOTORCYCLE' then 2 else 5 end) end
 where id=pid;
 return pid; end $$;


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
 if next_status='STAGE_2_OPEN' and (not exists(select 1 from public.villas where id=e.final_villa_id and event_id=e.id and active) or not exists(select 1 from public.event_dates where event_id=e.id and date=e.final_date+1) or e.final_villa_id is null or e.final_date is null or e.cost_per_person is null or coalesce(e.bank_name,'')='' or coalesce(e.bank_account_number,'')='' or coalesce(e.bank_account_holder,'')='' or exists(select 1 from public.participants p where p.event_id=e.id and not exists(select 1 from public.transport_members m where m.participant_id=p.id))) then raise exception 'Lengkapi villa, tanggal, transport semua peserta, biaya, dan bank'; end if;
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
 elsif p_action='finalize' then
 if e.status<>'STAGE_1_CLOSED' then raise exception 'Tutup Stage 1 terlebih dahulu'; end if;
 if not exists(select 1 from public.event_dates where event_id=e.id and date=(p_data->>'final_date')::date+1) then raise exception 'Pilih dua tanggal berurutan untuk 2 hari 1 malam'; end if;
 if exists(select 1 from public.payments where event_id=e.id) and (p_data->>'cost_per_person')::numeric is distinct from e.cost_per_person then raise exception 'Biaya tidak dapat diubah setelah ada pembayaran'; end if;
 if not exists(select 1 from public.villas where id=(p_data->>'final_villa_id')::uuid and event_id=e.id and active) then raise exception 'Villa tidak tersedia'; end if;
 update public.events set final_villa_id=(p_data->>'final_villa_id')::uuid,final_date=(p_data->>'final_date')::date,cost_per_person=(p_data->>'cost_per_person')::numeric,bank_name=p_data->>'bank_name',bank_account_number=p_data->>'bank_account_number',bank_account_holder=p_data->>'bank_account_holder',payment_note=p_data->>'payment_note',stage2_deadline=nullif(p_data->>'stage2_deadline','')::timestamptz where id=e.id;
 elsif p_action in ('group','delete_group','assign') then
 if e.status<>'STAGE_1_CLOSED' then raise exception 'Transport hanya dapat disusun setelah Stage 1 ditutup'; end if;
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
