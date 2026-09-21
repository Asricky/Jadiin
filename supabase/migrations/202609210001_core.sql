create type public.event_status as enum ('DRAFT','STAGE_1_OPEN','STAGE_1_CLOSED','STAGE_2_OPEN','COMPLETED','ARCHIVED');
create type public.vehicle_type as enum ('CAR','MOTORCYCLE','NONE');
create type public.transport_type as enum ('CAR','MOTORCYCLE','INDEPENDENT');
create type public.member_role as enum ('DRIVER','PASSENGER');
create type public.payment_status as enum ('PENDING','VERIFIED','REJECTED');

create table public.profiles (id uuid primary key references auth.users on delete cascade, display_name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create function public.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Organizer')); return new; end $$;
create trigger signup after insert on auth.users for each row execute function public.on_signup();
create table public.events (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), name text not null check(length(name) between 3 and 120), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text not null default '', cover_path text,
 status public.event_status not null default 'DRAFT', stage1_deadline timestamptz, stage2_deadline timestamptz, final_villa_id uuid, final_date date,
 cost_per_person numeric(12,2) check(cost_per_person >= 0), bank_name text, bank_account_number text, bank_account_holder text, payment_note text,
 show_transport_groups boolean not null default true, show_participant_list boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index events_owner on public.events(owner_id,status);
create table public.event_dates(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, date date not null, unique(event_id,date), unique(event_id,id));
create table public.villas(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, name text not null, description text not null default '', price numeric(12,2) not null default 0 check(price>=0), capacity int not null default 1 check(capacity>0), address text not null default '', google_maps_url text not null default '', facilities text[] not null default '{}', notes text not null default '', cover_path text, active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_id,id));
alter table public.events add constraint final_villa_same_event foreign key(id,final_villa_id) references public.villas(event_id,id) deferrable initially deferred;
alter table public.events add constraint final_date_in_event foreign key(id,final_date) references public.event_dates(event_id,date) deferrable initially deferred;
create table public.villa_images(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, villa_id uuid not null, storage_path text not null, sort_order int not null default 0, foreign key(event_id,villa_id) references public.villas(event_id,id) on delete cascade);
create table public.participants(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, name text not null check(length(name) between 2 and 80), normalized_name text generated always as (lower(regexp_replace(trim(name),'\s+',' ','g'))) stored, whatsapp text not null check(whatsapp ~ '^628[0-9]{7,12}$'), vehicle_type public.vehicle_type not null, access_token_hash text not null unique check(length(access_token_hash)=64), stage1_submitted_at timestamptz not null default now(), stage2_submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_id,normalized_name), unique(event_id,id));
create table public.participant_availability(event_id uuid not null, participant_id uuid not null, event_date_id uuid not null, primary key(participant_id,event_date_id), foreign key(event_id,participant_id) references public.participants(event_id,id) on delete cascade, foreign key(event_id,event_date_id) references public.event_dates(event_id,id) on delete cascade);
create index availability_date on public.participant_availability(event_id,event_date_id);
create table public.villa_votes(event_id uuid not null, participant_id uuid primary key, villa_id uuid not null, foreign key(event_id,participant_id) references public.participants(event_id,id) on delete cascade, foreign key(event_id,villa_id) references public.villas(event_id,id));
create index votes_villa on public.villa_votes(event_id,villa_id);
create table public.transport_groups(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, type public.transport_type not null, label text not null, owner_participant_id uuid, driver_participant_id uuid, capacity int not null check(capacity between 1 and 50), sort_order int not null default 0, unique(event_id,id), foreign key(event_id,owner_participant_id) references public.participants(event_id,id), foreign key(event_id,driver_participant_id) references public.participants(event_id,id), check(type <> 'MOTORCYCLE' or capacity<=2), check(type <> 'INDEPENDENT' or capacity=1), check(type='INDEPENDENT' or driver_participant_id is not null), unique(driver_participant_id));
create table public.transport_members(id uuid primary key default gen_random_uuid(), event_id uuid not null, transport_group_id uuid not null, participant_id uuid not null unique, role public.member_role not null, seat_order int not null default 0, foreign key(event_id,transport_group_id) references public.transport_groups(event_id,id) on delete cascade, foreign key(event_id,participant_id) references public.participants(event_id,id) on delete cascade);
create index transport_members_group on public.transport_members(transport_group_id);
create table public.upload_intents(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, participant_id uuid, path text not null unique, mime text not null check(mime in ('image/jpeg','image/png','image/webp')), size int not null check(size between 1 and 5242880), kind text not null check(kind in ('payment','media')), expires_at timestamptz not null default now()+interval '10 minutes', used boolean not null default false, foreign key(event_id,participant_id) references public.participants(event_id,id) on delete cascade);
create table public.payments(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, participant_id uuid not null unique, amount numeric(12,2) not null check(amount>=0), proof_storage_path text not null unique, status public.payment_status not null default 'PENDING', admin_note text, submitted_at timestamptz not null default now(), verified_at timestamptz, updated_at timestamptz not null default now(), foreign key(event_id,participant_id) references public.participants(event_id,id) on delete cascade);
create index payments_event_status on public.payments(event_id,status);
create table public.rate_limits(key text primary key, window_start timestamptz not null default now(), hits int not null default 1);

