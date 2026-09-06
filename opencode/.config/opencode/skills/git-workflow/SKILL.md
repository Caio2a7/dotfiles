---
name: git-workflow
description: Git conventions, branch naming strategies, commit patterns, and MR workflows
---

## Convenções de Git & Versionamento
- **Mensagens de Commit**: Escrever em português, imperativo, no padrão Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **Branches**:
  - `chore/nome-da-tarefa` para TRIVIAL
  - `fix/nome-da-tarefa` para SIMPLES (correções)
  - `feat/nome-da-tarefa` para COMPLEXA (funcionalidades)
- **Garanta Branch Limpa**: A pasta `.aiflow/` deve estar listada no `.git/info/exclude`.
