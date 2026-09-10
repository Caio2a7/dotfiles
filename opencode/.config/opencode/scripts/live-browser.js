#!/usr/bin/env node
/**
 * live-browser.js - High-speed CLI for interacting with isolated Helium Dev browser via CDP.
 * Zero-dependency WebSocket / HTTP CDP protocol.
 */

const http = require("http");
const { spawn } = require("child_process");
const CDP_URL = process.env.CDP_URL || "http://localhost:9222";

function httpReq(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CDP_URL);
    const req = http.request(url, { method, timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout na requisição CDP"));
    });
    req.end();
  });
}

async function isCdpAvailable() {
  try {
    const res = await httpReq("GET", "/json/version");
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureCdpReady() {
  if (await isCdpAvailable()) return true;

  // Auto-launch isolated helium-dev in background
  const p = spawn("helium-dev", [], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  p.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if (await isCdpAvailable()) return true;
  }
  return false;
}

async function getActiveTab() {
  const res = await httpReq("GET", "/json/list");
  const pages = (res.body || []).filter((it) => it.type === "page");
  if (pages.length === 0) throw new Error("Nenhuma aba ativa encontrada no Helium Dev.");
  return pages[0];
}

function sendWsCommand(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout executando comando CDP ${method}`));
    }, 8000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timer);
      try {
        const data = JSON.parse(event.data);
        if (data.id === 1) {
          ws.close();
          if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
          else resolve(data.result);
        }
      } catch (e) {
        ws.close();
        reject(e);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      ws.close();
      reject(err);
    };
  });
}

async function evalInTab(wsUrl, expression) {
  const res = await sendWsCommand(wsUrl, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res?.result?.value;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";

  if (command === "status") {
    const available = await isCdpAvailable();
    if (available) {
      const active = await getActiveTab().catch(() => null);
      console.log(JSON.stringify({
        status: "connected",
        cdp_url: CDP_URL,
        message: "Helium Dev isolado conectado na porta 9222.",
        active_tab: active ? { title: active.title, url: active.url } : null,
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        status: "disconnected",
        cdp_url: CDP_URL,
        message: "Helium Dev não está aberto na porta 9222. Execute 'helium-dev &' ou 'live-browser launch'.",
      }, null, 2));
    }
    return;
  }

  if (command === "launch") {
    const ready = await ensureCdpReady();
    console.log(JSON.stringify({
      success: ready,
      message: ready ? "Helium Dev isolado iniciado com sucesso na porta 9222." : "Falha ao iniciar Helium Dev.",
    }, null, 2));
    return;
  }

  // Auto-connect or auto-launch for operational commands
  const ready = await ensureCdpReady();
  if (!ready) {
    console.error(JSON.stringify({ error: "Não foi possível conectar ao Helium Dev na porta 9222." }));
    process.exit(1);
  }

  const activeTab = await getActiveTab().catch(async () => {
    // If no tab open, create a blank tab
    await httpReq("PUT", "/json/new?about:blank");
    return await getActiveTab();
  });

  switch (command) {
    case "list": {
      const res = await httpReq("GET", "/json/list");
      const pages = (res.body || []).filter((it) => it.type === "page").map((it, idx) => ({
        index: idx,
        id: it.id,
        title: it.title,
        url: it.url,
      }));
      console.log(JSON.stringify({ total: pages.length, pages }, null, 2));
      return;
    }

    case "search": {
      const query = args.slice(1).join(" ");
      if (!query) throw new Error("Informe o termo de pesquisa.");
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const res = await httpReq("PUT", `/json/new?${encodeURIComponent(searchUrl)}`);
      if (res.status === 200 && res.body?.id) {
        await httpReq("POST", `/json/activate/${res.body.id}`).catch(() => {});
        console.log(JSON.stringify({
          success: true,
          action: "opened_tab_and_searched",
          query,
          url: searchUrl,
          id: res.body.id,
        }, null, 2));
        return;
      }
      break;
    }

    case "goto":
    case "open": {
      let targetUrl = args[1];
      if (!targetUrl) throw new Error("Informe a URL de destino.");
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }
      await evalInTab(activeTab.webSocketDebuggerUrl, `window.location.href = ${JSON.stringify(targetUrl)}`);
      console.log(JSON.stringify({ success: true, action: "navigated", url: targetUrl }, null, 2));
      return;
    }

    case "click": {
      const target = args.slice(1).join(" ");
      if (!target) throw new Error("Informe o seletor ou texto a ser clicado.");

      const clickCode = `
        (() => {
          const query = ${JSON.stringify(target)}.toLowerCase().trim();
          
          try {
            const el = document.querySelector(${JSON.stringify(target)});
            if (el) {
              const clickable = el.closest("a") || el;
              clickable.scrollIntoView({ behavior: "instant", block: "center" });
              clickable.click();
              return { success: true, method: "selector", tag: clickable.tagName, text: (el.alt || el.innerText || el.src || "").slice(0, 50) };
            }
          } catch (e) {}

          const candidates = Array.from(document.querySelectorAll("a, button, [role='button'], h3, [role='link']"));
          const matched = candidates.find(c => {
            const text = (c.innerText || c.textContent || "").toLowerCase();
            const href = (c.getAttribute("href") || "").toLowerCase();
            return text.includes(query) || href.includes(query);
          });

          if (matched) {
            const clickable = matched.closest("a") || matched;
            clickable.scrollIntoView({ behavior: "instant", block: "center" });
            clickable.click();
            return {
              success: true,
              method: "text_match",
              tag: clickable.tagName,
              text: (clickable.innerText || "").slice(0, 80),
              href: clickable.getAttribute("href")
            };
          }

          return { success: false, error: "Nenhum elemento clicável encontrado com: " + query };
        })()
      `;

      const result = await evalInTab(activeTab.webSocketDebuggerUrl, clickCode);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "find": {
      const textToFind = args.slice(1).join(" ");
      if (!textToFind) throw new Error("Informe a palavra/texto a pesquisar.");

      const findCode = `
        (() => {
          const query = ${JSON.stringify(textToFind)}.toLowerCase();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.toLowerCase().includes(query)) {
              const parent = node.parentElement;
              parent.scrollIntoView({ behavior: "smooth", block: "center" });
              parent.style.backgroundColor = "#ffeb3b";
              parent.style.outline = "3px solid #f44336";
              parent.style.color = "#000";
              parent.style.borderRadius = "4px";
              return {
                found: true,
                query: ${JSON.stringify(textToFind)},
                matched_snippet: parent.innerText.slice(0, 250),
                tag: parent.tagName
              };
            }
          }
          return { found: false, query: ${JSON.stringify(textToFind)} };
        })()
      `;

      const result = await evalInTab(activeTab.webSocketDebuggerUrl, findCode);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "inspect": {
      const inspectCode = `
        (() => ({
          title: document.title,
          url: window.location.href,
          h1: Array.from(document.querySelectorAll("h1")).map(h => h.innerText.trim()).filter(Boolean),
          inputs: Array.from(document.querySelectorAll("input")).map(i => ({ name: i.name, id: i.id, placeholder: i.placeholder, type: i.type })),
          links_sample: Array.from(document.querySelectorAll("a")).slice(0, 15).map(a => ({ text: a.innerText.trim().slice(0, 40), href: a.href }))
        }))()
      `;
      const result = await evalInTab(activeTab.webSocketDebuggerUrl, inspectCode);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "screenshot": {
      const outPath = args[1] || "browser-screenshot.png";
      const res = await sendWsCommand(activeTab.webSocketDebuggerUrl, "Page.captureScreenshot", { format: "png" });
      if (res?.data) {
        const fs = require("fs");
        fs.writeFileSync(outPath, Buffer.from(res.data, "base64"));
        console.log(JSON.stringify({ success: true, file: outPath, tab: activeTab.title }));
        return;
      }
      break;
    }

    default:
      console.log(JSON.stringify({ error: `Comando desconhecido: ${command}` }));
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
