# OpenCode In-Process Tooling & Scripts Catalog

Este catálogo detalha a suíte de scripts utilitários mantidos no diretório [`scripts/`](../scripts/), projetados para execução local de alta velocidade, baixo consumo de memória e ausência de dependências externas pesadas (orientados à biblioteca padrão ou executores in-process isolados via `uv` e `npx`).

---

## 🧰 Visão Geral dos Utilitários

```mermaid
graph LR
    subgraph Suite_Scripts["Scripts Locais In-Process (~/.config/opencode/scripts/)"]
        AQEI["aqei-scorer.py\n+ aqei/\n(Auditor SOTA & Qualidade)"]
        Quota["quota.py\n+ quota_core/\n(Inspetor de Cotas)"]
        Status["status.py\n(Painel Unificado /status)"]
        Learn["learn.py\n(Extrator memory.jsonl /learn)"]
        Worktree["worktree-runner.sh\n(Sandbox 2PC /sandbox)"]
        ASTLint["ast-linter-hook.py\n(Hook Linter AST & Modularidade)"]
        Checkpoint["checkpoint.py\n(Snapshot & Monitor 40t /checkpoint)"]
        PerfBench["perf-bench.py\n(Hyperfine & Autocannon)"]
        SecScan["sec-scan.py\n(AppSec: Gitleaks/Semgrep/OSV)"]
        LiveBrowser["live-browser.js\n(Controle CDP Helium Dev)"]
        SemSearch["semantic-code-search.py\n(Busca Semântica GPU /semsearch)"]
    end

    AQEI --> QualityGate["Quality Gate & CI/CD"]
    ASTLint --> QualityGate
    Quota --> Orchestrator["Orchestrator / Status"]
    Status --> Orchestrator
    Learn --> MemoryMCP["memory.jsonl"]
    Worktree --> Isolation["Sandbox Efêmero (Git Worktree)"]
    Checkpoint --> ContextEconomy["Higiene de Sessão (Teto 40t)"]
    PerfBench --> Bench["Benchmarks (hyperfine / autocannon)"]
    SecScan --> BlueTeam["@blue-team / @reviewer"]
    LiveBrowser --> Browser["@browser / UI QA"]
    SemSearch --> Backend["@backend / GPU Local"]
```

---

## 1. `aqei-scorer.py` & Pacote Modular `aqei/`

- **Propósito:** Auditor estático e dinâmico de sessões e repositórios. Calcula o *Agentic Quality & Efficiency Index (AQEI)* através de 5 dimensões ponderadas e valida a integridade da árvore sintática (AST) para garantir conformidade matemática com o padrão ouro ($\ge 99\%$ SOTA).
- **Arquitetura Modular (`scripts/aqei/`):**
  O motor AQEI foi decomposto no pacote modular `aqei/` respeitando os limites rígidos de modularidade ($\le 300$ linhas por arquivo, $\le 40$ linhas por função):
  - **`aqei/cli.py`:** Ponto de entrada CLI, orquestração de parsing de argumentos (`--session`, `--audit-dir`, `--test`, `--benchmark`, `--json`) e roteamento de execução.
  - **`aqei/models.py`:** Dataclasses de domínio (`AQEIResult`, `MetricDimension`, `SessionRawData`, `FileAuditSummary`).
  - **`aqei/auditor.py`:** Auditoria estática profunda via AST Python e linters léxicos (`CodeStubAuditor`, `RepoAuditor`) verificando stubs (`TODO`, `FIXME`, `pass` livre, `NotImplementedError`), arquivos $> 300$ linhas e funções $> 40$ linhas.
  - **`aqei/calculator.py`:** Cálculo ponderado das 5 dimensões ($0.20 \cdot \text{CSI} + 0.15 \cdot \text{TBER} + 0.35 \cdot \text{RCP} + 0.15 \cdot \text{CPI} + 0.15 \cdot \text{DSIR}$) e aplicação do Operador de Barreira Crítica ($\Gamma_{\text{crit}}$).
  - **`aqei/penalties.py`:** Algoritmos estritos de penalidade (detecção de loops de gagueira shell, falhas consecutivas de ferramentas e inchaço de tokens).
  - **`aqei/db_reader.py`:** Leitor nativo do banco de dados SQLite (`opencode.db`) para extração determinística de telemetria da sessão (`OpenCodeDBReader`, `SessionAnalyzer`).
  - **`aqei/reporter.py`:** Renderizador de relatórios semafóricos em terminal ANSI e formatador padronizado em JSON.
  - **`aqei/harness.py`:** Suíte interna de testes unitários e orquestrador de convergência empírica do IRE.
