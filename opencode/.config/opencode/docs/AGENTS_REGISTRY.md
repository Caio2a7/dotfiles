# OpenCode Agents Registry & Formal Capabilities Catalog

Este catálogo descreve a ontologia, contratos de interface, matrizes de permissão e governança dos **4 agentes primários** (`orchestrator`, `agentic`, `build`, `plan`) e dos **16 subagentes especializados** do ecossistema OpenCode.

---

## 📊 Matriz Comparativa Geral

| Agente | Runtime | Escrita | Ferramentas & Scripts Mandatórios | Foco Primário |
| :--- | :--- | :--- | :--- | :--- |
| **`orchestrator`** | Cloud | `deny` | `task`, `todowrite`, scripts (`aqei-scorer`, `quota`, `status`, `learn`), MCPs (`sequentialthinking`, `memory`) | Direção técnica, DAG incremental, despacho especulativo, paralelismo massivo |
| **`agentic`** | Cloud (`claude-sonnet-5-5`, low) | Total | `read`, `edit`, `write`, `bash` irrestrito | Execução cirúrgica (*Locate -> Edit -> Finish*) |
| **`build`** | Cloud (`claude-opus-5-5[1m]`) | Total | ferramentas padrão do OpenCode | Comandos `/init`, `/spec`, `/plan` e `/map` |
| **`plan`** | Cloud (`claude-opus-5-5[1m]`) | `deny` | somente leitura | Planejamento somente leitura |
| **`worker`** | Cloud | Total | `write`, `edit`, `read`, MCP `context7`, MCP `ast-grep`, `bash` | Micro-ajustes/CSS (Faixa A), UI anti-AI-slop, estado complexo, contexto longo |
| **`backend`** | Cloud | Total | `write`, `edit`, MCP `context7`, MCP `ast-grep`, MCP `agent-lsp`, `bash` (compilação) | POO, DDD, Clean Architecture, APIs |
| **`database`** | Cloud | Total | `write`, `edit`, `read`, `bash` (timeouts, migrações) | 3NF/BCNF, Expand-and-Contract, índices |
| **`refactorer`** | Cloud | Total | `edit`, `write`, MCP `ast-grep`, MCP `agent-lsp`, script `ast-linter-hook.py`, `bash` | Refactoring Fowler, SOLID, limites 40/300L |
| **`devops`** | Cloud | Total | `write`, `edit`, MCP `docker`, `bash` (Docker, CI/CD) | Multi-stage, Compose, contêineres sem root |
| **`architect`** | Cloud | `deny` | `read`, `glob`, `grep`, MCP `sequentialthinking`, `bash` (no-rm) | Contratos de API, diagramas Mermaid, ADRs |
| **`data-engineer`** | Cloud | Total | `write`, `edit`, script `data-query.py` (DuckDB), Polars | Pipelines ETL/ELT idempotentes, Parquet |
| **`docs-writer`** | Cloud | Total | `write`, `edit`, `read`, `glob` (guia de estilo ativo) | Documentação técnica viva, runbooks, contratos |
| **`tester`** | Cloud | Total | `write`, `edit`, script `live-browser.js`, `bash` (test runners) | TDD adversarial, testes unitários, E2E Playwright |
| **`reviewer`** | Cloud | `deny` | `read`, `git diff`, script `aqei-scorer.py`, script `ast-linter-hook.py` | Quality gate semafórico, gate AQEI >= 80% (meta >= 99%), conformidade |
| **`debugger`** | Cloud | `deny` | `read`, MCP `ast-grep`, `bash` (logs, traces, git log) | Eliminação empírica de hipóteses, causa-raiz e Oráculo de Localização de Falhas (Agentless) |
| **`performance`** | Cloud | Total | script `perf-bench.py` (Hyperfine, Autocannon), `bash` | Profiling de latência (p95/p99) e carga USE |
| **`blue-team`** | Cloud | Total | script `sec-scan.py` (Semgrep, Gitleaks, OSV), `read`, `bash` | AppSec defensivo, SAST, CVEs, OWASP ASVS |
| **`red-team`** | Cloud | `deny` | `bash` (`curl`, sondagens seguras), `read` | Modelagem STRIDE, sondagens autorizadas |
| **`scout`** | Cloud | `deny` | `graphify`, MCP `ast-grep`, MCP `agent-lsp`, `grep`, `find`, `ls` | Cartografia estrutural da codebase sem inchaço |
| **`browser`** | Cloud | Total | `playwright-cli`, Chromium headless, script `live-browser.js` | Automação CLI atômica, inspeção DOM e CDP |

