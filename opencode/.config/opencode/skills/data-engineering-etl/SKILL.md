---
name: data-engineering-etl
description: Data engineering, ETL/ELT pipelines, parquet optimization, and data modeling using DuckDB and Polars. Use when transforming datasets, converting CSV/JSON to Parquet, building batch pipelines, or modeling analytical schemas ('pipeline de dados', 'converta para parquet', 'etl', 'transformação de dados').
---

# Data Engineering & Analytical Pipelines (DuckDB & Polars)

Diretrizes para arquitetura de pipelines de dados, conversão de formatos de alta performance e modelagem analítica.

## 1. Conversão de Formatos & Compressão Colunar
Converter CSV/JSON para **Parquet** colunar com compressão ZSTD reduz o uso de disco em até 85% e acelera queries em mais de 10x:
```bash
# Conversão instantânea de CSV para Parquet via DuckDB
data-query "COPY (SELECT * FROM 'dados.csv') TO 'dados.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)"

# Conversão particionada por data/categoria (otimização de partição)
data-query "COPY (SELECT * FROM 'dados.csv') TO 'dados_particionados' (FORMAT PARQUET, PARTITION_BY (ano, mes))"
```

## 2. Padrões de Modelagem Dimensional
- **Star Schema:** Separe métricas quantitativas em tabelas de fatos (`fact_orders`, `fact_events`) e atributos descritivos em dimensões (`dim_users`, `dim_products`).
- **Idempotência Obrigatória:** Pipelines devem permitir re-execução sem duplicar registros (use chaves naturais ou `ON CONFLICT DO UPDATE` / substituição de partições).
- **Tipagem Estrita:**
  - Evite tipos genéricos de texto (`VARCHAR`) para datas ou números.
  - Armazene timestamps sempre em UTC com precisão de microssegundos.

## 3. Validação de Contratos de Dados
Antes de finalizar um pipeline, valide:
1. **Unicidade de Chaves:** Nenhuma duplicação em IDs primários.
2. **Integridade de Chaves Estrangeiras:** Nenhum registro órfão nas tabelas de fatos.
3. **Limites de Nulos:** Colunas críticas (ex: valores de transação, timestamps) com 0% de nulos.
