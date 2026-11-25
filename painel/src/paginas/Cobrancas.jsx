import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

// ---------- utilitários ----------
const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = iso => iso.split("-").reverse().join("/");
const isoSP = d => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD
const hojeISO = () => isoSP(new Date());
const daquiADias = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoSP(d); };
const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", cartao: "Cartão" };

const FILTROS = {
  atrasadas: { rotulo: "Atrasadas", ok: r => r.situacao === "atrasado" },
  avencer: { rotulo: "A vencer (3 dias)", ok: r => r.situacao === "pendente" && r.vencimento <= daquiADias(3) },
  pendentes: { rotulo: "Todas pendentes", ok: () => true },
};

const serv = i => i.servico || "mensalidade"; // "mensalidade" ou o tipo do serviço avulso
const ROT_SERVICO = { placa: "placa", restauracao: "recuperação de placa", rejunte: "rejunte do piso",
  pintura: "pintura de jazigo", flores: "flores", reforma: "reforma" };

function montarMensagem(grupo, cfg) {
  const nome = grupo.nome.split(" ")[0];
  const mens = grupo.itens.filter(i => serv(i) === "mensalidade");
  const avulsos = grupo.itens.filter(i => serv(i) !== "mensalidade");
  const lista = avulsos.map(i => `${ROT_SERVICO[serv(i)]} (${brl(i.valor)}, vencimento ${dataBR(i.vencimento)})`).join("; ");
  if (!mens.length)
    return `Olá, ${nome}. Passando para lembrar do pagamento pendente: ${lista}. Pix: ${cfg.chave_pix || ""}. Se já pagou, por favor desconsidere. Obrigada pela confiança.`;

  const atrasada = mens.some(i => i.situacao === "atrasado");
  const modelo = (atrasada ? cfg.modelo_atraso : cfg.modelo_lembrete) || "Olá, {nome}. Mensalidade de R$ {valor}, vencimento {data}. Pix: {chave_pix}";
  const total = mens.reduce((s, i) => s + Number(i.valor), 0);
  const primeira = mens.map(i => i.vencimento).sort()[0];
  const extra = mens.length > 1 ? ` (${mens.length} jazigos)` : "";
  const texto = modelo
    .replaceAll("{nome}", nome)
    .replaceAll("{valor}", total.toFixed(2).replace(".", ",") + extra)
    .replaceAll("{data}", dataBR(primeira))
    .replaceAll("{chave_pix}", cfg.chave_pix || "");
  return avulsos.length ? `${texto}\n\nTambém consta em aberto: ${lista}.` : texto;
}

function linkZap(telefone, texto) {
  const numero = telefone.length <= 11 ? "55" + telefone : telefone;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// ---------- uma cobrança dentro do cartão do cliente ----------
function Item({ item, onPagar }) {
  const [forma, setForma] = useState("pix");
  return (
    <li className="item">
      <div>
        <strong>{brl(item.valor)}</strong> · vence {dataBR(item.vencimento)}
        <div className="suave">
          {serv(item) !== "mensalidade" && <strong>{ROT_SERVICO[serv(item)]}: </strong>}
          {item.perpetua ? `Perpétua ${item.perpetua}, rua ${item.rua}, quadra ${item.quadra}` : "Sem túmulo indicado"}
          {item.situacao === "atrasado" && <span className="selo"> · {item.dias_atraso} dia(s) de atraso</span>}
        </div>
      </div>
      <div className="acoes">
        <select value={forma} onChange={e => setForma(e.target.value)} aria-label="Forma de pagamento">
          {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn sec" onClick={() => onPagar(item, forma)}>Marcar como pago</button>
      </div>
    </li>
  );
}

// ---------- tela principal ----------
export default function Cobrancas() {
  const [linhas, setLinhas] = useState([]);
  const [cfg, setCfg] = useState({});
  const [filtro, setFiltro] = useState("atrasadas");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [c, k] = await Promise.all([
      supabase.from("v_cobranca_status").select("*").eq("status", "pendente").order("vencimento"),
      supabase.from("configuracao").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (c.error) setErro(c.error.message);
    else { setLinhas(c.data); setCfg(k.data || {}); }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const contagem = useMemo(
    () => Object.fromEntries(Object.entries(FILTROS).map(([k, f]) => [k, linhas.filter(f.ok).length])),
    [linhas]
  );

  const grupos = useMemo(() => {
    const mapa = new Map();
    linhas.filter(FILTROS[filtro].ok).forEach(r => {
      if (!mapa.has(r.cliente_id)) {
        mapa.set(r.cliente_id, { id: r.cliente_id, nome: r.cliente_nome, codigo: r.cliente_codigo,
          telefone: r.telefone, aceita: r.aceita_lembrete_whatsapp, itens: [] });
      }
      mapa.get(r.cliente_id).itens.push(r);
    });
    return [...mapa.values()];
  }, [linhas, filtro]);

  async function enviarLembrete(g) {
    window.open(linkZap(g.telefone, montarMensagem(g, cfg)), "_blank", "noopener"); // abre o WhatsApp
    const { error } = await supabase.from("cobranca")
      .update({ lembrete_enviado_em: new Date().toISOString() })
      .in("id", g.itens.map(i => i.id));
    if (error) setErro(error.message); else carregar();
  }

  async function marcarPago(item, forma) {
    if (!window.confirm(`Confirmar pagamento de ${brl(item.valor)} (${item.cliente_nome})?`)) return;
    const { error } = await supabase.from("cobranca")
      .update({ status: "pago", data_pagamento: hojeISO(), forma_pagamento: forma })
      .eq("id", item.id);
    if (error) setErro(error.message); else carregar();
  }

  async function gerarMes() {
    const { data, error } = await supabase.rpc("gerar_cobrancas");
    if (error) setErro(error.message);
    else { setAviso(`${data} cobrança(s) nova(s) gerada(s) para este mês.`); carregar(); }
  }

  return (
    <div className="pagina">
      <header className="titulo">
        <h1>Cobranças</h1>
        <div className="acoes">
          <button className="btn sec" onClick={gerarMes}>Gerar cobranças do mês</button>
        </div>
      </header>

      <main className="conteudo">
        <div className="abas" role="group" aria-label="Filtrar cobranças">
          {Object.entries(FILTROS).map(([k, f]) => (
            <button key={k} className="aba" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
              {f.rotulo} ({contagem[k]})
            </button>
          ))}
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        {aviso && <p className="aviso">{aviso}</p>}
        {carregando && <p className="suave">Carregando…</p>}
        {!carregando && grupos.length === 0 && <p className="suave">Nenhuma cobrança nesta lista.</p>}

        {grupos.map(g => {
          const total = g.itens.reduce((s, i) => s + Number(i.valor), 0);
          const enviado = g.itens.find(i => i.lembrete_enviado_em)?.lembrete_enviado_em;
          return (
            <section className="cartao" key={g.id}>
              <div className="cartao-topo">
                <div>
                  <h2>{g.nome} <span className="suave">{g.codigo}</span></h2>
                  <div className="suave">
                    {g.itens.length} cobrança(s) · total {brl(total)}
                    {enviado && ` · lembrete enviado em ${new Date(enviado).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
                {g.aceita
                  ? <button className="btn" onClick={() => enviarLembrete(g)}>Enviar lembrete</button>
                  : <span className="suave">Não aceita lembretes</span>}
              </div>
              <ul className="itens">
                {g.itens.map(i => <Item key={i.id} item={i} onPagar={marcarPago} />)}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
