-- Whatch: tela de admin (só o dono: app_metadata.whatch_dono, que só o banco marca).
-- Tudo o que a tela lê sai por funções security definer que conferem whatch_e_dono(); o gosto e as notas
-- de cada pessoa (telas_estado.estado) nunca saem daqui: só contagens, a origem do gosto e o uso da IA.

-- quem é dono (lido do banco, não do JWT: vale na hora, sem esperar o token renovar)
create or replace function public.whatch_e_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (u.raw_app_meta_data->>'whatch_dono')::boolean from auth.users u where u.id = auth.uid()), false)
$$;
revoke all on function public.whatch_e_dono() from public, anon;
grant execute on function public.whatch_e_dono() to authenticated;

-- custo de cada uso da IA: a função da Vercel grava os tokens uma vez, logo depois da chamada (com o token da pessoa).
-- O custo é calculado aqui (claude-opus-5-5: US$ 4 entrada, 20 saída, 0,20 cache lido, 5 cache gravado, por milhão).
alter table public.whatch_ia_uso
  add column if not exists tokens_in integer check (tokens_in >= 0),
  add column if not exists tokens_out integer check (tokens_out >= 0),
  add column if not exists cache_lido integer check (cache_lido >= 0),
  add column if not exists cache_criado integer check (cache_criado >= 0);
alter table public.whatch_ia_uso add column if not exists custo_usd numeric generated always as
  ((coalesce(tokens_in,0)*4.0 + coalesce(tokens_out,0)*20.0 + coalesce(cache_lido,0)*0.2 + coalesce(cache_criado,0)*5.0) / 1000000) stored;
drop policy if exists whatch_ia_uso_update on public.whatch_ia_uso;
create policy whatch_ia_uso_update on public.whatch_ia_uso for update to authenticated
  using (user_id = (select auth.uid()) and tokens_in is null and criado_em > now() - interval '15 minutes')
  with check (user_id = (select auth.uid()));
grant update (tokens_in, tokens_out, cache_lido, cache_criado) on public.whatch_ia_uso to authenticated;

-- limite próprio de uma pessoa (vazio = o padrão do código) e bloqueio da IA. A pessoa lê o dela (a função da Vercel lê
-- com o token dela); só o dono grava, pela função whatch_admin_limite.
create table if not exists public.whatch_limites (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pergunta_dia integer check (pergunta_dia between 0 and 1000),
  pergunta_mes integer check (pergunta_mes between 0 and 10000),
  gosto_dia integer check (gosto_dia between 0 and 1000),
  gosto_mes integer check (gosto_mes between 0 and 10000),
  bloqueado boolean not null default false,
  nota text check (char_length(nota) <= 300),
  atualizado_em timestamptz not null default now()
);
alter table public.whatch_limites enable row level security;
drop policy if exists whatch_limites_select on public.whatch_limites;
create policy whatch_limites_select on public.whatch_limites for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.whatch_limites from anon;
grant select on public.whatch_limites to authenticated;

-- recados dos testadores (Mais › Mandar um recado): a pessoa grava e vê os dela; o dono lê todos pela função
create table if not exists public.whatch_recados (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  texto text not null check (char_length(texto) between 1 and 2000),
  tela text check (char_length(tela) <= 40),
  lido boolean not null default false
);
alter table public.whatch_recados enable row level security;
drop policy if exists whatch_recados_insert on public.whatch_recados;
drop policy if exists whatch_recados_select on public.whatch_recados;
create policy whatch_recados_insert on public.whatch_recados for insert to authenticated
  with check (user_id = (select auth.uid()) and lido = false and criado_em > now() - interval '1 minute');
create policy whatch_recados_select on public.whatch_recados for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.whatch_recados from anon;
grant select, insert (texto, tela) on public.whatch_recados to authenticated;

-- títulos que não casaram no resumo da IA e nas importações (para melhorar o catálogo). Só o título e o ano.
create table if not exists public.whatch_sem_par (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  titulo text not null check (char_length(titulo) between 1 and 200),
  ano text check (char_length(ano) <= 12),
  origem text not null check (origem in ('resumo','importar'))
);
alter table public.whatch_sem_par enable row level security;
drop policy if exists whatch_sem_par_insert on public.whatch_sem_par;
create policy whatch_sem_par_insert on public.whatch_sem_par for insert to authenticated
  with check (user_id = (select auth.uid()) and criado_em > now() - interval '1 minute');
revoke all on public.whatch_sem_par from anon;
grant insert (titulo, ano, origem) on public.whatch_sem_par to authenticated;
create index if not exists whatch_sem_par_titulo on public.whatch_sem_par (lower(titulo));

