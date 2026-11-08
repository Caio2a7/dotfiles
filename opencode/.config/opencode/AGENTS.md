# Coding Agent Rules

## Response Style
- Seja terso. Sem frases de preenchimento nem explicações não solicitadas; o código fala.
- Ambiguidade: declare a premissa e prossiga, em uma só resposta.
- Não repita código antes de editar, não resuma o que acabou de fazer.
- Pronto = verificado: confira o resultado real com o harness ou os testes do projeto (dados reais, zero erro de console, screenshot conferido em UI) antes de declarar pronto.
- Diga explicitamente o que não pôde ser verificado; não repita inspeções redundantes (ex.: `git status` após edit bem-sucedido).

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
- Feedback do usuário que vale além da tarefa (preferência de design/fluxo, correção recorrente): grave no mesmo turno, conciso e sem duplicar, na seção de preferências do AGENTS.md do projeto. Antes de mexer em UI, leia essa seção.

## Frontend (Anti-AI-Slop)
- Precedência: (1) preferências do usuário no AGENTS.md do projeto; (2) design system e padrões das telas existentes (tokens, CSS, componentes; inspecione `tailwind.config.*`/`globals.css`); (3) regras genéricas, só para projeto novo sem identidade visual.
- Feature nova em projeto existente segue as telas existentes, sem perguntar estilo. Só projeto novo sem identidade: pergunte (ferramenta `question`) com 2–3 direções (ex.: Linear-Dark, Editorial Clean, Brutalista Técnico) antes de implementar.
- Ferramentas e dashboards: densidade de informação, alinhamento e simetria. Macro-espaçamento, hero e cards grandes só em landing/marketing.
- Proibido: degradê roxo genérico, 3 cards simétricos com ícones redondos, Inter/Roboto sem escala tipográfica, sombras pretas duras, elemento grande cercado de vazio, números soltos em cards grandes.
- Projeto novo: paleta contida com 1 cor de destaque.

## Segurança
- Nunca exponha chaves, segredos ou tokens; valide e sanitize entradas externas; evite `eval()` e execução de strings.

## Git
- Commits pequenos e atômicos, em português, Conventional Commits (`feat:`, `fix:`, ...). Nunca `git push --force` em `main`/`master`.

## LSP
- Verifique diagnósticos do LSP após editar cada arquivo; não marque tarefa `[x]` com erros pendentes (em COMPLEXA, warnings contam como erros).

## Ferramentas e Fluxo
- Scripts utilitários (`sec-scan`, `perf-bench`, `live-browser`, `aqei-scorer`, `quota`): ver `docs/TOOLING_CATALOG.md`.
- Comandos `/spec /plan /task /validate /debug /review /commit /mr` têm prompts próprios; não replique o fluxo aqui. Artefatos em `.aiflow/` (excluído do git).
- Mais de 20 etapas lógicas: pare e registre o plano em `docs/plan.md` antes de prosseguir.
