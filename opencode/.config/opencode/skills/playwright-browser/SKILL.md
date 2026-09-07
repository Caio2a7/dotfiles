---
name: playwright-browser
description: Web interaction, UI verification, and browser automation using Playwright CLI. Use when running E2E tests, capturing screenshots, generating test code, or verifying web pages.
---

# Playwright CLI & Web Verification Guidelines

Esta skill orienta o uso do **Playwright CLI** para testes E2E, validação visual e automação eficiente de navegadores sem sobrecarga de MCP.

## Vantagens do Modo CLI
- **Zero Poluição de Contexto:** Não injeta 15 schemas de ferramentas no prompt da IA.
- **Eficiência Máxima:** Execução atômica sob demanda via `bash`.
- **Determinismo:** Suporte total a reporters nativos (`list`, `line`, `html`), traces e screenshots.

## Principais Comandos do Playwright CLI

### 1. Captura de Screenshots (Verificação Visual)
```bash
# Captura de tela inteira em modo headless
npx playwright screenshot --full-page <URL> screenshot.png

# Captura aguardando renderização de SPA
npx playwright screenshot --wait-for-timeout=2000 <URL> screenshot.png
```

### 2. Execução de Testes E2E
```bash
# Executa todos os testes E2E no Chromium headless
npx playwright test --project=chromium --reporter=list

# Executa um arquivo ou cenário específico
npx playwright test tests/login.spec.ts --project=chromium

# Modo com rastreamento detalhado em caso de falha
npx playwright test --trace on-first-retry
```

### 3. Geração de Código de Teste (Codegen)
```bash
# Inicia navegador e gera script de teste a partir de ações do usuário
npx playwright codegen <URL>
```

### 4. Scripts Rápidos sob Demanda
Para extrair texto ou interagir com um elemento sem uma suíte completa de testes:
```bash
node -e '
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");
  const title = await page.title();
  console.log("Title:", title);
  await browser.close();
})();
'
```

## Boas Práticas:
- Use sempre seletores resilientes recomendados pelo Playwright: `page.getByRole()`, `page.getByLabel()`, `page.getByTestId()`.
- Em CI/CD, garanta `--reporter=list` ou `--reporter=github` para logs limpos.
