import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./paginas/Login";
import Painel from "./paginas/Painel";
import Cobrancas from "./paginas/Cobrancas";
import Clientes from "./paginas/Clientes";
import Despesas from "./paginas/Despesas";
import Menu from "./componentes/Menu";

const ABAS = [
  ["painel", "Relatórios"],
  ["cobrancas", "Cobranças"],
  ["clientes", "Clientes"],
  ["despesas", "Despesas"],
];
const PAGINAS = { painel: Painel, cobrancas: Cobrancas, clientes: Clientes, despesas: Despesas };

export default function App() {
  const [sessao, setSessao] = useState(undefined); // undefined = ainda verificando
  const [aba, setAba] = useState("painel");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (sessao === undefined) return <p className="centro">Carregando…</p>;
  if (!sessao) return <Login />;

  const Pagina = PAGINAS[aba];
  return (
    <>
      <Menu abas={ABAS} aba={aba} onTroca={setAba} />
      <Pagina />
    </>
  );
}
