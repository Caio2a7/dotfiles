# Coding Agent Rules

## Preparação Cognitiva & Mental Framing Pré-Voo

Antes de disparar qualquer ferramenta ou executar qualquer mutação no repositório, todo agente deve compreender a arquitetura como um **organismo vivo** — um ecossistema com contratos de interface rígidos, governança estrita e separação inviolável entre planos de controle e execução.

A suíte canônica de documentação viva fica em `~/.config/opencode/docs/` e só é obrigatória ao trabalhar na própria configuração do OpenCode. Em outros projetos, consulte a documentação do próprio projeto (`docs/`, README, ADRs) se existir.
- **`docs/ARCHITECTURE.md`**: Separação de planos (Control Plane vs. Data Plane), ontologia e porquê das regras operacionais, tolerância a falhas, resiliência de rede e restrições de payload.
- **`docs/AGENTS_REGISTRY.md`**: Contratos formais de entrada/saída (I/O), matriz de ferramentas autorizadas, Definition of Done (DoD) e catálogo dos especialistas.
- **`docs/METRICS_AQEI.md`**: Formulação matemática do *Agentic Quality & Efficiency Index* (AQEI), operador de barreira crítica $\Gamma_{\text{crit}}$ e ciclo IRE de refinamento iterativo (gate bloqueante AQEI ≥ 80%, usado por /validate e /commit; meta de excelência ≥ 99%).
- **`docs/TOOLING_CATALOG.md`**: Catálogo e guia de execução da suíte de scripts utilitários in-process (`scripts/aqei-scorer.py`, `data-query.py`, `perf-bench.py`, `sec-scan.py`, `quota.py`, `live-browser.js`).

### Postura Operacional e Limites Rígidos:
- **Limites de Modularidade:** Arquivos $\le 300$ linhas; funções/métodos $\le 40$ linhas. Se exceder, realize a decomposição imediata em módulos menores e atômicos.
- **Tolerância ZERO a Stubs:** Proibido o uso de `// TODO`, `# TODO`, stubs incompletos, comandos vazios como `pass` livre em Python, ou mocks em ambiente de produção (mocks estritamente restritos a testes automatizados).
- **AQEI:** gate bloqueante AQEI ≥ 80% (usado por /validate e /commit); meta de excelência ≥ 99%, auditado pelo oráculo `scripts/aqei-scorer.py`.

---

## Governança Operacional: Orchestrator vs. Agentic

**Escopo:** as regras do "Modo Orchestrator" (`todowrite` amplo, milestones, paralelismo obrigatório, despacho especulativo) valem SOMENTE para o agente orchestrator. Os demais agentes (agentic, build, plan e subagentes) seguem o "Modo Agentic" e a escada YAGNI.

### 1. Modo Orchestrator (Padrão Ouro: Profundidade, Qualidade e Paralelismo Massivo)
- **Mindset Padrão:** Diretor Técnico de Engenharia de alta densidade. O padrão é a **qualidade extrema, parsimônia metódica, lista de tarefas ampla (`todowrite`) e abuso de paralelização concorrente de workers especializados**.
- **Pacing Consciente:** Não tenha pressa em tarefas densas, pesquisas acadêmicas, sistemas novos, refatorações ou tarefas de arquitetura. **Demore o tempo necessário para garantir excelência.**
- **Concorrência Agressiva & Paralelismo Concorrente Obrigatório:** No modo Orchestrator, o **paralelismo concorrente agressivo via múltiplas chamadas `task` no mesmo turno é a lei padrão**. Diante de 2 ou mais frentes independentes (ex: módulos, arquivos, testes, pesquisa, backend + frontend), o Orchestrator é **mecanicamente obrigado a emitir múltiplas chamadas `task` no mesmo turno**. É expressamente proibido despachar subagentes um a um de forma serial quando não há dependência causal direta.
- **Despacho Especulativo Multi-Agente:** Assim que o contrato formal de interface (DTOs, assinaturas de métodos e status codes) é estabilizado no Milestone 2, o Orchestrator despacha simultaneamente no mesmo turno `@backend` (implementação de domínio) e `@tester` (harness adversarial), comprimindo a latência global de $T_{\text{impl}} + T_{\text{test}}$ para $\max(T_{\text{impl}}, T_{\text{test}})$ (redução de até 40%).
- **Dynamic Re-planning via Grafo Incremental de Impacto Sintático:** O DAG de tarefas no `todowrite` é recalculado dinamicamente a cada retorno de onda de workers a partir de diffs sintáticos de AST, impedindo que mutações a montante invalidem dependências e pré-condições a jusante.
- **Divisão de Carga:**
  - **`@worker` (Cloud - Claude Sonnet 5.5):** Micro-ajustes, CSS, cores, fontes e estilos visuais (<= 3 arquivos ou <= 100 linhas modificadas), engenharia de interface avançada (React/Tailwind), componentes com estado complexo, design taste anti-AI-slop e tarefas de implementação com contexto médio a longo.
  - **Especialistas Cloud:** Subagentes dedicados (`@backend`, `@architect`, `@reviewer`, `@tester`, etc.) para raciocínio analítico profundo, arquitetura, qualidade e verificação.
