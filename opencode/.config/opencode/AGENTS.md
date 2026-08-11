# Coding Agent Rules

## Response Style
- Be terse. No filler phrases ("Great!", "Sure!", "I'll help you with that").
- No unsolicited explanations. Code speaks. Explain only when asked.
- Prefer one response over a back-and-forth. If ambiguous, state assumption and proceed.
- Toda mensagem de commit deve ser em português e resumida

## Code Quality
- Write complete, working code. No placeholders, no `# TODO`, no `...add logic here`.
- No mocks or stubs unless explicitly asked for tests.
- Handle errors explicitly. No silent fails.
- Smallest diff possible. Don't touch what isn't broken.

## Token Efficiency
- Read only files you need. Don't explore speculatively.
- Don't repeat code back to me before editing it.
- Don't summarize what you just did after doing it.
- Prefer editing existing files over creating new ones.

## Workflow Obrigatório (Spec-Driven Development + TDD em .aiflow/)
1. `/init`: Garante `.aiflow` no `.git/info/exclude`, gera/refina `AGENTS.md` e estrutura base.
2. `/spec`: Detecta branch, verifica `.aiflow/spec.md` (refina se mesma tarefa, arquiva em `.aiflow/archive/spec-[DATA].md` se diferente) e lê `docs/decisions/*.md`.
3. `/plan`: Verifica `.aiflow/plan.md` (bloqueia se houver `[ ]` pendente; arquiva em `.aiflow/archive/plan-[DATA].md` se 100% `[x]`). Grava `# Classificação`, `# Branch` e `# Base`.
4. `/task` / `/tasks`: Executa a próxima tarefa `[ ]` (ou tarefa ad-hoc `/task <texto>`). Valida via `.aiflow/task-test.sh` + `.aiflow/task-test.log` em TDD. Apaga arquivos ao passar; retém em caso de falha.
5. `/validate`: Portão de qualidade. Se reprovar por teste, cria `.aiflow/debug-context.md` e recomenda `/debug`.
6. `/review`: Valida diff contra critérios de aceitação do `.aiflow/spec.md` e conformidade com ADRs em `docs/decisions/`.
7. `/commit`: Executa `git status` e `git diff --staged`, valida testes (garante que `task-test.sh` não existe), commita e faz push na branch do cabeçalho.
8. `/mr`: Cria branch de MR (`chore/`, `fix/`, `feat/`), commita, envia push remoto `-u` e exibe o template formatado no chat.

## Contexto Dinâmico (.aiflow/context.md)
- Se `.aiflow/context.md` existir no projeto, leia-o obrigatoriamente antes de qualquer ação.
- Ao concluir `/task`, `/tasks` ou `/debug` com sucesso, registre padrões descobertos, anti-padrões evitados e comportamentos não-óbvios de libs no `.aiflow/context.md`.

## Documentação de Bibliotecas & Ferramentas MCP
- **Context7 MCP**: Antes de implementar chamadas a bibliotecas externas, consulte a API atual via Context7 MCP. Nunca assuma contratos de versão.
- **Memory MCP**: Use para persistir decisões de arquitetura e padrões recorrentes entre sessões.
- **Sequential Thinking MCP**: Em tarefas de classificação COMPLEXA, utilize raciocínio encadeado antes de alterar qualquer arquivo.
- **AST-Grep MCP**: Prefira AST-grep para localização sintática de componentes e estruturas de código.

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
- Limites de Refatoração: funções > 40 linhas (dividir em menores) e arquivos > 300 linhas (propor decomposição em módulos).
- Em caso de incerteza ou travamento no diagnóstico de bugs, invoque o agente `@debugger` ou `@reviewer`.

