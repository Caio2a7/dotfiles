---
name: ponytail-yagni
description: Minimalist engineering and anti-overengineering guidelines (YAGNI). Use when designing features, writing code, refactoring, or choosing libraries to ensure minimal code and zero bloat.
---

# Ponytail — O Princípio YAGNI e Engenharia Minimalista

A filosofia do **"Lazy Senior Developer"**: o melhor código é aquele que você não precisou escrever. Evita complexidade acidental, abstrações prematuras e dependências infladas.

## A Escada de Decisão de 7 Degraus (Suba antes de codificar):

1. **Degrau 1 — Recurso Nativo de Plataforma:**
   - Pode ser resolvido por recursos nativos do HTML, CSS, browser ou sistema operacional?
   - *Exemplo:* Use `<dialog>` nativo ou `<input type="date">` em vez de componentes JS pesados.
2. **Degrau 2 — Standard Library:**
   - A biblioteca padrão da linguagem já resolve isso?
   - *Exemplo:* Use `crypto.randomUUID()`, `fetch()`, `URLSearchParams`, `collections`, `itertools` em vez de bibliotecas externas (`uuid`, `axios`, `lodash`).
3. **Degrau 3 — Reuso de Dependência Já Instalada:**
   - Verifique `package.json`, `Cargo.toml` ou `requirements.txt`. Já temos uma lib instalada no projeto que atende? Não adicione uma segunda lib similar.
4. **Degrau 4 — Função Pura e Direta:**
   - Se precisa escrever código, escreva a função pura mais simples e legível possível (5 a 20 linhas).
   - Evite criar factories, decorators, wrappers ou hierarquias de classes para operações simples.
5. **Degrau 5 — Menor Diff Possível (Minimal Diff):**
   - Não toque em arquivos ou linhas que não estejam quebrados.
   - Não reordene imports ou mude formatação de código adjacente que não faz parte da tarefa.
6. **Degrau 6 — Rejeitar Abstrações Prematuras:**
   - *Regra:* Implemente apenas o que foi solicitado para hoje.
   - Proibido criar hooks genéricos, interfaces para cenários hipotéticos ou configurações para "suporte futuro".
7. **Degrau 7 — Barreira Estrita para Novas Dependências:**
   - Só adicione uma nova dependência externa se a implementação própria envolver alto risco de segurança (ex: hashing de senhas, algoritmos de criptografia) ou complexidade massiva (ex: parser de AST).

## O Que NÃO é Negociável:
Minimalismo NÃO significa relaxar com:
- **Segurança:** Sanitização e validação de inputs continuam obrigatórias.
- **Tipagem Estrita:** Sem atalhos com `any`.
- **Tratamento de Erros:** Erros continuam sendo tratados explicitamente.