---

## 🌟 Modos Primários de Governança

### 1. `orchestrator`
- **Missão:** VP of Engineering. Governa campanhas complexas com parsimônia metódica, esteira de 5 milestones, paralelismo massivo via `task`, despacho especulativo e dynamic re-planning.
- **Protocolos de Execução:**
  - **Dynamic Re-planning (CodePlan):** Recálculo incremental do DAG de tarefas no `todowrite` a cada retorno de onda via diffs sintáticos de AST, prevenindo que mutações a montante invalidem dependências a jusante.
  - **Despacho Especulativo Multi-Agente:** Despacho simultâneo no mesmo turno de `@backend` (implementação) e `@tester` (harness adversarial) contra contratos de interface no Milestone 2, comprimindo a latência global de $T_{\text{impl}} + T_{\text{test}}$ para $\max(T_{\text{impl}}, T_{\text{test}})$ (redução de até 40%).
  - **SWE-planner Gate:** Verificação ativa de pré-condições executáveis (arquivos e símbolos) antes de persistir tarefas no `.aiflow/plan.md`.
- **Contrato:** `{ demand: string, scope?: string[], constraints?: string[] }`
- **Ferramentas Mandatórias:** Orquestração (`task`, `todowrite`), leitura (`read`, `glob`, `grep`), scripts in-process (`aqei-scorer.py`, `quota.py`, `status.py`, `learn.py`, `ast-linter-hook.py`), MCPs (`sequentialthinking`, `memory`). Bloqueadas: `edit`, `write`.
- **DoD:** DAG decomposto no `todowrite`, recálculo dinâmico incremental aplicado, ondas concluídas sem erros LSP, testes `FAIL_TO_PASS`/`PASS_TO_PASS` aprovados, gate AQEI bloqueante $\ge 80\%$ validado (meta $\ge 99\%$).
- **Anti-Patterns:** Mutação direta de arquivos, despacho serial de frentes independentes, conclusão prematura sem testes, planejamento estático cego sem re-avaliação do grafo de impacto.

### 2. `agentic`
- **Missão:** Executor cirúrgico direto (*Field Medic*). Otimizado para ciclos de linha reta (*Locate -> Edit -> Finish*) com diff mínimo YAGNI.
- **Contrato:** `{ task: string, target_file?: string }`
- **Ferramentas:** Autonomia total: `read`, `edit`, `write`, `bash` irrestrito.
- **DoD:** Leitura em passo único, alteração atômica aplicada, resposta concisa em menos de 3 linhas.
- **Anti-Patterns:** Burocracia especulativa, navegação desnecessária com glob/grep quando o arquivo já é conhecido, re-leitura pós-edição.

---

## 🛠️ Subagentes de Engenharia e Construção

### 3. `worker`
- **Missão:** Especialista de interface e implementação em nuvem (`claude-code/claude-sonnet-5-5`). Componentes React/Tailwind com estado complexo, design taste anti-AI-slop e raciocínio de contexto médio/longo.
- **Contrato:** `{ target_component: string, design_requirements?: string, code_modifications: string }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, MCP `context7` (mandatório para checagem prévia de APIs/libs externas), MCP `ast-grep`, `bash` (linters/compilação).
- **DoD:** Componente com double-bezel, macro-espaçamento (`py-20+`), paleta contida, tipografia expressiva, compilação limpa em no máximo 2 passos.
- **Anti-Patterns:** Degradês roxos genéricos de IA, cards simétricos genéricos, implementar APIs de bibliotecas sem consultar Context7 MCP.

### 4. `backend`
- **Missão:** Engenheiro backend sênior especialista em POO, DDD, Clean Architecture, microsserviços e concorrência segura.
- **Contrato:** `{ module_name: string, contracts: string[], business_rules: string[], stack: "typescript"|"python"|"go"|"java" }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, MCP `context7` (consulta obrigatória de bibliotecas), MCP `ast-grep` (localização sintática), MCP `agent-lsp` (`go_to_definition` para resolução precisa de tipos/contratos e `safe_apply_edit` para mutações atômicas com integridade sintática), `bash` (`tsc`, `py_compile`, `go build`).
- **DoD:** Código compilável, Value Objects imutáveis, injeção de dependências no construtor, tratamento explícito de erros e zero stubs.
- **Anti-Patterns:** Imports relativos quebrados, scripts temporários no repositório, placeholders `// TODO`.

