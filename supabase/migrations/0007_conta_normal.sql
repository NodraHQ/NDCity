-- NDCity 0007: conta normal (@ + senha), sem código de resgate.
-- A pessoa cria a conta, escolhe a cidade e resgata a casinha já logada.
-- Pode rodar de novo.

create or replace function public.claim_house_direct(
  p_handle text,
  p_city_slug text,
  p_lot_index int,
  p_lot_count int,
  p_building text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_city cities%rowtype;
  v_claim claims%rowtype;
  v_is_mayor boolean := false;
begin
  select * into v_city from cities where slug = p_city_slug for update;
  if not found then return json_build_object('ok', false, 'error', 'city_not_found'); end if;
  if p_lot_index < 0 or p_lot_index >= p_lot_count then
    return json_build_object('ok', false, 'error', 'invalid_lot');
  end if;
  if exists (select 1 from claims where instagram_handle = p_handle) then
    return json_build_object('ok', false, 'error', 'handle_has_house');
  end if;
  if exists (select 1 from claims where city_id = v_city.id and lot_index = p_lot_index) then
    return json_build_object('ok', false, 'error', 'lot_taken');
  end if;

  insert into claims (city_id, lot_index, instagram_handle, building_type)
  values (v_city.id, p_lot_index, p_handle, p_building)
  returning * into v_claim;

  if v_city.mayor_handle is null then
    update cities set mayor_handle = p_handle, unlocked_at = now() where id = v_city.id;
    v_is_mayor := true;
  end if;
  return json_build_object('ok', true, 'claim', row_to_json(v_claim), 'is_mayor', v_is_mayor);
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'lot_taken');
end $$;

revoke all on function public.claim_house_direct(text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.claim_house_direct(text, text, int, int, text) to service_role;
