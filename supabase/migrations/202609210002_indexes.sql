create index villa_images_event on public.villa_images(event_id);
create index villa_images_villa on public.villa_images(villa_id);
create index transport_members_event on public.transport_members(event_id);
create index upload_intents_event on public.upload_intents(event_id);
create index upload_intents_expiration on public.upload_intents(expires_at) where not used;
create index rate_limits_window on public.rate_limits(window_start);
create index transport_groups_owner on public.transport_groups(owner_participant_id);
create index transport_groups_event_driver on public.transport_groups(event_id,driver_participant_id);
create index events_final_villa on public.events(final_villa_id);
-- Keep usage counters bounded without a Vercel background worker.
create or replace function public.check_rate(p_key text,p_limit int default 30) returns boolean language plpgsql security definer set search_path='' as $$
declare n int; begin
 delete from public.rate_limits where key in (select key from public.rate_limits where window_start<now()-interval '1 day' limit 100);
 insert into public.rate_limits(key) values(p_key) on conflict(key) do update set hits=case when public.rate_limits.window_start<now()-interval '1 minute' then 1 else public.rate_limits.hits+1 end, window_start=case when public.rate_limits.window_start<now()-interval '1 minute' then now() else public.rate_limits.window_start end returning hits into n;
 return n<=p_limit; end $$;