- **Entrypoint:** `scripts/aqei-scorer.py` (executa `aqei.cli.main()`).
- **Dependências de Runtime:** Python 3.8+ (Stdlib pura: `ast`, `sqlite3`, `argparse`, `dataclasses`, `json`, `re`, `pathlib`). Zero pacotes externos necessários.
- **Tabela de Flags e Parâmetros:**

| Flag | Tipo | Descrição |
| :--- | :--- | :--- |
| `--session <id \| latest>` | String | Audita uma sessão gravada no banco SQLite do OpenCode. Use `latest` para a mais recente. |
| `--audit-dir <path>` | String | Varre a árvore de código-fonte em busca de stubs, arquivos $> 300$ linhas e funções $> 40$ linhas. |
| `--test` / `--benchmark` | Flag | Executa o harness interno de testes unitários do AST e demonstra a convergência do IRE. |
| `--json` | Flag | Emite o resultado final estritamente estruturado em JSON para consumo programático. |

- **Exemplos de Uso:**
```bash
# Auditar a sessão mais recente no projeto atual
python3 ~/.config/opencode/scripts/aqei-scorer.py --session latest

# Auditar estaticamente o repositório inteiro gerando JSON
python3 ~/.config/opencode/scripts/aqei-scorer.py --audit-dir . --json

# Rodar o harness de integridade interna
python3 ~/.config/opencode/scripts/aqei-scorer.py --test
```

- **Contrato de Saída (JSON Output):**
```typescript
interface AQEIOutput {
  global_score: number;           // Ex: 99.70
  status: string;                 // "PADRÃO OURO SOTA >= 99%" | "PRODUÇÃO EXCELENTE" | "CRÍTICO"
  dimensions: Array<{
    code: "CSI" | "TBER" | "RCP" | "CPI" | "DSIR";
    name: string;
    weight: number;
    score: number;
    raw_metrics: Record<string, any>;
    deductions: string[];
  }>;
  recommendations: string[];
  session_id?: string;
  target_path?: string;
}
```

---

## 2. `quota.py` & Motor Modular `quota_core/`

- **Propósito:** Inspetor determinístico de cotas e limites operacionais. Detecta automaticamente o modelo e provedor ativos na sessão lendo o SQLite do OpenCode (`~/.local/share/opencode/opencode.db`), `model.json` ou variáveis de ambiente, inspeciona o estado do plano Claude, e emite relatórios visuais ricos com barras de progresso e limites de tokens.
- **Arquitetura Modular (`scripts/quota_core/`):**
  - **`quota_core/detector.py`:** Módulo determinístico de detecção (`detect_active_model`, `classify_model`). Identifica o provedor (`claude-code`, `local-gpu`), categoriza grupos de cotas (plano Claude) e limites de contexto.
  - **`quota_core/sources.py`:** Fontes de cota (`fetch_claude_plan_status`). Lê o estado de limites do plano Claude em `~/.local/share/opencode-claude/rate-limit.json`.
  - **`quota_core/formatter.py`:** Motor de formatação e apresentação (`build_report`, `format_percent`, `format_reset_time`). Produz relatórios com barras de progresso visuais, percentuais de cota e badges de status semafórico.
  - **`quota_core/__init__.py`:** Facade de exportação unificada das funções canônicas do motor.
- **Entrypoint:** `scripts/quota.py` (executa `build_report(detect_active_model(), forced_model=args.model)`).
- **Dependências de Runtime:** Python 3 (Stdlib: `sqlite3`, `json`, `os`, `urllib.request`). Zero dependências externas.
- **Tabela de Uso e Parâmetros:**

