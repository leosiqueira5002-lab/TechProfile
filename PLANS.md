# Plano de trabalho — TechProfile AI

Documento vivo. Atualize o progresso, descobertas, decisões e retrospectiva durante cada fase. O repositório contém a fundação Next.js, o fluxo de upload/extração e a integração Mercado Pago server-side com entrada autenticada no checkout; credenciais locais podem estar configuradas pelo responsável, e aprovações listadas em `docs/DECISIONS.md` continuam necessárias antes de produção.

## Progress

- [x] Inspecionar o estado inicial: repositório Git sem commits e sem arquivos de aplicação.
- [x] Registrar visão, regras de produto, arquitetura inicial e roadmap documental.
- [x] Selecionar proposta de stack para MVP e registrar alternativas em `docs/ARCHITECTURE.md` e `docs/DECISIONS.md`.
- [x] Implementar e validar a landing page da Fase 1.
- [x] Implementar e validar upload e extração local de currículo da Fase 2.
- [x] Completar estados de documento carregado, substituição e contrato estruturado para preparar a Fase 3.
- [x] Redesenhar visualmente landing, página `/analise`, cabeçalho, marca e placeholder `/entrar` com identidade clara azul, preservando o fluxo de upload.
- [x] Implementar fluxo de diagnóstico demonstrativo determinístico com contrato comum de provedores e sem chamadas externas (Fase 3 — modo demo).
- [x] Corrigir detecção demo de formação, projetos, links, idiomas, experiência profissional e resumo sem expor dados de contato.
- [x] Adicionar CTA pós-diagnóstico e página visual `/curriculo` em preparação, sem transferir ou persistir contexto.
- [x] Conectar `/analise` ao editor `/curriculo` com rascunho factual compartilhado somente em memória.
- [ ] Obter aprovação das decisões de produto, privacidade e fornecedores em `docs/DECISIONS.md`.
- [x] Preparar migration aditiva de profiles/payments, RLS restritivo, trigger/backfill idempotentes e testes (sem aplicar ao remoto).
- [x] Revisar, aprovar e implementar a especificação/plano do Mercado Pago Checkout Pro avulso (backend e migration local/remota autorizada em fase anterior).
- [x] Conectar o header autenticado ao `POST /api/checkout`, sem enviar valores comerciais pelo navegador.
- [ ] Preparar autenticação, cotas/rate limit distribuído e política operacional antes de disponibilizar análise a usuários reais.

## Fase 0 — Alinhamento e fundação documental

**Objetivo:** estabelecer requisitos, limites e perguntas em aberto antes de escolher tecnologia ou implementar.

**Escopo:** documentação em `AGENTS.md`, `GOALS.md`, `PLANS.md`, `PROMPTS.md`, `README.md` e `docs/`.

**Arquivos relevantes:** todos os documentos acima.

**Dependências:** objetivo do produto fornecido pelo solicitante; confirmação futura das decisões abertas.

**Critérios de aceitação:** documentos coerentes entre si; regra anti-invenção explícita; fases com escopo, critérios e validação; nenhum código ou integração criado nesta fase.

**Validação:** conferir existência e consistência dos arquivos, revisar diff e executar `git diff --check` quando houver alterações versionadas.

**Riscos:** tratar hipóteses como decisões; prometer capacidades ou tratamento de dados ainda não definidos.

## Fase 1 — Landing page e experiência inicial

**Objetivo:** explicar valor, fluxo, limites e privacidade com clareza e permitir iniciar o fluxo de currículo.

**Escopo:** conteúdo e interface da página inicial, estados responsivos e acessíveis, chamada para iniciar. Não inclui análise real, cobrança ou integração externa.

**Arquivos relevantes:** a definir após seleção da stack; provável superfície web e seus componentes de apresentação.

**Dependências:** decisão de stack, identidade visual, idioma inicial e conteúdo de produto.

**Critérios de aceitação:** proposta de valor compreensível; fluxo e limites visíveis; experiência utilizável em telas pequenas e teclado; nenhuma alegação enganosa sobre IA, segurança ou resultados.

**Validação:** revisão de conteúdo, acessibilidade e comportamento visual nos tamanhos de tela suportados, conforme ferramentas escolhidas.

**Riscos:** prometer resultados de contratação; ocultar como documentos são tratados; escopo visual maior que o necessário.

## Fase 2 — Upload e extração de currículo

**Objetivo:** aceitar um currículo PDF/DOCX, validar sua estrutura e mostrar o texto extraído para conferência, sem análise por IA.

**Escopo concluído:** página `/analise` ligada aos CTAs; seleção/arraste de arquivo; estados aguardando, validando, enviando, lendo, carregado e erro; validação de extensão/MIME/tamanho no cliente e validação de MIME, assinatura, estrutura, páginas e tamanho no servidor; extração local no runtime Node; prévia e documento estruturado em memória na tela; substituição de currículo; armazenamento do original no Supabase privado condicionado a sessão autenticada e configuração completa. Sem autenticação e banco configurados, o processamento é temporário.

**Arquivos principais desta entrega:** `app/(product)/analise/page.tsx`, `app/(product)/analise/analysis.css`, `app/api/resumes/route.ts`, `components/resume-uploader.tsx`, `components/resume-document-panel.tsx`, `features/documents/extract.ts`, `features/documents/validation.ts`, `features/documents/types.ts`, `tests/resumes-api.test.mjs` e este plano.

**Dependências:** `pdf-parse` para PDF; `mammoth` para extração de texto DOCX; `yauzl` para inspecionar o ZIP DOCX antes do parser; `@supabase/supabase-js` para a futura operação Storage com JWT do usuário e chave pública sujeita a RLS. Nenhuma chave de serviço é usada. Next externaliza `pdf-parse` e `@napi-rs/canvas` para execução Node, conforme a orientação de integração da biblioteca.

