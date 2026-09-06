---
name: stack-typescript
description: Project TypeScript conventions, import patterns, strict typing guidelines, and forbidden patterns
---

## Regras Obrigatórias de TypeScript
- Strict mode sempre ativado.
- Tipagem explícita no retorno de funções públicas e exportadas.
- Organização de imports: pacotes externos (`node_modules`) → aliases internos (`@/...`) → caminhos relativos (`./...`).
- Prefira `type` a `interface` exceto para declarações extensíveis de POO/contratos públicos.

## Padrões Proibidos
- NUNCA use `any` sem um comentário justificando o motivo técnico.
- NUNCA use `console.log` em produção. Utilize o Logger oficial da aplicação.
- NUNCA use bibliotecas depreciadas (ex: `moment.js` -> use `date-fns` ou `dayjs`).
