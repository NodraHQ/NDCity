-- NDCity 0003: eleições (governador/presidente), proposta votada para a
-- prefeitura e mudança com troca do tipo de construção. Pode rodar de novo.

-- ---------------------------------------------------------------- eleições
create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  office text not null check (office in ('governor', 'president')),
  uf text,                                   -- só para governador
  status text not null default 'open' check (status in ('open', 'closed', 'canceled')),
  ends_at timestamptz not null,
  winner_handle text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((office = 'governor') = (uf is not null))
);

create table if not exists public.election_candidates (
  election_id uuid not null references public.elections(id) on delete cascade,
  handle text not null,
  created_at timestamptz not null default now(),
  primary key (election_id, handle)
);

create table if not exists public.election_votes (
  election_id uuid not null references public.elections(id) on delete cascade,
  voter text not null,
  candidate text not null,
  created_at timestamptz not null default now(),
  primary key (election_id, voter)
);

-- Quem ocupa cada cargo (uf = '' para presidente).
create table if not exists public.offices (
  office text not null check (office in ('governor', 'president')),
  uf text not null default '',
  holder_handle text not null,
  election_id uuid references public.elections(id) on delete set null,
  since timestamptz not null default now(),
  primary key (office, uf)
);

-- ---------------------------------------------------------------- prefeitura votada
create table if not exists public.hall_proposals (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  proposer text not null,
  style jsonb not null,
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'canceled')),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists hall_proposals_open_idx on public.hall_proposals (city_id) where status = 'open';

create table if not exists public.hall_votes (
  proposal_id uuid not null references public.hall_proposals(id) on delete cascade,
  handle text not null,
  approve boolean not null,
  created_at timestamptz not null default now(),
  primary key (proposal_id, handle)
);

-- ---------------------------------------------------------------- segurança
alter table public.elections enable row level security;
alter table public.election_candidates enable row level security;
alter table public.election_votes enable row level security;
alter table public.offices enable row level security;
alter table public.hall_proposals enable row level security;
alter table public.hall_votes enable row level security;
revoke all on public.elections, public.election_candidates, public.election_votes, public.offices,
  public.hall_proposals, public.hall_votes from anon, authenticated;
grant all on public.elections, public.election_candidates, public.election_votes, public.offices,
  public.hall_proposals, public.hall_votes to service_role;

-- ---------------------------------------------------------------- mudança
-- Agora a mudança também deixa escolher o tipo de construção de novo.
drop function if exists public.move_house(text, text, int, int);
create or replace function public.move_house(
  p_handle text, p_city_slug text, p_lot_index int, p_lot_count int, p_building text default null
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
  update claims set
    city_id = v_city.id,
    lot_index = p_lot_index,
    building_type = coalesce(p_building, building_type),
    created_at = now()
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

revoke all on function public.move_house(text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.move_house(text, text, int, int, text) to service_role;

-- Quando o prefeito muda, a proposta de pintura dele perde o efeito.
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
  if v_next is distinct from v_mayor then
    update hall_proposals set status = 'canceled', resolved_at = now()
    where city_id = p_city_id and status = 'open';
  end if;
  return v_next;
end $$;

-- Remover casinha também apaga votos e candidaturas da pessoa.
create or replace function public.remove_house(p_handle text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_mayor text;
begin
  delete from sessions where handle = p_handle;
  delete from codes where instagram_handle = p_handle;
  delete from election_candidates c using elections e
    where c.election_id = e.id and e.status = 'open' and c.handle = p_handle;
  delete from election_votes v using elections e
    where v.election_id = e.id and e.status = 'open' and (v.voter = p_handle or v.candidate = p_handle);
  delete from hall_votes v using hall_proposals p
    where v.proposal_id = p.id and p.status = 'open' and v.handle = p_handle;
  delete from claims where instagram_handle = p_handle returning * into v_claim;
  if not found then
    perform refresh_mayor(id) from cities where mayor_handle = p_handle;
    return json_build_object('ok', true, 'had_house', false);
  end if;
  v_mayor := refresh_mayor(v_claim.city_id);
  perform refresh_mayor(id) from cities where mayor_handle = p_handle;
  return json_build_object('ok', true, 'had_house', true, 'new_mayor', v_mayor);
end $$;
