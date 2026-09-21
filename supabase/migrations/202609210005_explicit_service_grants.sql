-- Hosted projects do not necessarily inherit the local stack's default grants.
-- The server-only service role still needs SQL privileges in addition to BYPASSRLS.
-- Keep browser roles restricted to the SELECT/RPC grants from earlier migrations.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.events,
  public.event_dates,
  public.villas,
  public.villa_images,
  public.participants,
  public.participant_availability,
  public.villa_votes,
  public.transport_groups,
  public.transport_members,
  public.upload_intents,
  public.payments,
  public.rate_limits,
  public.event_phase_history
to service_role;