**Limites da implementação:** arquivo até 4 MiB; corpo multipart até 4,5 MiB; PDF até 20 páginas; DOCX até 500 entradas ZIP e 20 MiB expandidos, com razão máxima de expansão 100:1; texto extraído até 200.000 caracteres; extração limitada a 15 segundos. Os documentos de segurança não fixavam números de páginas/expansão; estes valores foram adotados como limites conservadores para esta fase. O teto de arquivo de 4 MiB mantém o corpo abaixo do limite documentado da Vercel Function.

**Critérios de aceitação:** somente PDF/DOCX; validar extensão, MIME declarado, assinatura e estrutura; rejeitar arquivo vazio, corrompido, protegido, acima dos limites ou sem texto; não enviar conteúdo à OpenAI; não registrar o currículo; mostrar erros e prévia acessíveis; exibir nome, tipo, tamanho, número de páginas PDF e status; manter todas as métricas como não analisadas; sem configuração Supabase, indicar que o processamento é temporário.

**Validação executada nesta entrega:** `npm run lint`, `npm run typecheck`, `npm run build` e `node --test tests/resumes-api.test.mjs` (5 testes passando). Testes HTTP cobrem PDF/DOCX válidos, acima de 4 MiB, PDF de 21 páginas, MIME divergente/ausente, formato não permitido, arquivos PDF/DOCX corrompidos, PDF sem texto, PDF com 20 páginas, basename seguro e substituição. Pelo navegador, upload de PDF, troca por DOCX e erro de formato inválido foram confirmados; métricas seguiram em “— / NOT ANALYZED”. Console sem erros. Em viewport de 390 px, `scrollWidth` ficou em 375 px, sem overflow horizontal. Logs locais mostraram somente método, rota, status e duração; não registraram conteúdo extraído.

**Descobertas:** `pdf-parse` v2 gera separadores de página em `result.text` mesmo quando uma página não tem texto. A aplicação agora normaliza `result.pages[].text`, o que evita tratar esses separadores como conteúdo. A biblioteca também precisa ser externalizada no build do Next para o worker/canvas funcionarem no runtime Node.

**Limitações:** Supabase não está configurado e não foi testado contra um projeto real; são necessárias `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_RESUME_BUCKET`, além de Auth, bucket privado e políticas Storage/RLS corretas. A rota exige JWT válido quando o armazenamento está configurado e confirma que o bucket não é público; a tela ainda não encaminha JWT porque login real está fora desta fase. Portanto, aqui o documento estruturado e o texto extraído existem somente na memória da tela e se perdem ao recarregar/sair; o original não persiste sem sessão e configuração. Não há persistência de metadados/texto em banco, OCR, antivírus nem limite de uso por usuário.

**Riscos restantes:** parser PDF/DOCX executa no processo web; limites e timeout reduzem exposição, mas não equivalem a isolamento de processo/limite de memória. A rota de upload ainda precisa de autenticação, rate limit e validação de políticas do bucket antes de processar currículos reais em produção.

**Próximo marco sugerido à época:** Fase 3 — definir área/cargo desejado, contrato do diagnóstico e mensagens factuais. Esse marco foi concluído posteriormente; ver o registro de implementação abaixo.

## Fase 3 — Diagnóstico do currículo

**Objetivo:** apresentar observações úteis sobre clareza, evidências e alinhamento ao cargo escolhido.

**Escopo concluído nesta etapa:** área e cargo obrigatórios; rota `/api/analyses`; interface comum `AnalysisProvider`; provedor demo determinístico selecionado pela aplicação, com análise simples de seções e tecnologias literalmente encontradas; saída validada pelo mesmo schema Zod e pelas regras de evidência; resultado temporário exibido na tela com indicador “Modo demonstração”. Não há score nem chamada externa. Ausências usam linguagem neutra e sugestões condicionais. O adaptador OpenAI permanece separado para uma ativação futura, mas não é importado pelo seletor ativo.

**Arquivos principais:** `app/api/analyses/route.ts`, `features/analysis/contracts.ts`, `features/analysis/provider.ts`, `features/analysis/providers/`, `components/resume-analysis-workspace.tsx`, `components/resume-document-panel.tsx`, `components/resume-uploader.tsx`, `app/(product)/analise/page.tsx`, `app/(product)/analise/analysis.css`, `tests/analysis-demo.test.mjs`, `tests/analysis-contract.test.mjs`, `tests/analyses-api.test.mjs` e este plano.

**Dependências:** `zod` para validação de entrada/saída. O modo demo usa código local determinístico e não precisa de credenciais. O adaptador preparado para OpenAI usa `fetch` nativo, mas não está selecionado nem chamado. A futura ativação dependerá da aprovação de tratamento de dados, configuração segura de `OPENAI_API_KEY` e seleção/validação do modelo.

**Validações da implementação demo:** 12 testes próprios do modo demo, 16 testes de contrato/provedor, 6 testes HTTP da rota de análise e 5 regressões HTTP de upload/extração; `npm run lint`, `npm run typecheck` e `npm run build`. As fixtures são fictícias e cobrem formação/projetos sem títulos exatos, GitHub/LinkedIn sem expor URLs, idiomas com níveis, ausência de experiência/tecnologias/resumo, contatos e schema comum.

**Limitações e riscos restantes:** o provedor demo usa padrões de texto e lista finita de tecnologias, não compreende contexto nem mede qualidade; pode não reconhecer seções com títulos incomuns e nunca comprova que uma competência existe fora do currículo. Resultado temporário se perde ao recarregar. Não existe autenticação nem rate limit distribuído. O adaptador OpenAI não foi chamado e ainda requer decisão de privacidade, minimização validada, modelo aprovado, credencial secreta em ambiente seguro e revisão de retenção antes de ser selecionado.

**Resultado:** fluxo de upload existente → contexto profissional → confirmação → análise demo estruturada → apresentação temporária está implementado sem OpenAI ou outra chamada externa. Nenhuma funcionalidade de LinkedIn, vaga, pagamento, otimização de currículo ou PDF foi iniciada.

