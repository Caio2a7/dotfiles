local U = {}

U.protected_vim_cmds = {
  ["w"] = true, ["w!"] = true, ["wa"] = true, ["wa!"] = true, ["write"] = true,
  ["q"] = true, ["q!"] = true, ["qa"] = true, ["qa!"] = true, ["quit"] = true,
  ["wq"] = true, ["wq!"] = true, ["wqa"] = true, ["wqa!"] = true,
  ["x"] = true, ["x!"] = true, ["xa"] = true, ["xa!"] = true,
  ["e"] = true, ["e!"] = true, ["edit"] = true,
  ["b"] = true, ["b!"] = true, ["bd"] = true, ["bd!"] = true, ["bdelete"] = true,
  ["bw"] = true, ["bw!"] = true, ["bwipeout"] = true,
  ["bn"] = true, ["bp"] = true, ["bnext"] = true, ["bprev"] = true, ["buffer"] = true,
  ["buffers"] = true, ["bfirst"] = true, ["blast"] = true,
  ["sp"] = true, ["split"] = true, ["vsp"] = true, ["vsplit"] = true,
  ["new"] = true, ["vnew"] = true, ["clo"] = true, ["close"] = true, ["only"] = true,
  ["tabnew"] = true, ["tabe"] = true, ["tabedit"] = true, ["tabclose"] = true,
  ["tabn"] = true, ["tabp"] = true, ["tabnext"] = true, ["tabprev"] = true,
  ["h"] = true, ["help"] = true, ["helpclose"] = true,
  ["s"] = true, ["substitute"] = true,
  ["g"] = true, ["global"] = true, ["v"] = true,
  ["d"] = true, ["delete"] = true, ["y"] = true, ["yank"] = true,
  ["m"] = true, ["move"] = true, ["t"] = true, ["copy"] = true,
  ["c"] = true, ["change"] = true,
  ["j"] = true, ["join"] = true,
  ["norm"] = true, ["normal"] = true,
  ["lua"] = true, ["luado"] = true, ["luafile"] = true,
  ["py"] = true, ["py3"] = true, ["python3"] = true,
  ["source"] = true, ["so"] = true,
  ["set"] = true, ["setlocal"] = true, ["setglobal"] = true,
  ["noh"] = true, ["nohlsearch"] = true,
  ["copen"] = true, ["cclose"] = true, ["cn"] = true, ["cp"] = true, ["cnext"] = true, ["cprev"] = true,
  ["lopen"] = true, ["lclose"] = true, ["ln"] = true, ["lp"] = true,
  ["checkhealth"] = true, ["marks"] = true, ["jumps"] = true,
  ["registers"] = true, ["reg"] = true,
  ["history"] = true, ["undo"] = true, ["redo"] = true,
  ["messages"] = true, ["echomsg"] = true, ["echo"] = true,
  ["terminal"] = true, ["term"] = true,
}

local ext_map = {
  go = "go", java = "java", py = "python", rs = "rust", ts = "typescript",
  tsx = "typescriptreact", js = "javascript", jsx = "javascriptreact", json = "json",
  md = "markdown", html = "html", css = "css", scss = "scss", yaml = "yaml",
  yml = "yaml", toml = "toml", xml = "xml", sql = "sql", sh = "bash",
  bash = "bash", zsh = "bash", lua = "lua", c = "c", cpp = "cpp",
}

function U.strip_ansi(str)
  if not str then return "" end
  local clean = str:gsub("\27%[[%d;?]*[%a]", "")
  clean = clean:gsub("\r\n", "\n"):gsub("\r", "")
  return clean
end

local function detect_by_command(cmd)
  local lower = cmd:lower()
  if lower:match("^go%s+doc") or lower:match("^godoc") then return "text" end
  if lower:match("^man%s") or lower:match("^info%s") or lower:match("^tldr%s")
     or lower:match("%-%-help") or lower:match("%s%-h$") or lower:match("%s%-h%s") then
    return "man"
  end
  if lower:match("^git%s+diff") or lower:match("^git%s+show") or lower:match("^diff%s") or lower:match("^patch%s") then
    return "diff"
  end
  if lower:match("^git%s+status") then return "gitcommit" end
  if lower:match("^git%s+log") or lower:match("^git%s+branch") then return "git" end
  local cat_file = cmd:match("^(?:cat|bat|head|tail|less|more)%s+([%w_%-%.%/]+)")
  if cat_file then
    local ext = cat_file:match("%.([%w_]+)$")
    if ext and ext_map[ext:lower()] then return ext_map[ext:lower()] end
  end
  return nil
end

local function detect_by_content(output)
  if not output or output == "" then return nil end
  local trimmed = vim.trim(output)
  if (trimmed:sub(1, 1) == "{" and trimmed:sub(-1) == "}")
     or (trimmed:sub(1, 1) == "[" and trimmed:sub(-1) == "]") then
    return "json"
  end
  if trimmed:match("^<%?xml") or (trimmed:sub(1, 1) == "<" and trimmed:sub(-1) == ">") then
    return "xml"
  end
  if trimmed:match("^%d%d%d%d%-%d%d%-%d%d") or trimmed:match("^%[[%a]+%]") or trimmed:match("%s%[WARN%]") or trimmed:match("%s%[ERROR%]") then
    return "log"
  end
  return nil
end

function U.detect_filetype(cmd, output)
  return detect_by_command(cmd) or detect_by_content(output) or "markdown"
end

return U