### 5. `database`
- **Missão:** Arquiteto de dados focado em modelagem 3NF/BCNF, evolução zero-downtime (Expand-and-Contract) e tuning de índices SQL.
- **Contrato:** `{ operation: "new_table"|"migration_expand"|"migration_contract"|"index_tuning", entity_definition: Record<string, string>, lock_timeout_ms?: number }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, `bash` (execução e validação de migrações).
- **DoD:** Migrações com `lock_timeout = '2s'`, índices criados com `CONCURRENTLY`, chaves UUIDv7/BIGINT e scripts idempotentes de rollback.
- **Anti-Patterns:** `DROP COLUMN` destrutivo direto sem contract prévio, migrações sem timeout de lock, queries sem índices em chaves estrangeiras.

### 6. `refactorer`
- **Missão:** Especialista em Clean Code e catálogo Martin Fowler. Decomposição atômica respeitando limites de 40/300 linhas preservando 100% dos testes.
- **Contrato:** `{ target_files: string[], focus: "split_large_file"|"shorten_methods"|"extract_interface"|"eliminate_duplication", test_snapshot_command: string }`
- **Ferramentas Mandatórias:** `edit`, `write`, `read`, MCP `ast-grep` (reescrita estrutural sem quebras), MCP `agent-lsp` (`blast_radius` para auditoria do grafo de impacto transversal e `simulate_edit` para verificação virtual prévia de compilação/tipos), script `ast-linter-hook.py`, `bash` (`git push` bloqueado).
- **DoD:** Arquivos $\le 300$ linhas, funções $\le 40$ linhas, zero stubs, conformidade AST e 100% da suíte de testes verde preservada.
- **Anti-Patterns:** Alterar regras de negócio durante o refactoring, refatorar sem snapshot de testes verdes comprovado.

### 7. `devops`
- **Missão:** Engenheiro de infraestrutura como código, contêineres otimizados e automação CI/CD.
- **Contrato:** `{ service_name: string, environment: "docker"|"compose"|"github-actions", ports?: number[], caching_strategy?: string }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, MCP `docker` (inspeção de contêineres, logs, imagens e estatísticas), `bash` (docker build/compose).
- **DoD:** Dockerfiles multi-stage em imagens mínimas (Alpine/Distroless), execução com usuário não-root (`USER`), cache em camadas otimizado e segredos isolados.
- **Anti-Patterns:** Execução como root no contêiner, cópia de `.env` para a imagem, builds monolíticos sem multi-stage.

---

## 📐 Subagentes de Design, Análise e Documentação

### 8. `architect`
- **Missão:** Modelagem de sistemas distribuídos, contratos de fronteira, ADRs formais e topologia de componentes.
- **Contrato:** `{ title: string, problem_context: string, options_considered: string[], target_adr_path?: string }`
- **Ferramentas Mandatórias:** `read`, `glob`, `grep`, MCP `sequentialthinking` (raciocínio encadeado), `bash` (`rm` bloqueado, `edit: deny`).
- **DoD:** ADR registrado em `docs/decisions/` com trade-offs detalhados e diagramas em sintaxe Mermaid funcional.
- **Anti-Patterns:** Arquiteturas infladas desnecessárias (over-engineering), adoção de padrões sem análise explícita de prós e contras.

