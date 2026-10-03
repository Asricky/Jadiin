-- Late registration and authenticated reconfirmation before payment uploads.
alter table public.participants add column payment_details_confirmed_at timestamptz;

create function public.confirm_payment_participant(
  p_event uuid, p_hash text, p_existing_hash text, p_data jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  pid uuid;
  vehicle public.vehicle_type;
  capacity integer;
  participant_name text;
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null or e.status <> 'STAGE_2_OPEN' or
    (e.stage2_deadline is not null and e.stage2_deadline <= now()) then
    raise exception 'Pendaftaran dan pembayaran ditutup';
  end if;
  if p_data->>'confirmed' is distinct from 'true' then
    raise exception 'Konfirmasi nama dan kendaraan terlebih dahulu';
  end if;
  participant_name := trim(p_data->>'name');
  vehicle := (p_data->>'vehicle_type')::public.vehicle_type;
  capacity := case when vehicle = 'NONE' then null else (p_data->>'vehicle_capacity')::integer end;
  if vehicle = 'MOTORCYCLE' and capacity > 2 then
    raise exception 'Motor maksimal 2 orang termasuk driver';
  end if;
  if p_existing_hash is not null then
    select id into pid from public.participants
    where event_id = e.id and access_token_hash = p_existing_hash for update;
    if pid is null or p_hash is distinct from p_existing_hash then
      raise exception 'Sesi tidak valid';
    end if;
    update public.participants set name = participant_name, whatsapp = p_data->>'whatsapp',
      vehicle_type = vehicle, vehicle_capacity = capacity,
      vehicle_owner = case when vehicle = 'NONE' then null else coalesce(nullif(trim(p_data->>'vehicle_owner'), ''), participant_name) end,
      vehicle_driver = case when vehicle = 'NONE' then null else coalesce(nullif(trim(p_data->>'vehicle_driver'), ''), participant_name) end,
      payment_details_confirmed_at = now(), updated_at = now()
    where id = pid;
  else
    insert into public.participants (event_id, name, whatsapp, vehicle_type, vehicle_capacity,
      vehicle_owner, vehicle_driver, access_token_hash, stage1_submitted_at, payment_details_confirmed_at)
    values (e.id, participant_name, p_data->>'whatsapp', vehicle, capacity,
      case when vehicle = 'NONE' then null else coalesce(nullif(trim(p_data->>'vehicle_owner'), ''), participant_name) end,
      case when vehicle = 'NONE' then null else coalesce(nullif(trim(p_data->>'vehicle_driver'), ''), participant_name) end,
      p_hash, null, now()) returning id into pid;
  end if;
  return pid;
end $$;
revoke all on function public.confirm_payment_participant(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_payment_participant(uuid,text,text,jsonb) to service_role;
