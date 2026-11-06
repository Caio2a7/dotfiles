/**
 * Tokenizador mínimo de shell: separa um comando em segmentos
 * ({ words, redirects, heredoc, herestring, piped }) respeitando aspas,
 * operadores de controle, redirecionamentos e corpos de heredoc.
 * Não é um parser completo; cobre o necessário para classificar comandos.
 */
const REDIRECT_OUT = new Set([">", ">>", ">|", "&>", "&>>", ">&"]);

function newSegment(piped) {
  return { words: [], redirects: [], heredoc: false, herestring: false, piped };
}

function readSingleQuoted(src, i) {
  const end = src.indexOf("'", i + 1);
  if (end === -1) return { text: src.slice(i + 1), next: src.length };
  return { text: src.slice(i + 1, end), next: end + 1 };
}

function readDoubleQuoted(src, i) {
  let text = "";
  let j = i + 1;
  while (j < src.length && src[j] !== '"') {
    if (src[j] === "\\" && j + 1 < src.length) j++;
    text += src[j++];
  }
  return { text, next: j + 1 };
}

function skipHeredocBodies(src, i, delimiters) {
  let pos = i;
  for (const delim of delimiters) {
    while (pos < src.length) {
      const eol = src.indexOf("\n", pos);
      const line = src.slice(pos, eol === -1 ? src.length : eol);
      pos = eol === -1 ? src.length : eol + 1;
      if (line.trim() === delim) break;
    }
  }
  return pos;
}

/** Lê o operador de redirecionamento iniciado em src[i] ('>' ou '<'). */
function readRedirectOp(src, i) {
  const ch = src[i];
  if (ch === "<") {
    if (src.startsWith("<<<", i)) return { op: "<<<", next: i + 3 };
    if (src.startsWith("<<", i)) return { op: "<<", next: i + (src[i + 2] === "-" ? 3 : 2) };
    return { op: "<", next: i + 1 };
  }
  for (const op of [">>", ">|", ">&"]) {
    if (src.startsWith(op, i)) return { op, next: i + 2 };
  }
  return { op: ">", next: i + 1 };
}

export function parseShell(src) {
  const segments = [];
  let cur = newSegment(false);
  let word = null;
  let pendingOp = null;
  const heredocs = [];

  const endWord = () => {
    if (word === null) return;
    if (pendingOp === "<<") heredocs.push(word);
    else if (pendingOp === "<<<") cur.herestring = true;
    else if (pendingOp) cur.redirects.push({ op: pendingOp, target: word });
    else cur.words.push(word);
    pendingOp = null;
    word = null;
  };
  const endSegment = (nextPiped) => {
    endWord();
    pendingOp = null;
    if (cur.words.length || cur.redirects.length || cur.heredoc || cur.herestring) segments.push(cur);
    cur = newSegment(nextPiped);
  };
  const append = (text) => {
    word = (word ?? "") + text;
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'") {
      const r = readSingleQuoted(src, i);
      append(r.text);
      i = r.next;
    } else if (ch === '"') {
      const r = readDoubleQuoted(src, i);
      append(r.text);
      i = r.next;
    } else if (ch === "\\") {
      if (src[i + 1] !== "\n") append(src[i + 1] ?? "");
      i += 2;
    } else if (ch === " " || ch === "\t") {
      endWord();
      i++;
    } else if (ch === "#" && word === null) {
      const eol = src.indexOf("\n", i);
      i = eol === -1 ? src.length : eol;
    } else if (ch === "\n") {
      endSegment(false);
      i = skipHeredocBodies(src, i + 1, heredocs.splice(0));
    } else if (ch === ";" || ch === "(" || ch === ")") {
      endSegment(false);
      i++;
    } else if (ch === "|") {
      const dbl = src[i + 1] === "|";
      endSegment(!dbl);
      i += dbl || src[i + 1] === "&" ? 2 : 1;
    } else if (ch === "&" && src[i + 1] === "&") {
      endSegment(false);
      i += 2;
    } else if (ch === "&" && src[i + 1] === ">") {
      endWord();
      pendingOp = src[i + 2] === ">" ? "&>>" : "&>";
      i += pendingOp.length;
    } else if (ch === "&") {
      endSegment(false);
      i++;
    } else if (ch === ">" || ch === "<") {
      if (word !== null && /^\d+$/.test(word)) word = null;
      endWord();
      const r = readRedirectOp(src, i);
      pendingOp = r.op;
      if (r.op === "<<") cur.heredoc = true;
      i = r.next;
    } else {
      append(ch);
      i++;
    }
  }
  endSegment(false);
  return segments;
}

export function isFileWriteRedirect(redirect) {
  return REDIRECT_OUT.has(redirect.op) && redirect.op !== ">&";
}
