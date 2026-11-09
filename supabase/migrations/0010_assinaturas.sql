-- NDCity 0010: assinatura mensal do chat no cartão (Mercado Pago), cancelável.
-- Pode rodar de novo.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  product text not null default 'chat_mensal',
  provider text not null default 'mercadopago',
  preapproval_id text unique,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'paused', 'cancelled')),
  payer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_handle_idx on public.subscriptions (handle);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant all on public.subscriptions to service_role;

-- Remover casinha também apaga a assinatura (o cancelamento no Mercado Pago é
-- feito pelo site antes de remover).
create or replace function public.remove_house(p_handle text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_mayor text;
begin
  delete from sessions where handle = p_handle;
  delete from accounts where handle = p_handle;
  delete from login_codes where handle = p_handle;
  update subscriptions set status = 'cancelled', updated_at = now() where handle = p_handle and status <> 'cancelled';
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
