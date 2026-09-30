-- Keep the existing groups/members as the only source of truth. Owners reserve
-- an actual seat, including when somebody else drives their vehicle.
create unique index transport_one_owned_vehicle on public.transport_groups(owner_participant_id)
 where type <> 'INDEPENDENT' and owner_participant_id is not null;

create function public.guard_transport_seat() returns trigger
language plpgsql security definer set search_path='' as $$
declare g public.transport_groups; begin
 perform 1 from public.events where id=new.event_id for update;
 if tg_op='UPDATE' and (new.transport_group_id<>old.transport_group_id or new.participant_id<>old.participant_id) and exists(
   select 1 from public.transport_groups where id=old.transport_group_id and type<>'INDEPENDENT' and old.participant_id in (owner_participant_id,driver_participant_id)
 ) then raise exception 'Pemilik dan driver tetap di kendaraannya'; end if;
 select * into g from public.transport_groups where id=new.transport_group_id and event_id=new.event_id for update;
 if g.id is null then raise exception 'Kendaraan tidak ditemukan'; end if;
 if (select count(*) from public.transport_members where transport_group_id=g.id and id<>new.id)>=g.capacity then
   raise exception 'Kendaraan sudah penuh';
 end if;
 return new;
end $$;
create trigger guard_transport_seat before insert or update on public.transport_members
 for each row execute function public.guard_transport_seat();

create function public.reserve_vehicle_owner() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.type<>'INDEPENDENT' and new.owner_participant_id is not null and new.owner_participant_id is distinct from new.driver_participant_id then
   if new.capacity<2 then raise exception 'Pemilik dan driver yang berbeda membutuhkan minimal dua kursi'; end if;
   if exists(select 1 from public.transport_members where participant_id=new.owner_participant_id) then
     raise exception 'Pemilik sudah berada di transport lain. Lepaskan pilihannya sebelum menambahkan kendaraan';
   end if;
   insert into public.transport_members(event_id,transport_group_id,participant_id,role)
   values(new.event_id,new.id,new.owner_participant_id,'PASSENGER');
 end if;
 -- The existing admin_action inserts the driver, who can also be the owner.
 return new;
end $$;
create trigger reserve_vehicle_owner after insert on public.transport_groups
 for each row execute function public.reserve_vehicle_owner();

-- Abort rather than displace an existing passenger if legacy data conflicts.
insert into public.transport_members(event_id,transport_group_id,participant_id,role)
 select g.event_id,g.id,g.owner_participant_id,
 case when g.owner_participant_id=g.driver_participant_id then 'DRIVER'::public.member_role else 'PASSENGER'::public.member_role end
 from public.transport_groups g where g.type<>'INDEPENDENT' and g.owner_participant_id is not null
 and not exists(select 1 from public.transport_members m where m.transport_group_id=g.id and m.participant_id=g.owner_participant_id);

create function public.keep_reserved_vehicle_seat() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.transport_groups g join public.events e on e.id=g.event_id
   where g.id=old.transport_group_id and g.type<>'INDEPENDENT'
   and old.participant_id in (g.owner_participant_id,g.driver_participant_id)) then
   raise exception 'Pemilik dan driver tetap di kendaraannya. Hapus kendaraan terlebih dahulu untuk mengubahnya';
 end if;
 return old;
end $$;
create trigger keep_reserved_vehicle_seat before delete on public.transport_members
 for each row execute function public.keep_reserved_vehicle_seat();
revoke all on function public.guard_transport_seat(),public.reserve_vehicle_owner(),public.keep_reserved_vehicle_seat() from public,anon,authenticated;
