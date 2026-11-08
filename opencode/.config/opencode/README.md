# Configuração do OpenCode (v2.2.6)

Config versionada em `~/dotfiles/opencode/.config/opencode` e ligada a `~/.config/opencode` via GNU Stow. Modelos via Claude (assinatura), pelo CLI `claude`.

## Estrutura

| Caminho | Conteúdo |
| :--- | :--- |
| `opencode.json` | Modelo, agentes, comandos, MCP, permissões, compaction, formatter, LSP, policies. |
| `cli.json` | TUI: tema, keybinds e plugins de TUI. |
| `AGENTS.md` | Regras globais carregadas em toda sessão (custo fixo; mantenha enxuto). |
| `agents/` | 12 agentes em Markdown. Ver [registro](docs/AGENTS_REGISTRY.md). |
| `skills/` | 23 skills locais. |
| `plugins/` | Plugins locais: `claude-context-cap`, `agent-model-sync`, `session-hygiene`, `cli-notify` (TUI). |
| `scripts/` | Utilitários. Ver [catálogo](docs/TOOLING_CATALOG.md). |
| `docs/` | Documentação. Ver [índice](docs/README.md). |

## Agentes

12 em Markdown: `orchestrator` (padrão), `agentic`, `worker`, `backend`, `devops`, `architect`, `docs-writer`, `tester`, `reviewer`, `debugger`, `blue-team`, `browser`. Embutidos: `explore` e `general` (Sonnet 5.5), `build` e `plan` (Opus 1M, usados por `/init /spec /plan /map /analyze`) e `title` (`local-gpu/qwen2.5-coder:7b`, sem gastar cota). Papel e modelo de cada um em [docs/AGENTS_REGISTRY.md](docs/AGENTS_REGISTRY.md).

- `orchestrator`: lidera, delega e verifica; não edita arquivos.
- `agentic`: executor direto para ajustes pontuais. Também acessível por `/agentic`.

## Plugins

| Plugin | Função |
| :--- | :--- |
| `@openchamber/opencode-claude` | Bridge para o CLI `claude` (provider `claude-code`), pela assinatura. |
| `claude-context-cap` | Limita o contexto dos modelos 1M a 200k (`maxContext: 200000`). |
| `agent-model-sync` | Aplica à sessão o modelo do agente primário. |
| `session-hygiene` | Regras de shell: bloqueia escrita de arquivo via shell (`sed -i`, redirecionamento, heredoc, `tee`); `/tmp`, `/dev/null` e `*.log` liberados. Leitura via shell é livre. |
| `opencode-antigravity-auth` | Reserva para quando a cota do Claude acabar. |

## MCP

Só o `context7` (remoto). Obrigatório consultá-lo antes de integrar biblioteca externa.

## Compaction

| Item | Valor |
| :--- | :--- |
| Modo | `auto` |
| Gatilho | ~185k (cap de 200k menos buffer de 15k) |
| `keep` | 30000 tokens |
| Resumo | Haiku 4.5 (decisão do bridge) |

O autocompact interno do CLI só dispararia em ~967k, então não há compaction dupla.

## Comandos

23 comandos inline no `opencode.json`.

| Grupo | Comandos |
| :--- | :--- |
| Fluxo `.aiflow` | `/init /spec /plan /task /tasks /validate /review /commit /mr /debug /adr /map /analyze` |
| Utilitários | `/quota /aqei /status /learn /sandbox /checkpoint /semsearch` |
| Atalhos para agente | `/agentic /audit /playwright` |

Pipeline: `/spec` → `/plan` → `/task` ou `/tasks` (TDD com `.aiflow/task-test.sh`) → `/validate` → `/review` → `/commit` ou `/mr`. Artefatos em `.aiflow/` (excluído do git). Se uma tarefa falha, `/debug` lê `.aiflow/task-test.log`.

## Skills

23 locais em `skills/`: `api-design`, `appsec-blue-team`, `backend-engineering`, `code-review-checklist`, `conventional-commits`, `design-taste-frontend`, `docker-devops`, `git-advanced-workflows`, `git-workflow`, `high-end-visual-design`, `live-browser`, `minimalist-ui`, `playwright-browser`, `playwright-dashboard`, `ponytail-yagni`, `pr-template`, `project-init`, `security-audit`, `security-checklist`, `spec-workflow`, `stack-typescript`, `tdd-workflow`, `technical-documentation`.

As 13 skills do Claude desktop vindas de `~/.claude/skills/synced` (`docs`, `docx`, `pdf`, `pptx`, `xlsx`, `google-workspace`, `morning`, `built-in-browser`, `chrome-browser`, `computer-use`, `import-memory`, `deep-research`, `skill-creator`) recebem `deny` no OpenCode.

## Scripts

Catálogo completo em [docs/TOOLING_CATALOG.md](docs/TOOLING_CATALOG.md): `aqei-scorer.py`, `quota.py`, `status.py`, `learn.py`, `worktree-runner.sh`, `ast-linter-hook.py`, `checkpoint.py`, `perf-bench.py`, `sec-scan.py`, `live-browser.js`, `semantic-code-search.py`, `opencode-maintenance.sh`.

Manutenção automática: o timer systemd `opencode-maintenance.timer` roda `opencode-maintenance.sh` às 04:30, com retentativa a cada 2 h se houver atividade (poda de sessões, VACUUM do banco, limpeza de `/tmp`).

## Qualidade

Gate AQEI ≥ 80% (meta ≥ 99%) via `scripts/aqei-scorer.py`; especificação em [docs/METRICS_AQEI.md](docs/METRICS_AQEI.md). Limites de código: arquivos ≤ 300 linhas, funções ≤ 40.

## Uso

```bash
cd ~/dotfiles && stow opencode      # liga a config em ~/.config/opencode
opencode debug config               # valida o opencode.json
opencode service restart            # aplica mudanças de plugin
```

O V2.2.6 não tem perfis de configuração; a variação de comportamento vem do agente primário e do modelo escolhidos.