### 9. `data-engineer`
- **Missão:** Engenharia de dados, pipelines ETL/ELT idempotentes, conversão colunar Parquet e modelagem Star Schema.
- **Contrato:** `{ input_paths: string[], output_target: string, compression: "snappy"|"zstd", schema_definitions: Record<string, string> }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, script `data-query.py` (DuckDB), Python (Polars / DuckDB).
- **DoD:** Pipeline idempotente implementado, redução $\ge 70\%$ do tamanho em disco via Parquet, validações de integridade aprovadas.
- **Anti-Patterns:** Pipelines que duplicam dados ao re-executar, inferência relaxada de tipos temporais e decimais.

### 10. `docs-writer`
- **Missão:** Documentação técnica viva, clara e adaptável continuamente ao guia de estilo do operador (`.aiflow/docs-style.md`).
- **Contrato:** `{ target_docs: string[], doc_type: "readme"|"architecture"|"api_spec"|"runbook"|"catalog", subject_scope: string }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, `glob`, inspeção obrigatória prévia do guia de estilo (`.aiflow/docs-style.md`).
- **DoD:** Markdown limpo, sem marketing speak, tabelas estruturadas, diagramas Mermaid, contratos rigorosos e adesão total ao estilo ativo.
- **Anti-Patterns:** Emojis ou enrolação retórica quando o guia proibir, documentações divergentes do código implementado.

---

## 🧪 Subagentes de Qualidade, Diagnóstico e Testes

### 11. `tester`
- **Missão:** Engenheiro adversarial de testes. Constrói suítes unitárias, integração e testes E2E Playwright.
- **Contrato:** `{ target_code: string, test_type: "unit"|"integration"|"e2e_playwright", expected_failures: string[] }`
- **Ferramentas Mandatórias:** `write`, `edit`, `read`, script `live-browser.js` (inspeção CDP e automação ao vivo), `bash` (pytest, vitest, playwright).
- **DoD:** Execução em 1 passo, evidência adversarial de `FAIL_TO_PASS`, preservação de `PASS_TO_PASS` e traces gerados em falhas de UI.
- **Anti-Patterns:** Mocks permissivos que escondem bugs reais, testes superficiais sem cobertura de caminhos de erro.

### 12. `reviewer`
- **Missão:** Quality Gate sênior. Audita diffs contra critérios do spec, conformidade com ADRs, boas práticas e índice AQEI.
- **Contrato:** `{ spec_path: string, git_diff_target?: string }`
- **Ferramentas Mandatórias:** `read`, `git diff`, `git log`, `grep`, script `aqei-scorer.py` (auditoria do índice AQEI: gate bloqueante $\ge 80\%$, meta $\ge 99.0\%$), script `ast-linter-hook.py`.
- **DoD:** Relatório semafórico (🔴 Crítico, 🟡 Importante, 🟢 Sugestão) com parecer final formal (APROVADO ou REPROVADO).
- **Anti-Patterns:** Aprovar stubs (`// TODO`), tolerar regressões de tipagem ou ausência de tratamento de exceções.

### 13. `debugger`
- **Missão:** Diagnóstico reverso e eliminação científica de hipóteses de falha. Atua também como **Oráculo de Localização Hierárquica de Falhas (Agentless Protocol)**: isolamento pré-mutação de defeitos em pipeline de 4 níveis, consultado por `/task` e `/debug`.
- **Pipeline de Localização Hierárquica de Falhas (Agentless Protocol):**
  - **Nível 1 (Repo Filter):** Filtragem de superfície via `glob`/`grep`, descartando ruídos (vendor, lockfiles, build) e mapeando arquivos suspeitos.
  - **Nível 2 (File Candidate Selection):** Ranqueamento dos 1 a 3 arquivos mais prováveis com base em símbolos do erro e fluxo de dados causal.
  - **Nível 3 (AST Block Isolation):** Delimitação do bloco sintático afetado via `ast-grep_search` ou `read` focado, isolando a função/método e o intervalo exato de linhas (`[inicio, fim]`).
  - **Nível 4 (Emissão do Fault Localization DTO):** Geração do diagnóstico estruturado padronizado em JSON:
    ```json
    {
      "target_file": "caminho/do/arquivo",
      "symbol": "nome_da_funcao_ou_classe",
      "line_range": [inicio, fim],
      "root_cause_hypothesis": "diagnóstico cirúrgico",
      "recommended_specialist": "backend | worker"
    }
    ```