| Argumento | Tipo | Descrição |
| :--- | :--- | :--- |
| *(sem argumentos)* | N/A | Detecta o modelo ativo no diretório atual e imprime seu status consolidado. |
| `--model <model_id>` | String | Força a inspeção de limites específicos de um modelo arbitrário cadastrado. |

- **Exemplos de Uso:**
```bash
# Inspecionar a cota do modelo ativo no momento
python3 ~/.config/opencode/scripts/quota.py

# Inspecionar limites de um modelo específico
python3 ~/.config/opencode/scripts/quota.py --model claude-code/claude-sonnet-5-5
```

---

## 3. `status.py`

- **Propósito:** Painel unificado de status operacional do sistema OpenCode. Consolida em um único snapshot no terminal o estado do modelo ativo, o estado do plano Claude, o contexto do Git e as métricas de qualidade AQEI da última sessão gravada no banco SQLite.
- **Comando Associado:** `/status` (slash command nativo do OpenCode).
- **Dependências de Runtime:** Python 3 (Stdlib pura: `subprocess`, `sys`, `os`, `typing`) consumindo in-process os módulos `aqei` e `quota_core`.
- **Módulos Integrados:**
  - `quota_core.detector.detect_active_model`: Identifica o modelo LLM em uso, provedor e variante.
  - `quota_core.sources.fetch_claude_plan_status`: Relata o estado do limite do plano Claude (janela e reset).
  - Git subprocess: Extrai branch atual e quantidade de arquivos modificados (`git status --porcelain`).
  - `aqei.db_reader.OpenCodeDBReader` & `SessionAnalyzer`: Audita a sessão mais recente no SQLite e calcula o score AQEI global em tempo real.
- **Exemplo de Uso:**
```bash
# Exibir o painel unificado de status
python3 ~/.config/opencode/scripts/status.py
```

- **Exemplo de Painel Renderizado:**
```
┌──────────────────────────────────────────────────────────────┐
│ OPENCODE UNIFIED SYSTEM STATUS                               │
├──────────────────────────────────────────────────────────────┤
│  Active Model:    claude-sonnet-5-5 (claude-code / default)  │
│  Claude Plan:     allowed (five_hour)                        │
│  Git Context:     main (Clean)                               │
│  Last Session:    Refatoração Modular Scripts               │
│  Latest AQEI:     99.7% (PADRÃO OURO SOTA >= 99%)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. `learn.py`

- **Propósito:** Extrator automatizado de aprendizados técnicos, decisões de arquitetura e padrões descobertos para integração com o grafo de conhecimento persistente do grafo `memory.jsonl`. Permite que lições aprendidas em uma sessão sejam retidas globalmente entre repositórios da máquina.
- **Comando Associado:** `/learn`.
- **Dependências de Runtime:** Python 3 (Stdlib pura: `argparse`, `json`, `os`, `re`, `subprocess`, `typing`).
- **Fontes de Dados & Mecanismo:**
  - Inspeciona `.aiflow/context.md` e `~/.config/opencode/.aiflow/context.md` em busca de descobertas e lições registradas.
  - Inspeciona os commits recentes do Git (`git log -n3 --pretty=format:%s (%h)`).
  - Estrutura as entidades com tipagem de entidades do grafo (`<Repo>_Learnings` e `<Repo>_RecentCommits`).
  - **Modo Preview (padrão):** Exibe resumo visual colorido no terminal sem alterar arquivos.
  - **Modo Persistência (`--save` ou `--commit`):** Anexa as entidades em formato JSON Lines (`.jsonl`) em `~/.config/opencode/memory.jsonl`.
- **Tabela de Flags:**

| Flag | Tipo | Descrição |
| :--- | :--- | :--- |
| *(sem flags)* | N/A | Executa em modo preview exibindo as entidades extraídas no terminal. |
| `--save` / `--commit` | Flag | Grava e persiste as entidades no arquivo canônico `~/.config/opencode/memory.jsonl`. |

- **Exemplos de Uso:**
```bash
# Visualizar preview dos aprendizados da sessão atual
python3 ~/.config/opencode/scripts/learn.py

