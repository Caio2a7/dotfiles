#!/usr/bin/env node
/**
 * live-browser.js - Operates user's live browser (Helium / Chromium) via CDP.
 */

const { chromium } = require("/home/caio/.config/opencode/node_modules/playwright");
const http = require("http");

const CDP_URL = process.env.CDP_URL || "http://localhost:9222";

async function isCdpAvailable() {
  return new Promise((resolve) => {
    const req = http.get(`${CDP_URL}/json/version`, { timeout: 1500 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function getActivePage(browser) {
  const contexts = browser.contexts();
  if (contexts.length === 0) throw new Error("Nenhum contexto de navegador encontrado.");
  const pages = contexts[0].pages();
  if (pages.length === 0) throw new Error("Nenhuma aba aberta encontrada no navegador.");
  // Return the last active page or first
  return pages[pages.length - 1];
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";

  const available = await isCdpAvailable();

  if (command === "status") {
    if (available) {
      console.log(JSON.stringify({ status: "connected", cdp_url: CDP_URL, message: "Helium Browser conectado via porta 9222." }, null, 2));
    } else {
      console.log(JSON.stringify({
        status: "disconnected",
        cdp_url: CDP_URL,
        message: "Porta de depuração 9222 não está respondendo. Certifique-se de que o Helium Browser foi iniciado com a flag --remote-debugging-port=9222 (configurada em ~/.config/helium-browser-flags.conf)."
      }, null, 2));
    }
    return;
  }

  if (!available) {
    console.error(JSON.stringify({
      error: "Helium Browser não está acessível na porta 9222.",
      instruction: "Reinicie o Helium Browser para que ele aplique a flag --remote-debugging-port=9222 configurada em ~/.config/helium-browser-flags.conf."
    }));
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (e) {
    console.error(JSON.stringify({ error: `Falha ao conectar via CDP: ${e.message}` }));
    process.exit(1);
  }

  try {
    const page = await getActivePage(browser);

    switch (command) {
      case "inspect": {
        const title = await page.title();
        const url = page.url();

        // Extract interactive elements from DOM
        const elements = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll("input, button, a, select, textarea, [role='button']").forEach((el, i) => {
            if (i > 60) return; // Limit to 60 elements
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // Ignore invisible

            const text = (el.innerText || el.textContent || el.value || "").trim().slice(0, 50);
            const placeholder = el.getAttribute("placeholder") || "";
            const id = el.id ? `#${el.id}` : "";
            const name = el.name ? `[name="${el.name}"]` : "";
            const role = el.getAttribute("role") || el.tagName.toLowerCase();
            const type = el.getAttribute("type") || "";

            items.push({
              tag: el.tagName.toLowerCase(),
              type: type || undefined,
              text: text || placeholder || undefined,
              selector: id || name || (text ? `text="${text}"` : undefined)
            });
          });
          return items.filter(it => it.selector);
        });

        console.log(JSON.stringify({
          title,
          url,
          interactive_elements_count: elements.length,
          sample_elements: elements.slice(0, 25)
        }, null, 2));
        break;
      }

      case "screenshot": {
        const outIdx = args.indexOf("--out");
        const outPath = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : "helium-live-screenshot.png";
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(JSON.stringify({ success: true, file: outPath, title: await page.title(), url: page.url() }));
        break;
      }

      case "click": {
        const selIdx = args.indexOf("--selector");
        const selector = selIdx !== -1 ? args[selIdx + 1] : null;
        if (!selector) throw new Error("Falta parâmetro --selector");
        await page.click(selector, { timeout: 5000 });
        console.log(JSON.stringify({ success: true, action: "click", selector, currentUrl: page.url() }));
        break;
      }

      case "fill": {
        const selIdx = args.indexOf("--selector");
        const valIdx = args.indexOf("--value");
        const selector = selIdx !== -1 ? args[selIdx + 1] : null;
        const value = valIdx !== -1 ? args[valIdx + 1] : "";
        if (!selector) throw new Error("Falta parâmetro --selector");
        await page.fill(selector, value, { timeout: 5000 });
        console.log(JSON.stringify({ success: true, action: "fill", selector, valueLength: value.length }));
        break;
      }

      case "eval": {
        const codeIdx = args.indexOf("--code");
        const code = codeIdx !== -1 ? args[codeIdx + 1] : null;
        if (!code) throw new Error("Falta parâmetro --code");
        const result = await page.evaluate((c) => eval(c), code);
        console.log(JSON.stringify({ success: true, result }));
        break;
      }

      case "navigate": {
        const urlIdx = args.indexOf("--url");
        const targetUrl = urlIdx !== -1 ? args[urlIdx + 1] : null;
        if (!targetUrl) throw new Error("Falta parâmetro --url");
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        console.log(JSON.stringify({ success: true, action: "navigate", url: page.url(), title: await page.title() }));
        break;
      }

      default:
        console.log(JSON.stringify({ error: `Comando desconhecido: ${command}` }));
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