**Ponte original para o criador:** a primeira versão mostrou CTA e página `/curriculo` sem transferir contexto, conforme o escopo daquela fase. A transferência em memória foi definida e implementada na etapa abaixo; não há persistência temporária ou permanente.

**Validação desta ponte:** testes unitários da copy dinâmica/genérica, junto à suíte completa; confirmar no navegador que o CTA aparece somente depois do diagnóstico, navega à rota estática e não dispara chamadas externas.

### Correção da análise demonstrativa — resultado e retrospectiva

**Problema:** o primeiro analisador demo dependia demais de títulos de seção e usava um trecho bruto do texto como resumo. Um currículo válido podia, por isso, ser classificado como sem formação/projetos, e contatos podiam acabar em evidências exibidas.

**Correção:** a extração agora combina títulos com padrões textuais para formação, descrições de projetos, referências a LinkedIn/GitHub, idiomas e sinais explícitos de experiência profissional. O demo conserva trechos de evidência, oculta URLs e remove linhas de contato dos achados. Projetos não contam como emprego. Sem resumo explícito, o resultado informa a ausência e sugere criá-lo depois; nenhuma passagem bruta do currículo é apresentada como resumo. O schema e o fluxo visual não mudaram.

**Validação executada:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs` (39 testes); `npm run lint`; `npm run typecheck`; `npm run build`; `git diff --check`.

**Limitação descoberta:** a detecção continua baseada em padrões e vocabulário finito; pode não reconhecer sinônimos, cursos ou idiomas em linhas muito distantes e não interpreta o contexto semanticamente. Links são apresentados pelo tipo da plataforma, sem repetir o endereço. A regra é conservadora quando não há evidência profissional explícita.

**Próximo marco sugerido:** aprovar tratamento de dados e provedor/modelo; depois selecionar o adaptador OpenAI, configurar `OPENAI_API_KEY` apenas em ambiente protegido, validar minimização e executar avaliações de factualidade antes de usuários reais. Autenticação e cotas/rate limit continuam necessárias antes de piloto.

**Arquivos relevantes:** a definir; contrato de resultado, instruções de IA e apresentação do diagnóstico.

**Dependências:** extração confiável, regras de `docs/AI_RULES.md`, decisão sobre provedor e tratamento de dados.

**Critérios de aceitação:** achados distinguem evidência de sugestão; ausência é formulada como “não encontrado”; afirmações referenciam o material de origem; saída inválida é revisada ou rejeitada.

**Validação:** conjunto de exemplos anonimizados e casos adversariais; revisão de factualidade e clareza; política de qualidade definida antes de lançamento.

**Riscos:** alucinação, viés, recomendações genéricas, falsa confiança e exposição de dados pessoais ao modelo.

## Fase 4 — Paywall

**Objetivo:** definir uma transição transparente entre diagnóstico e recursos pagos, caso o modelo comercial seja confirmado.

**Escopo:** proposta e estados de acesso; cobrança e integração ficam fora até decisão explícita.

**Arquivos relevantes:** a definir após decisões de monetização e arquitetura.

**Dependências:** confirmação do modelo de negócio, preço, direitos do consumidor, região e requisitos legais aplicáveis.

**Critérios de aceitação:** valor, preço, limites, renovação e cancelamento são apresentados com clareza antes de qualquer compra; acesso não é concedido com estado ambíguo.

**Validação:** revisão dos fluxos de acesso e textos; quando houver cobrança autorizada, testes em ambiente de teste do provedor escolhido.

**Riscos:** cobrança inesperada, estado de assinatura divergente, requisitos legais e dependência prematura de fornecedor.

## Fase 5 — Currículo otimizado

**Objetivo:** propor uma redação mais clara e alinhada ao objetivo sem alterar os fatos da pessoa.

**Escopo:** geração revisável e comparação com o conteúdo de origem; mudanças devem ser editáveis e rastreáveis. Sem adicionar fatos novos.

**Arquivos relevantes:** a definir; regras de IA, estrutura do currículo e interface de revisão.

**Dependências:** diagnóstico, regras factuais, formato de saída e decisão de produto sobre edição.

**Critérios de aceitação:** toda afirmação substantiva é apoiada por fonte; itens incertos geram pergunta ou ficam de fora; pessoa revisa antes de exportar.

**Validação:** comparação factual automatizada quando viável e revisão humana de casos; cenários com lacunas e instruções conflitantes.

**Riscos:** embelezamento que muda o sentido, números fabricados e remoção de contexto relevante.

**Preparação entregue antes do gerador:** CTA pós-diagnóstico e página `/curriculo` estática estão implementados para preparar a navegação. A página não recebe nem consulta o resultado da análise. A transferência do contexto e sua retenção/persistência devem ser projetadas e implementadas junto com o gerador nesta fase; nenhum localStorage, cookie, query param ou banco foi introduzido como ponte temporária.

## Fase 6 — Exportação PDF

**Objetivo:** permitir exportar a versão aprovada em documento legível.

**Escopo:** geração de PDF a partir do conteúdo revisado; layout e compatibilidade a definir.

**Arquivos relevantes:** a definir; modelo visual e exportador.

**Dependências:** currículo otimizado revisável, identidade visual e requisitos de formato.

**Critérios de aceitação:** PDF legível, selecionável quando tecnicamente possível, sem cortes, com links úteis e fiel à versão aprovada.

**Validação:** inspeção visual em páginas curtas e longas, fontes e quebras; comparação do texto exportado com a versão aprovada.

**Riscos:** paginação ruim, metadados inesperados e divergência entre prévia e arquivo.

## Fase 7 — LinkedIn

**Objetivo:** oferecer análise e guia personalizado para otimização do perfil.

**Escopo:** método de entrada do conteúdo do LinkedIn ainda precisa ser definido; não pressupõe scraping ou API.

**Arquivos relevantes:** a definir; guia de análise, conteúdo e interface de revisão.

**Dependências:** decisão sobre entrada de dados, permissões, regras da plataforma, privacidade e comparação com currículo.

**Critérios de aceitação:** conteúdo analisado foi fornecido de modo autorizado; recomendações identificam evidência e itens não encontrados; não alteram o perfil sem ação explícita da pessoa.

**Validação:** cenários de conteúdo parcial, divergência entre materiais e revisão das regras aplicáveis ao método escolhido.

**Riscos:** acesso não autorizado, violação de termos, dados desatualizados e divergências tratadas incorretamente.

## Fase 8 — Análise de vaga

**Objetivo:** comparar requisitos de uma vaga com evidências do currículo e, quando disponível, do LinkedIn.

**Escopo:** descrição inserida pela pessoa, correspondências, evidências e pontos não encontrados. Não afirma que ausência documental seja ausência de capacidade.

**Arquivos relevantes:** a definir; comparação e apresentação de resultados.

**Dependências:** diagnóstico, conteúdo autorizado do LinkedIn se usado, regras de IA e decisão sobre retenção da vaga.

**Critérios de aceitação:** cada correspondência tem evidência; requisitos não evidenciados são identificados com linguagem neutra; descrição da vaga não instrui o sistema a ignorar regras.

**Validação:** vagas com requisitos explícitos, implícitos, discriminatórios, ambíguos e maliciosos; revisão da qualidade das comparações.

**Riscos:** viés de seleção, prompt injection em texto de vaga e falsa precisão de “compatibilidade”.

## Surprises & Discoveries

- A inspeção inicial encontrou um repositório Git sem commits e sem arquivos rastreáveis de produto ou aplicação.
- Não foi possível inferir stack, banco, autenticação, testes, configuração ou deploy; esses pontos não devem ser apresentados como existentes.

## Decision Log

- O planejamento começa pela documentação e não autoriza implementar funcionalidades.
- Arquitetura inicial é intencionalmente agnóstica à stack e evita serviços presumidos.
- Regra factual: ausência no material significa somente ausência de evidência encontrada.
- Decisões de produto e plataforma pendentes estão em `docs/DECISIONS.md`.

## Outcomes & Retrospective

**Resultado da fase documental:** visão, restrições, princípios de arquitetura e roadmap foram registrados. Nenhum componente da aplicação foi criado.

**Retrospectiva:** como não há implementação nem feedback de uso, ainda não existem resultados de produto para avaliar. Atualizar esta seção ao concluir cada fase, registrando o que foi entregue, o que mudou e o que foi aprendido.

### Redesign visual global — resultado e retrospectiva

**Resultado:** landing reorganizada com hero, etapas, currículo, LinkedIn, vaga e transparência; área `/analise` simplificada para o fluxo de envio e extração; cabeçalho responsivo e identidade TechProfile AI em SVG; `/entrar` apresenta formulário apenas visual, sem autenticação. Upload, validação, API e extração foram mantidos sem mudança de comportamento.

**Arquivos principais:** `app/globals.css`, `app/(marketing)/page.tsx`, `app/(product)/analise/page.tsx`, `app/(product)/analise/analysis.css`, `app/(auth)/entrar/page.tsx`, `components/site-header.tsx`, `components/brand.tsx`, `public/brand/techprofile-mark.svg`, `public/brand/techprofile-full.svg` e `docs/DESIGN.md`.

**Discoveries:** a rota de entrada ainda não existia; a nova rota é deliberadamente estática e não submete credenciais. A tela de análise conserva o componente funcional de upload e a prévia da extração, sem introduzir resultados fictícios.

**Validação:** `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` executados. `/`, `/analise` e `/entrar` foram abertas e inspecionadas no navegador integrado em viewport desktop e mobile (390 × 844 CSS px). A navegação móvel foi expandida; nenhuma das rotas mostrou overflow horizontal; console sem erros nas três rotas. O servidor de desenvolvimento permanece em `http://localhost:3000/`.

