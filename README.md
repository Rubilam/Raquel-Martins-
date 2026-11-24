# Raquel Martins | Conservação de Túmulos

Site público e painel de gestão para uma empresa de conservação de túmulos (placas, restauração e cuidado mensal de jazigos).

## Estrutura
- `site/`: site público (HTML, CSS e JS puros), com botões de WhatsApp por serviço
- `painel/`: painel administrativo (React + Vite + Supabase): login e cobranças
- `banco/`: `schema.sql` (tabelas, regras de acesso, views) e `importar.sql` (migração de planilha)

## Como rodar
1. Supabase > SQL Editor: rode `banco/schema.sql` e depois `banco/importar.sql`.
2. Crie o usuário em Authentication e registre-o na tabela `administrador`.
3. `cd painel && npm install`, copie `.env.example` para `.env.local`, preencha e rode `npm run dev`.

Use apenas dados fictícios neste repositório.
