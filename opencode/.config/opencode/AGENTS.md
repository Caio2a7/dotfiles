# Coding Agent Rules

## Execução Local & Resposta
- Máquina real via OpenCode: execute tudo de fato com as ferramentas locais (`shell`, `read`, `edit`); nunca assuma sandbox remoto.
- Resposta tersa, sem preenchimento nem explicações não solicitadas; não repita código antes de editar nem resuma o óbvio.
- Proibido usar emojis em qualquer texto gerado (respostas, commits, PRs, issues, docs, relatórios, código), mesmo que venham de um template ou skill.

## Lei do Pronto & Rigor Analítico
- **Pronto = executado e provado:** proibido declarar concluído sem anexar o output real do comando de validação (testes, linter, `tsc --noEmit` ou parser para JSON/YAML/TOML/config). Em regressão multi-módulo, use unit tests globais + E2E só da área alterada; quando rodar vários E2Es independentes, execute em paralelo num único `shell` sem repetir comandos/renders já aprovados. Sem prova, declare "não verificado".
- **Sem duplicação nem lixo:** remova referências antigas, chaves duplicadas e restos órfãos ao editar configs ou código.
- **Investigação real:** proibido chutar por suposição rasa; rastreie código-fonte, dependências e chamadores reais (`arquivo:linha`) antes de concluir ou editar.

## Código, Contexto & Ferramentas
- Código completo: mire em `≤ 300` linhas/arquivo e `≤ 40` linhas/função no design inicial; sem stubs, `TODO`, `pass` livre ou `catch` vazio; erros explícitos. Nunca reescreva um arquivo já pronto e testado só por passar pouco de 300 linhas.
- Consulte Context7 (`resolve-library-id` + `query-docs`) antes de integrar libs externas.
- Leia arquivos `< 250` linhas de uma vez (não fatie em vários `read`s); use `grep` + `offset`/`limit` só em arquivos grandes. `.aist/context.md` tem teto de 80 linhas (`/learn`); antes de pausa >1h use `/handoff` e retome com `/resume`. Grave preferências duráveis do usuário no `AGENTS.md` do projeto.

## Frontend (Anti-AI-Slop)
- Precedência: (1) preferências no `AGENTS.md` do projeto; (2) padrões das telas existentes; (3) anti-AI-slop em projeto novo (pergunte direção via `question`, paleta contida com 1 cor de destaque).
- Ferramentas/dashboards: densidade, alinhamento e simetria; sem degradê roxo genérico, sombras duras, cards simétricos clichês ou números soltos.
- Acabamento visual/materiais ópticos: carregue `ui-material-craft` + `visual-qa-critic`, valide em `DSF=2`.

## Segurança, Git & LSP
- Nunca exponha chaves/tokens; valide e sanitize entradas externas; evite `eval()`.
- Commits pequenos e atômicos em PT-BR (Conventional Commits); nunca `git push --force` em `main`/`master`.
- Verifique diagnósticos do LSP após editar; não conclua tarefa com erros pendentes.