create function public.owns_event(eid uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.events where id=eid and owner_id=auth.uid()) $$;
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
alter table public.events enable row level security;
create policy own_events on public.events for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
do $$ declare t text; begin foreach t in array array['event_dates','villas','villa_images','participants','participant_availability','villa_votes','transport_groups','transport_members','payments','upload_intents'] loop execute format('alter table public.%I enable row level security',t); execute format('create policy owner_access on public.%I for all to authenticated using(public.owns_event(event_id)) with check(public.owns_event(event_id))',t); end loop; end $$;
alter table public.rate_limits enable row level security;
-- Mutations go through the transactional RPCs, including for authenticated users.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.events,public.event_dates,public.villas,public.villa_images,public.participants,public.participant_availability,public.villa_votes,public.transport_groups,public.transport_members,public.payments to authenticated;

create function public.check_rate(p_key text, p_limit int default 30) returns boolean language plpgsql security definer set search_path='' as $$ declare n int; begin
 insert into public.rate_limits(key) values(p_key) on conflict(key) do update set hits=case when public.rate_limits.window_start<now()-interval '1 minute' then 1 else public.rate_limits.hits+1 end, window_start=case when public.rate_limits.window_start<now()-interval '1 minute' then now() else public.rate_limits.window_start end returning hits into n; return n<=p_limit; end $$;

