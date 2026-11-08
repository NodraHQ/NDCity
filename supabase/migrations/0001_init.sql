-- Cidadezinha: estrutura inicial do banco.
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é "idempotente").

-- Cidades. Hoje só existe uma; o mapa-múndi vai adicionar outras.
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  seed text not null,
  layout_version int not null default 1,
  mayor_handle text,            -- null = cidade bloqueada
  unlocked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Casinhas resgatadas. Uma por @ (no mundo todo) e uma por lote.
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  lot_index int not null check (lot_index >= 0),
  instagram_handle text not null unique,
  building_type text not null check (building_type in ('casa','predio','oficina','padaria','cabare')),
  created_at timestamptz not null default now(),
  unique (city_id, lot_index)
);

-- Códigos de resgate, cada um ligado a um @.
create table if not exists public.codes (
  code text primary key,
  instagram_handle text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  claim_id uuid references public.claims(id) on delete set null
);
create index if not exists codes_handle_idx on public.codes (instagram_handle);

-- Segurança: ninguém acessa as tabelas pelo navegador.
-- O site fala com o banco só pelo servidor, usando a chave secreta.
alter table public.cities enable row level security;
alter table public.claims enable row level security;
alter table public.codes enable row level security;
revoke all on public.cities, public.claims, public.codes from anon, authenticated;
grant all on public.cities, public.claims, public.codes to service_role;

-- Resgate "tudo ou nada": confere o código, o lote e o @, cria a
-- casinha e, se for a primeira da cidade, entrega a prefeitura.
create or replace function public.claim_house(
  p_code text,
  p_city_slug text,
  p_lot_index int,
  p_lot_count int,
  p_building text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.codes%rowtype;
  v_city public.cities%rowtype;
  v_claim public.claims%rowtype;
  v_is_mayor boolean := false;
begin
  select * into v_code from public.codes where code = p_code for update;
  if not found then
    return json_build_object('ok', false, 'error', 'code_not_found');
  end if;
  if v_code.used_at is not null then
    return json_build_object('ok', false, 'error', 'code_used');
  end if;

  select * into v_city from public.cities where slug = p_city_slug for update;
  if not found then
    return json_build_object('ok', false, 'error', 'city_not_found');
  end if;

  if p_lot_index < 0 or p_lot_index >= p_lot_count then
    return json_build_object('ok', false, 'error', 'invalid_lot');
  end if;

  if exists (select 1 from public.claims where instagram_handle = v_code.instagram_handle) then
    return json_build_object('ok', false, 'error', 'handle_has_house');
  end if;

  if exists (select 1 from public.claims where city_id = v_city.id and lot_index = p_lot_index) then
    return json_build_object('ok', false, 'error', 'lot_taken');
  end if;

  insert into public.claims (city_id, lot_index, instagram_handle, building_type)
  values (v_city.id, p_lot_index, v_code.instagram_handle, p_building)
  returning * into v_claim;

  update public.codes set used_at = now(), claim_id = v_claim.id where code = v_code.code;

  if v_city.mayor_handle is null then
    update public.cities set mayor_handle = v_code.instagram_handle, unlocked_at = now()
    where id = v_city.id;
    v_is_mayor := true;
  end if;

  return json_build_object('ok', true, 'claim', row_to_json(v_claim), 'is_mayor', v_is_mayor);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'lot_taken');
end;
$$;

revoke all on function public.claim_house(text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.claim_house(text, text, int, int, text) to service_role;

-- A primeira cidade.
insert into public.cities (slug, name, seed)
values ('cidadezinha', 'Cidadezinha', 'cidadezinha')
on conflict (slug) do nothing;
