-- NDCity 0011: limite de tentativas de senha guardado no banco (vale para
-- todos os servidores da Vercel, não só para um) e faxina do sistema antigo
-- de códigos de resgate. Pode rodar de novo.

create table if not exists public.rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_key_at on public.rate_hits (key, at);
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from anon, authenticated;
grant all on public.rate_hits to service_role;

-- Registra uma tentativa e devolve true se ainda está dentro do limite.
create or replace function public.hit_rate(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  -- limpeza de vez em quando (tentativas com mais de 1 dia)
  if random() < 0.02 then delete from rate_hits where at < now() - interval '1 day'; end if;
  select count(*) into v_count from rate_hits
  where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then return false; end if;
  insert into rate_hits (key) values (p_key);
  return true;
end $$;
revoke all on function public.hit_rate(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate(text, int, int) to service_role;

-- sistema antigo de códigos de resgate (não é mais usado)
drop function if exists public.claim_house(text, text, int, int, text);
drop table if exists public.codes;
