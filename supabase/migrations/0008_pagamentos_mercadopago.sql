-- NDCity 0008: pagamento pelo Mercado Pago e limite mensal de vendas.
-- Pode rodar de novo.

-- Configurações editáveis pelo admin (ex.: limite mensal de vendas).
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.purchases add column if not exists checkout_id text;
create index if not exists purchases_created_idx on public.purchases (created_at desc);
create unique index if not exists purchases_provider_ref_idx on public.purchases (provider, provider_ref) where provider_ref is not null;

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
grant all on public.settings to service_role;

insert into public.settings (key, value) values ('monthly_cap_cents', '200000')
on conflict (key) do nothing;
