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

class ShellLexer {
  constructor(src) {
    this.src = src;
    this.segments = [];
    this.cur = newSegment(false);
    this.word = null;
    this.pendingOp = null;
    this.heredocs = [];
  }

  endWord() {
    if (this.word === null) return;
    if (this.pendingOp === "<<") this.heredocs.push(this.word);
    else if (this.pendingOp === "<<<") this.cur.herestring = true;
    else if (this.pendingOp) this.cur.redirects.push({ op: this.pendingOp, target: this.word });
    else this.cur.words.push(this.word);
    this.pendingOp = null;
    this.word = null;
  }

  endSegment(nextPiped) {
    this.endWord();
    this.pendingOp = null;
    const c = this.cur;
    if (c.words.length || c.redirects.length || c.heredoc || c.herestring) this.segments.push(c);
    this.cur = newSegment(nextPiped);
  }

  append(text) {
    this.word = (this.word ?? "") + text;
  }

  /** Consome texto, aspas, escapes, espaços e comentários; retorna o próximo índice ou -1. */
  stepText(i) {
    const { src } = this;
    const ch = src[i];
    if (ch === "'" || ch === '"') {
      const r = ch === "'" ? readSingleQuoted(src, i) : readDoubleQuoted(src, i);
      this.append(r.text);
      return r.next;
    }
    if (ch === "\\") {
      if (src[i + 1] !== "\n") this.append(src[i + 1] ?? "");
      return i + 2;
    }
    if (ch === " " || ch === "\t") {
      this.endWord();
      return i + 1;
    }
    if (ch === "#" && this.word === null) {
      const eol = src.indexOf("\n", i);
      return eol === -1 ? src.length : eol;
    }
    return -1;
  }

  /** Consome separadores de segmento e redirecionamentos; retorna o próximo índice ou -1. */
  stepOperator(i) {
    const { src } = this;
    const ch = src[i];
    if (ch === "\n") {
      this.endSegment(false);
      return skipHeredocBodies(src, i + 1, this.heredocs.splice(0));
    }
    if (ch === ";" || ch === "(" || ch === ")") return this.splitAt(i, 1, false);
    if (ch === "|") {
      const dbl = src[i + 1] === "|";
      return this.splitAt(i, dbl || src[i + 1] === "&" ? 2 : 1, !dbl);
    }
    if (ch === "&") return this.stepAmpersand(i);
    if (ch === ">" || ch === "<") return this.stepRedirect(i);
    return -1;
  }

  splitAt(i, width, nextPiped) {
    this.endSegment(nextPiped);
    return i + width;
  }

  stepAmpersand(i) {
    const next = this.src[i + 1];
    if (next === "&") return this.splitAt(i, 2, false);
    if (next !== ">") return this.splitAt(i, 1, false);
    this.endWord();
    this.pendingOp = this.src[i + 2] === ">" ? "&>>" : "&>";
    return i + this.pendingOp.length;
  }

  stepRedirect(i) {
    if (this.word !== null && /^\d+$/.test(this.word)) this.word = null;
    this.endWord();
    const r = readRedirectOp(this.src, i);
    this.pendingOp = r.op;
    if (r.op === "<<") this.cur.heredoc = true;
    return r.next;
  }

  run() {
    let i = 0;
    while (i < this.src.length) {
      let next = this.stepText(i);
      if (next === -1) next = this.stepOperator(i);
      if (next === -1) {
        this.append(this.src[i]);
        next = i + 1;
      }
      i = next;
    }
    this.endSegment(false);
    return this.segments;
  }
}

export function parseShell(src) {
  return new ShellLexer(src).run();
}

export function isFileWriteRedirect(redirect) {
  return REDIRECT_OUT.has(redirect.op) && redirect.op !== ">&";
}
