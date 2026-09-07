---
name: data-analysis-eda
description: Exploratory Data Analysis (EDA), statistical inference, and insight generation using DuckDB, Polars, and Python. Use when analyzing datasets, CSV, Parquet, JSON logs, computing statistics, or testing hypotheses ('analise os dados', 'data analysis', 'quais os insights', 'faça uma análise exploratória').
---

# Exploratory Data Analysis (EDA) & Statistical Inference

Esta skill orienta o fluxo científico de análise de dados e extração de insights acionáveis sem alucinação matemática.

## Ferramentas & Execução Rápida:
Utilize o utilitário nativo `data-query` (DuckDB embutido) ou scripts Python via `uv run`:

```bash
# 1. Inspecionar tipos de colunas e primeiras linhas
data-query schema arquivo.csv

# 2. Sumário estatístico completo (contagem, nulos, média, desvio, quartis)
data-query summary arquivo.csv

# 3. Consulta analítica SQL direta (agregação, ranking, percentis)
data-query "SELECT categoria, COUNT(*) as qtd, AVG(valor) as media FROM 'dados.parquet' GROUP BY categoria ORDER BY media DESC"
```

## Protocolo de Análise Científica em 4 Etapas:
1. **Inspeção de Sanidade:**
   - Verifique a taxa de valores nulos (`null_percentage`).
   - Identifique colunas constantes (variância zero) ou IDs com cardinalidade 1:1.
   - Detecte outliers usando IQR (*Interquartile Range*: valores abaixo de `Q1 - 1.5*IQR` ou acima de `Q3 + 1.5*IQR`).
2. **Distribuição & Assimetria:**
   - Avalie se a distribuição é normal (gaussiana) ou assimétrica (cauda longa). Se for assimétrica, prefira a mediana (`q50`) à média (`avg`).
3. **Cruzamento & Segmentação:**
   - Calcule correlações (Pearson para lineares, Spearman para ordinais).
   - Segmente por dimensões-chave (tempo, região, coorte, categoria).
4. **Comunicação de Insights:**
   - **Regra:** Todo insight deve conter o número empírico exato.
   - Apresente tabelas comparativas limpas.
   - Conclua com recomendações práticas baseadas no resultado.