**Limitações:** não há autenticação, análise de LinkedIn ou análise de vaga implementadas. As seções correspondentes na landing são conceituais e identificadas como futuras/demonstrativas.

**Próximo marco:** continuar a sequência de produto definida acima após validar as decisões pendentes em `docs/DECISIONS.md`; este redesign não inicia a análise por IA.

### Fase 2 — resultado e retrospectiva

**Resultado:** upload PDF/DOCX acessível em `/analise`; validação no servidor por extensão, MIME, assinatura e parser; limites para payload, páginas, expansão ZIP, texto e tempo; extração sem IA e prévia do texto. O armazenamento é opcional apenas para sessão Supabase validada e bucket explicitamente privado. No estado atual do repositório, a extração é temporária e não grava o arquivo.

**Decision Log:** usar 4 MiB por arquivo e 20 páginas PDF para manter o endpoint dentro do limite de corpo da Vercel enquanto a autenticação/upload direto ainda não existe; limitar DOCX a 500 entradas e 20 MiB expandidos/100:1; armazenar com a chave pública + JWT do usuário sob RLS, nunca com `service_role`; falhar fechado se o bucket estiver público; nenhum envio à OpenAI nesta fase.

**Outcomes & Retrospective:** lint, typecheck e build passaram. Os casos sintéticos previstos foram aceitos/rejeitados conforme esperado. A inspeção do navegador confirmou título, formatos e CTA. A ferramenta atual não forneceu acesso direto à console JavaScript; por isso, não há alegação de leitura direta da console. O próximo ciclo deve adicionar autenticação e testar Storage/RLS real antes de persistir documentos de usuários.

## Fase 0.5 — Definição técnica

**Objetivo:** escolher uma arquitetura inicial moderna, simples e segura para orientar a implementação do MVP, sem provisionar serviços.