-- ---------- funções da tela de admin ----------
create or replace function public.whatch_admin_resumo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb; hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if not public.whatch_e_dono() then raise exception 'só o dono' using errcode = '42501'; end if;
  select jsonb_build_object(
    'pessoas', (select count(*) from telas_members),
    'novas_7d', (select count(*) from telas_members where criado_em > now() - interval '7 days'),
    'ativas_7d', (select count(*) from telas_estado where atualizado_em > now() - interval '7 days'),
    'com_gosto', (select count(*) from telas_estado where jsonb_typeof(estado->'perfil') = 'object'),
    'origem_gosto', (select coalesce(jsonb_object_agg(o, n), '{}'::jsonb) from (select coalesce(estado->'perfil'->>'origem','?') o, count(*) n from telas_estado where jsonb_typeof(estado->'perfil') = 'object' group by 1) x),
    'entrada', (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb) from (select coalesce(u.raw_app_meta_data->>'provider','?') p, count(*) n from telas_members m join auth.users u on u.id = m.user_id group by 1) x),
    'cadastros_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'n', n) order by d), '[]'::jsonb) from (select (criado_em at time zone 'America/Sao_Paulo')::date d, count(*) n from telas_members where criado_em > now() - interval '30 days' group by 1) x),
    'ia', jsonb_build_object(
      'hoje', (select count(*) from whatch_ia_uso where criado_em >= hoje),
      'mes', (select count(*) from whatch_ia_uso where criado_em >= mes),
      'total', (select count(*) from whatch_ia_uso),
      'por_tipo_mes', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb) from (select tipo, count(*) n from whatch_ia_uso where criado_em >= mes group by 1) x),
      'custo_hoje', (select coalesce(round(sum(custo_usd), 4), 0) from whatch_ia_uso where criado_em >= hoje),
      'custo_mes', (select coalesce(round(sum(custo_usd), 4), 0) from whatch_ia_uso where criado_em >= mes),
      'custo_total', (select coalesce(round(sum(custo_usd), 4), 0) from whatch_ia_uso),
      'sem_tokens', (select count(*) from whatch_ia_uso where tokens_in is null and criado_em < now() - interval '15 minutes'),
      'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'n', n, 'custo', c) order by d), '[]'::jsonb) from (select (criado_em at time zone 'America/Sao_Paulo')::date d, count(*) n, round(sum(custo_usd), 4) c from whatch_ia_uso where criado_em > now() - interval '30 days' group by 1) x)
    ),
    'login', jsonb_build_object(
      'pedidos_24h', (select count(*) from login_pedidos where app = 'whatch' and criado_em > now() - interval '24 hours'),
      'emails_24h', (select count(distinct email_hash) from login_pedidos where app = 'whatch' and criado_em > now() - interval '24 hours'),
      'ips_24h', (select count(distinct ip_hash) from login_pedidos where app = 'whatch' and criado_em > now() - interval '24 hours'),
      'ips_no_limite_24h', (select count(*) from (select ip_hash from login_pedidos where app = 'whatch' and criado_em > now() - interval '24 hours' group by ip_hash, date_trunc('hour', criado_em) having count(*) >= 10) x),
      'emails_no_limite_24h', (select count(*) from (select email_hash from login_pedidos where app = 'whatch' and criado_em > now() - interval '24 hours' group by email_hash having count(*) >= 10) x),
      'por_hora', (select coalesce(jsonb_agg(jsonb_build_object('hora', h, 'n', n) order by h), '[]'::jsonb) from (select date_trunc('hour', criado_em) h, count(*) n from login_pedidos where app = 'whatch' and criado_em > now() - interval '24 hours' group by 1) x)
    ),
    'recados_novos', (select count(*) from whatch_recados where not lido),
    'sem_par', (select coalesce(jsonb_agg(jsonb_build_object('titulo', t, 'ano', a, 'n', n, 'pessoas', p, 'origens', o) order by n desc, t), '[]'::jsonb) from (
       select min(titulo) t, max(ano) a, count(*) n, count(distinct user_id) p, string_agg(distinct origem, ', ') o
       from whatch_sem_par where criado_em > now() - interval '90 days' group by lower(titulo) order by count(*) desc limit 60) x)
  ) into r;
  return r;
end $$;

