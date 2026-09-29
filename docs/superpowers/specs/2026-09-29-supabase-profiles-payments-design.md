# Especificação: base segura de perfis e pagamentos

**Status:** aprovado para implementação.

## Objetivo

Preparar o banco Supabase para registrar o perfil Free/Pro e pagamentos Mercado Pago, dando ao backend futuro uma base idempotente e protegida por RLS. Este escopo não processa compras nem concede acesso Pro em produção.

## Estado e limites

- Supabase Auth por e-mail/senha já existe. Novos perfis devem referenciar `auth.users`; senhas não pertencem a `public`.
- A pasta `supabase/migrations/` não possui migrations ainda.
- O projeto não tem Supabase CLI, `psql` nem banco local disponível. A migration e testes SQL serão criados, sem conexão ou aplicação remota.
- Nenhum Checkout, webhook, mudança de plano em produção, página de pagamento, credencial Mercado Pago ou `service_role` será usado.
- A migration é estritamente aditiva: cria funções, triggers, policies e tabelas novas; não altera nem remove objetos existentes. Backfill apenas insere perfis ausentes.

## Modelo de dados

### `public.profiles`

| Coluna | Definição |
|---|---|
| `user_id` | UUID, chave primária e FK para `auth.users(id) ON DELETE CASCADE` |
| `plan` | TEXT, `NOT NULL`, default `free`, CHECK limitado a `free` ou `pro` |
| `pro_expires_at` | TIMESTAMPTZ, nullable |
| `created_at` | TIMESTAMPTZ, `NOT NULL`, default `now()` |
| `updated_at` | TIMESTAMPTZ, `NOT NULL`, default `now()` |

Perfil não guarda credenciais ou senha. Perfil Free nasce sem expiração Pro.

### `public.payments`

| Coluna | Definição |
|---|---|
| `id` | UUID, chave primária, default `gen_random_uuid()` |
| `user_id` | UUID, `NOT NULL`, FK para `auth.users(id) ON DELETE CASCADE` |
| `provider` | TEXT, `NOT NULL`, CHECK inicial limitado a `mercado_pago` |
| `provider_payment_id` | TEXT, `NOT NULL` |
| `amount` | NUMERIC(10,2), `NOT NULL` |
| `currency` | TEXT, `NOT NULL`, default `BRL` |
| `status` | TEXT, `NOT NULL` |
| `access_days` | INTEGER, `NOT NULL`, default `30` |
| `created_at` | TIMESTAMPTZ, `NOT NULL`, default `now()` |
| `updated_at` | TIMESTAMPTZ, `NOT NULL`, default `now()` |

Uma constraint UNIQUE em `(provider, provider_payment_id)` impede registrar/processar duas vezes a mesma transação do mesmo provedor. O schema não decide estados de negócio, preço, recorrência ou regras de reembolso.

## Criação e atualização

- Uma função pequena `SECURITY DEFINER` será usada apenas pelo trigger `AFTER INSERT ON auth.users` para criar profile Free.
- A função define `search_path` vazio, qualifica objetos com schema e usa `ON CONFLICT (user_id) DO NOTHING`; metadados enviados pelo browser não podem definir plano ou expiração.
- A migration também insere perfis para `auth.users` existentes sem profile com `INSERT ... SELECT ... ON CONFLICT DO NOTHING`. Reaplicar o backfill não duplica nem sobrescreve registros.
- Um trigger `BEFORE UPDATE` por tabela usa helper simples para atualizar `updated_at`; sem framework ou trigger genérico multiuso.

## Autorização e RLS

- RLS habilitado em ambas as tabelas.
- Usuários autenticados recebem apenas `SELECT` e apenas linhas onde `user_id = auth.uid()`.
- `anon` não recebe acesso às tabelas.
- `authenticated` não recebe `INSERT`, `UPDATE` ou `DELETE`; nenhuma policy permissiva ou policy de escrita é criada.
- Não há grant de escrita a clientes para `plan`, `pro_expires_at` ou `payments`. Futuro backend confiável/webhook será projetado separadamente; esta fase não adiciona `service_role`.

## Regra de acesso Pro

Adicionar `features/billing/access.ts` com helper puro `isProActive(profile, now)`. O helper retorna verdadeiro somente quando `profile.plan === "pro"`, `pro_expires_at` existe e seu instante é estritamente posterior ao `now` recebido. Valores ausentes, inválidos, expirados ou `free` retornam falso. O helper não lê sessão, banco, ambiente ou browser e não será ligado a controles de acesso nesta fase.

## Testes e validação

- Testes TypeScript/Node com fixtures fictícias cobrem perfil Free, helper Pro ativo/expirado e ausência de dados.
- Testes SQL pgTAP em `supabase/tests/` cobrem trigger de cadastro, backfill/idempotência, acesso próprio e isolamento entre dois usuários, ausência de permissões/policies de escrita e unicidade do pagamento.
- O teste de migration usa apenas usuários, pagamentos e valores fictícios em transação local.
- Não usar contas, tokens, chaves reais, endpoint remoto ou ambiente de produção.
- `npm run lint`, `npm run typecheck`, `npm run build`, suíte Node e `git diff --check` devem passar.
- Limitação: sem Supabase CLI/instância PostgreSQL local, pgTAP não poderá ser executado aqui. Não instalar ferramentas nem conectar ao projeto remoto sem autorização separada; validar SQL localmente quando um Supabase local estiver disponível.

## Documentação

Atualizar `PLANS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` e `docs/DECISIONS.md` para registrar as tabelas, a política RLS, o trigger/backfill, o status de Mercado Pago como provedor futuro e que checkout/webhook ainda não existem.

## Critérios de aceite

1. Novo `auth.users` ganha exatamente um profile `free` com `pro_expires_at IS NULL`.
2. Backfill cria profile para auth users antigos ausentes sem duplicar ou sobrescrever dados existentes.
3. RLS e grants permitem leitura própria, negam leitura cruzada e bloqueiam escrita por `authenticated`.
4. Pagamento duplicado do mesmo provider/payment id falha pela constraint UNIQUE.
5. Helper puro aceita apenas Pro cuja expiração é futura.
6. Nenhuma migration é aplicada a qualquer banco remoto; checkout, webhook e atualização em produção continuam ausentes.

## Riscos e consequências

- As alterações de plano dependerão de uma futura rotina backend confiável; nenhum usuário pode conceder Pro a si mesmo.
- A migration pressupõe que o projeto Supabase disponibiliza `gen_random_uuid()` (presente em PostgreSQL usado pelo Supabase).
- Comandos padrão `supabase test db` podem reconstruir banco local; só usar instância de teste descartável e nunca apontar para o projeto remoto.
- Produtos, preços, recorrência, política de reembolso e significado de status de pagamento permanecem fora desta especificação.