**Escopo:** documentar framework e linguagem, frontend, backend/API, banco, autenticação, armazenamento, extração, IA, PDF, pagamento, hosting, observabilidade, privacidade, variáveis e estrutura de pastas.

**Arquivos relevantes:** `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` e este plano.

**Dependências:** visão de produto e prioridade do MVP já definidas; confirmação do responsável antes de criar contas, inserir chaves ou configurar serviços.

**Critérios de aceitação:** cada decisão relevante tem escolha, razão e alternativa; stack atende o fluxo sem serviços distribuídos prematuros; dados de currículo têm caminho de retenção e exclusão; itens que exigem aprovação estão marcados; nenhum código ou serviço é criado nesta fase.

**Validação:** revisar os documentos e links oficiais usados; `git diff --check`; confirmar que somente os três arquivos autorizados foram alterados.

**Riscos:** limites de execução do hosting para Chromium e documentos; regras de retenção/localização dos provedores; disponibilidade e meios de pagamento no mercado escolhido; custo variável de IA.

**Resultado:** proposta selecionada: Next.js/TypeScript em monólito modular; Supabase para Postgres, Auth e Storage; OpenAI para análise estruturada; Playwright para PDF; Stripe Checkout condicionado à validação regional; Vercel para hosting e Sentry para erros. Nenhum fornecedor foi configurado.

**Surprises & Discoveries:** a documentação oficial consultada confirma suporte do Next.js a App Router, handlers e execução Node; Supabase documenta buckets privados e links assinados; Stripe oferece checkout hospedado; OpenAI oferece saída com schema estruturado. Isso confirma viabilidade conceitual, mas não valida custo, disponibilidade por país, retenção contratual ou limites específicos de produção.

**Decision Log:** decisões e alternativas estão registradas em `docs/DECISIONS.md`; aprovações de fornecedor, mercado, preço, conta e retenção ainda são necessárias.

**Outcomes & Retrospective:** definição técnica documentada sem código, instalação, conta, banco, pagamento, API externa ou deploy. Próxima ação: revisar as aprovações pendentes; depois planejar implementação da landing page na Fase 1 com os nomes de pastas da arquitetura.

## Fase 0.6 — Auditoria técnica

**Objetivo:** revisar a proposta contra o fluxo do produto, riscos operacionais e documentação oficial atual.

**Escopo:** classificar stack, tecnologias, cobertura dos fluxos, integridade factual, exposição à IA, retenção/exclusão, upload e parsing, Stripe, modelo OpenAI, Playwright/Vercel e custo.

**Arquivos relevantes:** `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md` e este plano.

**Dependências:** proposta técnica da Fase 0.5 e referências oficiais de fornecedores; não houve código ou protótipo.

**Critérios de aceitação:** cada tópico tem status OK/ATENÇÃO/BLOQUEADOR; problemas têm correção simples; decisões que exigem responsável estão explícitas; não criar código nem configurar fornecedores.

**Validação:** revisão de coerência entre documentos, `git diff --check` e status do Git para confirmar escopo documental.

**Riscos identificados:** limite de 4,5 MB em Vercel Functions se upload for encaminhado pela API; pipeline de arquivo vulnerável sem defesa a arquivos ZIP/PDF hostis; texto pessoal desnecessário e retenção padrão de logs de abuso da API; exclusão Storage incompleta se somente metadados forem removidos; incerteza de Chromium no bundle/serverless; recorrência Stripe pode não estar disponível no Brasil; custos por tokens, renderização e taxas ainda não estimados.

**Surprises & Discoveries:** Vercel documenta corpo máximo de 4,5 MB e limites de bundle/tempo/memória. Supabase exige políticas Storage/RLS e a exclusão de metadata isolada não remove o objeto real. A OpenAI descreve logs de abuso potencialmente retidos até 30 dias por padrão. A Stripe indica o Brasil como país suportado, mas a disponibilidade de um produto específico de subscription pricing tem exceções para o Brasil; modelo avulso versus recorrente precisa ser resolvido.

**Decision Log:** recomenda-se upload direto autenticado ao Storage; minimização/remoção de identificadores antes da IA; definir retenção por categoria e exclusão completa; manter `gpt-4.1-mini` apenas como candidato até benchmark; validar Chromium na Vercel; definir modelo/preço Stripe antes da implementação de pagamento. Detalhes e links em `docs/DECISIONS.md`.

**Outcomes & Retrospective:** arquitetura em geral coerente para MVP e cobre os fluxos planejados, com as condições documentadas. Não houve mudança de modelo automática, benchmark, teste de arquivos ou prova de deploy. Esta etapa termina com fornecedores e política de dados aguardando aprovação; não iniciar integrações ou receber currículos reais até resolver bloqueadores registrados.

## Integração em memória entre análise e editor — resultado e retrospectiva

**Objetivo:** ao acionar o CTA após uma análise concluída, preparar um `ResumeDraft` somente com informações identificadas e iniciar o editor com esses valores.

**Escopo concluído:** provider React no layout compartilhado `(product)`; mapeador puro em `features/resume/transfer.ts`; CTA monta o rascunho a partir do texto extraído, cargo e evidências da análise e navega para `/curriculo`; o editor recebe `initialValue` quando há contexto e consome o valor uma vez; rota sem contexto inicia vazia. Não há chamadas externas a partir do CTA, armazenamento no browser, banco, IA nova ou PDF.

**Dados transferidos:** cargo desejado; nome, e-mail, telefone, links profissionais e localização apenas quando reconhecidos com rótulos/padrões claros; resumo sob seção explícita; formação, projetos, experiências profissionais com evidência explícita, habilidades/tecnologias, idiomas e certificações apoiados no texto original e nas evidências. Projetos pessoais/acadêmicos não viram experiência; linha isolada de link de repositório não cria projeto; tecnologias não são inferidas; endereço completo não é usado como localização. Datas de somente ano são aceitas nos campos de texto sem completar mês.

