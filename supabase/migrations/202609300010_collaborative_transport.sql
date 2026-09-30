-- Event-scoped collaboration: a valid participant may assign other passengers.
-- The event row lock serializes capacity checks and preserves reserved seats.
create function public.assign_transport(p_event uuid,p_hash text,p_group uuid default null,p_independent boolean default false,p_participant uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.events; p public.participants; g public.transport_groups; current_group uuid; target uuid;
begin
 select * into e from public.events where id=p_event for update;
 if e.status is distinct from 'STAGE_2_OPEN' then raise exception 'Pemilihan transport sudah ditutup'; end if;
 select * into p from public.participants where event_id=e.id and access_token_hash=p_hash;
 if p.id is null then raise exception 'Sesi tidak valid'; end if;
 if p_participant is not null then
 select * into p from public.participants where event_id=e.id and id=p_participant;
 if p.id is null then raise exception 'Peserta tidak tersedia untuk acara ini'; end if;
 end if;
 select transport_group_id into current_group from public.transport_members where participant_id=p.id;
 if exists(select 1 from public.transport_groups where event_id=e.id and type<>'INDEPENDENT' and p.id in (owner_participant_id,driver_participant_id)) then raise exception 'Driver tetap di kendaraannya. Hubungi organizer untuk mengganti driver'; end if;
 if p_independent then
 select id into target from public.transport_groups where event_id=e.id and type='INDEPENDENT' and owner_participant_id=p.id and not exists(select 1 from public.transport_members m where m.transport_group_id=transport_groups.id and m.participant_id<>p.id) limit 1;
 if target is null then insert into public.transport_groups(event_id,type,label,capacity,owner_participant_id) values(e.id,'INDEPENDENT','Mandiri '||p.name,1,p.id) returning id into target; end if;
 else target:=p_group; end if;
 if target is not null then
 select * into g from public.transport_groups where id=target and event_id=e.id for update;
 if g.id is null then raise exception 'Kendaraan tidak tersedia untuk acara ini'; end if;
 if g.type='INDEPENDENT' and g.owner_participant_id is distinct from p.id then raise exception 'Transport mandiri khusus untuk pemiliknya'; end if;
 if target=current_group then return target; end if;
 if (select count(*) from public.transport_members where transport_group_id=g.id)>=g.capacity then raise exception 'Kursi baru saja diambil peserta lain. Pilih kendaraan lain'; end if;
 end if;
 delete from public.transport_members where participant_id=p.id and event_id=e.id;
 if target is not null then insert into public.transport_members(event_id,transport_group_id,participant_id,role) values(e.id,target,p.id,'PASSENGER'); end if;
 return target;
end $$;
revoke all on function public.assign_transport(uuid,text,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.assign_transport(uuid,text,uuid,boolean,uuid) to service_role;
