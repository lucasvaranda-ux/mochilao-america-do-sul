-- Whatch (whatch.madeinbr.app) no projeto compartilhado madeinbr.
-- AINDA NÃO APLICADA. Antes: a Fase 0 da SV Nuvem (Etapa 1 de 08/10, as 11 políticas do SV e o limite do enviar-login),
-- senão qualquer pessoa logada no Whatch lê dados do SV. Revisão da SV Nuvem pedida no documento da Fase 0.
--
-- telas_members: quem usa o Whatch (para o apps_da_conta e o excluir-conta saberem que a conta é de mais de um app).
-- telas_estado: o estado da pessoa (o mesmo objeto do backup: notas, status, gosto, coleções...), uma linha por pessoa.
-- login_pedidos: o freio da função whatch-login (e-mail e IP só como HMAC, nunca crus); só a função (service_role) lê e grava.

create table if not exists public.telas_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.telas_members enable row level security;
create policy telas_members_select on public.telas_members for select to authenticated using (user_id = (select auth.uid()));
create policy telas_members_insert on public.telas_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy telas_members_delete on public.telas_members for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.telas_estado (
  user_id uuid primary key references auth.users(id) on delete cascade,
  estado jsonb not null,
  atualizado_em timestamptz not null default now(),
  constraint telas_estado_objeto check (jsonb_typeof(estado) = 'object'),
  constraint telas_estado_tamanho check (pg_column_size(estado) < 1500000)
);
alter table public.telas_estado enable row level security;
create policy telas_estado_select on public.telas_estado for select to authenticated using (user_id = (select auth.uid()));
create policy telas_estado_insert on public.telas_estado for insert to authenticated with check (user_id = (select auth.uid()));
create policy telas_estado_update on public.telas_estado for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy telas_estado_delete on public.telas_estado for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.telas_members, public.telas_estado from anon;
grant select, insert, delete on public.telas_members to authenticated;
grant select, insert, update, delete on public.telas_estado to authenticated;

create table if not exists public.login_pedidos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  app text not null,
  email_hash text not null,
  ip_hash text not null
);
alter table public.login_pedidos enable row level security; -- sem políticas: anon e authenticated não veem nada
revoke all on public.login_pedidos from anon, authenticated;
create index if not exists login_pedidos_email on public.login_pedidos (email_hash, criado_em);
create index if not exists login_pedidos_ip on public.login_pedidos (ip_hash, criado_em);
create index if not exists login_pedidos_quando on public.login_pedidos (criado_em);