# Persistir os aprendizados no grafo global (memory.jsonl)
python3 ~/.config/opencode/scripts/learn.py --save
```

---

## 5. `worktree-runner.sh`

- **Propósito:** Executor em sandbox seguro utilizando *Git Worktrees* temporárias/efêmeras sob o paradigma *Two-Phase Commit (2PC)*. Permite testar comandos, refatorações perigosas ou suítes de teste com garantia absoluta de que o repositório principal não será corrompido em caso de falha.
- **Comando Associado:** `/sandbox <comando...>`.
- **Dependências de Runtime:** Bash, Git (`git worktree`, `git diff`, `git apply`).
- **Mecanismo Operacional (Two-Phase Commit):**
  - **Fase 1 (Isolamento Efêmero):** Cria uma worktree temporária em `/tmp/opencode-wt-$$` destacada de `HEAD` e direciona a execução para o diretório isolado.
  - **Execução:** Roda o comando arbitrário na worktree.
  - **Fase 2 (Commit / Rollback):**
    - Se o comando terminar com sucesso (`exit code 0`): captura o diff das alterações, exibe estatísticas (`git diff --stat`) e aplica o patch diretamente no repositório de trabalho via `git apply --reject --whitespace=fix`.
    - Se o comando falhar (`exit code != 0`): descarta o sandbox imediatamente via handler `cleanup` (`trap cleanup EXIT INT TERM`). O repositório original permanece 100% intocado.
- **Exemplos de Uso:**
```bash
# Executar suíte de testes em sandbox isolado
bash ~/.config/opencode/scripts/worktree-runner.sh npm test

# Executar script de migração ou build com garantia de rollback
bash ~/.config/opencode/scripts/worktree-runner.sh python3 run_migration.py

# Executar múltiplos comandos encadeados
bash ~/.config/opencode/scripts/worktree-runner.sh "npm run build && npm run lint"
```

---

## 6. `ast-linter-hook.py`

- **Propósito:** Hook passivo de linter sintático AST e validação de limites de modularidade arquitetural baseado nos princípios Princeton ACI (*Agent-Computer Interface*). Projetado para execução pré-commit, validação pós-escrita por agentes autônomos ou como etapa de validação estática em CI/CD.
- **Dependências de Runtime:** Python 3 (Stdlib: `ast`, `os`, `re`, `sys`, `pathlib`). Importa `aqei.auditor.CodeStubAuditor` quando disponível.
- **Invariantes Invioláveis Auditadas:**
  1. **Teto de Arquivo:** Máximo de 300 linhas por arquivo (avalia todas as linguagens).
  2. **Teto de Função/Método:** Máximo de 40 linhas por função (Python via `ast.parse` / AST walk; JavaScript/TypeScript via parser de blocos léxicos).
  3. **Tolerância Zero a Stubs:** Bloqueio imediato de comentários `TODO`, `FIXME`, blocos `pass` vazios ou `raise NotImplementedError`.
  4. **Erros de Sintaxe AST:** Falha sumária em qualquer erro sintático de compilação.
- **Tabela de Parâmetros:**

| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `<arquivo1> [arquivo2 ...]` | Caminhos | Lista de arquivos a serem validados. |
| `-v` / `--verbose` | Flag | Exibe confirmação visual de arquivos aprovados. |

- **Código de Retorno:** `0` (todos conformes) ou `1` (se qualquer violação for detectada).
- **Exemplos de Uso:**
```bash
# Validar arquivos específicos antes de commitar
python3 ~/.config/opencode/scripts/ast-linter-hook.py src/index.ts src/app.py

