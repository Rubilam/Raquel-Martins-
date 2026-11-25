import { supabase } from "../supabase";

export default function Menu({ abas, aba, onTroca }) {
  return (
    <nav className="menu" aria-label="Menu principal">
      <strong className="menu-marca">Raquel Martins</strong>
      <div className="menu-abas">
        {abas.map(([id, rotulo]) => (
          <button key={id} aria-current={aba === id ? "page" : undefined} onClick={() => onTroca(id)}>
            {rotulo}
          </button>
        ))}
      </div>
      <button className="menu-sair" onClick={() => supabase.auth.signOut()}>Sair</button>
    </nav>
  );
}
