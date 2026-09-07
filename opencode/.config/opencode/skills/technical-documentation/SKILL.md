---
name: technical-documentation
description: Adaptive technical documentation, API specifications, runbooks, and Mermaid diagrams. Use when creating or updating READMEs, architectural docs, API references, or adapting docs to user style preferences ('documentação', 'readme', 'api docs', 'runbook', 'documentar', 'estilo de docs').
---

# Living Technical Documentation & Adaptive Style Guide

Esta skill gerencia a produção de documentação técnica viva que se adapta dinamicamente às preferências de formato e densidade do desenvolvedor.

---

## 1. Ciclo de Adaptação de Estilo (Living Style Guide)

O arquivo `.aiflow/docs-style.md` (ou `~/.config/opencode/docs-style.md`) define as regras ativas de redação do projeto:

```markdown
# Documentation Style Preferences
- Tone: Concise, engineer-to-engineer, zero marketing filler
- Formatting: Vertical bullet points, high density, tabular data where applicable
- Emojis: Prohibited (or allowed based on user instruction)
- Code snippets: Minimal, working, copy-paste ready
- Diagrams: Mermaid sequence/flowchart diagrams for complex workflows
```

### Como Atualizar o Estilo sob Demanda:
Se o usuário der instruções de calibração (ex: *"quero sem emojis"*, *"mais enxuta"*, *"formatação vertical"*):
1. Atualize imediatamente as regras em `.aiflow/docs-style.md`.
2. Aplique as novas diretrizes ao documento gerado.
3. Todas as gerações futuras consultarão esse arquivo automaticamente.

---

## 2. Padrões de Estrutura por Tipo de Documento:

### A. Documentação de API (REST / tRPC)
- **Endpoint:** `POST /api/v1/orders`
- **Autenticação:** `Bearer <token>`
- **Request Body (JSON):** Schema e exemplo mínimo válido.
- **Respostas de Sucesso (2xx):** Código HTTP e payload retornado.
- **Erros Mapeados (4xx / 5xx):** Tabela com código de erro, causa e formato RFC 7807.
- **Exemplo com cURL:** Comando pronto para teste de terminal.

### B. Runbooks & Guias Operacionais
- **Objetivo:** O que este procedimento realiza.
- **Pré-requisitos:** Permissões, credenciais e ferramentas necessárias.
- **Passo a Passo Sequencial:** Comandos numerados exatos.
- **Critérios de Validação:** Como confirmar que a operação teve sucesso.
- **Procedimento de Rollback:** Comandos para reverter em caso de falha.
