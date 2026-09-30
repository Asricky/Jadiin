-- One curated recommendation per event, separate from votes and the final booking.
alter table public.events add column recommended_villa_id uuid;
alter table public.events add constraint recommended_villa_same_event
 foreign key(id,recommended_villa_id) references public.villas(event_id,id)
 on delete set null (recommended_villa_id);
create function public.recommend_villa(p_event uuid,p_villa uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.events; begin
 select * into e from public.events where id=p_event and owner_id=auth.uid() for update;
 if e.id is null then raise exception 'Event tidak ditemukan'; end if;
 if e.status in ('COMPLETED','ARCHIVED') then raise exception 'Event hanya dapat dibaca'; end if;
 if p_villa is not null and not exists(select 1 from public.villas where event_id=e.id and id=p_villa and active) then raise exception 'Pilih villa aktif dari acara ini'; end if;
 update public.events set recommended_villa_id=p_villa,updated_at=now() where id=e.id;
 return e.id;
end $$;
revoke all on function public.recommend_villa(uuid,uuid) from public,anon;
grant execute on function public.recommend_villa(uuid,uuid) to authenticated;
create function public.clear_inactive_recommendation() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 update public.events set recommended_villa_id=null where id=new.event_id and recommended_villa_id=new.id;
 return new;
end $$;
revoke all on function public.clear_inactive_recommendation() from public,anon,authenticated;
create trigger clear_inactive_recommendation after update of active on public.villas
 for each row when (not new.active) execute function public.clear_inactive_recommendation();
