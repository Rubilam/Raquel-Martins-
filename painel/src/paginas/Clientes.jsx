import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { brl, dataBR, hojeISO, soDigitos, somaMes, msgErro } from "../utils";

// Mensalidade (cuidado do jazigo) de um túmulo: a ativa, ou a mais recente
const assDe = j => {
  const l = (j.assinatura || []).filter(a => a.tipo === "cuidado_jazigo");
  return l.find(a => a.status === "ativa") || l[l.length - 1];
};
const clienteAtivo = c => (c.jazigo || []).some(j => assDe(j)?.status === "ativa");

// Serviços avulsos (tabela "pedido"). O status "instalado" do banco aparece como "Concluído".
const TIPOS = { placa: "Placa", restauracao: "Recuperação / restauração de placa", rejunte: "Rejunte do piso",
  pintura: "Pintura de jazigo", flores: "Flores", reforma: "Outra reforma" };
const MATERIAIS = { bronze: "Bronze", granito: "Granito", porcelanato: "Porcelanato", lajota: "Lajota", inox: "Inox", outro: "Outro" };
const STATUS = { orcamento: "Orçamento", aprovado: "Aprovado", em_producao: "Em andamento", instalado: "Concluído", cancelado: "Cancelado" };
const ORIGENS = { whatsapp: "WhatsApp", indicacao: "Indicação", instagram: "Instagram",
  administracao_cemiterio: "Administração do cemitério", presencial: "No cemitério", outro: "Outro" };
const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", cartao: "Cartão" };

function ClienteForm({ cliente, onFim, onCancelar }) {
  const [f, setF] = useState({
    nome: cliente?.nome || "", telefone: cliente?.telefone || "",
    aceita: cliente?.aceita_lembrete_whatsapp ?? true, obs: cliente?.observacoes || "",
  });
  const [erro, setErro] = useState("");
  const set = k => e => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function salvar(e) {
    e.preventDefault(); setErro("");
    const dados = { nome: f.nome.trim(), telefone: soDigitos(f.telefone),
      aceita_lembrete_whatsapp: f.aceita, observacoes: f.obs.trim() || null };
    if (!/^\d{10,13}$/.test(dados.telefone)) return setErro("Informe o telefone com DDD (10 a 13 dígitos).");
    const { data, error } = cliente
      ? await supabase.from("cliente").update(dados).eq("id", cliente.id)
      : await supabase.from("cliente").insert(dados).select().single();
    if (error) return setErro(msgErro(error));
    onFim(data?.id || cliente.id);
  }

  return (
    <form className="form" onSubmit={salvar}>
      <h3>{cliente ? "Editar cliente" : "Novo cliente"}</h3>
      <label>Nome<input value={f.nome} onChange={set("nome")} required /></label>
      <label>Telefone (WhatsApp, com DDD)<input value={f.telefone} onChange={set("telefone")} inputMode="tel" required /></label>
      <label>Observações<input value={f.obs} onChange={set("obs")} /></label>
      <label className="check"><input type="checkbox" checked={f.aceita} onChange={set("aceita")} /> Aceita lembretes por WhatsApp</label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes"><button className="btn">Salvar</button>
        <button type="button" className="btn sec" onClick={onCancelar}>Cancelar</button></div>
    </form>
  );
}

