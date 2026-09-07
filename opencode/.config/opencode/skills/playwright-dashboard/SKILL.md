---
name: playwright-dashboard
description: Launch Playwright UI Mode, HTML test reports, and Trace Viewer dashboards. Use when running UI tests, viewing test results, debugging traces, or when tests fail ('playwright dashboard', 'abra os testes no dashboard', 'show trace', 'show report').
---

# Playwright Dashboard & Visual Test Debugging

Esta skill orienta a abertura e execução dos dashboards visuais do Playwright, tanto sob demanda quanto **automaticamente** durante o ciclo de testes.

## 🤖 Gatilhos Automáticos (Durante Testes e TDD):
1. **Gravação de Trace Obrigatória:**
   - Todo teste executado pelo agente inclui `--trace on-first-retry` para garantir a geração da autópsia visual.
2. **Abertura Automática Pós-Falha:**
   - Se a suíte de testes E2E falhar, o agente dispara automaticamente em segundo plano (`&`) o **Trace Viewer** da execução:
     ```bash
     TRACE_FILE=$(find test-results -name "trace.zip" 2>/dev/null | head -n1)
     [ -n "$TRACE_FILE" ] && npx playwright show-trace "$TRACE_FILE" &
     ```
   - O desenvolvedor recebe a janela do Trace Viewer aberta na tela com linha do tempo de rede, snapshots do DOM antes/depois de cada clique e logs de console sem precisar digitar nada.

---

## 🖥️ Abertura Sob Demanda:

### 1. Playwright UI Mode (Dashboard Local Interativo)
Executa com Time-Travel Debugging, Watch Mode e visualização ao vivo:
```bash
npx playwright test --ui &
```

### 2. HTML Test Report (Relatório de Execução)
```bash
npx playwright show-report &
```

### 3. Trace Viewer Manual
```bash
npx playwright show-trace test-results/.../trace.zip &
```

### 4. Execução de Testes E2E no Terminal
```bash
npx playwright test --project=chromium --trace on-first-retry --reporter=list
```
