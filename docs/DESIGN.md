# Diretrizes de design

## Princípios

- Apresentar uma plataforma profissional de carreira e tecnologia com clareza, calma e credibilidade.
- Usar espaço em branco, hierarquia direta e poucos elementos por tela.
- Não prometer contratação, resultados ou diagnósticos que ainda não existem.
- Tratar lacunas como informações não encontradas no material enviado, nunca como falta de competência.
- A pessoa mantém controle sobre o conteúdo e revisa qualquer texto sugerido.

## Identidade visual

Paleta de interface:

| Uso | Cor |
| --- | --- |
| Superfície | `#FFFFFF` |
| Fundo suave | `#F3F6F8` |
| Azul principal | `#0A66C2` |
| Azul escuro | `#16437E` |
| Azul claro | `#E8F3FF` |
| Texto principal | `#172033` |
| Texto secundário | `#5E6B7A` |
| Bordas | `#D9E2EA` |
| Sucesso | `#057642` |

Azul é o destaque da marca. Fundos de páginas e áreas de conteúdo permanecem claros; não usar fundo preto, navy dominante, neon ou gradientes fortes. A marca usa o símbolo azul com o nome em grafite e está disponível em SVG nas versões completa e mark em `public/brand/`.

## Tipografia e espaçamento

- Usar Arial/Helvetica do sistema para evitar dependência de fonte externa e manter leitura consistente.
- H1 entre 42 e 60 px em desktop, reduzido para cerca de 39 px em telas estreitas.
- Títulos de seção entre 32 e 42 px; texto de corpo geralmente entre 14 e 18 px; labels entre 10 e 13 px.
- Usar escala de espaçamento baseada em passos de 4 px, com intervalos amplos entre seções e grupos relacionados mais próximos.
- Limitar a largura dos textos e do conteúdo principal para facilitar leitura em telas grandes.

## Componentes

- **Botão principal:** azul `#0A66C2`, texto branco, borda arredondada de 8 px e hover discreto.
- **Botão secundário:** fundo branco, borda `#D9E2EA`, texto principal e mesmo padrão de foco.
- **Cards:** fundo branco, borda suave, raio entre 8 e 14 px e sombra mínima.
- **Inputs:** fundo branco, borda `#CBD5E1`, rótulo explícito e foco azul visível.
- **Badges:** fundo azul claro e texto azul escuro; usar apenas quando comunicam estado ou contexto.
- **Navegação:** cabeçalho branco com borda inferior sutil, links discretos e ação primária. Em telas pequenas, usar menu nativo expansível.
- **Estados de upload:** manter estados de validação, envio, leitura, sucesso e erro legíveis e acessíveis sem alterar o fluxo funcional.

## Layout e responsividade

- Em desktop, usar conteúdo centralizado e grades de duas colunas quando houver benefício claro.
- Em tablet, reduzir colunas e larguras mantendo a hierarquia.
- Em mobile, empilhar seções, permitir botões de largura total e reorganizar as demonstrações; não permitir overflow horizontal.
- Usar HTML semântico, rótulos corretos, navegação por teclado e foco perceptível.
- Respeitar `prefers-reduced-motion`; animações limitam-se a transições curtas de hover e estado.

## Linguagem

Usar português direto, evitar urgência ou garantias e distinguir recursos disponíveis de visões conceituais ou futuras. Exemplos visuais devem ser identificados como demonstração, sem scores, diagnósticos ou dados atribuídos a usuários reais.