**Arquivos principais:** `app/(product)/layout.tsx`, `features/resume/resume-draft-context.tsx`, `features/resume/components/resume-builder-from-context.tsx`, `features/resume/transfer.ts`, `components/resume-analysis-workspace.tsx`, `app/(product)/curriculo/page.tsx`, `features/resume/components/resume-editor.tsx`, `app/(product)/analise/analysis.css`, `tests/resume-transfer.test.mjs` e este plano.

**Validação:** suite completa do Node (`tests/*.test.mjs`), lint, typecheck, build de produção e `git diff --check`; inspeção manual em desktop e mobile do caminho upload → análise demo → CTA → editor; rota `/curriculo` aberta diretamente permaneceu vazia; alteração do nome atualizou a prévia; viewport mobile sem overflow horizontal; inspeção da console do navegador registrada ao concluir a validação.

**Surprises & Discoveries:** currículos podem expressar datas só como ano, mas o editor usava controles `month`, incapazes de exibir esse dado sem inventar mês. Os quatro campos de datas passaram a aceitar texto (`AAAA-MM ou AAAA`) mantendo o layout; a prévia já exibe literalmente o ano. O PDF de teste também confirmou que rótulos/idiomas sem acentos são comuns após extração; o mapeador reconhece formas em português e inglês sem alterar o texto transferido.

**Decision Log:** o provider vive apenas na navegação client-side do segmento `(product)`; o consumidor move os dados para o estado local do `ResumeBuilder` e limpa o contexto, reduzindo a cópia temporária. Dados duvidosos ficam vazios. Nenhuma informação inferida substitui confirmação do usuário.

**Limitações:** o mapeador usa padrões conservadores, não é parser semântico completo e pode deixar de reconhecer layouts, instituições ou idiomas fora dos padrões suportados. Texto extraído e rascunho continuam apenas em memória; recarregar a página perde o contexto e as edições.

**Outcomes & Retrospective:** a navegação e o editor iniciam com os campos comprovados, e as alterações feitas no editor atualizam a prévia em tempo real. Nenhuma fase posterior foi iniciada.

## Exportação local do currículo para PDF — resultado e retrospectiva

**Objetivo:** permitir que a pessoa exporte a versão atual do `ResumeDraft` por impressão nativa do navegador, sem enviar o currículo para geração server-side.

**Escopo concluído:** botão “Exportar como PDF” no editor; botão desabilitado e orientação quando o currículo está vazio; clique chama somente `window.print()`; CSS de impressão A4 mostra apenas a prévia HTML, esconde shell/editor/ações, preserva texto selecionável e tenta manter cada item profissional junto em uma página. Atualizado o registro de arquitetura e segurança para refletir a decisão local aprovada para o MVP.

**Arquivos principais:** `features/resume/model.ts`, `features/resume/components/resume-builder.tsx`, `features/resume/resume-builder.css`, `tests/resume-builder.test.mjs`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md` e este plano.

**Validação executada:** 72 testes passaram (`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs`); `npm run lint`; `npm run typecheck`; ESLint nos arquivos de `features/resume` alterados; `npm run build`; `git diff --check`. Currículo vazio deixou o botão desabilitado no navegador; preenchimento habilitou e o clique invocou `window.print()`. O navegador integrado não exibiu sua janela nativa de impressão; para revisar a saída, o motor local do Edge imprimiu fixtures HTML sintéticas com as mesmas regras CSS: o currículo curto gerou 1 página e o longo 2 páginas, ambas em 594,96 × 841,92 pt (A4). Texto extraído continha nome/conteúdo do currículo e não continha editor ou cabeçalho do site. Em viewport mobile de 390 px, a página ficou em 375 px sem overflow; console do navegador sem erros/avisos.

**Descobertas e limitações:** regras `break-inside: avoid` são uma preferência do navegador; itens maiores que a área útil ainda podem ser divididos e o resultado visual pode variar entre navegadores. Em mobile, a edição continua responsiva, mas a impressão móvel depende das opções do navegador/dispositivo.

**Decision Log:** para o MVP, impressão local substitui a proposta anterior de Playwright/Chromium server-side. Gerar/baixar PDF diretamente pelo servidor exigirá nova decisão; nenhum motor PDF foi adicionado.

**Outcomes & Retrospective:** a exportação usa o mesmo HTML aprovado pelo usuário e não introduz persistência, rede ou envio a fornecedor. Nenhuma outra fase foi iniciada.

## Supabase Auth básico — implementação

**Objetivo:** permitir criação e acesso a uma conta TechProfile AI por e-mail/senha e proteger as rotas de produto.

**Escopo concluído:** rotas `/entrar` e `/cadastro`; cadastro/login pelo Supabase Auth; mensagem para confirmação de e-mail; callback PKCE em `/auth/confirm`; sessão SSR baseada em cookies via `@supabase/ssr`; renovação no `proxy.ts`; verificação de claims no servidor; proteção de `/analise` e `/curriculo`; redirecionamento de contas autenticadas para `/analise`; logout no cabeçalho do produto; mensagens de erro amigáveis sem registrar credenciais ou respostas brutas.

**Arquivos principais:** `app/(auth)/layout.tsx`, `app/(auth)/entrar/page.tsx`, `app/(auth)/cadastro/page.tsx`, `app/auth/confirm/route.ts`, `app/(product)/layout.tsx`, `proxy.ts`, `lib/supabase/`, `features/auth/`, `components/auth-form.tsx`, `components/sign-out-button.tsx`, `components/site-header.tsx`, `tests/auth.test.mjs`, `.env.example`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md` e `AGENTS.md`.

