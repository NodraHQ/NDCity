-- NDCity 0004: histórico (log de tudo que muda) e painel de acessos.
-- Pode rodar de novo.

-- ---------------------------------------------------------------- histórico
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor text not null,          -- 'admin', 'sistema' ou o @ de quem fez
  action text not null,         -- ex.: 'chegou', 'mudou', 'pagamento'...
  handle text,                  -- @ afetado
  city_slug text,
  details jsonb
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_handle_idx on public.audit_log (handle);
create index if not exists audit_log_action_idx on public.audit_log (action);

-- ---------------------------------------------------------------- acessos
-- Uma linha por visitante (cookie anônimo) por dia. Sem dados pessoais.
create table if not exists public.visits (
  visitor_id text not null,
  day date not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  views int not null default 0,
  handle text,
  last_path text,
  primary key (visitor_id, day)
);
create index if not exists visits_last_idx on public.visits (last_at desc);
create index if not exists visits_day_idx on public.visits (day);

create or replace function public.track_visit(p_vid text, p_handle text, p_path text, p_view boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into visits (visitor_id, day, handle, last_path, views)
  values (p_vid, (now() at time zone 'America/Sao_Paulo')::date, p_handle, p_path, case when p_view then 1 else 0 end)
  on conflict (visitor_id, day) do update set
    last_at = now(),
    handle = coalesce(excluded.handle, visits.handle),
    last_path = excluded.last_path,
    views = visits.views + case when p_view then 1 else 0 end;
end $$;

alter table public.audit_log enable row level security;
alter table public.visits enable row level security;
revoke all on public.audit_log, public.visits from anon, authenticated;
grant all on public.audit_log, public.visits to service_role;
revoke all on function public.track_visit(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.track_visit(text, text, text, boolean) to service_role;
