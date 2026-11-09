-- Inv · pedidos ao Claude ("Pedir mudança" em inv.madeinbr.app)
--
-- AINDA NÃO APLICADO. Aplicar no projeto madeinbr (irawlnmcinqkxzgczmrb) só com o OK do Lucas.
--
-- A página inv.html grava aqui direto do navegador, com a chave anon (pública por desenho, a mesma do peru.html).
-- Por isso o anon só pode INSERIR, e só pedidos "novos": não lê, não edita, não apaga.
-- Não há política de select/update/delete para o anon: só o service role (o Claude, por ferramenta) lê e responde.
-- A página manda o próprio id (uuid gerado no aparelho), com "Prefer: return=minimal" (sem select, não dá para
-- pedir a linha de volta); um reenvio do mesmo pedido dá 409 e a página conta como enviado.
--
-- Quem implementa um pedido: marcar estado ('em_andamento', 'feito' ou 'recusado'), escrever a resposta,
-- o número do PR em pr e respondido_em = now(); e acrescentar a entrada em inv/mudancas.json.

create table public.inv_pedidos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  secao text not null check (char_length(secao) between 1 and 120),
  pagina text check (pagina is null or char_length(pagina) <= 40),
  texto text not null check (char_length(texto) between 1 and 4000),
  contexto jsonb check (contexto is null or pg_column_size(contexto) <= 8192),
  estado text not null default 'novo' check (estado in ('novo','em_andamento','feito','recusado')),
  resposta text,
  pr text,
  respondido_em timestamptz
);

comment on table public.inv_pedidos is
  'Pedidos de mudança mandados pela página do Inv (anon só insere). O Claude lê com o service role, implementa, marca estado/resposta/pr/respondido_em e registra em inv/mudancas.json.';

create index inv_pedidos_estado_criado on public.inv_pedidos (estado, criado_em desc);

alter table public.inv_pedidos enable row level security;

-- o anon só insere pedidos novos, sem resposta
create policy "inv_pedidos_insert_anon" on public.inv_pedidos
  for insert to anon
  with check (estado = 'novo' and resposta is null and pr is null and respondido_em is null);

grant insert on public.inv_pedidos to anon;
-- nenhuma política de select/update/delete para anon ou authenticated: com RLS ligado, ficam negados.
