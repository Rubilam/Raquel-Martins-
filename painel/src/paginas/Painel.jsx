import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../supabase";
import { brl, hojeISO, somaMes } from "../utils";

const PERIODOS = { mes: ["Este mês", 0], tri: ["3 meses", 2], ano: ["12 meses", 11], tudo: ["Tudo", null] };
const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", cartao: "Cartão" };
const soma = a => a.reduce((s, x) => s + Number(x.valor), 0);
const agrupar = (a, chave) => Object.entries(a.reduce((m, x) => {
  const k = x[chave] || "Não informado"; m[k] = (m[k] || 0) + Number(x.valor); return m;
}, {})).sort((x, y) => y[1] - x[1]);

export default function Painel() {
  const [periodo, setPeriodo] = useState("mes");
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      const hoje = hojeISO().slice(0, 7), n = PERIODOS[periodo][1];
      const inicio = n === null ? "0001-01-01" : somaMes(hoje, -n) + "-01";
      const r = await Promise.all([
        supabase.from("cobranca").select("valor, forma_pagamento").eq("status", "pago").gte("data_pagamento", inicio),
        supabase.from("despesa").select("valor, categoria").gte("data", inicio),
        supabase.from("v_fluxo_mensal").select("*").gte("mes", somaMes(hoje, -11) + "-01"),
        supabase.from("v_cobranca_status").select("valor, situacao, cliente_id").eq("status", "pendente"),
        supabase.from("assinatura").select("valor, periodicidade").eq("status", "ativa"),
      ]);
      const falha = r.find(x => x.error);
      if (falha) return setErro(falha.error.message);
      setD({ pagas: r[0].data, desp: r[1].data, fluxo: r[2].data, pend: r[3].data, ass: r[4].data });
    })();
  }, [periodo]);

  if (erro) return <div className="pagina"><main className="conteudo"><p className="erro">{erro}</p></main></div>;
  if (!d) return <p className="centro">Carregando…</p>;

  const arrecadado = soma(d.pagas), gastos = soma(d.desp);
  const atrasadas = d.pend.filter(p => p.situacao === "atrasado");
  const previsto = d.ass.reduce((s, a) => s + Number(a.valor) / (a.periodicidade === "anual" ? 12 : 1), 0);
  const cards = [
    { t: "Arrecadado", v: brl(arrecadado) },
    { t: "Gastos", v: brl(gastos) },
    { t: "Saldo", v: brl(arrecadado - gastos), neg: arrecadado - gastos < 0 },
    { t: "A receber (pendente)", v: brl(soma(d.pend)) },
    { t: "Em atraso", v: brl(soma(atrasadas)), s: `${new Set(atrasadas.map(a => a.cliente_id)).size} cliente(s)` },
    { t: "Mensalidades previstas por mês", v: brl(previsto), s: `${d.ass.length} assinatura(s) ativa(s)` },
  ];
  const serie = d.fluxo.map(r => ({ mes: `${r.mes.slice(5, 7)}/${r.mes.slice(2, 4)}`,
    Receita: Number(r.receita), Gastos: Number(r.despesa) }));
  const porForma = agrupar(d.pagas.map(p => ({ valor: p.valor, k: FORMAS[p.forma_pagamento] })), "k");
  const porCategoria = agrupar(d.desp, "categoria");

  return (
    <div className="pagina"><main className="conteudo">
      <div className="linha-titulo">
        <h1>Relatórios</h1>
        <div className="abas" role="group" aria-label="Período">
          {Object.entries(PERIODOS).map(([k, [rotulo]]) => (
            <button key={k} className="aba" aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>{rotulo}</button>
          ))}
        </div>
      </div>

      <div className="numeros">
        {cards.map(c => (
          <div className="numero" key={c.t}>
            <span className="suave">{c.t}</span>
            <strong className={c.neg ? "neg" : ""}>{c.v}</strong>
            {c.s && <span className="suave">{c.s}</span>}
          </div>
        ))}
      </div>

      <section className="cartao">
        <h2>Receita e gastos por mês (últimos 12 meses)</h2>
        {serie.length === 0 ? <p className="suave">Ainda não há movimentação.</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={v => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={v => brl(v)} />
              <Legend />
              <Bar dataKey="Receita" fill="#4B2A8A" />
              <Bar dataKey="Gastos" fill="#C9A24B" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="duas">
        <section className="cartao"><h2>Arrecadado por forma de pagamento</h2>
          {porForma.length === 0 && <p className="suave">Sem pagamentos no período.</p>}
          <ul className="itens sem-borda">{porForma.map(([k, v]) => <li className="item" key={k}><span>{k}</span><strong>{brl(v)}</strong></li>)}</ul>
        </section>
        <section className="cartao"><h2>Gastos por categoria</h2>
          {porCategoria.length === 0 && <p className="suave">Sem despesas no período.</p>}
          <ul className="itens sem-borda">{porCategoria.map(([k, v]) => <li className="item" key={k}><span>{k}</span><strong>{brl(v)}</strong></li>)}</ul>
        </section>
      </div>
    </main></div>
  );
}
