-- NDCity 0005: mais tipos de construção. Pode rodar de novo.
alter table public.claims drop constraint if exists claims_building_type_check;
alter table public.claims add constraint claims_building_type_check check (building_type in (
  'casa', 'predio', 'oficina', 'padaria', 'cabare',
  'mansao', 'igreja', 'escola', 'mercado', 'boteco', 'lanchonete',
  'academia', 'farmacia', 'hotel', 'barbearia', 'sorveteria', 'posto'
));