# Validação com saída verbosa
python3 ~/.config/opencode/scripts/ast-linter-hook.py -v scripts/*.py
```

---

## 7. `checkpoint.py`

- **Propósito:** Monitor de higiene de sessão e gerador de snapshots determinísticos em `.aiflow/checkpoint-latest.json`. Protege a janela de raciocínio contra a síndrome de degradação de contexto (*Lost in the Middle*) monitorando o teto crítico de 40 turnos.
- **Comando Associado:** `/checkpoint`.
- **Dependências de Runtime:** Python 3 (Stdlib pura: `datetime`, `json`, `os`, `pathlib`, `sqlite3`, `subprocess`, `sys`).
- **Mecanismo Operacional:**
  - Conecta-se em modo leitura ao SQLite do OpenCode (`~/.local/share/opencode/opencode.db`).
  - Extrai `session_id`, título e total de mensagens acumuladas na sessão ativa.
  - Inspeciona o estado do Git (branch ativa e `git diff --stat`).
  - Realiza o parsing de `.aiflow/plan.md` separando tarefas pendentes (`[ ]`) e concluídas (`[x]`).
  - Gera o snapshot serializado em `.aiflow/checkpoint-latest.json`.
  - **Alerta Crítico de Higiene ($\ge 40$ turnos):** Se a sessão atingir 40 ou mais turnos, emite alerta formal com recomendação de auto-forking (descarregar estado com `/commit` ou `/plan` e iniciar nova sessão limpa via `opencode`).
- **Exemplos de Uso:**
```bash
# Gerar snapshot de checkpoint e verificar higiene da sessão
python3 ~/.config/opencode/scripts/checkpoint.py
```

- **Contrato JSON de Snapshot (`.aiflow/checkpoint-latest.json`):**
```json
{
  "timestamp": "2026-09-29T06:06:00.000Z",
  "session_id": "sess_01J9...",
  "session_title": "Refatoração Modular Scripts",
  "turn_count": 24,
  "branch": "main",
  "tasks": {
    "pending": [
      "Atualizar documentação de ferramentas"
    ],
    "completed": [
      "Modularizar aqei em pacote aqei/",
      "Modularizar quota em quota_core/"
    ]
  },
  "git_diff_summary": "scripts/status.py | 12 +-\n 1 file changed"
}
```

---

## 9. `perf-bench.py`

- **Propósito:** Utilitário unificado de benchmarking estatístico e testes de estresse. Elimina palpites integrando `hyperfine` (para tempo de execução de CLI, builds e compiladores) e `autocannon` (para taxa de transferência e latência de cauda de servidores HTTP).
- **Dependências de Runtime:** Python 3, `hyperfine` (no PATH) e `npx` (para invocar `autocannon` sob demanda sem instalação global).
- **Tabela de Subcomandos e Parâmetros:**

| Subcomando | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `cli` | `--cmd "<cmd>"` (repetível)<br>`--warmup <N>` (padrão: 2)<br>`--runs <N>` (padrão: 5) | Executa medições estatísticas com warm-up e exporta tabela de médias e desvio padrão. |
| `http` | `<url>`<br>`-c <conns>` (padrão: 10)<br>`-d <secs>` (padrão: 5)<br>`-p <pipelining>` (padrão: 1) | Dispara requisições concorrentes e relata throughput (req/s) e percentis (p50, p90, p95, p99). |

- **Exemplos de Uso:**
```bash
# Comparar tempo de build entre dois scripts
python3 ~/.config/opencode/scripts/perf-bench.py cli \
  --cmd "python3 script_v1.py" \
  --cmd "python3 script_v2.py" \
  --warmup 3 --runs 10

# Testar latência de API local com 20 conexões simultâneas por 10 segundos
python3 ~/.config/opencode/scripts/perf-bench.py http http://localhost:3000/api/health -c 20 -d 10
```

- **Exemplo de Saída HTTP (Percentis):**
```markdown
| Percentil | Latência (ms) |
| :--- | :--- |
| p50 | 2.15 ms |
| p90 | 4.80 ms |
| p95 | 6.10 ms |
| p99 | 11.20 ms |
```

---

## 10. `sec-scan.py`

- **Propósito:** Scanner integrado de segurança de aplicações (*Application Security - AppSec*). Unifica auditoria de credenciais vazadas (`gitleaks`), análise estática de vulnerabilidades no código (`semgrep`) e detecção de CVEs em dependências de software (`osv-scanner`).
- **Dependências de Runtime:** Python 3, com binários locais detectados dinamicamente: `gitleaks`, `semgrep`, `osv-scanner`.
- **Tabela de Subcomandos:**

| Subcomando | Alvo | Ferramenta Subjacente | O que Audita |
| :--- | :--- | :--- | :--- |
| `secrets` | `[target_path]` | `gitleaks detect` | Chaves privadas, tokens JWT, senhas hardcoded e API keys. |
| `sast` | `[target_path]` | `semgrep --config p/owasp-top-10` | Vulnerabilidades de injeção (SQL, XSS, SSRF), caminhos inseguros e permissões. |
| `deps` | `[target_path]` | `osv-scanner` | CVEs registradas na base do Google OSV contra locks (`package-lock.json`, etc.). |
| `all` | `[target_path]` | Todas acima | Varredura completa integrada com relatório consolidado. |

- **Exemplos de Uso:**
```bash
# Verificar segredos no repositório inteiro
python3 ~/.config/opencode/scripts/sec-scan.py secrets .

# Auditoria completa de segurança antes de um deploy
python3 ~/.config/opencode/scripts/sec-scan.py all .
```

---

## 11. `live-browser.js`

- **Propósito:** CLI de altíssima velocidade para interação direta via *Chrome DevTools Protocol (CDP)* com a instância isolada do navegador Helium Dev (`helium-dev`). Permite inspecionar abas, capturar telas e executar scripts em milissegundos sem o overhead de inicialização de suítes de teste.
- **Dependências de Runtime:** Node.js (Stdlib: `http`, `child_process`). Conecta via HTTP/WebSocket em `http://localhost:9222`. Caso o processo não esteja rodando, auto-inicializa o `helium-dev` em background de forma transparente.
- **Tabela de Subcomandos:**

| Subcomando | Argumentos | Operação |
| :--- | :--- | :--- |
| `status` | N/A | Verifica se o navegador está ativo e escutando na porta 9222. |
| `inspect` | N/A | Retorna URL, título e status HTTP da aba atualmente aberta. |
| `navigate` | `<url>` | Navega a aba ativa imediatamente para o endereço especificado. |
| `screenshot`| `[output.png]` | Captura print da viewport via protocolo CDP `Page.captureScreenshot`. |
| `eval` | `"<js_code>"` | Executa código JavaScript na aba ativa e devolve o valor avaliado. |

- **Exemplos de Uso:**
```bash
# Verificar status da conexão CDP
node ~/.config/opencode/scripts/live-browser.js status

# Navegar para página de desenvolvimento local
node ~/.config/opencode/scripts/live-browser.js navigate http://localhost:3000

# Capturar screenshot imediato do estado da UI
node ~/.config/opencode/scripts/live-browser.js screenshot /tmp/preview.png

# Extrair o título da página via script JS injetado
node ~/.config/opencode/scripts/live-browser.js eval "document.title"
```

- **Contrato de Comunicação:**
  - Protocolo nativo Chrome DevTools Protocol via JSON-RPC sobre HTTP/WebSocket.
  - Latência típica de comando: $\le 15$ milissegundos.

---

## 12. `semantic-code-search.py`

- **Propósito:** Mecanismo de busca semântica vetorial e indexação de código-fonte acelerado na GPU local através do modelo de embeddings `nomic-embed-text` servido pelo Ollama local (`http://127.0.0.1:11434/api/embeddings`). Permite localizar blocos de código por significado ou intenção conceitual em vez de correspondência léxica exata ou regex.
- **Comando Associado:** `/semsearch <query>`.
- **Dependências de Runtime:** Python 3 (Stdlib: `argparse`, `dataclasses`, `json`, `math`, `os`, `sys`, `typing`, `urllib.request`) e serviço do Ollama em execução local com o modelo `nomic-embed-text` carregado na GPU.
- **Mecanismo Operacional:**
  - **Indexação (`index`):** Varre recursivamente a árvore de arquivos de código (`.py`, `.ts`, `.js`, `.go`), ignorando diretórios de build e artefatos (`node_modules`, `.git`, `.venv`, `venv`, `dist`, `build`, `__pycache__`, `.aiflow`). Segmenta os arquivos em blocos lógicos (`CodeChunk` de até 30 linhas com cortes contextuais em declarações de classes e funções), gera embeddings densos via Ollama e grava o índice serializado em `.aiflow/code-embeddings.json` (com fallback para `.code-embeddings.json`).
  - **Busca Vetorial (`search`):** Gera o vetor denso da consulta, calcula a similaridade por cosseno (`cosine_similarity`) contra todos os blocos do índice pré-computado e exibe no terminal os top-$K$ resultados ranqueados com arquivo, linha inicial/final, score de similaridade e preview do trecho de código.
- **Tabela de Subcomandos e Parâmetros:**

| Subcomando | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `index` | `[dir]` (padrão: `.`) | Mapeia arquivos de código, extrai blocos sintáticos, calcula embeddings e salva o índice em disco. |
| `search` | `<query>`<br>`--top-k <N>` (padrão: 5) | Gera o vetor da query, ranqueia os blocos por similaridade de cosseno e exibe os top-$K$ resultados. |

- **Exemplos de Uso:**
```bash
# Indexar a base de código do diretório atual na GPU local
python3 ~/.config/opencode/scripts/semantic-code-search.py index .

# Buscar rotinas de autenticação JWT e validação de tokens
python3 ~/.config/opencode/scripts/semantic-code-search.py search "JWT authentication and token validation" --top-k 3

# Buscar manipuladores de reconexão de socket com backoff exponencial
python3 ~/.config/opencode/scripts/semantic-code-search.py search "socket reconnect exponential backoff" --top-k 5
```

- **Exemplo de Retorno no Terminal:**
```
[SEARCH] Query: "JWT authentication" (Top-3)

#1 [0.8842] | src/auth/service.py:34-58
def authenticate_user(token: str) -> UserClaims:
    decoded = jwt.decode(token, SECRET, algorithms=["HS256"])
    ...
```

---


## 13. `opencode-maintenance.sh` e `opencode-maintenance.timer`

- **Propósito:** manutenção do OpenCode sem intervenção: poda de sessões, `wal_checkpoint(TRUNCATE)` + `VACUUM` do SQLite e limpeza de dirs ad hoc em `/tmp` (`td`, `ana*.py` com mais de 2 dias).
- **Segurança:** só age com o OpenCode ocioso (nenhuma mensagem nos últimos 20 min e nenhuma sessão ativa na API); trava `flock`; intervalo mínimo de 20 h entre execuções.
- **Poda:** sessões filhas com mais de 21 dias e sessões raiz com mais de 60 dias (sem filhas recentes), via `opencode api delete`.
- **VACUUM:** para o serviço (`opencode service stop`), compacta o banco e reinicia.
- **Log:** `~/.local/state/opencode-maintenance.log` (últimas 500 linhas).

| Flag | Efeito |
| :--- | :--- |
| `--dry-run` | Só reporta o que faria; não toca no serviço nem apaga nada. |
| `--force` | Ignora a trava de 20 h (a checagem de ociosidade continua). |

- **Timer systemd (usuário):** `opencode-maintenance.timer` dispara às 04:30 (`Persistent=true`), 10 min após o boot e a cada 2 h depois da última execução; se o OpenCode estiver ativo, o script se adia para o próximo disparo. A unit fica no repo `dotfiles` (`systemd/.config/systemd/user/`).

```bash
bash ~/.config/opencode/scripts/opencode-maintenance.sh --dry-run
systemctl --user list-timers opencode-maintenance.timer
```

---

## 🔌 Servidores MCP

Só o `context7` (remoto, `https://mcp.context7.com/mcp`) está configurado. Os demais MCPs foram removidos do `opencode.json`; para uma integração pontual, adicione o bloco em `mcp.servers` do `opencode.json` do projeto, com `disabled: false`. Substitutos nativos: LSP do OpenCode (`lsp`) para diagnósticos, `grep` para referências, `git`/`docker` via shell.
