-- =====================================================================
-- Raquel Martins | Conservação de Túmulos
-- Schema do banco (Supabase / PostgreSQL)
-- Como rodar: Supabase > SQL Editor > cole tudo > Run
-- =====================================================================

-- ---------- Utilitário: "hoje" no horário de Brasília ----------------
create or replace function hoje() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- ---------- Acesso: só administradoras cadastradas -------------------
-- Quem cria conta no site NÃO vê nada, a menos que esteja nesta tabela.
create table administrador (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from administrador where user_id = auth.uid())
$$;

-- ---------- Clientes e jazigos ---------------------------------------
create sequence cliente_seq;

create table cliente (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    default ('CLI-' || lpad(nextval('cliente_seq')::text, 3, '0')),
  nome text not null,
  telefone text not null unique check (telefone ~ '^[0-9]{10,13}$'), -- só dígitos, com DDD
  aceita_lembrete_whatsapp boolean not null default true,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table jazigo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete restrict,
  perpetua text not null check (btrim(perpetua) <> ''),
  rua text not null check (btrim(rua) <> ''),
  quadra text not null check (btrim(quadra) <> ''),
  latitude numeric(9,6),
  longitude numeric(9,6),
  foto_referencia text,          -- caminho do arquivo no Storage
  tipo_material text,
  observacoes text,
  criado_em timestamptz not null default now(),
  unique (perpetua, rua, quadra) -- o mesmo túmulo não entra duas vezes
);

create table homenageado (        -- para o memorial futuro; um jazigo pode ter vários
  id uuid primary key default gen_random_uuid(),
  jazigo_id uuid not null references jazigo(id) on delete cascade,
  nome text not null,
  nascimento date,
  falecimento date
);

-- ---------- Serviços pontuais (placas, reformas) ---------------------
create table pedido (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id),
  jazigo_id uuid references jazigo(id),
  tipo text not null check (tipo in ('placa','reforma','restauracao')),
  material text check (material in ('bronze','granito','porcelanato','lajota','inox','outro')),
  valor numeric(10,2) not null check (valor >= 0),
  status text not null default 'orcamento'
    check (status in ('orcamento','aprovado','em_producao','instalado','cancelado')),
  origem text check (origem in ('indicacao','whatsapp','instagram','administracao_cemiterio','presencial','outro')),
  data_orcamento date not null default hoje(),
  data_aprovacao date,
  data_conclusao date,
  observacoes text
);

-- ---------- Serviços recorrentes (cuidado do jazigo, memorial) -------
create table assinatura (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id),
  jazigo_id uuid not null references jazigo(id),
  tipo text not null default 'cuidado_jazigo' check (tipo in ('cuidado_jazigo','memorial')),
  valor numeric(10,2) not null check (valor >= 0),
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal','anual')),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  data_inicio date not null default hoje(),
  status text not null default 'ativa' check (status in ('ativa','cancelada')),
  data_cancelamento date,
  observacoes text
);
-- Um jazigo só pode ter uma assinatura ativa de cada tipo
create unique index assinatura_ativa_unica on assinatura (jazigo_id, tipo) where status = 'ativa';

-- ---------- Cobranças -------------------------------------------------
-- "Atrasado" não é gravado: é calculado na view v_cobranca_status.
create table cobranca (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid references assinatura(id) on delete cascade,
  pedido_id uuid references pedido(id) on delete cascade,
  referencia date,               -- 1º dia do mês de referência (assinaturas)
  vencimento date not null,
  valor numeric(10,2) not null check (valor >= 0),
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  data_pagamento date,
  forma_pagamento text check (forma_pagamento in ('dinheiro','pix','transferencia','cartao')),
  lembrete_enviado_em timestamptz,
  observacao text,
  check (num_nonnulls(assinatura_id, pedido_id) = 1),         -- ou assinatura ou pedido
  check (status <> 'pago' or data_pagamento is not null),
  unique (assinatura_id, referencia)                          -- não duplica o mês
);
create index cobranca_pendente_idx on cobranca (vencimento) where status = 'pendente';

-- ---------- Despesas e configuração ----------------------------------
create table despesa (
  id uuid primary key default gen_random_uuid(),
  data date not null default hoje(),
  categoria text not null,       -- material, transporte, ferramentas...
  descricao text,
  valor numeric(10,2) not null check (valor >= 0)
);
create index despesa_data_idx on despesa (data);