**Dependências:** variáveis locais `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `@supabase/ssr` adicionado, `@supabase/supabase-js` já existia. Nenhum schema/tabela, Storage, service role ou outra integração foi criado.

**Critérios de aceitação:** entradas inválidas e erros do provedor são apresentados em português sem stack trace; usuário sem sessão não acessa rotas protegidas; sessão válida permanece durante navegação/atualização; logout invalida acesso às rotas de produto; destino de confirmação é local e fixo.

**Validação:** `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` e 71 testes independentes passaram. A execução da suite completa obteve 73 aprovações e 3 falhas nos testes de integração de upload: o servidor local usa o Supabase configurado e esses testes não fornecem sessão/token, então a rota exige Storage autenticado e retorna 503. O formulário `/cadastro` foi inspecionado no navegador; `/analise` e `/curriculo` sem sessão redirecionaram para `/entrar`. Não foi criada conta real, então confirmação por e-mail, login de sucesso, persistência de sessão e logout precisam de teste manual com conta controlada pelo responsável.

**Riscos e limites:** conclusão de cadastro depende de confirmação habilitada/configurada no projeto Supabase e entrega de e-mail; conta SMTP padrão possui limites baixos. Não há recuperação de senha, alteração de e-mail, MFA, perfil, exclusão de conta, rate limit próprio ou autorização de dados persistidos. A sessão é mantida pelo cookie SSR do Supabase.

**Configuração manual pendente:** no Supabase Auth, confirmar provedor e-mail/senha, decisão de confirmação de e-mail, Site URL e allowlist de redirect URLs para `http://localhost:3000/auth/confirm` e domínio de produção. Configurar SMTP verificado para entrega confiável antes de uso público. Nenhum serviço foi alterado pela implementação.

**Outcomes & Retrospective:** autenticação básica implementada sem tabela de credenciais, persistência própria, Storage ou mudanças no fluxo do currículo. O Supabase do ambiente está configurado, mas a validação de conta e e-mail não foi executada para evitar criar uma conta ou enviar e-mail sem dados/conta fornecidos pelo responsável. Os três testes de API de upload falharam por exigir uma sessão Storage ausente no fixture de integração; os outros 71 testes passaram. A integração continuará dependendo da configuração de redirect/SMTP do projeto antes de uso público.


## Profiles e pagamentos — base de dados preparatória

**Objetivo:** criar tabelas seguras de perfil Free/Pro e pagamentos, mais um helper local puro de validade Pro, sem iniciar cobrança ou autorização de recursos.

**Escopo concluído:** migration aditiva para `public.profiles` e `public.payments`; RLS habilitado; roles de cliente limitados a leitura das próprias linhas; trigger seguro para profile Free; backfill idempotente; timestamps de atualização; unicidade por provedor e ID externo; helper `isProActive(profile, now)` sem conexão com autorização.