- **Contrato:** `{ error_context_path: string, failing_command: string }` (localização: `{ error_context: string, symptoms: string[], stack_trace?: string }`)
- **Ferramentas Mandatórias:** `read`, MCP `ast-grep` (análise de nós e assinaturas sintáticas), `bash` (inspeção de logs e traces; `edit: deny`).
- **DoD:** Causa-raiz comprovada empiricamente com evidência concreta e especificação cirúrgica de correção para o `worker`; emissão do `Fault Localization DTO` estruturado com bloco AST e linhas delimitadas antes de qualquer mutação.
- **Anti-Patterns:** Suposições intuitivas sem análise de stack trace, mutações aleatórias esperando que o erro se resolva por sorte, saltar níveis do pipeline Agentless, mutações cegas sem isolamento de intervalo de linhas.

### 14. `performance`
- **Missão:** Profiling estatístico de latência e carga fundamentado no Método USE e Coordinated Omission.
- **Contrato:** `{ target: "cli"|"http", command_or_url: string, concurrency?: number, duration_seconds?: number }`
- **Ferramentas Mandatórias:** script `perf-bench.py` (Hyperfine para CLI, Autocannon para HTTP), `bash`.
- **DoD:** Relatório com percentis detalhados (p50, p90, p95, p99), throughput e comparação empírica antes vs. depois.
- **Anti-Patterns:** Zero Performance Guessing: afirmar otimizações sem benchmarks, reportar média aritmética mascarando p99.

---

## 🛡️ Subagentes de Segurança e Navegação

### 15. `blue-team`
- **Missão:** Especialista em AppSec defensivo, análise estática SAST, auditoria de dependências vulneráveis e endurecimento OWASP ASVS.
- **Contrato:** `{ scope: "secrets"|"sast"|"deps"|"all", target_path: string }`
- **Ferramentas Mandatórias:** script `sec-scan.py` (Gitleaks, Semgrep, OSV-Scanner), `read`, `bash`.
- **DoD:** Varredura completa executada, zero segredos expostos, classificação CWE/CVSS e planos de remediação aplicados.
- **Anti-Patterns:** Confiar exclusivamente em validações client-side, suprimir alertas SAST sem justificativa formal.

### 16. `red-team`
- **Missão:** Modelagem de ameaças (STRIDE), análise de superfície de ataque e sondagem ativa não-destrutiva de endpoints autorizados.
- **Contrato:** `{ target_endpoint: string, scope: "auth"|"input_validation"|"idor"|"headers" }`
- **Ferramentas Mandatórias:** `bash` (`curl`, scripts locais de sondagem), `read` (`edit: deny`).
- **DoD:** Superfície de ataque mapeada via STRIDE, testes conceituais executados com segurança e relatório defensivo para o `blue-team`.
- **Anti-Patterns:** Sondagens contra alvos não autorizados, injeção de cargas destrutivas ou indisponibilização de serviços (DoS).

### 17. `scout`
- **Missão:** Navegador estrutural e cartógrafo de código. Mapeia árvores e dependências sem poluir a janela de contexto.
- **Contrato:** `{ query: string, repository_path?: string }`
- **Ferramentas Mandatórias:** `graphify`, MCP `ast-grep` (pesquisa sintática de nós e estruturas), MCP `agent-lsp` (`go_to_definition` para salto semântico direto até declarações e contratos sem leitura especulativa), `grep`, `find`, `ls` (`edit: deny`).
- **DoD:** Mapa estrutural conciso entregue em 2-3 passos com caminhos exatos de arquivos e assinaturas de tipos.
- **Anti-Patterns:** Despejar arquivos inteiros no chat, navegação especulativa lendo conteúdos não relacionados à busca.

### 18. `browser`
- **Missão:** Automação web atômica via Playwright CLI oficial ou navegador isolado Helium Dev via Chrome DevTools Protocol (CDP).
- **Contrato:** `{ url: string, actions: Array<"goto"|"click"|"fill"|"screenshot"|"snapshot">, selectors?: Record<string, string> }`
- **Ferramentas Mandatórias:** `playwright-cli`, Chromium headless, script `live-browser.js` (interação CDP com Helium Dev).
- **DoD:** Navegação determinística via comandos atômicos da CLI em milissegundos, screenshots e snapshots gravados.
- **Anti-Patterns:** Scripts avulsos descartáveis em vez da CLI oficial, esperas cegas com timeouts arbitrários.
