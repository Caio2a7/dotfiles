---
name: visual-qa-critic
description: Protocolo rigoroso de inspeção visual, crítica honesta de screenshots em zoom Retina (DPR 2) e iteração estética antes de entregar mudanças de UI. Use sempre ao criar ou refinar acabamento visual, CSS de materiais, layout ou componentes.
---

# Visual QA Critic — Inspeção Retina & Crítica Honesta

## 1. Captura Obrigatória em 2 Escalas
Nunca julgue acabamento fino, vidro, bordas ou micro-tipografia a partir de um único print 1x distante. Sempre capture duas vistas reais usando o harness permanente do projeto:
1. **Close-up Retina (`DSF=2` ou zoom 2x):** isolado no componente alterado (`--selector`). Em 1x DPI, subpixels, especulares e halos ficam borrados e mascaram defeitos ópticos.
2. **Contexto real (tela inteira):** valida proporção, ritmo espacial, contraste global, alinhamento e harmonia com os elementos vizinhos.

## 2. Crítica Visual Brutalmente Honesta (Anti-Autoengano)
Ao abrir cada PNG com `read`, é **PROIBIDO** carimbar "conferido visualmente" ou descrever a intenção do CSS em vez do que está renderizado nos pixels. Avalie objetivamente os **5 eixos** (nota mental de 1 a 10):

1. **Verdade do material:** se o alvo é Liquid Glass, parece vidro líquido Apple real ou virou plástico cinza leitoso, chapa metálica ou caixa wireframe?
2. **Limpeza de bordas e luz:** há linhas brancas duras/estouradas, degraus de gradiente (banding), serrilhado nos cantos, recortes secos ou sombras sujas?
3. **Interação com o fundo:** a transparência conversa visivelmente com luz/cor atrás dela, ou está morta/invisível sobre preto chapado?
4. **Geometria & Escala:** os raios são concêntricos (`R_outer = R_inner + padding`)? O peso visual e o tamanho respeitam a tipografia e a densidade da linha?
5. **Estados interativos:** vazio, preenchido, ativo, hover/focus e extras preservam a mesma linguagem óptica sem quebrar hierarquia ou contraste?

## 3. Portão de Auto-Rejeição
- Se **qualquer eixo ficar abaixo de 8/10** ou houver defeito perceptível nos pixels: **NÃO entregue**.
- Diagnostique a causa óptica real (ex.: "fundo `#121212` sem substrato luminoso matou a refração", "borda `0.35` criou wireframe duro", "fill `0.16` deixou leitoso").
- Ajuste o CSS/DOM e re-renderize em `DSF=2` + contexto real.
- Repita por **até 3 iterações internas** até passar nos 5 eixos (ou até estourar o time box — nesse caso, entregue o parcial relatando exatamente qual eixo ficou abaixo da meta e por quê).

## 4. Alinhamento Após Rejeição do Usuário
Quando o usuário rejeitar uma entrega visual enviando um screenshot/print:
- Inspecione a imagem do usuário com atenção máxima antes de tocar no código.
- Descreva explicitamente o **desvio óptico observado nos pixels** (ex.: "o container parece caixa preta com contorno branco duro e cantos rígidos, sem transparência nem brilho especular curvo").
- Só edite após nomear o defeito concreto e mapear a correção física/óptica correspondente.

## 5. Evidência no Retorno
Inclua no retorno ao orquestrador:
- Caminhos dos dois screenshots (close-up `DSF=2` e contexto).
- Avaliação curta dos 5 eixos (ou os defeitos corrigidos entre iterações).