**Arquivos principais:** `supabase/migrations/20260929000000_profiles_payments.sql`, `supabase/tests/database/20260929000000_profiles_payments.test.sql`, `features/billing/access.ts`, `tests/billing-access.test.mjs`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`, especificação/plano em `docs/superpowers/`.

**Dependências:** nenhuma dependência npm nova. A migration espera ambiente Supabase/PostgreSQL com roles padrão (`anon`, `authenticated`) e `gen_random_uuid()`.

**Critérios de aceitação:** profile Free criado sem confiar em metadados do cliente; backfill não duplica nem sobrescreve perfis; RLS permite apenas leitura própria; usuários comuns não escrevem perfil/pagamentos; IDs duplicados de pagamento são rejeitados; helper Pro retorna ativo somente antes da expiração.

**Validação:** 3 testes Node do helper; lint, typecheck, build, suíte Node completa e `git diff --check`. O arquivo pgTAP foi revisado estaticamente, mas não executado: este ambiente não tem Supabase CLI nem `psql`/PostgreSQL local. Nenhuma conexão ou aplicação remota foi feita.

**Riscos e limitações:** migration ainda precisa ser revisada e aplicada manualmente em ambiente Supabase escolhido. Sem webhook, o banco não confirma transações nem atualiza plano. A constraint de unicidade previne duplicar uma referência externa, mas não implementa processamento idempotente de eventos. Ainda precisam ser definidos estados oficiais, preço, dias de acesso, reembolso/cancelamento e rotina backend confiável.

**Surprises & Discoveries:** o repositório não continha migrations e o ambiente não oferece CLI/servidor Postgres local. Para respeitar o limite de segurança, a validação SQL ficou no nível de teste pgTAP escrito e revisão estática, sem instalar ferramentas ou usar o projeto remoto.

**Decision Log:** Mercado Pago fica registrado como provedor futuro escolhido para avaliação, não configurado. A migration é aditiva e permanece local. O role comum recebe `SELECT` somente; mudanças privilegiadas de plano permanecem para desenho separado. `isProActive` é cálculo informativo puro, não proteção de rota/recurso.

**Outcomes & Retrospective:** schema, controles e testes foram preparados sem checkout, webhook, credenciais, alteração de dados remotos ou grant de Pro em runtime. Nenhuma etapa posterior foi iniciada.


## Supabase CLI — vínculo e inspeção remota

**Objetivo:** configurar a CLI e inspecionar migrations sem alterar o banco remoto.

**Concluído:** Node v24.14.0; Supabase CLI `2.118.0` em `devDependencies`; `supabase/config.toml` e ignore local inicializados sem sobrescrever migrations. CLI autenticada pelo fluxo oficial do navegador e projeto vinculado ao mesmo Project Ref obtido do hostname Supabase em `.env.local`, sem exibir URL ou publishable key.

**Migrations:** há uma migration SQL local, `20260929000000_profiles_payments.sql`. `npx supabase migration list` mostrou essa versão sem correspondente remota; o histórico remoto não lista migrations. Consultas somente de leitura confirmaram que ainda não existem `public.profiles`, `public.payments`, as funções ou os triggers que a migration criará. O remoto usa PostgreSQL 17.6, tem `auth.users`, roles `anon`/`authenticated` e `gen_random_uuid()`.

**Validação e limites:** nenhum `db push` ou alteração remota foi executado. Docker não está disponível, portanto os testes SQL pgTAP permanecem sem execução. `.env.local` continua ignorado; nenhum `service_role` está referenciado no frontend.

**Resultado:** não foi encontrado conflito no histórico de migrations nem colisão com os objetos-alvo consultados. A migration está pronta para uma etapa futura de aplicação, sujeita a autorização explícita; considerar que pgTAP não foi executado neste ambiente.


## Aplicação da migration profiles/payments

**Resultado:** `npx supabase db push` aplicou somente `20260929000000_profiles_payments.sql`. `npx supabase migration list` confirmou a mesma versão local e remota. Nenhuma outra migration, seed ou role foi aplicada.

**Verificação remota somente leitura:** tabelas, RLS, policies `profiles_select_own`/`payments_select_own`, funções `set_updated_at()`/`create_profile_for_new_auth_user()` e os três triggers previstos existem e estão ativos. A query retornou 1 profile no lote inicial (backfill), todos Free e com `pro_expires_at IS NULL`; 0 usuários Auth sem profile; 0 pagamentos. Nenhum usuário foi alterado para Pro.

**Validação:** lint, typecheck, build, 79/79 testes Node e `git diff --check` passaram. pgTAP permanece sem execução porque Docker não está disponível. Nenhuma implementação de Checkout ou webhook foi iniciada.

## Mercado Pago Checkout Pro — especificação e plano aprovados

**Estado:** especificação aprovada e implementação local concluída. Conforme informado pelo responsável, a migration base `profiles`/`payments` foi aplicada e validada no Supabase remoto; não foi reconsultada nesta tarefa.

**Decisão comercial confirmada:** pagamento avulso de R$ 19,90 BRL, quantidade 1, concedendo 30 dias. Cada aprovação nova estende a partir de `max(now(), pro_expires_at)`; mesmo pagamento aprovado repetido não concede outros 30 dias.

**Arquivos de desenho:** `docs/superpowers/specs/2026-09-29-mercado-pago-checkout-pro-design.md` e `docs/superpowers/plans/2026-09-29-mercado-pago-checkout-pro.md`.

**Arquitetura implementada:** Checkout Pro usa a Preferences API; `POST /api/checkout` autenticado deriva user ID via claims e fixa preço/dias no servidor; `POST /api/webhooks/mercado-pago` verifica HMAC, consulta `GET /v1/payments/{id}` e valida preço/moeda/usuário/status/modo antes da RPC. A migration aditiva cria RPC privilegiada e transacional para registrar pagamento e estender o profile uma vez. `/pagamento/sucesso`, `/pagamento/pendente` e `/pagamento/erro` são páginas estáticas e nunca concedem acesso.

**Configuração prevista:** `MERCADO_PAGO_ACCESS_TOKEN`, novo `MERCADO_PAGO_WEBHOOK_SECRET`, novo `MERCADO_PAGO_MODE=test|production`, `NEXT_PUBLIC_APP_URL` público com HTTPS e `SUPABASE_SERVICE_ROLE_KEY` exclusivamente server-side para RPC. A Public Key do Mercado Pago não é necessária para checkout hospedado por redirecionamento.

**Ruling durante a implementação:** `external_reference` simples contendo UUID não prova que a associação foi criada pelo servidor. O formato é `tp1:<user_uuid>:<HMAC-SHA256>` com secret oficial de Webhooks e manifesto `techprofile-checkout-v1:<user_uuid>`. Sem secret, checkout/webhook falham fechados. Rotacionar a secret invalida checkouts pendentes assinados com o valor anterior.

**Migração e configuração manual:** criada `supabase/migrations/20260929000100_mercado_pago_payment_processor.sql`; `.env.example` contém placeholders. `NEXT_PUBLIC_APP_URL` usa a origem pública Vercel, e modo fica `test`. Para teste real em sandbox, selecionar explicitamente Access Token em **Credenciais de teste** no painel Mercado Pago, configurar Webhook Secret oficial, `SUPABASE_SERVICE_ROLE_KEY` server-side e notificação do tópico payment apontada ao HTTPS público. O prefixo do token não basta para distinguir teste de produção. Não foram feitas cobranças nem chamadas à API Mercado Pago.

**Validação desta implementação:** suíte completa Node `104/104`; `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` passaram. Node cobre autenticação, valores fixos, não adulteração, assinatura, estados, valor/moeda/referência/modo, delegação ao processamento transacional e páginas de retorno; pgTAP verifica grants, argumentos, transições e idempotência. Docker não está disponível, então pgTAP foi revisado estaticamente, mas não executado localmente.

**Gate remoto:** `npx supabase migration list` mostrou `20260929000000` aplicada no remoto e `20260929000100` somente local. `npx supabase db push --dry-run` propôs somente `20260929000100_mercado_pago_payment_processor.sql` (sem seeds ou roles) e concluiu sem warning/erro. A operação não aplicou alterações; `npx supabase db push` não foi executado e requer autorização separada.

### Entrada de checkout no frontend

**Estado:** implementada no header autenticado, antes de “Sair”, tanto no desktop quanto no menu mobile. O botão executa somente `POST /api/checkout`, sem body; o servidor continua determinando usuário, preço e prazo. A resposta validada usa `checkoutUrl` e o navegador navega para a URL HTTPS retornada. Enquanto aguarda, o botão fica desabilitado e exibe “Abrindo pagamento...”; falhas mostram uma mensagem amigável. Nenhum status de plano foi adicionado ao header porque não havia consulta de profile já existente no shell.

**Validação:** 110 testes Node, lint, typecheck, build de produção e `git diff --check` passaram. Não foi iniciado checkout nem feita chamada externa ao Mercado Pago.

**Decisões ainda abertas antes do lançamento:** termos, impostos/nota, política de reembolso/chargeback e operação de credenciais/teste-produção. Aplicação da migration remota e deploy continuarão exigindo autorização separada.
