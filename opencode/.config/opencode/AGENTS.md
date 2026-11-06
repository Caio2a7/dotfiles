# Coding Agent Rules

## Response Style
- Seja terso. Sem frases de preenchimento nem explicações não solicitadas; o código fala.
- Ambiguidade: declare a premissa e prossiga, em uma só resposta.
- Não repita código antes de editar, não resuma o que acabou de fazer.
- Não rode `git status` nem inspeções repetidas após editar; se a ferramenta teve sucesso, entregue.

## Code Quality & YAGNI
- Código completo: sem stubs, `TODO`, `pass` livre, placeholders; mocks só em testes.
- Arquivos ≤ 300 linhas, funções ≤ 40 linhas; exceda → decomponha.
- Menor diff possível; prefira stdlib e dependências existentes a wrappers ou libs novas.
- Trate erros explicitamente; falhas silenciosas e `catch` vazio são proibidos.
- Gate de qualidade: AQEI ≥ 80% via `scripts/aqei-scorer.py` (meta ≥ 99%).
- Context7 (`resolve-library-id` + `query-docs`) é obrigatório antes de integrar bibliotecas externas; nunca presuma assinaturas de memória.

## Token Efficiency
- Leia só o necessário; não explore especulativamente; prefira editar a criar arquivos.
- Se `.aiflow/context.md` existir, leia antes de agir; ao concluir `/task`, `/tasks` ou `/debug`, registre padrões, anti-padrões e comportamentos não-óbvios de libs.
- Sessão com 40 turnos ou assunto novo: recomende nova sessão consumindo `.aiflow/context.md` (use `/plan` ou `/commit` para descarregar o estado).

## Frontend (Anti-AI-Slop)
- Projeto com design system: inspecione `tailwind.config.*`/`globals.css` e siga a identidade existente.
- Projeto/feature nova sem especificação visual: pergunte (ferramenta `question`) com 2–3 opções (ex.: Linear-Dark, Editorial Clean, Brutalista Técnico) antes de implementar.
- Proibido: degradê roxo genérico, 3 cards simétricos com ícones redondos, Inter/Roboto sem escala tipográfica, sombras pretas duras.
- Obrigatório: double-bezel em containers, macro-espaçamento (`py-20+`), paleta contida com 1 cor de destaque, botões "ilha".

## Segurança
- Nunca exponha chaves, segredos ou tokens; valide e sanitize entradas externas; evite `eval()` e execução de strings.

## Git
- Commits pequenos e atômicos, em português, Conventional Commits (`feat:`, `fix:`, ...). Nunca `git push --force` em `main`/`master`.

## LSP
- Verifique diagnósticos do LSP após editar cada arquivo; não marque tarefa `[x]` com erros pendentes (em COMPLEXA, warnings contam como erros).

## Ferramentas e Fluxo
- Scripts utilitários (`sec-scan`, `data-query`, `perf-bench`, `live-browser`, `aqei-scorer`, `quota`): ver `docs/TOOLING_CATALOG.md`.
- Comandos `/spec /plan /task /validate /debug /review /commit /mr` têm prompts próprios; não replique o fluxo aqui. Artefatos em `.aiflow/` (excluído do git).
- Mais de 20 etapas lógicas: pare e registre o plano em `docs/plan.md` antes de prosseguir.