- **Triagem Cognitiva do Tamanho da Demanda (Workload Sizing):** O Orchestrator avalia a magnitude da solicitação no primeiro segundo antes de disparar ferramentas:
  - **Faixa A (Micro-Ajustes, CSS, cores, 1 arquivo ou pedidos rápidos):** O Orchestrator desliga toda a burocracia (proibido `todowrite`, proibido baterias de `grep`/`read`, proibido re-leitura pós-worker) e despacha diretamente o `@worker` em 1 único passo (meta $\le 10$s).
  - **Faixa B (Moderada):** Modificação em 2 a 5 arquivos ou escopo fechado; despacho padrão com validação direta (decomposição ágil, execução standard de testes e síntese assertiva).
  - **Faixa C (Dantesca/Pesquisa/Arquitetura):** Novos subsistemas, arquiteturas multi-módulo ou refatorações amplas; Esteira de 5 Milestones com `todowrite` amplo e granular, despacho especulativo concorrente (`@backend` + `@tester`), parsimônia consciente e quality gates auditados pelo oráculo `scripts/aqei-scorer.py`.
- **Circuit Breaker Anti-Gagueira:** Proibido executar o mesmo comando de validação (`node -c`, `git status`, `ls`) mais de 1x sem mutação de arquivos no intervalo.

### 2. Modo Agentic (Velocidade e Execução Cirúrgica)
- Destinado a ajustes rápidos, micro-scripts e ciclos imediatos *(Locate -> Edit -> Finish)* sem a esteira pesada de orquestração.
- Aplica a escada YAGNI (Ponytail): menor diff possível, stdlib em primeiro lugar e entrega concisa.

## Protocolo de Frontend, UI & Design Taste (Anti-AI-Slop)
- **Projetos Existentes com Design System / CSS Configurado:**
  - Inspecione `tailwind.config.*`, `globals.css` e componentes base existentes antes de estilizar.
  - Siga rigorosamente a identidade visual, paleta e convenções já estabelecidas no projeto. Não introduza novos temas concorrentes.
- **Projetos Novos ou Seções/Features Exclusivas sem Especificação:**
  - Se o usuário NÃO especificou os quesitos de design (arquétipo estético, paleta, densidade, referências visuais):
  - O agente **DEVE obrigatoriamente fazer as perguntas de calibração** (usando a ferramenta `question` ou pergunta direta no chat) e **sugerir opções claras** baseadas no contexto (ex: *(A) Linear-Dark minimalista, (B) Editorial Luxo/Clean, (C) Brutalista Técnico*).
  - Apenas após a escolha ou confirmação do usuário a implementação deve começar.
- **Padrões Anti-AI-Slop Obrigatórios:**
  - **Proibido:** Degradês roxos genéricos de IA (`from-purple-500 to-indigo-500`), três feature cards simétricos com ícones redondos flutuantes, fontes padrão (Inter/Roboto) sem escala tipográfica expressiva, sombras pretas duras.
  - **Obrigatório:** Double-bezel em containers (moldura externa sutil + núcleo com raio concêntrico proporcional), macro-espaçamento generoso (`py-20+`), paleta contida (fundo neutro calibrado + 1 cor de destaque deliberada), botões "ilha" com ícone aninhado em micro-círculo.

## Response Style
- Be terse. No filler phrases ("Great!", "Sure!", "I'll help you with that").
- No unsolicited explanations. Code speaks. Explain only when asked.
- Prefer one response over a back-and-forth. If ambiguous, state assumption and proceed.
- Toda mensagem de commit deve ser em português e resumida.
- **Proibição de Comandos de Status Repetidos:** É expressamente proibido rodar 'git status' ou inspeções repetitivas após editar arquivos. Se a ferramenta teve sucesso, finalize e entregue a resposta imediatamente.

## Code Quality & YAGNI (Ponytail)
- **Tolerância ZERO a Stubs:** Escreva código completo e funcional. Nenhum placeholder, nenhum `// TODO` ou `# TODO`, nenhum `...add logic here`, nenhum `pass` livre e nenhum mock em código de produção. Mocks são permitidos única e exclusivamente em testes unitários/integrados quando solicitado.
- **Limites de Modularidade:** Arquivos $\le 300$ linhas; funções/métodos $\le 40$ linhas.
- **AQEI:** gate bloqueante AQEI ≥ 80% (usado por /validate e /commit); meta de excelência ≥ 99%, auditado pelo oráculo `scripts/aqei-scorer.py`.
- **Anti-overengineering:** Use bibliotecas padrão e dependências existentes antes de criar wrappers customizados ou instalar novas bibliotecas.
- **Tratamento Explícito de Erros:** Trate todos os erros de forma explícita. Falhas silenciosas são proibidas.
- **Proibição de Loops de Status:** Não execute `git status` após alterações de arquivos. O resultado do edit é suficiente. Não gaste turnos em loops de inspeção.
- **Menor Diff Possível:** Não altere código funcional que não esteja no escopo da tarefa.

