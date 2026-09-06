---
name: refactoring-catalog
description: Martin Fowler refactoring catalog transformations and code smell remediation. Use when refactoring legacy code, simplifying complex conditionals, decomposing long functions, or improving code readability ('refatorar', 'refactoring', 'code smell', 'extrair função', 'guard clauses').
---

# Martin Fowler's Refactoring Catalog & Code Smell Remediation

Guia prático para transformações atômicas de código preservando 100% da invariância comportamental.

---

## 1. Regra de Ouro da Refatoração
Refatorar **nunca** adiciona funcionalidade nova nem altera o comportamento observável:
1. Garanta que testes automatizados existem e estão passando (*green*).
2. Execute transformações pequenas em micropassos atômicos.
3. Re-execute a suíte de testes após cada transformação.

---

## 2. Principais Transformações & Remediações de Code Smells

### A. Guard Clauses (Substituir Condicionais Aninhadas)
- **Code Smell:** Escada de `if/else` aninhados (*Arrow Anti-Pattern* / complexidade ciclomática alta).
- **Transformação:** Trate os casos de erro ou saída rápida no topo da função e retorne imediatamente:
  ```typescript
  // ❌ Ruim (Aninhado):
  function getPayout(user: User) {
    if (user.isActive) {
      if (!user.isBlocked) {
        if (user.balance > 0) {
          return user.balance * 0.9;
        }
      }
    }
    return 0;
  }

  // ✅ Bom (Guard Clauses lineares):
  function getPayout(user: User): number {
    if (!user.isActive || user.isBlocked || user.balance <= 0) {
      return 0;
    }
    return user.balance * 0.9;
  }
  ```

### B. Extract Function (Extrair Função)
- **Code Smell:** Função com mais de 40 linhas realizando múltiplas tarefas (orquestração + cálculo + formatação).
- **Transformação:** Mova o bloco lógico coeso para uma função pura isolada com nome declarativo que explica *o que* faz, não *como*.

### C. Introduce Parameter Object
- **Code Smell:** Função recebendo 5 ou mais parâmetros soltos (`x, y, width, height, color, opacity`).
- **Transformação:** Agrupe os parâmetros relacionados em uma estrutura coesa (`RectangleOptions` ou `Record`).

### D. Replace Conditional with Polymorphism / Strategy
- **Code Smell:** `switch(type)` ou cadeias de `if(type === ...)` repetidas em vários lugares do sistema.
- **Transformação:** Crie uma interface comum e implemente cada variação em sua própria classe/estratégia (padrão Strategy).

### E. Separate Query from Modifier (CQS - Command Query Separation)
- **Regra:** Uma função deve executar uma ação (modificar estado) OU responder uma pergunta (retornar dados), nunca ambos silenciosamente.