function TumuloForm({ clienteId, jazigo, onFim, onCancelar }) {
  const ass = jazigo ? assDe(jazigo) : null;
  const [f, setF] = useState({
    perpetua: jazigo?.perpetua || "", rua: jazigo?.rua || "", quadra: jazigo?.quadra || "",
    obs: jazigo?.observacoes || "", valor: ass ? String(ass.valor) : "", dia: ass ? String(ass.dia_vencimento) : "",
    inicio: somaMes(hojeISO().slice(0, 7), 1),
  });
  const [erro, setErro] = useState("");
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const mostraMensalidade = !ass || ass.status === "ativa";

  async function salvar(e) {
    e.preventDefault(); setErro("");
    const valor = f.valor === "" ? null : Number(String(f.valor).replace(",", "."));
    const dia = f.dia === "" ? null : Number(f.dia);
    if (valor !== null && (Number.isNaN(valor) || valor < 0)) return setErro("Valor inválido.");
    if (valor !== null && !(dia >= 1 && dia <= 28)) return setErro("Informe o dia de vencimento (1 a 28).");

    const campos = { perpetua: f.perpetua.trim(), rua: f.rua.trim(),
      quadra: f.quadra.trim().toUpperCase(), observacoes: f.obs.trim() || null };
    let jid = jazigo?.id;
    if (jid) {
      const r = await supabase.from("jazigo").update(campos).eq("id", jid);
      if (r.error) return setErro(msgErro(r.error));
    } else {
      const r = await supabase.from("jazigo").insert({ ...campos, cliente_id: clienteId }).select().single();
      if (r.error) return setErro(msgErro(r.error));
      jid = r.data.id;
    }

    if (valor !== null) {
      let r;
      if (ass?.status === "ativa") { // altera a mensalidade e as cobranças que ainda estão pendentes
        r = await supabase.from("assinatura").update({ valor, dia_vencimento: dia }).eq("id", ass.id);
        if (!r.error) r = await supabase.from("cobranca").update({ valor }).eq("assinatura_id", ass.id).eq("status", "pendente");
      } else if (!ass) {
        r = await supabase.from("assinatura").insert({ cliente_id: clienteId, jazigo_id: jid, tipo: "cuidado_jazigo",
          valor, dia_vencimento: dia, data_inicio: f.inicio + "-01" });
      }
      if (r?.error) return setErro(msgErro(r.error));
    }
    onFim();
  }

  return (
    <form className="form" onSubmit={salvar}>
      <h3>{jazigo ? "Editar túmulo" : "Novo túmulo"}</h3>
      <div className="trio">
        <label>Perpétua<input value={f.perpetua} onChange={set("perpetua")} required /></label>
        <label>Rua<input value={f.rua} onChange={set("rua")} required /></label>
        <label>Quadra<input value={f.quadra} onChange={set("quadra")} required /></label>
      </div>
      <label>Observações (ex.: portão azul ao lado)<input value={f.obs} onChange={set("obs")} /></label>
      {mostraMensalidade && (
        <>
          <div className="trio">
            <label>Valor mensal (R$)<input value={f.valor} onChange={set("valor")} inputMode="decimal" /></label>
            <label>Dia do vencimento (1 a 28)<input value={f.dia} onChange={set("dia")} inputMode="numeric" /></label>
            {!ass && <label>Primeira cobrança em<input type="month" value={f.inicio} onChange={set("inicio")} /></label>}
          </div>
          <p className="suave">Deixe o valor em branco se este túmulo não tem mensalidade.</p>
        </>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes"><button className="btn">Salvar</button>
        <button type="button" className="btn sec" onClick={onCancelar}>Cancelar</button></div>
    </form>
  );
}

function PedidoForm({ cliente, pedido, onFim, onCancelar }) {
  const [f, setF] = useState({
    tipo: pedido?.tipo || "placa", jazigo: pedido?.jazigo_id || "", material: pedido?.material || "",
    valor: pedido ? String(pedido.valor) : "", status: "aprovado", origem: pedido?.origem || "",
    obs: pedido?.observacoes || "", pago: "nao", forma: "pix", venc: hojeISO(),
  });
  const [erro, setErro] = useState("");
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const comMaterial = f.tipo === "placa" || f.tipo === "restauracao";
  const cobrando = !pedido && f.status !== "orcamento";

  async function salvar(e) {
    e.preventDefault(); setErro("");
    const valor = Number(String(f.valor).replace(",", "."));
    if (Number.isNaN(valor) || valor < 0) return setErro("Informe o valor do serviço.");
    const campos = { cliente_id: cliente.id, jazigo_id: f.jazigo || null, tipo: f.tipo,
      material: comMaterial ? f.material || null : null, valor, origem: f.origem || null, observacoes: f.obs.trim() || null };

    if (pedido) { // edição: o status muda pela lista; aqui só os dados do serviço
      let r = await supabase.from("pedido").update(campos).eq("id", pedido.id);
      if (!r.error && valor !== Number(pedido.valor))
        r = await supabase.from("cobranca").update({ valor }).eq("pedido_id", pedido.id).eq("status", "pendente");
      if (r.error) return setErro(msgErro(r.error));
      return onFim();
    }

    const hoje = hojeISO();
    const r = await supabase.from("pedido").insert({ ...campos, status: f.status,
      data_aprovacao: f.status !== "orcamento" ? hoje : null,
      data_conclusao: f.status === "instalado" ? hoje : null }).select().single();
    if (r.error) return setErro(msgErro(r.error));
    if (cobrando && valor > 0) { // gera a cobrança (já paga ou pendente)
      const pago = f.pago === "sim";
      const r2 = await supabase.from("cobranca").insert({ pedido_id: r.data.id, vencimento: pago ? hoje : f.venc, valor,
        status: pago ? "pago" : "pendente", data_pagamento: pago ? hoje : null, forma_pagamento: pago ? f.forma : null });
      if (r2.error) return setErro(msgErro(r2.error));
    }
    onFim();
  }

  return (
    <form className="form" onSubmit={salvar}>
      <h3>{pedido ? "Editar serviço" : "Novo serviço"}</h3>
      <div className="trio">
        <label>Serviço
          <select value={f.tipo} onChange={set("tipo")}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Túmulo
          <select value={f.jazigo} onChange={set("jazigo")}>
            <option value="">Não se aplica</option>
            {(cliente.jazigo || []).map(j => <option key={j.id} value={j.id}>Perpétua {j.perpetua}, rua {j.rua}, quadra {j.quadra}</option>)}
          </select>
        </label>
        {comMaterial && (
          <label>Material
            <select value={f.material} onChange={set("material")}>
              <option value="">—</option>
              {Object.entries(MATERIAIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
        <label>Valor (R$)<input value={f.valor} onChange={set("valor")} inputMode="decimal" required /></label>
        <label>Como o cliente chegou
          <select value={f.origem} onChange={set("origem")}>
            <option value="">—</option>
            {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {!pedido && (
          <label>Situação
            <select value={f.status} onChange={set("status")}>
              {Object.entries(STATUS).filter(([k]) => k !== "cancelado").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
      </div>
      <label>Observações<input value={f.obs} onChange={set("obs")} /></label>
      {cobrando && (
        <div className="trio">
          <label>Pagamento
            <select value={f.pago} onChange={set("pago")}>
              <option value="nao">Ainda não pago</option>
              <option value="sim">Já pago</option>
            </select>
          </label>
          {f.pago === "sim"
            ? <label>Forma de pagamento
                <select value={f.forma} onChange={set("forma")}>
                  {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            : <label>Vencimento<input type="date" value={f.venc} onChange={set("venc")} /></label>}
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes"><button className="btn">Salvar</button>
        <button type="button" className="btn sec" onClick={onCancelar}>Cancelar</button></div>
    </form>
  );
}

export default function Clientes() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [aberto, setAberto] = useState(null);
  const [modo, setModo] = useState(null); // {t:"novoCliente"} | {t:"editarCliente",id} | {t:"novoTumulo",id} | {t:"editarTumulo",jid}
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("cliente").select("*, jazigo(*, assinatura(*)), pedido(*, cobranca(*))").order("nome");
    if (error) setErro(error.message); else setLista(data);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const fim = id => { setModo(null); if (id) setAberto(id); carregar(); };

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase(), d = soDigitos(busca);
    return lista.filter(c => {
      if (status === "ativos" && !clienteAtivo(c)) return false;
      if (status === "inativos" && clienteAtivo(c)) return false;
      if (!q) return true;
      return c.nome.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) ||
        (d && c.telefone.includes(d)) || (c.jazigo || []).some(j => j.perpetua.toLowerCase().includes(q));
    });
  }, [lista, busca, status]);

  async function alternar(a) {
    setErro("");
    if (a.status === "ativa") {
      if (!window.confirm("Cancelar a mensalidade deste túmulo? As cobranças pendentes serão canceladas.")) return;
      const r = await supabase.from("assinatura").update({ status: "cancelada", data_cancelamento: hojeISO() }).eq("id", a.id);
      if (r.error) return setErro(msgErro(r.error));
      const r2 = await supabase.from("cobranca").update({ status: "cancelado" }).eq("assinatura_id", a.id).eq("status", "pendente");
      if (r2.error) return setErro(msgErro(r2.error));
    } else {
      const r = await supabase.from("assinatura").update({ status: "ativa", data_cancelamento: null }).eq("id", a.id);
      if (r.error) return setErro(msgErro(r.error));
    }
    carregar();
  }

  async function mudarStatus(p, novo) {
    setErro("");
    if (novo === p.status) return;
    if (novo === "cancelado" && !window.confirm("Cancelar este serviço? A cobrança pendente também será cancelada.")) return;
    const hoje = hojeISO();
    const campos = { status: novo };
    if (novo !== "orcamento" && novo !== "cancelado" && !p.data_aprovacao) campos.data_aprovacao = hoje;
    if (novo === "instalado") campos.data_conclusao = hoje;
    let r = await supabase.from("pedido").update(campos).eq("id", p.id);
    if (r.error) return setErro(msgErro(r.error));
    if (novo === "cancelado") {
      r = await supabase.from("cobranca").update({ status: "cancelado" }).eq("pedido_id", p.id).eq("status", "pendente");
    } else if (novo !== "orcamento" && Number(p.valor) > 0 && !(p.cobranca || []).some(x => x.status !== "cancelado")) {
      r = await supabase.from("cobranca").insert({ pedido_id: p.id, vencimento: hoje, valor: p.valor });
    }
    if (r.error) return setErro(msgErro(r.error));
    carregar();
  }

  return (
    <div className="pagina"><main className="conteudo">
      <div className="linha-titulo">
        <h1>Clientes</h1>
        <button className="btn" onClick={() => setModo({ t: "novoCliente" })}>+ Novo cliente</button>
      </div>
      {modo?.t === "novoCliente" && <ClienteForm onFim={fim} onCancelar={() => setModo(null)} />}

      <div className="filtros">
        <input placeholder="Buscar por nome, código, telefone ou perpétua" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar" />
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filtrar por situação">
          <option value="todos">Todos</option>
          <option value="ativos">Com mensalidade ativa</option>
          <option value="inativos">Sem mensalidade ativa</option>
        </select>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {carregando && <p className="suave">Carregando…</p>}
      {!carregando && visiveis.length === 0 && <p className="suave">Nenhum cliente encontrado.</p>}

      {visiveis.map(c => {
        const ativo = clienteAtivo(c), aberta = aberto === c.id;
        return (
          <section className="cartao" key={c.id}>
            <div className="cartao-topo">
              <div>
                <h2>{c.nome} <span className="suave">{c.codigo}</span></h2>
                <div className="suave">{c.telefone} · {(c.jazigo || []).length} túmulo(s){" "}
                  <span className={"badge " + (ativo ? "ok" : "off")}>{ativo ? "Mensalidade ativa" : "Sem mensalidade"}</span>
                </div>
                {c.observacoes && <div className="suave">{c.observacoes}</div>}
              </div>
              <div className="acoes">
                <button className="btn sec" onClick={() => setModo({ t: "editarCliente", id: c.id })}>Editar</button>
                <button className="btn sec" onClick={() => setAberto(aberta ? null : c.id)}>{aberta ? "Fechar" : "Túmulos"}</button>
              </div>
            </div>

            {modo?.t === "editarCliente" && modo.id === c.id &&
              <ClienteForm cliente={c} onFim={fim} onCancelar={() => setModo(null)} />}

            {aberta && (
              <>
                <ul className="itens">
                  {(c.jazigo || []).map(j => {
                    const a = assDe(j);
                    if (modo?.t === "editarTumulo" && modo.jid === j.id)
                      return <li key={j.id}><TumuloForm clienteId={c.id} jazigo={j} onFim={fim} onCancelar={() => setModo(null)} /></li>;
                    return (
                      <li className="item" key={j.id}>
                        <div>
                          <strong>Perpétua {j.perpetua}, rua {j.rua}, quadra {j.quadra}</strong>
                          <div className="suave">
                            {a ? `${brl(a.valor)} por ${a.periodicidade === "anual" ? "ano" : "mês"}, vence dia ${a.dia_vencimento} · ${a.status === "ativa" ? "ativa" : "cancelada"}` : "Sem mensalidade"}
                            {j.observacoes && ` · ${j.observacoes}`}
                          </div>
                        </div>
                        <div className="acoes">
                          <button className="btn sec" onClick={() => setModo({ t: "editarTumulo", jid: j.id })}>Editar</button>
                          {a && <button className="btn sec" onClick={() => alternar(a)}>{a.status === "ativa" ? "Cancelar mensalidade" : "Reativar"}</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {modo?.t === "novoTumulo" && modo.id === c.id &&
                  <TumuloForm clienteId={c.id} onFim={fim} onCancelar={() => setModo(null)} />}
                {modo?.t === "novoPedido" && modo.id === c.id &&
                  <PedidoForm cliente={c} onFim={fim} onCancelar={() => setModo(null)} />}
                <div className="acoes-fim">
                  <button className="btn sec" onClick={() => setModo({ t: "novoTumulo", id: c.id })}>+ Adicionar túmulo</button>
                  <button className="btn sec" onClick={() => setModo({ t: "novoPedido", id: c.id })}>+ Adicionar serviço</button>
                </div>
                {(c.pedido || []).length > 0 && (
                  <>
                    <h3 className="sub-titulo">Serviços</h3>
                    <ul className="itens">
                      {c.pedido.slice().sort((a, b) => b.data_orcamento.localeCompare(a.data_orcamento)).map(p => {
                        if (modo?.t === "editarPedido" && modo.pid === p.id)
                          return <li key={p.id}><PedidoForm cliente={c} pedido={p} onFim={fim} onCancelar={() => setModo(null)} /></li>;
                        const j = (c.jazigo || []).find(x => x.id === p.jazigo_id);
                        const cobr = (p.cobranca || []).filter(x => x.status !== "cancelado");
                        const pago = cobr.length > 0 && cobr.every(x => x.status === "pago");
                        const pagamento = pago ? "Pago" : cobr.length ? "Pagamento pendente"
                          : p.status === "orcamento" ? "Aguardando aprovação" : "Sem cobrança";
                        return (
                          <li className="item" key={p.id}>
                            <div>
                              <strong>{TIPOS[p.tipo]}{p.material && ` · ${MATERIAIS[p.material]}`} · {brl(p.valor)}</strong>
                              <div className="suave">{dataBR(p.data_orcamento)} · {pagamento}
                                {j && ` · perpétua ${j.perpetua}, rua ${j.rua}, quadra ${j.quadra}`}</div>
                            </div>
                            <div className="acoes">
                              <select value={p.status} onChange={e => mudarStatus(p, e.target.value)} aria-label="Situação do serviço">
                                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                              <button className="btn sec" onClick={() => setModo({ t: "editarPedido", pid: p.id })}>Editar</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        );
      })}
    </main></div>
  );
}
