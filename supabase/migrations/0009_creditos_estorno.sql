-- NDCity 0009: personalização passa a ser por crédito (1 pintura por compra),
-- gasto de crédito sem risco de usar duas vezes e retirada do recurso no
-- estorno. Pode rodar de novo.

-- Quem já tinha a personalização "para sempre" fica com 1 pintura de crédito.
update public.entitlements set credits = greatest(credits, 1), updated_at = now()
where feature = 'customize' and credits = 0;

-- Gasta 1 crédito (mudança ou pintura). Devolve true se tinha crédito.
create or replace function public.use_credit(p_handle text, p_feature text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update entitlements set credits = credits - 1, updated_at = now()
  where handle = p_handle and feature = p_feature and credits > 0;
  return found;
end $$;

-- Estorno/contestação: tira o que a compra tinha dado.
-- chat: tira os dias; mudança/pintura: tira o crédito (se ainda não foi usado).
create or replace function public.revoke_entitlement(p_handle text, p_feature text, p_days int, p_credits int)
returns json language plpgsql security definer set search_path = public as $$
declare v_row entitlements%rowtype;
begin
  update entitlements set
    expires_at = case when p_days is null or expires_at is null then expires_at
                      else expires_at - make_interval(days => p_days) end,
    credits = greatest(0, credits - coalesce(p_credits, 0)),
    updated_at = now()
  where handle = p_handle and feature = p_feature
  returning * into v_row;
  return row_to_json(v_row);
end $$;

revoke all on function public.use_credit(text, text) from public, anon, authenticated;
revoke all on function public.revoke_entitlement(text, text, int, int) from public, anon, authenticated;
grant execute on function public.use_credit(text, text) to service_role;
grant execute on function public.revoke_entitlement(text, text, int, int) to service_role;
