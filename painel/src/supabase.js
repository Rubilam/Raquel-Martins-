import { createClient } from "@supabase/supabase-js";

// A chave "anon" pode ficar no front: quem protege os dados é o login + RLS do banco.
// NUNCA coloque a chave "service_role" aqui nem no GitHub.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