create table configuracao (       -- uma única linha
  id smallint primary key default 1 check (id = 1),
  chave_pix text,
  nome_recebedor text,
  whatsapp text,
  modelo_lembrete text,
  modelo_atraso text
);
insert into configuracao (chave_pix, nome_recebedor, whatsapp, modelo_lembrete, modelo_atraso) values (
  'raquelmoraismartins@gmail.com', 'Raquel Martins', '5511963763299',
  'Olá, {nome}. Passando para lembrar que a mensalidade do cuidado do jazigo, no valor de R$ {valor}, vence no dia {data}. Se preferir, o Pix é: {chave_pix}. Se puder, envie o comprovante por aqui para eu dar baixa. Obrigada pela confiança.',
  'Olá, {nome}. Não localizamos o pagamento da mensalidade de R$ {valor}, com vencimento em {data}. Caso já tenha feito, por favor desconsidere. Pix: {chave_pix}. Qualquer dúvida, é só responder esta mensagem.'
);

-- ---------- Equipe (para o app de geolocalização, uso futuro) --------
create table funcionario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  ativo boolean not null default true
);

create table visita (
  id uuid primary key default gen_random_uuid(),
  jazigo_id uuid not null references jazigo(id),
  funcionario_id uuid references funcionario(id),
  data_hora timestamptz not null default now(),
  servico text not null check (servico in ('limpeza','rega','reparo','outro')),
  latitude numeric(9,6),          -- onde o funcionário estava ao registrar
  longitude numeric(9,6),
  foto_antes text,
  foto_depois text,
  observacao text
);
create index visita_jazigo_idx on visita (jazigo_id, data_hora desc);

-- ---------- Índices de apoio -----------------------------------------
create index jazigo_cliente_idx on jazigo (cliente_id);
create index assinatura_cliente_idx on assinatura (cliente_id);
create index pedido_cliente_idx on pedido (cliente_id);

-- ---------- Views para o painel e o gráfico --------------------------
create view v_cobranca_status with (security_invoker = true) as
select
  c.*,
  case when c.status = 'pendente' and c.vencimento < hoje() then 'atrasado' else c.status end as situacao,
  case when c.status = 'pendente' and c.vencimento < hoje() then hoje() - c.vencimento else 0 end as dias_atraso,
  cl.id as cliente_id, cl.codigo as cliente_codigo, cl.nome as cliente_nome,
  cl.telefone, cl.aceita_lembrete_whatsapp,
  j.perpetua, j.rua, j.quadra
from cobranca c
left join assinatura a on a.id = c.assinatura_id
left join pedido p on p.id = c.pedido_id
join cliente cl on cl.id = coalesce(a.cliente_id, p.cliente_id)
left join jazigo j on j.id = coalesce(a.jazigo_id, p.jazigo_id);

create view v_fluxo_mensal with (security_invoker = true) as
select
  date_trunc('month', d)::date as mes,
  sum(receita) as receita,
  sum(despesa) as despesa,
  sum(receita) - sum(despesa) as saldo
from (
  select data_pagamento as d, valor as receita, 0::numeric as despesa from cobranca where status = 'pago'
  union all
  select data, 0::numeric, valor from despesa
) t
group by 1
order by 1;

-- ---------- Geração das cobranças do mês -----------------------------
-- Pode ser chamada por um botão do painel: supabase.rpc('gerar_cobrancas')
create or replace function gerar_cobrancas(p_mes date default null) returns integer
language plpgsql as $$
declare
  v_mes date := date_trunc('month', coalesce(p_mes, hoje()))::date;
  n integer;
begin
  insert into cobranca (assinatura_id, referencia, vencimento, valor)
  select a.id, v_mes,
         make_date(extract(year from v_mes)::int, extract(month from v_mes)::int, a.dia_vencimento),
         a.valor
  from assinatura a
  where a.status = 'ativa'
    and v_mes >= date_trunc('month', a.data_inicio)::date
    and (a.periodicidade = 'mensal'
         or extract(month from a.data_inicio) = extract(month from v_mes))
  on conflict (assinatura_id, referencia) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Segurança (RLS) ------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cliente','jazigo','homenageado','pedido','assinatura',
                           'cobranca','despesa','configuracao','funcionario','visita']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_total on %I for all to authenticated
                    using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
alter table administrador enable row level security;  -- sem policy: ninguém lê pela API

revoke all on all tables in schema public from anon;
revoke execute on function gerar_cobrancas(date) from public, anon;
grant execute on function gerar_cobrancas(date) to authenticated;
