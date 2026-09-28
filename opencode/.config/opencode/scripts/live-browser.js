#!/usr/bin/env node
/**
 * live-browser.js - High-speed CLI for interacting with isolated Helium Dev browser via CDP.
 * Zero-dependency WebSocket / HTTP CDP protocol.
 */

const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");
const CDP_URL = process.env.CDP_URL || "http://localhost:9222";

function httpReq(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(path, CDP_URL), { method, timeout: 5000 }, (res) => {
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
    return (await httpReq("GET", "/json/version")).status === 200;
  } catch {
    return false;
  }
}

async function ensureCdpReady() {
  if (await isCdpAvailable()) return true;
  spawn("helium-dev", [], { detached: true, stdio: "ignore", env: process.env }).unref();
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
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout executando comando CDP ${method}`));
    }, 8000);

    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onerror = (err) => {
      clearTimeout(timer);
      ws.close();
      reject(err);
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

async function cmdStatus() {
  const available = await isCdpAvailable();
  const active = available ? await getActiveTab().catch(() => null) : null;
  console.log(JSON.stringify({
    status: available ? "connected" : "disconnected",
    cdp_url: CDP_URL,
    message: available ? "Helium Dev isolado conectado na porta 9222." : "Helium Dev não está aberto na porta 9222.",
    active_tab: active ? { title: active.title, url: active.url } : null,
  }, null, 2));
}

async function cmdLaunch() {
  const ready = await ensureCdpReady();
  console.log(JSON.stringify({
    success: ready,
    message: ready ? "Helium Dev isolado iniciado com sucesso na porta 9222." : "Falha ao iniciar Helium Dev.",
  }, null, 2));
}

async function cmdList() {
  const res = await httpReq("GET", "/json/list");
  const pages = (res.body || []).filter((it) => it.type === "page").map((it, idx) => ({
    index: idx,
    id: it.id,
    title: it.title,
    url: it.url,
  }));
  console.log(JSON.stringify({ total: pages.length, pages }, null, 2));
}

async function cmdSearch(query) {
  if (!query) throw new Error("Informe o termo de pesquisa.");
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const res = await httpReq("PUT", `/json/new?${encodeURIComponent(searchUrl)}`);
  if (res.status === 200 && res.body?.id) {
    await httpReq("POST", `/json/activate/${res.body.id}`).catch(() => {});
    console.log(JSON.stringify({ success: true, action: "opened_tab_and_searched", query, url: searchUrl, id: res.body.id }, null, 2));
  }
}

async function cmdGoto(targetUrl, tab) {
  if (!targetUrl) throw new Error("Informe a URL de destino.");
  const url = /^https?:\/\//.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
  await evalInTab(tab.webSocketDebuggerUrl, `window.location.href = ${JSON.stringify(url)}`);
  console.log(JSON.stringify({ success: true, action: "navigated", url }, null, 2));
}

async function cmdClick(target, tab) {
  if (!target) throw new Error("Informe o seletor ou texto a ser clicado.");
  const clickCode = `(() => {
    const query = ${JSON.stringify(target)}.toLowerCase().trim();
    try {
      const el = document.querySelector(${JSON.stringify(target)});
      if (el) {
        const c = el.closest("a") || el;
        c.scrollIntoView({ behavior: "instant", block: "center" });
        c.click();
        return { success: true, method: "selector", tag: c.tagName, text: (el.alt || el.innerText || el.src || "").slice(0, 50) };
      }
    } catch (e) {}
    const candidates = Array.from(document.querySelectorAll("a, button, [role='button'], h3, [role='link']"));
    const m = candidates.find(c => (c.innerText || c.textContent || "").toLowerCase().includes(query) || (c.getAttribute("href") || "").toLowerCase().includes(query));
    if (m) {
      const c = m.closest("a") || m;
      c.scrollIntoView({ behavior: "instant", block: "center" });
      c.click();
      return { success: true, method: "text_match", tag: c.tagName, text: (c.innerText || "").slice(0, 80), href: c.getAttribute("href") };
    }
    return { success: false, error: "Nenhum elemento clicável encontrado com: " + query };
  })()`;
  console.log(JSON.stringify(await evalInTab(tab.webSocketDebuggerUrl, clickCode), null, 2));
}

async function cmdFind(textToFind, tab) {
  if (!textToFind) throw new Error("Informe a palavra/texto a pesquisar.");
  const findCode = `(() => {
    const query = ${JSON.stringify(textToFind)}.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.toLowerCase().includes(query)) {
        const p = node.parentElement;
        p.scrollIntoView({ behavior: "smooth", block: "center" });
        Object.assign(p.style, { backgroundColor: "#ffeb3b", outline: "3px solid #f44336", color: "#000", borderRadius: "4px" });
        return { found: true, query: ${JSON.stringify(textToFind)}, matched_snippet: p.innerText.slice(0, 250), tag: p.tagName };
      }
    }
    return { found: false, query: ${JSON.stringify(textToFind)} };
  })()`;
  console.log(JSON.stringify(await evalInTab(tab.webSocketDebuggerUrl, findCode), null, 2));
}

async function cmdInspect(tab) {
  const inspectCode = `(() => ({
    title: document.title,
    url: window.location.href,
    h1: Array.from(document.querySelectorAll("h1")).map(h => h.innerText.trim()).filter(Boolean),
    inputs: Array.from(document.querySelectorAll("input")).map(i => ({ name: i.name, id: i.id, placeholder: i.placeholder, type: i.type })),
    links_sample: Array.from(document.querySelectorAll("a")).slice(0, 15).map(a => ({ text: a.innerText.trim().slice(0, 40), href: a.href }))
  }))()`;
  console.log(JSON.stringify(await evalInTab(tab.webSocketDebuggerUrl, inspectCode), null, 2));
}

async function cmdScreenshot(outPath, tab) {
  const target = outPath || "browser-screenshot.png";
  const res = await sendWsCommand(tab.webSocketDebuggerUrl, "Page.captureScreenshot", { format: "png" });
  if (res?.data) {
    fs.writeFileSync(target, Buffer.from(res.data, "base64"));
    console.log(JSON.stringify({ success: true, file: target, tab: tab.title }));
  }
}

async function dispatchCommand(command, args, activeTab) {
  switch (command) {
    case "list": return await cmdList();
    case "search": return await cmdSearch(args.slice(1).join(" "));
    case "goto":
    case "open": return await cmdGoto(args[1], activeTab);
    case "click": return await cmdClick(args.slice(1).join(" "), activeTab);
    case "find": return await cmdFind(args.slice(1).join(" "), activeTab);
    case "inspect": return await cmdInspect(activeTab);
    case "screenshot": return await cmdScreenshot(args[1], activeTab);
    default: console.log(JSON.stringify({ error: `Comando desconhecido: ${command}` }));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";
  if (command === "status") return await cmdStatus();
  if (command === "launch") return await cmdLaunch();

  const ready = await ensureCdpReady();
  if (!ready) {
    console.error(JSON.stringify({ error: "Não foi possível conectar ao Helium Dev na porta 9222." }));
    process.exit(1);
  }

  const activeTab = await getActiveTab().catch(async () => {
    await httpReq("PUT", "/json/new?about:blank");
    return await getActiveTab();
  });
  await dispatchCommand(command, args, activeTab);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
