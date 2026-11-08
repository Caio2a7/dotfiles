# Registro de Agentes

Fonte da verdade: o frontmatter de [`agents/*.md`](../agents/) e a seção `agents` do `opencode.json`. Os modelos usam o provider `claude-code` (bridge `@openchamber/opencode-claude`, assinatura Claude).

## Agentes em Markdown (12)

| Agente | Modo | Modelo | Papel |
| :--- | :--- | :--- | :--- |
| `orchestrator` | primário (padrão) | Opus 5.5 1M, `variant: high` | Engenheiro líder: detém o contexto, decide, especifica, delega fatias independentes e verifica. `edit: deny`. |
| `agentic` | primário | Sonnet 5.5, `variant: low` | Executor direto: edições pontuais, configs, scripts e correções de passo único. |
| `worker` | subagente | Sonnet 5.5 | Implementação de contexto médio/longo; dono de telas e componentes (React/Tailwind). |
| `backend` | subagente | Sonnet 5.5 | Lógica de domínio, serviços, APIs, POO/GoF, Clean Architecture. |
| `devops` | subagente | Sonnet 5.5 | Dockerfiles, compose, CI/CD, systemd, scripts de infra. |
| `architect` | subagente | Opus 5.5 1M | Contratos, schemas, interfaces, diagramas e ADRs. |
| `docs-writer` | subagente | Sonnet 5.5 | Documentação técnica viva (README, API, runbooks, Mermaid), com guia de estilo adaptável. |
| `tester` | subagente | Sonnet 5.5 | Testes unitários, de integração e de regressão; roda o harness do projeto. |
| `reviewer` | subagente | Sonnet 5.5 | Revisão de diffs: segurança, correção, desempenho e YAGNI. Não edita. |
| `debugger` | subagente | Opus 5.5 1M | Causa raiz por hipóteses e rastreio de execução. Devolve diagnóstico e proposta. |
| `blue-team` | subagente | Sonnet 5.5 | AppSec defensivo: SAST, remediação, hardening, CVEs de dependências. |
| `browser` | subagente | Sonnet 5.5 | Automação de navegador e QA visual com Playwright CLI. |

`default_agent` é o `orchestrator`. O papel do orchestrator está em [`agents/orchestrator.md`](../agents/orchestrator.md): ele dimensiona o esforço, despacha até 4 subagentes em paralelo (posse exclusiva de arquivos), mantém o `sessionID` de cada frente e confere o diff e os testes antes de responder.

## Agentes embutidos configurados no `opencode.json`

| Agente | Modelo | Uso |
| :--- | :--- | :--- |
| `explore` | Sonnet 5.5 | Mapeamento e busca em repositório; devolve resumo. |
| `general` | Sonnet 5.5 | Pesquisa e tarefas de texto/config sem especialista melhor. |
| `build` | Opus 5.5 1M | Usado pelos comandos `/init`, `/spec`, `/plan` e `/map`. |
| `plan` | Opus 5.5 1M | Somente leitura; usado pelo comando `/analyze`. |
| `title` | `local-gpu/qwen2.5-coder:7b` (Ollama) | Gera títulos de sessão sem gastar cota. |

## Agentes removidos

Seis agentes de domínio saíram (dados, banco, performance, red team, refatoração e mapeamento por grafo), junto com os quatro comandos que apontavam para eles e com as skills e o script de análise de dados.

## Seleção do modelo

O plugin `agent-model-sync` aplica o modelo do agente primário à sessão ao iniciar ou ao trocar de agente (o runner do V2.2.6 ignora o `model` de agentes primários). Uma troca manual de modelo é preservada até a próxima troca de agente. Subagentes usam o `model` do próprio frontmatter.

## Comandos que roteiam para agentes

| Comando | Agente |
| :--- | :--- |
| `/init`, `/spec`, `/plan`, `/map` | `build` |
| `/analyze` | `plan` |
| `/validate` | `tester` |
| `/review` | `reviewer` |
| `/adr` | `architect` |
| `/audit` | `blue-team` |
| `/playwright` | `browser` |
| `/agentic` | `agentic` |

A lista completa dos 23 comandos está no [README](../README.md#comandos).
