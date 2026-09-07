---
name: project-init
description: Guide for creating and refining project-specific AGENTS.md, docs/ structure, and repository rules
---

## Estrutura do AGENTS.md por Projeto

Todo repositório deve ter seu próprio `AGENTS.md` no raiz contendo:

```markdown
# Regras do Projeto: [Nome do Projeto]

## Tech Stack & Ferramentas
- Linguagem/Framework: (ex: TypeScript 5.x, Next.js 14, React 18)
- Testes: (ex: Vitest / Jest / Pytest) -> Comando: `npm test`
- Linter/Formatter: (ex: Biome / ESLint / Prettier) -> Comando: `npm run lint`
- Type-check: `npm run type-check`

## Convenções de Código Locais
- Padrões de importação (ex: alias `@/components/...`)
- O que NÃO utilizar (ex: não usar `any`, não usar `moment.js`, não usar `axios`)
- Estrutura de pastas e nomeação de arquivos

## Comandos Rápidos de Validação
- Teste único: `npx vitest path/to/file.test.ts`
- Build de verificação: `npm run build`
```

## Como Refinar
Edite o `AGENTS.md` do projeto sempre que identificar um erro recorrente do agente naquele repositório.
