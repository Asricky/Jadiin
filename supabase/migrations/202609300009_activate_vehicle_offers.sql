-- Stage 1 declarations are offers; Stage 2 seats still live only in groups/members.
-- Activate unambiguous self-owned/self-driven offers once, without moving anybody
-- who has already chosen another ride. Remember activation so deleted vehicles
-- are not unexpectedly recreated on phase changes.
alter table public.participants add column vehicle_offer_activated_at timestamptz;
update public.participants p set vehicle_offer_activated_at=now()
 where exists(select 1 from public.transport_groups g where g.type<>'INDEPENDENT' and g.owner_participant_id=p.id);

create function public.activate_vehicle_offers(p_event uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.participants; gid uuid; begin
 perform 1 from public.events where id=p_event and status='STAGE_2_OPEN' for update;
 if not found then return; end if;
 for p in select * from public.participants where event_id=p_event and vehicle_type<>'NONE' and vehicle_offer_activated_at is null order by created_at,id loop
   if lower(regexp_replace(trim(coalesce(nullif(p.vehicle_owner,''),p.name)),'\s+',' ','g'))<>p.normalized_name
     or lower(regexp_replace(trim(coalesce(nullif(p.vehicle_driver,''),p.name)),'\s+',' ','g'))<>p.normalized_name then continue; end if;
   if exists(select 1 from public.transport_members where participant_id=p.id)
     or exists(select 1 from public.transport_groups where type<>'INDEPENDENT' and (owner_participant_id=p.id or driver_participant_id=p.id)) then continue; end if;
   insert into public.transport_groups(event_id,type,label,capacity,owner_participant_id,driver_participant_id)
   values(p_event,p.vehicle_type::text::public.transport_type,
     case when p.vehicle_type='CAR' then 'Mobil ' else 'Motor ' end||p.name,
     coalesce(p.vehicle_capacity,case when p.vehicle_type='CAR' then 5 else 2 end),p.id,p.id) returning id into gid;
   insert into public.transport_members(event_id,transport_group_id,participant_id,role) values(p_event,gid,p.id,'DRIVER');
   update public.participants set vehicle_offer_activated_at=now() where id=p.id;
 end loop;
end $$;
revoke all on function public.activate_vehicle_offers(uuid) from public,anon,authenticated;

create function public.activate_event_vehicle_offers() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 perform public.activate_vehicle_offers(new.id); return new;
end $$;
create trigger activate_event_vehicle_offers after update of status on public.events
 for each row when(new.status='STAGE_2_OPEN' and old.status is distinct from new.status)
 execute function public.activate_event_vehicle_offers();

create function public.activate_participant_vehicle_offer() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 perform public.activate_vehicle_offers(new.event_id); return new;
end $$;
create trigger activate_participant_vehicle_offer after insert or update of vehicle_type,vehicle_owner,vehicle_driver,vehicle_capacity on public.participants
 for each row when(new.vehicle_type<>'NONE') execute function public.activate_participant_vehicle_offer();

create function public.remember_vehicle_activation() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.type<>'INDEPENDENT' then
   update public.participants set vehicle_offer_activated_at=coalesce(vehicle_offer_activated_at,now()) where id=new.owner_participant_id;
 end if;
 return new;
end $$;
create trigger remember_vehicle_activation after insert on public.transport_groups
 for each row execute function public.remember_vehicle_activation();
revoke all on function public.activate_event_vehicle_offers(),public.activate_participant_vehicle_offer(),public.remember_vehicle_activation() from public,anon,authenticated;

-- Existing published events receive the same safe activation as newly published ones.
do $$ declare e record; begin
 for e in select id from public.events where status='STAGE_2_OPEN' loop
   perform public.activate_vehicle_offers(e.id);
 end loop;
end $$;