create function public.submit_stage1(p_event uuid,p_hash text,p_existing_hash text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; pid uuid; d uuid; begin
 select * into e from public.events where id=p_event for update;
 if e.status is distinct from 'STAGE_1_OPEN' or e.stage1_deadline<now() then raise exception 'Pendaftaran sudah ditutup'; end if;
 if p_existing_hash is not null then select id into pid from public.participants where event_id=p_event and access_token_hash=p_existing_hash; if pid is null then raise exception 'Sesi tidak valid'; end if; end if;
 if not exists(select 1 from public.villas where id=(p_data->>'villa_id')::uuid and event_id=p_event and active) then raise exception 'Villa tidak tersedia'; end if;
 if pid is null then insert into public.participants(event_id,name,whatsapp,vehicle_type,access_token_hash) values(p_event,trim(p_data->>'name'),p_data->>'whatsapp',(p_data->>'vehicle_type')::public.vehicle_type,p_hash) returning id into pid;
 else update public.participants set name=trim(p_data->>'name'),whatsapp=p_data->>'whatsapp',vehicle_type=(p_data->>'vehicle_type')::public.vehicle_type,updated_at=now() where id=pid; end if;
 delete from public.participant_availability where participant_id=pid;
 for d in select value::uuid from jsonb_array_elements_text(p_data->'dates') loop insert into public.participant_availability values(p_event,pid,d); end loop;
 insert into public.villa_votes values(p_event,pid,(p_data->>'villa_id')::uuid) on conflict(participant_id) do update set villa_id=excluded.villa_id;
 return pid; end $$;

create function public.admin_action(p_event uuid,p_action text,p_data jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; result uuid; d date; g public.transport_groups; pid uuid; next_status public.event_status; begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if p_action='create' then insert into public.events(owner_id,name,slug,description,stage1_deadline) values(auth.uid(),p_data->>'name',p_data->>'slug',coalesce(p_data->>'description',''),nullif(p_data->>'stage1_deadline','')::timestamptz) returning id into result; return result; end if;
 select * into e from public.events where id=p_event and owner_id=auth.uid() for update;
 if e.id is null then raise exception 'Event tidak ditemukan'; end if;
 result:=e.id;
 if p_action='delete_event' then if p_data->>'confirmation' <> e.name then raise exception 'Nama konfirmasi tidak cocok'; end if; delete from public.events where id=e.id; return result; end if;
 if p_action='status' then
 next_status:=(p_data->>'status')::public.event_status;
 if not ((e.status='DRAFT' and next_status='STAGE_1_OPEN') or (e.status='STAGE_1_OPEN' and next_status='STAGE_1_CLOSED') or (e.status='STAGE_1_CLOSED' and next_status in ('STAGE_1_OPEN','STAGE_2_OPEN')) or (e.status='STAGE_2_OPEN' and next_status='COMPLETED') or (e.status='COMPLETED' and next_status in ('ARCHIVED','STAGE_2_OPEN'))) then raise exception 'Perubahan status tidak diizinkan'; end if;
 if next_status='STAGE_1_OPEN' and (not exists(select 1 from public.event_dates where event_id=e.id) or not exists(select 1 from public.villas where event_id=e.id and active)) then raise exception 'Tambahkan tanggal dan villa aktif terlebih dahulu'; end if;
 if next_status='STAGE_2_OPEN' and (e.final_villa_id is null or e.final_date is null or e.cost_per_person is null or coalesce(e.bank_name,'')='' or coalesce(e.bank_account_number,'')='' or coalesce(e.bank_account_holder,'')='' or exists(select 1 from public.participants p where p.event_id=e.id and not exists(select 1 from public.transport_members m where m.participant_id=p.id))) then raise exception 'Lengkapi villa, tanggal, transport semua peserta, biaya, dan bank'; end if;
 update public.events set status=next_status,updated_at=now() where id=e.id; return result; end if;
 if e.status in ('COMPLETED','ARCHIVED') then raise exception 'Event hanya dapat dibaca'; end if;
 if p_action='settings' then update public.events set name=p_data->>'name',slug=p_data->>'slug',description=p_data->>'description',stage1_deadline=nullif(p_data->>'stage1_deadline','')::timestamptz,show_participant_list=(p_data->>'show_participant_list')::boolean,show_transport_groups=(p_data->>'show_transport_groups')::boolean,updated_at=now() where id=e.id;
 elsif p_action='dates' then
 if e.status <> 'DRAFT' then raise exception 'Tanggal hanya dapat diubah saat draft'; end if;
 delete from public.event_dates where event_id=e.id;
 for d in select value::date from jsonb_array_elements_text(p_data->'dates') loop insert into public.event_dates(event_id,date) values(e.id,d); end loop;
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
 elsif p_action='participant' then update public.participants set name=p_data->>'name',whatsapp=p_data->>'whatsapp',vehicle_type=(p_data->>'vehicle_type')::public.vehicle_type where event_id=e.id and id=(p_data->>'id')::uuid;
 elsif p_action='delete_participant' then delete from public.participants where event_id=e.id and id=(p_data->>'id')::uuid;
 elsif p_action='payment_review' then
 if e.status<>'STAGE_2_OPEN' then raise exception 'Stage 2 belum dibuka'; end if;
 if p_data->>'status' not in ('VERIFIED','REJECTED') then raise exception 'Status tidak valid'; end if;
 update public.payments set status=(p_data->>'status')::public.payment_status,admin_note=p_data->>'admin_note',verified_at=case when p_data->>'status'='VERIFIED' then now() else null end,updated_at=now() where event_id=e.id and id=(p_data->>'id')::uuid and status='PENDING';
 if not found then raise exception 'Pembayaran sudah diproses atau tidak ditemukan'; end if;
 else raise exception 'Aksi tidak dikenal'; end if;
 return result; end $$;

create function public.commit_upload(p_intent uuid,p_hash text default null,p_villa uuid default null,p_owner uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare u public.upload_intents; e public.events; begin
 select * into u from public.upload_intents where id=p_intent;
 select * into e from public.events where id=u.event_id for update;
 select * into u from public.upload_intents where id=p_intent for update;
 if u.id is null or u.used or u.expires_at<now() then raise exception 'Upload kedaluwarsa atau sudah digunakan'; end if;
 if u.kind='payment' then
 if e.status<>'STAGE_2_OPEN' or e.stage2_deadline<now() then raise exception 'Pembayaran ditutup'; end if;
 if not exists(select 1 from public.participants where id=u.participant_id and event_id=e.id and access_token_hash=p_hash) then raise exception 'Sesi tidak valid'; end if;
 if exists(select 1 from public.payments where participant_id=u.participant_id and status in ('PENDING','VERIFIED')) then raise exception 'Pembayaran sudah diterima'; end if;
 insert into public.payments(event_id,participant_id,amount,proof_storage_path) values(e.id,u.participant_id,e.cost_per_person,u.path) on conflict(participant_id) do update set proof_storage_path=excluded.proof_storage_path,status='PENDING',admin_note=null,submitted_at=now(),updated_at=now(),verified_at=null;
 update public.participants set stage2_submitted_at=now() where id=u.participant_id;
 else
 if e.owner_id is distinct from p_owner or e.status not in ('DRAFT','STAGE_1_OPEN','STAGE_1_CLOSED') then raise exception 'Tidak diizinkan'; end if;
 if p_villa is null then update public.events set cover_path=u.path where id=e.id;
 else insert into public.villa_images(event_id,villa_id,storage_path) values(e.id,p_villa,u.path); update public.villas set cover_path=coalesce(cover_path,u.path) where id=p_villa and event_id=e.id; end if;
 end if;
 update public.upload_intents set used=true where id=u.id;
 end $$;

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.owns_event(uuid),public.admin_action(uuid,text,jsonb) to authenticated;
grant execute on all functions in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('villa-media','villa-media',true,5242880,array['image/jpeg','image/png','image/webp']),('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy media_read on storage.objects for select to anon,authenticated using(bucket_id='villa-media');
create policy owner_proof_read on storage.objects for select to authenticated using(bucket_id='payment-proofs' and exists(select 1 from public.events e where e.id::text=(storage.foldername(name))[1] and e.owner_id=auth.uid()));
-- Writes use a server-authorized signed upload only. No anonymous or general authenticated writes.
