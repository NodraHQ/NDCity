-- Cidadezinha 0002: mapa do Brasil, login de morador, chat, recursos pagos
-- e sucessão da prefeitura. Pode rodar mais de uma vez.

-- ---------------------------------------------------------------- cidades
alter table public.cities add column if not exists ibge_code int unique;
alter table public.cities add column if not exists uf text;
alter table public.cities add column if not exists lat double precision;
alter table public.cities add column if not exists lng double precision;
alter table public.cities add column if not exists timezone text;
alter table public.cities add column if not exists layout_size int not null default 22;
alter table public.cities add column if not exists hall_style jsonb;

-- ---------------------------------------------------------------- casinhas
alter table public.claims add column if not exists style jsonb;

-- ---------------------------------------------------------------- sessões
-- Login do morador: guardamos só o "hash" do token, nunca o token.
create table if not exists public.sessions (
  token_hash text primary key,
  handle text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists sessions_handle_idx on public.sessions (handle);

-- ---------------------------------------------------------------- chat
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  city_id uuid not null references public.cities(id) on delete cascade,
  handle text not null,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists messages_city_idx on public.messages (city_id, id desc);

-- ---------------------------------------------------------------- recursos pagos
-- chat: assinatura (expires_at); customize: compra única; move: créditos.
create table if not exists public.entitlements (
  handle text not null,
  feature text not null check (feature in ('chat', 'customize', 'move')),
  expires_at timestamptz,
  credits int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (handle, feature)
);

-- Compras (para quando o gateway de pagamento for escolhido).
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  product text not null,
  amount_cents int not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'refunded')),
  provider text,
  provider_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ---------------------------------------------------------------- segurança
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.entitlements enable row level security;
alter table public.purchases enable row level security;
revoke all on public.sessions, public.messages, public.entitlements, public.purchases from anon, authenticated;
grant all on public.sessions, public.messages, public.entitlements, public.purchases to service_role;

-- ---------------------------------------------------------------- prefeitura
-- Se o prefeito não mora mais na cidade, a prefeitura passa para o morador
-- mais antigo. Sem moradores, a prefeitura fica vaga e a cidade volta a
-- ficar bloqueada (o próximo a chegar vira prefeito).
create or replace function public.refresh_mayor(p_city_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_mayor text;
  v_next text;
begin
  select mayor_handle into v_mayor from cities where id = p_city_id for update;
  if v_mayor is not null and exists (
    select 1 from claims where city_id = p_city_id and instagram_handle = v_mayor
  ) then
    return v_mayor;
  end if;
  select instagram_handle into v_next from claims
  where city_id = p_city_id order by created_at, id limit 1;
  update cities set
    mayor_handle = v_next,
    unlocked_at = case when v_next is null then null else coalesce(unlocked_at, now()) end,
    hall_style = case when v_next is distinct from v_mayor then null else hall_style end
  where id = p_city_id;
  return v_next;
end $$;

-- Remover casinha (admin): tira TODO o acesso da pessoa.
-- Apaga a casa, os logins (sessões) e os códigos dela, e passa a
-- prefeitura adiante se ela era a prefeita. Para voltar, só com um
-- código novo gerado pelo admin.
create or replace function public.remove_house(p_handle text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_mayor text;
begin
  delete from sessions where handle = p_handle;
  delete from codes where instagram_handle = p_handle;
  delete from claims where instagram_handle = p_handle returning * into v_claim;
  if not found then
    -- sem casa, mas pode ter sobrado como prefeito de algum lugar
    perform refresh_mayor(id) from cities where mayor_handle = p_handle;
    return json_build_object('ok', true, 'had_house', false);
  end if;
  v_mayor := refresh_mayor(v_claim.city_id);
  perform refresh_mayor(id) from cities where mayor_handle = p_handle;
  return json_build_object('ok', true, 'had_house', true, 'new_mayor', v_mayor);
end $$;

-- Mudança de cidade: gasta 1 crédito de mudança.
create or replace function public.move_house(
  p_handle text, p_city_slug text, p_lot_index int, p_lot_count int
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_city cities%rowtype;
  v_credits int;
  v_is_mayor boolean := false;
  v_old_city uuid;
begin
  select * into v_claim from claims where instagram_handle = p_handle for update;
  if not found then return json_build_object('ok', false, 'error', 'no_house'); end if;

  select credits into v_credits from entitlements
  where handle = p_handle and feature = 'move' for update;
  if coalesce(v_credits, 0) < 1 then return json_build_object('ok', false, 'error', 'no_credit'); end if;

  select * into v_city from cities where slug = p_city_slug for update;
  if not found then return json_build_object('ok', false, 'error', 'city_not_found'); end if;
  if v_city.id = v_claim.city_id then return json_build_object('ok', false, 'error', 'same_city'); end if;
  if p_lot_index < 0 or p_lot_index >= p_lot_count then return json_build_object('ok', false, 'error', 'invalid_lot'); end if;
  if exists (select 1 from claims where city_id = v_city.id and lot_index = p_lot_index) then
    return json_build_object('ok', false, 'error', 'lot_taken');
  end if;

  v_old_city := v_claim.city_id;
  update claims set city_id = v_city.id, lot_index = p_lot_index, created_at = now()
  where id = v_claim.id returning * into v_claim;
  update entitlements set credits = credits - 1, updated_at = now()
  where handle = p_handle and feature = 'move';
  perform refresh_mayor(v_old_city);
  if v_city.mayor_handle is null then
    update cities set mayor_handle = p_handle, unlocked_at = now() where id = v_city.id;
    v_is_mayor := true;
  end if;
  return json_build_object('ok', true, 'claim', row_to_json(v_claim), 'is_mayor', v_is_mayor);
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'lot_taken');
end $$;

-- Liberar recurso pago (pelo admin hoje; pelo gateway no futuro).
create or replace function public.grant_entitlement(
  p_handle text, p_feature text, p_days int, p_credits int
) returns json
language plpgsql security definer set search_path = public as $$
declare v_row entitlements%rowtype;
begin
  insert into entitlements (handle, feature, expires_at, credits)
  values (
    p_handle, p_feature,
    case when p_days is null then null else now() + make_interval(days => p_days) end,
    coalesce(p_credits, 0)
  )
  on conflict (handle, feature) do update set
    expires_at = case
      when p_days is null then null
      else greatest(coalesce(entitlements.expires_at, now()), now()) + make_interval(days => p_days)
    end,
    credits = entitlements.credits + coalesce(p_credits, 0),
    updated_at = now()
  returning * into v_row;
  return row_to_json(v_row);
end $$;

revoke all on function public.refresh_mayor(uuid) from public, anon, authenticated;
revoke all on function public.remove_house(text) from public, anon, authenticated;
revoke all on function public.move_house(text, text, int, int) from public, anon, authenticated;
revoke all on function public.grant_entitlement(text, text, int, int) from public, anon, authenticated;
grant execute on function public.refresh_mayor(uuid) to service_role;
grant execute on function public.remove_house(text) to service_role;
grant execute on function public.move_house(text, text, int, int) to service_role;
grant execute on function public.grant_entitlement(text, text, int, int) to service_role;

-- Corrige prefeituras que ficaram com alguém que não mora mais na cidade.
select public.refresh_mayor(id) from public.cities;
