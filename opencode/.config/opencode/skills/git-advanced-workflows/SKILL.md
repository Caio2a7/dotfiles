---
name: git-advanced-workflows
description: Operações avançadas e resgate do Git: resolução de conflitos em rebase, bisect para caça a bugs, reflog para recuperação de commits e gerenciamento de stash.
---

# Advanced Git Workflows & Emergency Operations

Guia técnico para resolução de conflitos em rebase, busca binária de bugs com bisect, recuperação de commits perdidos com reflog e gerenciamento do stash.

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
Para encontrar automaticamente qual commit exato introduziu um bug:
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
# Para finalizar e retornar à branch de origem:
git bisect reset
```

---

## 3. Resgate de Emergência com Git Reflog
Quando um commit parecer ter sido "perdido" após um reset acidental (`git reset --hard`) ou rebase mal-sucedido:
1. O Git registra todas as movimentações do ponteiro `HEAD` no `reflog`:
   ```bash
   git reflog
   ```
2. Localize o hash ou identificador do commit anterior à operação (ex: `HEAD@{2}`).
3. Crie uma branch de recuperação a partir desse ponto:
   ```bash
   git branch rescue-branch HEAD@{2}
   ```
4. Ou restaure o ponteiro atual com segurança:
   ```bash
   git reset --hard HEAD@{2}
   ```

---

## 4. Gerenciamento Avançado de Stash
Para isolar alterações temporárias sem poluir o histórico de commits:
- **Guardar alterações (incluindo untracked):**
  ```bash
  git stash push -u -m "wip: feature em andamento"
  ```
- **Listar e inspecionar conteúdo do stash:**
  ```bash
  git stash list
  git stash show -p stash@{0}
  ```
- **Aplicar e remover o stash mais recente:**
  ```bash
  git stash pop
  ```
- **Criar uma branch diretamente de um stash:**
  ```bash
  git stash branch feature-recuperada stash@{0}
  ```
- **Limpar stashes obsoletos:**
  ```bash
  git stash drop stash@{0}
  # ou limpar todo o stash:
  git stash clear
  ```
