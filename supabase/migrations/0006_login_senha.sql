-- NDCity 0006: senha própria e códigos de acesso de uso único. Pode rodar de novo.

-- Senha que o morador cria (só o hash, nunca a senha).
create table if not exists public.accounts (
  handle text primary key,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Códigos de acesso para quem esqueceu a senha: valem uma vez e expiram.
create table if not exists public.login_codes (
  code text primary key,
  handle text not null,
  source text not null default 'admin',     -- 'admin' ou 'bot'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists login_codes_handle_idx on public.login_codes (handle);

alter table public.accounts enable row level security;
alter table public.login_codes enable row level security;
revoke all on public.accounts, public.login_codes from anon, authenticated;
grant all on public.accounts, public.login_codes to service_role;

-- Remover casinha também apaga a senha e os códigos de acesso.
create or replace function public.remove_house(p_handle text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_mayor text;
begin
  delete from sessions where handle = p_handle;
  delete from codes where instagram_handle = p_handle;
  delete from accounts where handle = p_handle;
  delete from login_codes where handle = p_handle;
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
