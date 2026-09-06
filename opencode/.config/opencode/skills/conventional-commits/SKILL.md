---
name: conventional-commits
description: Guide for writing clear conventional commit messages in Portuguese following standard specifications
---

## Formato Padrão
`<tipo>(<escopo>): <descrição curta em português>`

## Tipos Permitidos
- `feat`: Nova funcionalidade para o usuário.
- `fix`: Correção de bug.
- `docs`: Alterações exclusivamente em documentação.
- `style`: Formatação, pontos e vírgulas ausentes, sem alteração de código.
- `refactor`: Refatoração de código sem adicionar feature ou corrigir bug.
- `perf`: Mudança de código focada em melhoria de performance.
- `test`: Adição ou correção de testes existentes.
- `chore`: Atualização de tarefas de build, pacotes ou configurações.

## Regras Obrigatórias
1. Escrever a descrição em **português**, no modo imperativo e em letra minúscula (ex: `adiciona autenticação`, `corrige cálculo de frete`).
2. Não adicionar ponto final na primeira linha.
3. Manter a primeira linha com no máximo 72 caracteres.
4. Caso haja breaking changes, incluir `BREAKING CHANGE:` no rodapé ou `!` após o tipo (ex: `feat!: altera contrato da API`).

## Exemplos
- `feat(auth): adiciona login social com Google`
- `fix(checkout): trata valor nulo no cálculo de imposto`
- `refactor(db): extrai pool de conexões para singleton`
