---
name: git-workflow
description: Fluxo diário do Git: nomenclatura de branches, Conventional Commits em português e isolamento .aiflow.
---

# Fluxo Diário do Git & Versionamento

Diretrizes para o fluxo de trabalho cotidiano no Git, padronização de commits, nomenclatura de branches e isolamento de artefatos de IA.

---

## 1. Nomenclatura de Branches
As branches devem seguir a categorização baseada na complexidade da tarefa:
- `chore/nome-da-tarefa` — Tarefas TRIVIAIS (ajustes rápidos, dependências, limpeza).
- `fix/nome-da-tarefa` — Correções SIMPLES de bugs ou comportamentos inesperados.
- `feat/nome-da-tarefa` — Novas funcionalidades COMPLEXAS ou refatorações estruturais.

> **Regra:** Nomes de branches em kebab-case, descritivos e concisos (ex: `feat/autenticacao-jwt`, `fix/login-csrf`).

---

## 2. Conventional Commits em Português
Todos os commits devem ser atômicos, no modo imperativo e redigidos em português:
- `feat: adiciona autenticação por JWT`
- `fix: corrige validação de payload no login`
- `refactor: extrai lógica de formatação de moedas`
- `docs: atualiza guia de instalação no README`
- `test: adiciona testes unitários para cálculo de desconto`
- `chore: atualiza dependências do projeto`

> **Proibição:** Mensagens vagas ("ajustes", "fix", "wip") ou em inglês quando o padrão do projeto é português.

---

## 3. Isolamento da Pasta `.aiflow`
Para evitar poluição do repositório remoto com contextos transitórios de IA:
- A pasta `.aiflow/` **DEVE** estar isolada no `.git/info/exclude` local:
  ```bash
  grep -qxF '.aiflow/' .git/info/exclude || echo '.aiflow/' >> .git/info/exclude
  ```
- **Nunca** inclua arquivos de `.aiflow/` no `git add` ou em commits do repositório upstream, a menos que explicitamente exigido pela governança do time.
