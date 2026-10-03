---
name: spec-workflow
description: Professional spec-driven development workflow guide (Spec -> Plan -> Build -> Test -> Commit)
---

## Fluxo Profissional (Waterflow em 15 Minutos)

### Passo 1: Especificação (`docs/spec.md`)
Antes de escrever qualquer código, estruture os requisitos e decisões em `docs/spec.md`:
- Objetivos principais e escopo
- Requisitos funcionais e não-funcionais
- Escolhas de arquitetura e modelos de dados
- Casos de borda (edge cases) e plano de mitigação
- Estratégia de testes

### Passo 2: Planejamento (`docs/plan.md`)
Alimente a spec em um modelo de raciocínio alto e quebre a implementação em tarefas atômicas:
- Cada tarefa deve ser independente e testável.
- Mantenha sessões focadas em uma única tarefa por vez.
- **Verificação de Pré-Condições Executáveis (SWE-planner Gate - Valmeekam et al. / SWE-planner 2024):** Antes de planejar qualquer mutação (ex: "Modificar função X no arquivo Y"), o agente é estritamente proibido de planejar no vácuo. Ele DEVE verificar ativamente a existência física do arquivo e do símbolo alvo (`ast-grep_search`, `grep` ou `read`). Se a pré-condição falhar, o plano deve refletir a criação ou ajuste imediato, eliminando planos quebrados por suposição.

### Passo 3: Construção & Teste em Loop
- Implemente uma tarefa por vez.
- Execute os testes após cada mudança significativa.
- Nunca ignore falhas nos testes antes de prosseguir.

### Passo 4: Save Points (Commits)
- Faça commit após cada pequena tarefa concluída e testada.
- Garanta que a working tree esteja limpa ao finalizar a funcionalidade.