create or replace function public.whatch_admin_pessoas(p_busca text default '', p_limite integer default 200) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if not public.whatch_e_dono() then raise exception 'só o dono' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(x order by x->>'ultimo' desc nulls last), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', m.user_id, 'email', u.email, 'entrou', m.criado_em, 'como', coalesce(u.raw_app_meta_data->>'provider','?'),
      'dono', coalesce((u.raw_app_meta_data->>'whatch_dono')::boolean, false),
      'ultimo', greatest(e.atualizado_em, (select max(criado_em) from whatch_ia_uso i where i.user_id = m.user_id)),
      'gosto', case when jsonb_typeof(e.estado->'perfil') = 'object' then coalesce(e.estado->'perfil'->>'origem','?') end,
      'notas', (select count(*) from jsonb_object_keys(coalesce(e.estado->'notas', '{}'::jsonb))),
      'ia_hoje', (select jsonb_object_agg(tipo, n) from (select tipo, count(*) n from whatch_ia_uso i where i.user_id = m.user_id and criado_em >= hoje group by 1) z),
      'ia_mes', (select jsonb_object_agg(tipo, n) from (select tipo, count(*) n from whatch_ia_uso i where i.user_id = m.user_id and criado_em >= mes group by 1) z),
      'custo_mes', (select coalesce(round(sum(custo_usd), 4), 0) from whatch_ia_uso i where i.user_id = m.user_id and criado_em >= mes),
      'custo_total', (select coalesce(round(sum(custo_usd), 4), 0) from whatch_ia_uso i where i.user_id = m.user_id),
      'limite', (select to_jsonb(l) - 'user_id' from whatch_limites l where l.user_id = m.user_id)
    ) x
    from telas_members m join auth.users u on u.id = m.user_id left join telas_estado e on e.user_id = m.user_id
    where coalesce(p_busca, '') = '' or u.email ilike '%' || p_busca || '%'
    limit greatest(1, least(coalesce(p_limite, 200), 1000))
  ) y);
end $$;

create or replace function public.whatch_admin_limite(p_user uuid, p_pergunta_dia integer, p_pergunta_mes integer,
  p_gosto_dia integer, p_gosto_mes integer, p_bloqueado boolean, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.whatch_e_dono() then raise exception 'só o dono' using errcode = '42501'; end if;
  if not exists (select 1 from telas_members where user_id = p_user) then raise exception 'pessoa não usa o Whatch'; end if;
  if p_pergunta_dia is null and p_pergunta_mes is null and p_gosto_dia is null and p_gosto_mes is null and not coalesce(p_bloqueado, false) and coalesce(p_nota, '') = '' then
    delete from whatch_limites where user_id = p_user; return; -- volta ao padrão
  end if;
  insert into whatch_limites (user_id, pergunta_dia, pergunta_mes, gosto_dia, gosto_mes, bloqueado, nota, atualizado_em)
  values (p_user, p_pergunta_dia, p_pergunta_mes, p_gosto_dia, p_gosto_mes, coalesce(p_bloqueado, false), nullif(left(p_nota, 300), ''), now())
  on conflict (user_id) do update set pergunta_dia = excluded.pergunta_dia, pergunta_mes = excluded.pergunta_mes, gosto_dia = excluded.gosto_dia,
    gosto_mes = excluded.gosto_mes, bloqueado = excluded.bloqueado, nota = excluded.nota, atualizado_em = now();
end $$;

create or replace function public.whatch_admin_recados(p_limite integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.whatch_e_dono() then raise exception 'só o dono' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'quando', r.criado_em, 'email', u.email, 'texto', r.texto, 'tela', r.tela, 'lido', r.lido) order by r.criado_em desc), '[]'::jsonb)
    from (select * from whatch_recados order by criado_em desc limit greatest(1, least(coalesce(p_limite, 100), 500))) r left join auth.users u on u.id = r.user_id);
end $$;

create or replace function public.whatch_admin_recado_lido(p_id bigint, p_lido boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.whatch_e_dono() then raise exception 'só o dono' using errcode = '42501'; end if;
  update whatch_recados set lido = coalesce(p_lido, true) where id = p_id;
end $$;

revoke all on function public.whatch_admin_resumo() from public, anon;
revoke all on function public.whatch_admin_pessoas(text, integer) from public, anon;
revoke all on function public.whatch_admin_limite(uuid, integer, integer, integer, integer, boolean, text) from public, anon;
revoke all on function public.whatch_admin_recados(integer) from public, anon;
revoke all on function public.whatch_admin_recado_lido(bigint, boolean) from public, anon;
grant execute on function public.whatch_admin_resumo() to authenticated;
grant execute on function public.whatch_admin_pessoas(text, integer) to authenticated;
grant execute on function public.whatch_admin_limite(uuid, integer, integer, integer, integer, boolean, text) to authenticated;
grant execute on function public.whatch_admin_recados(integer) to authenticated;
grant execute on function public.whatch_admin_recado_lido(bigint, boolean) to authenticated;
