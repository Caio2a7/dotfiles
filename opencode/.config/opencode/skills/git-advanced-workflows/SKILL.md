---
name: git-advanced-workflows
description: Advanced Git workflows, rebase conflict resolution, bisect bug hunting, stash management, and reflog rescue. Use when dealing with tricky merge conflicts, rebasing, recovering lost commits, or hunting regressions ('conflito git', 'rebase', 'git bisect', 'reflog', 'recuperar commit').
---

# Advanced Git Workflows & Emergency Operations

Guia técnico para resolução de conflitos, rastreamento de regressões com bisect e resgate de histórico.

---

## 1. Resolução Segura de Conflitos de Rebase
Quando ocorrer conflito durante `git rebase main`:
1. Inspecione o estado:
   ```bash
   git status
   ```
2. Identifique os marcadores no arquivo:
   - `<<<<<<< HEAD` (a branch base / upstream).
   - `=======` (divisor).
   - `>>>>>>> <seu-commit>` (suas alterações).
3. Edite o arquivo, preservando a lógica correta e eliminando os marcadores.
4. Adicione o arquivo resolvido:
   ```bash
   git add caminho/do/arquivo.ts
   ```
5. Prossiga sem gerar commit de merge:
   ```bash
   git rebase --continue
   ```
   *(Para abortar a qualquer momento e voltar intacto: `git rebase --abort`).*

---

## 2. Caça a Regressões com Git Bisect (Busca Binária no Histórico)
Para encontrar automaticamente qual commit exato introduziu um bug em 10 passos em vez de 1.000:
```bash
# Iniciar o bisect
git bisect start

# Marcar o commit atual como quebrado
git bisect bad

# Marcar o último commit sabidamente funcional
git bisect good v1.2.0

# O Git faz o checkout do commit intermediário. Execute o teste:
npm test
# Se passar:
git bisect good
# Se quebrar:
git bisect bad

# O Git apontará o commit causador com precisão matemática.
# Para finalizar:
git bisect reset
```

---

## 3. Resgate de Emergência com Git Reflog
Quando um commit parecer ter sido "perdido" após um reset acidental (`git reset --hard`):
1. O Git nunca apaga commits imediatamente; o ponteiro fica no `reflog`:
   ```bash
   git reflog
   ```
2. Localize o commit antes do desastre (ex: `HEAD@{2}`).
3. Crie uma branch de recuperação ou restaure o ponteiro:
   ```bash
   git branch rescue-branch HEAD@{2}
   ```
