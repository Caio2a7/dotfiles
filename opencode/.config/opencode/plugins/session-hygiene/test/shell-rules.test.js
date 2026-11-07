import { test } from "node:test"
import assert from "node:assert/strict"
import { blockedCommand, checkShellCommand } from "../lib/shell-rules.js"

const BLOCKED = [
  ["python3 heredoc", "python3 - <<'EOF'\nopen('a.txt','w').write('x')\nEOF"],
  ["python heredoc sem traço", "python3 <<EOF\nprint(1)\nEOF"],
  ["python -c open w", `python3 -c "open('a.txt','w').write('x')"`],
  ["python -c open a", `python3 -c "open('a.log2', 'a').write('x')"`],
  ["python -c write_text", `python3 -c "from pathlib import Path; Path('a').write_text('x')"`],
  ["sed -i", "sed -i 's/a/b/' src/app.js"],
  ["sed -i.bak", "sed -i.bak 's/a/b/' src/app.js"],
  ["sed -ni cluster", "sed -Ei 's/a/b/' f.txt"],
  ["perl -pi", "perl -pi -e 's/a/b/' f.txt"],
  ["cat > arquivo", "cat > src/new.js <<'EOF'\nx\nEOF"],
  ["cat >> arquivo", "cat >> notes.md <<EOF\nx\nEOF"],
  ["echo > arquivo", "echo 'x' > config.json"],
  ["printf >> arquivo", "printf 'x' >> config.json"],
  ["heredoc para arquivo", "node <<EOF > out.js\nconsole.log(1)\nEOF"],
  ["tee arquivo", "echo x | tee src/a.js"],
  ["tee -a arquivo", "echo x | tee -a src/a.js"],
  ["bash -c aninhado", `bash -c "sed -i 's/a/b/' f"`],
  ["cat arquivo em /tmp não-log", "cat > /tmp/x.py <<EOF\nprint(1)\nEOF"],
]

const ALLOWED = [
  ["cat json oculto", "cat .obsidian/appearance.json"],
  ["sed -n arquivo", "sed -n '1,5p' Scripts/x.sh"],
  ["sed -n $ arquivo", "sed -n '5,$p' src/app.js"],
  ["head arquivo", "head -50 a.js"],
  ["tail arquivo", "tail -n 20 a.js"],
  ["wc arquivo", "wc -l src/app.js"],
  ["cat | jq", "cat a.json | jq ."],
  ["jq arquivo", "jq .name package.json"],
  ["grep em pipe", "cat a.js | grep foo | head -3"],
  ["cat vários", "cat a.js b.js"],
  ["encadeado com cat", "cd src && cat app.js"],
  ["python script", "python3 script.py"],
  ["python -c sem escrita", `python3 -c "print(open('a.txt').read())"`],
  ["python -c open r", `python3 -c "open('a.txt','r').read()"`],
  ["pipe sed -n", "git log | sed -n 1,5p"],
  ["pipe cat", "echo hi | cat"],
  ["cat heredoc para /dev/null", "cat <<EOF > /dev/null\nx\nEOF"],
  ["redir /dev/null", "npm test > /dev/null 2>&1"],
  ["redir /tmp/*.log", "npm run build > /tmp/build.log 2>&1"],
  ["tee .log", "bash run.sh 2>&1 | tee .aiflow/task-test.log"],
  ["git", "git commit -m 'feat: x' && git status"],
  ["git diff", "git diff HEAD~1 -- src/app.js"],
  ["node script", "node scripts/build.js"],
  ["npm", "npm install --save-dev vitest"],
  ["docker", "docker compose up -d"],
  ["sed sem -i em pipe", "echo hi | sed 's/a/b/'"],
  ["sed s/// stdout", "sed 's/a/b/' src/app.js"],
  ["sed -n com texto em aspas", `echo "sed -i foo" | head -1`],
  ["comando vazio", "   "],
  ["ls e grep", "ls -la src && grep -rn foo src"],
  ["cat de log", "cat /tmp/build.log"],
  ["fd dup 2>&1", "make 2>&1"],
  ["perl sem -i", "perl -Mstrict -e 'print 1'"],
  ["bash -c inofensivo", `bash -c "npm test"`],
  ["heredoc em git commit", "git commit -F - <<EOF\nmsg com cat > x\nEOF"],
]

for (const [name, cmd] of BLOCKED) {
  test(`bloqueia: ${name}`, () => {
    const found = checkShellCommand(cmd)
    assert.ok(found, `deveria bloquear: ${cmd}`)
    assert.match(found.hint, /`edit`.*`write`/)
  })
}

for (const [name, cmd] of ALLOWED) {
  test(`permite: ${name}`, () => {
    assert.equal(checkShellCommand(cmd), null, `não deveria bloquear: ${cmd}`)
  })
}

test("blockedCommand gera comando shell seguro que falha com a mensagem", () => {
  const out = blockedCommand({ kind: "write", reason: "it's x", hint: "use edit" })
  assert.match(out, /exit 1$/)
  assert.match(out, /BLOQUEADO/)
  assert.ok(!out.includes("it's x"))
})