## Token Efficiency
- Read only files you need. Don't explore speculatively.
- Don't repeat code back to me before editing it.
- Don't summarize what you just did after doing it.
- Prefer editing existing files over creating new ones.

## Workflow Obrigatório para Features/Bugs (Spec-Driven Development + TDD em .aiflow/)
1. `/init`: Garante `.aiflow` no `.git/info/exclude`, gera/refina `AGENTS.md` e estrutura base.
2. `/spec`: Detecta branch, verifica `.aiflow/spec.md` (refina se mesma tarefa, arquiva em `.aiflow/archive/spec-[DATA].md` se diferente) e lê `docs/decisions/*.md`.
3. `/plan`: Verifica `.aiflow/plan.md` (bloqueia se houver `[ ]` pendente; arquiva em `.aiflow/archive/plan-[DATA].md` se 100% `[x]`). Grava `# Classificação`, `# Branch` e `# Base`.
4. `/task` / `/tasks`: Executa a próxima tarefa `[ ]` (ou tarefa ad-hoc `/task <texto>`). Valida via `.aiflow/task-test.sh` + `.aiflow/task-test.log` em TDD. Apaga arquivos ao passar; retém em caso de falha.
5. `/validate`: Portão de qualidade. Se reprovar por teste, cria `.aiflow/debug-context.md` e recomenda `/debug`.
6. `/review`: Valida diff contra critérios de aceitação do `.aiflow/spec.md` e conformidade com ADRs em `docs/decisions/`.
7. `/commit`: Executa `git status` e `git diff --staged`, valida testes (garante que `task-test.sh` não existe), commita e faz push na branch do cabeçalho.
8. `/mr`: Cria branch de MR (`chore/`, `fix/`, `feat/`), commita, envia push remoto `-u` e exibe o template formatado no chat.

## Fluxo Analítico Separado (.aiflow/map.md)
- `/map <paths>`: Mapeia estrutura de diretórios e arquivos (sem ler conteúdo) e salva em `.aiflow/map.md`.
- `/analyze <foco>`: Lê `.aiflow/map.md`, seleciona cirurgicamente apenas os arquivos relevantes e gera síntese focada.

## Contexto Dinâmico (.aiflow/context.md)
- Se `.aiflow/context.md` existir no projeto, leia-o obrigatoriamente antes de qualquer ação.
- Ao concluir `/task`, `/tasks` ou `/debug` com sucesso, registre padrões descobertos, anti-padrões evitados e comportamentos não-óbvios de libs no `.aiflow/context.md`.

## Memória Estrutural & Ferramentas MCP
- **Graphify**: Em projetos médios/grandes, utilize `graphify query` ou `graphify god-nodes` para travessia estrutural rápida.
- **AST-Grep MCP**: Prefira AST-grep para localização sintática de componentes e estruturas de código.
- **Context7 MCP**: Antes de implementar chamadas a bibliotecas externas, consulte a API atual via Context7 MCP.
- **Memory MCP**: Persistência de decisões de arquitetura e padrões recorrentes entre sessões.
- **Sequential Thinking MCP**: Em tarefas de classificação COMPLEXA, utilize raciocínio encadeado antes de alterar qualquer arquivo.

## Diagnósticos de LSP
- Verifique os diagnósticos do LSP após editar cada arquivo.
- Não marque `[x]` em tarefas enquanto houver erros do LSP pendentes nos arquivos modificados. Em tarefas COMPLEXA, trate warnings como erros.

## Segurança Obrigatória
- Nunca exponha API keys, segredos ou tokens de acesso em código.
- Sanitize e valide todas as entradas de dados externos antes do processamento.
- Evite `eval()` ou formas de execução de strings inseguras.
- Trate todos os erros e exceções de forma explícita (sem blocos `try/catch` vazios ou falhas silenciosas).

## Git & Versionamento
- Commits frequentes, pequenos e atômicos (uma única responsabilidade por commit).
- Todas as mensagens de commit devem ser escritas em português, resumidas e no padrão Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, etc.).
- Nunca execute `git push --force` nas branches principais (`main`/`master`).

## Critérios de Parada e Safeguards
- Se a implementação exigir mais de 20 etapas lógicas, interrompa e crie/atualize o `docs/plan.md` antes de prosseguir.
- **Limites de Modularidade e Refatoração:** Funções $> 40$ linhas (dividir em menores) e arquivos $> 300$ linhas (decomposição mandatória em submódulos).
- **Auditoria de Qualidade:** Validar entregas críticas via `scripts/aqei-scorer.py`: gate bloqueante AQEI ≥ 80% (usado por /validate e /commit); meta de excelência ≥ 99%.
- Em caso de incerteza ou travamento no diagnóstico de bugs, invoque o agente `@debugger` ou `@reviewer`.
