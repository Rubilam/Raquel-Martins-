-- Rode DEPOIS do schema.sql.
-- Passo a passo: importar o CSV na tabela import_planilha e depois: select importar_planilha();
-- =====================================================================
-- IMPORTAÇÃO DA PLANILHA (dados de teste ou do caderno)
-- 1) Table Editor > import_planilha > Insert > Import data from CSV
-- 2) SQL Editor: select importar_planilha();
-- =====================================================================
create table import_planilha (
  nome text, telefone text, perpetua text, rua text, quadra text,
  valor_mensal text, dia_vencimento text, ultimo_mes_pago text, observacoes text
);
alter table import_planilha enable row level security;  -- só pelo painel do Supabase

create or replace function importar_planilha() returns text
language plpgsql as $$
declare
  v_clientes int; v_jazigos int; v_assin int; v_pagas int; v_menor date; v_mes date;
begin
  -- normaliza: telefone só com dígitos, valor com ponto, mês "10/2026" vira data
  create temp table t_imp on commit drop as
  select
    nullif(btrim(nome),'') as nome,
    regexp_replace(coalesce(telefone,''), '\D', '', 'g') as telefone,
    btrim(perpetua) as perpetua, btrim(rua) as rua, upper(btrim(quadra)) as quadra,
    replace(nullif(btrim(valor_mensal),''), ',', '.')::numeric as valor,
    nullif(btrim(dia_vencimento),'')::smallint as dia,
    case when nullif(btrim(ultimo_mes_pago),'') is not null
         then to_date('01/' || btrim(ultimo_mes_pago), 'DD/MM/YYYY') end as ultimo_pago,
    nullif(btrim(observacoes),'') as obs
  from import_planilha;

  insert into cliente (nome, telefone)
  select min(nome), telefone from t_imp group by telefone
  on conflict (telefone) do nothing;
  get diagnostics v_clientes = row_count;

  insert into jazigo (cliente_id, perpetua, rua, quadra, observacoes)
  select c.id, t.perpetua, t.rua, t.quadra, t.obs
  from t_imp t join cliente c on c.telefone = t.telefone
  on conflict (perpetua, rua, quadra) do nothing;
  get diagnostics v_jazigos = row_count;

  insert into assinatura (cliente_id, jazigo_id, valor, dia_vencimento, data_inicio)
  select j.cliente_id, j.id, t.valor, t.dia, coalesce(t.ultimo_pago, hoje())
  from t_imp t
  join jazigo j on j.perpetua = t.perpetua and j.rua = t.rua and j.quadra = t.quadra
  where t.valor is not null and t.dia is not null
  on conflict (jazigo_id, tipo) where status = 'ativa' do nothing;
  get diagnostics v_assin = row_count;

  -- registra o último mês pago de cada assinatura
  insert into cobranca (assinatura_id, referencia, vencimento, valor, status, data_pagamento, observacao)
  select a.id, t.ultimo_pago,
         make_date(extract(year from t.ultimo_pago)::int, extract(month from t.ultimo_pago)::int, a.dia_vencimento),
         a.valor, 'pago',
         make_date(extract(year from t.ultimo_pago)::int, extract(month from t.ultimo_pago)::int, a.dia_vencimento),
         'Importado da planilha'
  from t_imp t
  join jazigo j on j.perpetua = t.perpetua and j.rua = t.rua and j.quadra = t.quadra
  join assinatura a on a.jazigo_id = j.id and a.status = 'ativa'
  where t.ultimo_pago is not null
  on conflict (assinatura_id, referencia) do nothing;
  get diagnostics v_pagas = row_count;

  -- gera as cobranças dos meses seguintes até o mês atual (viram pendentes ou atrasadas)
  select min(ultimo_pago) into v_menor from t_imp;
  v_mes := coalesce(v_menor, date_trunc('month', hoje())::date);
  while v_mes <= date_trunc('month', hoje())::date loop
    perform gerar_cobrancas(v_mes);
    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  delete from import_planilha;
  return format('clientes: %s, jazigos: %s, assinaturas: %s, meses pagos registrados: %s',
                v_clientes, v_jazigos, v_assin, v_pagas);
end $$;
revoke execute on function importar_planilha() from public, anon, authenticated;
