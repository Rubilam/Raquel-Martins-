import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { brl, dataBR, hojeISO, somaMes, msgErro } from "../utils";

const CATEGORIAS = ["Material", "Transporte", "Ferramentas", "Ajudante", "Outros"];

export default function Despesas() {
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [lista, setLista] = useState([]);
  const [f, setF] = useState({ data: hojeISO(), categoria: CATEGORIAS[0], descricao: "", valor: "" });
  const [erro, setErro] = useState("");
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("despesa").select("*")
      .gte("data", mes + "-01").lt("data", somaMes(mes, 1) + "-01").order("data", { ascending: false });
    if (error) setErro(error.message); else setLista(data);
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault(); setErro("");
    const valor = Number(String(f.valor).replace(",", "."));
    if (!(valor > 0)) return setErro("Informe um valor maior que zero.");
    const { error } = await supabase.from("despesa").insert({
      data: f.data, categoria: f.categoria, descricao: f.descricao.trim() || null, valor });
    if (error) return setErro(msgErro(error));
    setF({ ...f, descricao: "", valor: "" });
    if (f.data.slice(0, 7) === mes) carregar(); else setMes(f.data.slice(0, 7));
  }

  async function excluir(d) {
    if (!window.confirm(`Excluir a despesa de ${brl(d.valor)} (${d.categoria})?`)) return;
    const { error } = await supabase.from("despesa").delete().eq("id", d.id);
    if (error) setErro(msgErro(error)); else carregar();
  }

  const total = lista.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="pagina"><main className="conteudo">
      <h1>Despesas</h1>
      <form className="form" onSubmit={salvar}>
        <h3>Nova despesa</h3>
        <div className="trio">
          <label>Data<input type="date" value={f.data} onChange={set("data")} required /></label>
          <label>Categoria
            <select value={f.categoria} onChange={set("categoria")}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Valor (R$)<input value={f.valor} onChange={set("valor")} inputMode="decimal" required /></label>
        </div>
        <label>Descrição (opcional)<input value={f.descricao} onChange={set("descricao")} /></label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes"><button className="btn">Adicionar</button></div>
      </form>

      <div className="linha-titulo">
        <h2>Despesas do mês: {brl(total)}</h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês" />
      </div>
      {lista.length === 0 && <p className="suave">Nenhuma despesa neste mês.</p>}
      <section className="cartao"><ul className="itens sem-borda">
        {lista.map(d => (
          <li className="item" key={d.id}>
            <div><strong>{brl(d.valor)}</strong> · {d.categoria}
              <div className="suave">{dataBR(d.data)}{d.descricao && ` · ${d.descricao}`}</div></div>
            <button className="btn sec" onClick={() => excluir(d)}>Excluir</button>
          </li>
        ))}
      </ul></section>
    </main></div>
  );
}
