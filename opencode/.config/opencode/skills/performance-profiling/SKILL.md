---
name: performance-profiling
description: Systems performance engineering, latency profiling, and empirical benchmarking using Hyperfine and Autocannon. Use when diagnosing bottlenecks, analyzing p95/p99 latency, profiling CPU/memory, running load tests, or optimizing hot paths ('performance', 'benchmark', 'teste de carga', 'latência', 'gargalo', 'otimização').
---

# Performance Engineering & Empirical Profiling Playbook

Este guia consolida as ferramentas e metodologias para medição estatística de latência, vazão (*throughput*) e eliminação empírica de gargalos.

---

## 1. Ferramentas Integradas & Comandos Rápidos

### A. Benchmark Estatístico de CLI / Scripts (Hyperfine)
Compara a velocidade de execução com rodadas de aquecimento (*warmup*) e desvio padrão:
```bash
# Comparação estatística entre duas abordagens
perf-bench cli --cmd "python3 solucao_A.py" --cmd "python3 solucao_B.py"

# Benchmark com 3 warmups e 10 execuções
perf-bench cli --warmup 3 --runs 10 --cmd "npm run build"
```

### B. Teste de Carga & Percentis de Latência HTTP (Autocannon)
Mede a distribuição real de latência (`p50`, `p90`, `p95`, `p99`) e requisições/segundo:
```bash
# Teste de 5 segundos com 20 conexões simultâneas
perf-bench http "http://localhost:3000/api/users" -c 20 -d 5

# Teste com pipelining para máxima saturação de throughput
perf-bench http "http://localhost:8080/health" -c 50 -d 10 -p 2
```

---

## 2. A Ilusão da Média e o Problema da Cauda Longa (p99)
- **Nunca use a média aritmética** para tomar decisões de arquitetura em produção. Em sistemas concorrentes, a média esconde outliers severos causados por pausas de Garbage Collection, bloqueios de I/O ou contenção de conexões.
- **O Foco é no `p95` e `p99`:** O p99 representa o pior caso de 1 a cada 100 requisições (normalmente os clientes mais ativos ou operações com payloads maiores).

---

## 3. Checklist de Diagnóstico de Gargalos:
1. **Banco de Dados (Primeiro Suspeito):**
   - Execute `EXPLAIN (ANALYZE, BUFFERS)` na query suspeita.
   - Verifique se há `Seq Scan` em tabelas com mais de 10.000 linhas.
   - Verifique se o pool de conexões (HikariCP / pgBouncer) está saturado.
2. **CPU & Hot Paths:**
   - Procure por loops aninhados O(n²), serializações JSON redundantes em objetos gigantes e expressões regulares com backtracking catastrófico (ReDoS).
3. **Memória & Alocação:**
   - Evite instanciar objetos temporários desnecessários dentro de loops de alta frequência.
   - Use estruturas com tipo primitivo e pools de buffers onde aplicável.
