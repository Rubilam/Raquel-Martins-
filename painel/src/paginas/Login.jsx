import { useState } from "react";
import { supabase } from "../supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      console.error(error);
      setErro(error.message === "Invalid login credentials"
      ? "E-mail ou senha incorretos."
      : error.message);
    }
    setEnviando(false);
  }

  return (
    <main className="login">
      <form className="login-caixa" onSubmit={entrar}>
        <h1>Raquel Martins</h1>
        <p className="suave">Painel de gestão</p>
        <label>E-mail
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>Senha
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
