# TechProfile AI — especificação do editor de currículo

**Data:** 2026-09-26  
**Status:** aprovado para implementação

## Objetivo

Transformar `/curriculo` em um editor manual de currículo com formulário editável e uma prévia sincronizada. A página inicia vazia e mantém os dados somente no estado em memória enquanto estiver montada.

## Escopo

- Campos: dados pessoais e contato, cargo/objetivo desejado, resumo profissional, experiências, formação, projetos, habilidades, idiomas e certificações.
- Campos de texto e listas repetíveis são editáveis; o usuário pode adicionar e remover itens das listas.
- Um modelo tipado representa o rascunho do currículo e aceita, por interface, um valor inicial opcional para permitir uma integração futura. Nesta etapa, a rota não fornece esse valor.
- A prévia é renderizada a partir do mesmo estado do formulário e mostra somente os campos e seções preenchidos.
- No desktop, editor à esquerda e prévia à direita. Em telas menores, editor e prévia ficam empilhados, sem overflow horizontal.
- A página preserva o shell, cabeçalho e identidade visual existentes; os estilos novos ficam restritos ao editor e à prévia.

## Fora de escopo

Não haverá conexão com `/analise`, preenchimento automático, IA, exportação ou geração de PDF, banco de dados, `localStorage`, cookies, outra persistência, autenticação, pagamentos ou integrações externas. Não será feito redesign global nem serão adicionadas dependências.

## Arquitetura proposta

- `features/resume/types.ts`: tipos para o rascunho e para valores iniciais futuros.
- `features/resume/model.ts`: criação do estado vazio e funções puras para atualizar e administrar itens das listas.
- `features/resume/components/resume-builder.tsx`: estado em memória e composição do layout do editor e da prévia.
- `features/resume/components/resume-editor.tsx`: formulário separado por seções, com controles de edição, inclusão e remoção.
- `features/resume/components/resume-preview.tsx`: apresentação somente de conteúdo preenchido, sem inferir ou criar informações.
- A rota existente `app/(product)/curriculo/page.tsx` renderiza o editor sem dados iniciais.
- CSS limitado ao escopo do editor, seguindo o tema claro e azul atual.

O modelo é uma estrutura de interface local, não uma promessa de persistência. Ao desmontar a página, o rascunho é perdido.

## Comportamento e validação

- Valores vazios são válidos e não aparecem na prévia.
- Campos opcionais preenchidos recebem validação básica apropriada, como formato de e-mail e URL; mensagens ficam junto ao campo correspondente.
- Entradas repetíveis podem ser adicionadas e removidas sem preencher a prévia com placeholders fictícios.
- A edição não executa chamadas de rede nem registra o conteúdo do currículo em logs.
- A prévia reflete as alterações do formulário durante a digitação.

## Testes e validação

- Adicionar testes unitários para o estado inicial vazio, operações puras do modelo e a regra de omitir conteúdo vazio, usando o runner já presente no repositório.
- Validar manualmente inclusão, edição e remoção nas seções; atualização da prévia; tela desktop e viewport mobile sem overflow.
- Executar `npm run lint`, `npm run typecheck`, `npm run build` e os testes existentes pertinentes.

## Critérios de aceitação

1. `/curriculo` abre vazio, sem consultar ou receber dados de `/analise`.
2. O formulário permite editar os grupos definidos e administrar os itens repetíveis.
3. A prévia atualiza junto com o formulário e mostra apenas campos preenchidos.
4. O layout apresenta editor à esquerda e prévia à direita no desktop, empilhando-os no mobile.
5. Não há chamadas externas nem persistência temporária ou permanente.
6. Não há IA, PDF, autenticação, banco, dependências novas ou alteração global do design.
7. Tipos deixam possível receber dados iniciais no futuro, mas a integração não é implementada.

## Riscos e decisões

- O rascunho é perdido ao navegar para fora ou recarregar, conforme solicitado; a transferência de contexto da análise e a persistência pertencem a uma etapa futura do gerador.
- Sem biblioteca visual ou formulários nova, os componentes e validações devem seguir os padrões já existentes no repositório.
- Nenhum conteúdo será inferido para completar campos ausentes; a prévia somente apresenta o que o usuário digitou.
