vim.opt.selection = "exclusive"
vim.opt.virtualedit = "onemore"
vim.opt.keymodel = "startsel,stopsel"
vim.opt.clipboard = "unnamedplus"
vim.opt.timeoutlen = 1000

local opts = { noremap = true, silent = true }

vim.keymap.set("n", "<C-Left>", "b", opts)
vim.keymap.set("n", "<C-Right>", "w", opts)

vim.keymap.set("n", "<M-v>", "<C-v>", { desc = "Visual Block", noremap = true, silent = true })
vim.keymap.set("i", "<M-v>", "<Esc><C-v>", { desc = "Visual Block", noremap = true, silent = true })

-- AutoComando para zerar timeoutlen no Snacks Picker e fechar com 1 Esc instantâneo
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "snacks_picker_input", "snacks_picker_list" },
  callback = function(ev)
    local buf = ev.buf
    vim.opt_local.timeoutlen = 0
    vim.opt_local.ttimeoutlen = 0

    local close_snacks = function()
      pcall(function() require("snacks").picker.close() end)
      vim.cmd("stopinsert")
      pcall(vim.cmd, "close")
    end

    vim.keymap.set({ "i", "n", "v", "t" }, "<Esc>", close_snacks, { buffer = buf, nowait = true, silent = true })
  end,
})

-- Ctrl+B: Buffers (Abre no 1º clique instantâneo em todos os modos)
local function open_buffers()
  if vim.fn.mode() == "i" then
    vim.cmd("stopinsert")
  end
  require("snacks").picker.buffers()
end

vim.keymap.set({ "n", "i", "v" }, "<C-b>", open_buffers, { desc = "Buffers", nowait = true, noremap = true, silent = true })

-- Ctrl+T: Toggle Terminal Bottom
local function toggle_term_bottom()
  if vim.fn.mode() == "i" then
    vim.cmd("stopinsert")
  end
  pcall(vim.cmd, "ToggleTerm direction=horizontal")
end

-- Ctrl+Shift+T: Toggle Terminal Fullscreen
local function toggle_term_fullscreen()
  if vim.fn.mode() == "i" then
    vim.cmd("stopinsert")
  end
  pcall(function()
    local toggleterm = require("toggleterm.terminal")
    local term = toggleterm.get(1)
    if not term or not term:is_open() then
      vim.cmd("ToggleTerm direction=horizontal")
      vim.schedule(function()
        local t = toggleterm.get(1)
        if t and t.bufnr then
          local win = vim.fn.bufwinid(t.bufnr)
          if win ~= -1 then
            vim.api.nvim_win_call(win, function()
              vim.cmd("resize " .. vim.o.lines)
              vim.cmd("vertical resize " .. vim.o.columns)
            end)
          end
        end
      end)
    else
      term:close()
    end
  end)
end

vim.keymap.set({ "n", "i", "v", "t" }, "<C-t>", toggle_term_bottom, { desc = "Toggle Terminal Bottom", nowait = true, noremap = true, silent = true })
vim.keymap.set({ "n", "i", "v", "t" }, "<C-S-t>", toggle_term_fullscreen, { desc = "Toggle Terminal Fullscreen", nowait = true, noremap = true, silent = true })
vim.keymap.set({ "n", "i", "v", "t" }, "<C-S-T>", toggle_term_fullscreen, { desc = "Toggle Terminal Fullscreen", nowait = true, noremap = true, silent = true })


vim.keymap.set("n", "<C-z>", "u", { desc = "Desfazer", noremap = true, silent = true })
vim.keymap.set("i", "<C-z>", "<C-o>u", { desc = "Desfazer", noremap = true, silent = true })
vim.keymap.set("v", "<C-z>", "<Esc>u", { desc = "Desfazer", noremap = true, silent = true })


local function run_ctrl_semicolon()
  if vim.fn.mode() == "i" then
    vim.cmd("stopinsert")
  end
  vim.cmd("normal! $")
  if vim.fn.col("$") > 1 then
    vim.cmd("normal! l")
  end
  vim.cmd("normal! .")
end

vim.keymap.set(
  { "n", "i" },
  "<C-;>",
  run_ctrl_semicolon,
  { desc = "Ir para Fim Real e Repetir", noremap = true, silent = true }
)
vim.keymap.set("v", "<C-;>", ":normal $l.<CR>", { desc = "Repetir no Fim da Selecao", noremap = true, silent = true })

vim.keymap.set("i", "<C-S-Left>", "<Esc>lvb", opts)
vim.keymap.set("i", "<C-S-Right>", "<C-o>ve", opts)
vim.keymap.set("v", "<C-S-Left>", "b", opts)
vim.keymap.set("v", "<C-S-Right>", "e", opts)

local function toggle_line_comment(lnum)
  local line = vim.api.nvim_buf_get_lines(0, lnum - 1, lnum, false)[1]
  if not line or not line:match("%S") then
    return
  end
  local cs = vim.bo.commentstring
  if not cs or cs == "" then
    cs = "# %s"
  end
  local left, right = cs:match("^(.*)%%s(.*)$")
  if not left then
    left = cs
    right = ""
  end
  local indent = line:match("^(%s*)")
  local content = line:sub(#indent + 1)
  local left_trim = vim.trim(left)
  local right_trim = vim.trim(right)
  local esc_left = vim.pesc(left_trim)
  local esc_right = vim.pesc(right_trim)
  local is_commented = content:match("^" .. esc_left)
  local new_line
  if is_commented then
    local uncommented = content:gsub("^" .. esc_left .. "%s?", "", 1)
    if right_trim ~= "" then
      uncommented = uncommented:gsub("%s?" .. esc_right .. "$", "")
    end
    new_line = indent .. uncommented
  else
    new_line = indent .. left .. content .. right
  end
  vim.api.nvim_buf_set_lines(0, lnum - 1, lnum, false, { new_line })
end

local function run_comment_normal()
  toggle_line_comment(vim.api.nvim_win_get_cursor(0)[1])
end

local function run_comment_visual()
  vim.cmd("normal! \27")
  local start_ln = vim.fn.line("'<")
  local end_ln = vim.fn.line("'>")
  if start_ln > end_ln then
    start_ln, end_ln = end_ln, start_ln
  end
  for i = start_ln, end_ln do
    toggle_line_comment(i)
  end
end

vim.schedule(function()
  if vim.fn.maparg("<C-l>", "n") ~= "" then
    pcall(vim.keymap.del, "n", "<C-l>")
  end
  vim.keymap.set("n", "<C-l>", "V", { desc = "Select Line", noremap = true, silent = true })
  vim.keymap.set("i", "<C-l>", "<Esc>V", { desc = "Select Line", noremap = true, silent = true })
  vim.keymap.set("v", "<C-l>", function()
    local mode = vim.fn.mode()
    if mode == "v" then
      vim.cmd("normal! V")
    else
      vim.cmd("normal! j")
    end
  end, { desc = "Expand Selection", noremap = true, silent = true })

  -- Mapeamento vv: Selecionar linha inteira no modo Normal (como dd e yy)
  vim.keymap.set("n", "vv", "V", { desc = "Selecionar Linha Inteira", noremap = true, silent = true })
  vim.keymap.set("i", "vv", "<Esc>V", { desc = "Selecionar Linha Inteira", noremap = true, silent = true })
  vim.keymap.set("v", "vv", "V", { desc = "Selecionar Linha Inteira", noremap = true, silent = true })

  -- Objetos de Texto customizados: vil (conteúdo útil da linha) e val (linha inteira)
  vim.keymap.set({ "x", "o" }, "il", ":<C-u>normal! g_v^<CR>", { desc = "Conteúdo Interno da Linha", noremap = true, silent = true })
  vim.keymap.set({ "x", "o" }, "al", ":<C-u>normal! V<CR>", { desc = "Linha Inteira com Quebra", noremap = true, silent = true })
end)

local function toggle_cell_symbol(is_ins_param)
  local was_insert = (is_ins_param == true) or (vim.api.nvim_get_mode().mode:sub(1, 1) == "i")
  local view = vim.fn.winsaveview()
  local buf = vim.api.nvim_get_current_buf()
  local r, c = view.lnum, view.col
  local row_0 = r - 1
  local line = vim.api.nvim_buf_get_lines(buf, row_0, r, false)[1] or ""
  local ft = (vim.bo[buf].filetype or ""):lower()
  local fn = vim.api.nvim_buf_get_name(buf):lower()
  local is_markdown = (ft == "markdown" or ft == "rmd" or fn:sub(-3) == ".md" or fn:sub(-4) == ".rmd")

  if is_markdown then
    local s1, e1 = line:find("%[%s*%]")
    local s2, e2 = line:find("%[[xX]%]")
    local new_line

    if s1 or s2 then
      local start_pos, end_pos, is_checked
      if s1 and s2 then
        if s1 < s2 then start_pos, end_pos, is_checked = s1, e1, false
        else start_pos, end_pos, is_checked = s2, e2, true end
      elseif s1 then start_pos, end_pos, is_checked = s1, e1, false
      elseif s2 then start_pos, end_pos, is_checked = s2, e2, true end

      new_line = is_checked
        and (line:sub(1, start_pos - 1) .. "[ ]" .. line:sub(end_pos + 1))
        or (line:sub(1, start_pos - 1) .. "[X]" .. line:sub(end_pos + 1))
    else
      if line:find("^%s*[%-*%+]%s+") then
        new_line = line:gsub("^(%s*[%-*%+])%s+", "%1 [X] ")
      else
        new_line = "- [X] " .. line
      end
    end

    vim.api.nvim_buf_set_lines(buf, row_0, r, false, { new_line })

    if _G.auto_move_completed_markdown_tasks then
      _G.auto_move_completed_markdown_tasks(buf)
    end

    local function restore_pos()
      local line_now = vim.api.nvim_buf_get_lines(buf, row_0, r, false)[1] or new_line
      local line_len = #line_now
      if was_insert then
        local target_c = math.min(c, line_len)
        pcall(vim.api.nvim_win_set_cursor, 0, { r, target_c })
        if target_c >= line_len then
          pcall(vim.cmd, "startinsert!")
        else
          pcall(vim.cmd, "startinsert")
        end
      else
        local target_c = math.min(c, math.max(0, line_len - 1))
        pcall(vim.api.nvim_win_set_cursor, 0, { r, target_c })
        pcall(vim.fn.winrestview, view)
      end
    end

    restore_pos()
    vim.schedule(restore_pos)
    return
  end

  local delim = ","
  if ft:find("tsv") or fn:sub(-4) == ".tsv" or (line:find("\t") and not line:find(",")) then
    delim = "\t"
  elseif line:find(";") and not line:find(",") then
    delim = ";"
  end

  local out, q, s = {}, false, 1
  for i = 1, #line do
    local ch = line:sub(i, i)
    if ch == '"' then
      q = not q
    elseif ch == delim and not q then
      out[#out + 1] = { s = s - 1, e = i - 1, t = line:sub(s, i - 1) }
      s = i + 1
    end
  end
  out[#out + 1] = { s = s - 1, e = #line, t = line:sub(s) }
  if #out == 0 then return end

  local idx = 1
  for i = 1, #out do
    local f = out[i]
    local next_s = (i < #out) and out[i + 1].s or 99999
    if c >= f.s and c < next_s then
      idx = i
      break
    end
  end

  local cell = out[idx]
  if not cell then return end

  local t = cell.t
  local new_t
  if t:find("✅", 1, true) then
    new_t = t:gsub("%s*✅", "❎")
  elseif t:find("❎", 1, true) then
    new_t = t:gsub("%s*❎", "")
  else
    local trimmed = vim.trim(t)
    if trimmed == "" then
      new_t = "✅"
    else
      new_t = trimmed .. " ✅"
    end
  end

  out[idx].t = new_t

  local new_fields = {}
  for _, f in ipairs(out) do
    table.insert(new_fields, f.t)
  end
  local new_line = table.concat(new_fields, delim)

  vim.api.nvim_buf_set_lines(buf, row_0, r, false, { new_line })
  pcall(vim.cmd, "doautocmd TextChanged")
  vim.notify("Célula atualizada: " .. new_t, vim.log.levels.INFO, { title = "CSV Toggle" })

  local function restore_pos()
    local line_now = vim.api.nvim_buf_get_lines(buf, row_0, r, false)[1] or new_line
    local line_len = #line_now
    if was_insert then
      local target_c = math.min(c, line_len)
      pcall(vim.api.nvim_win_set_cursor, 0, { r, target_c })
      if target_c >= line_len then
        pcall(vim.cmd, "startinsert!")
      else
        pcall(vim.cmd, "startinsert")
      end
    else
      local target_c = math.min(c, math.max(0, line_len - 1))
      pcall(vim.api.nvim_win_set_cursor, 0, { r, target_c })
      pcall(vim.fn.winrestview, view)
    end
  end

  restore_pos()
  vim.schedule(restore_pos)
end

local function clear_all_symbols()
  local buf = vim.api.nvim_get_current_buf()
  local line_count = vim.api.nvim_buf_line_count(buf)
  local lines = vim.api.nvim_buf_get_lines(buf, 0, line_count, false)
  local changed = false
  for i, l in ipairs(lines) do
    local cleaned = l:gsub("%s*✅", ""):gsub("%s*❎", "")
    if cleaned ~= l then
      lines[i] = cleaned
      changed = true
    end
  end
  if changed then
    vim.api.nvim_buf_set_lines(buf, 0, line_count, false, lines)
    vim.notify("Todos os símbolos ✅ e ❎ foram removidos!", vim.log.levels.INFO, { title = "CSV" })
  end
end

pcall(vim.api.nvim_create_user_command, "CsvToggle", function()
  local is_ins = (vim.api.nvim_get_mode().mode:sub(1, 1) == "i")
  toggle_cell_symbol(is_ins)
end, {})

pcall(vim.api.nvim_create_user_command, "CsvClear", function()
  clear_all_symbols()
end, {})

local function run_csv_toggle()
  pcall(vim.cmd, "CsvToggle")
end

local function unbind_all_ctrl_x(buf)
  local prefixes = {
    "<C-x>", "\x18", "<Esc>[120;5u",
    "<C-x>a", "<C-x>s", "<C-x>q", "<C-x>t", "<C-x>c", "<C-x>d",
    "<C-x>f", "<C-x>g", "<C-x>h", "<C-x>i", "<C-x>l", "<C-x>m", "<C-x>p",
    "<C-x>r", "<C-x>v", "<C-x>w", "<C-x>y", "<C-x>z"
  }
  for _, k in ipairs(prefixes) do
    if buf and vim.api.nvim_buf_is_valid(buf) then
      pcall(vim.keymap.del, "n", k, { buffer = buf })
      pcall(vim.keymap.del, "i", k, { buffer = buf })
      pcall(vim.keymap.del, "v", k, { buffer = buf })
    end
    pcall(vim.keymap.del, "n", k)
    pcall(vim.keymap.del, "i", k)
    pcall(vim.keymap.del, "v", k)
  end
end

-- Mapeamento nativo direto em Vimscript (nível de engine C do Neovim)
vim.cmd([[
  silent! nunmap <C-x>
  silent! iunmap <C-x>
  silent! vunmap <C-x>
  nnoremap <silent> <C-x> :CsvToggle<CR>
  inoremap <silent> <C-x> <cmd>CsvToggle<CR>
  vnoremap <silent> <C-x> :<C-u>CsvToggle<CR>
  nnoremap <silent> <leader>x :CsvToggle<CR>
  nnoremap <silent> <leader>cx :CsvToggle<CR>
  nnoremap <silent> cx :CsvToggle<CR>
  nnoremap <silent> <Esc>[120;6u :CsvClear<CR>
  vnoremap <silent> <Esc>[120;6u :<C-u>CsvClear<CR>
  nnoremap <silent> <C-S-x> :CsvClear<CR>
  inoremap <silent> <C-S-x> <cmd>CsvClear<CR>
  vnoremap <silent> <C-S-x> :<C-u>CsvClear<CR>
  nnoremap <silent> <leader>X :CsvClear<CR>
  nnoremap <silent> <leader>cX :CsvClear<CR>
  nnoremap <silent> cX :CsvClear<CR>
]])

-- Mapeamento Buffer-Local em tempo de execução via Vimscript
vim.api.nvim_create_autocmd({ "BufEnter", "BufWinEnter", "FileType" }, {
  group = vim.api.nvim_create_augroup("CsvToggleCellKeymaps", { clear = true }),
  pattern = "*",
  callback = function(ev)
    vim.schedule(function()
      if not vim.api.nvim_buf_is_valid(ev.buf) then return end
      pcall(vim.cmd, "nunmap <buffer> <C-x>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <C-x> :CsvToggle<CR>")
      pcall(vim.cmd, "inoremap <buffer> <silent> <C-x> <cmd>CsvToggle<CR>")
      pcall(vim.cmd, "vnoremap <buffer> <silent> <C-x> :<C-u>CsvToggle<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <leader>x :CsvToggle<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <leader>cx :CsvToggle<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> cx :CsvToggle<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <Esc>[120;6u :CsvClear<CR>")
      pcall(vim.cmd, "vnoremap <buffer> <silent> <Esc>[120;6u :<C-u>CsvClear<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <C-S-x> :CsvClear<CR>")
      pcall(vim.cmd, "inoremap <buffer> <silent> <C-S-x> <cmd>CsvClear<CR>")
      pcall(vim.cmd, "vnoremap <buffer> <silent> <C-S-x> :<C-u>CsvClear<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <leader>X :CsvClear<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> <leader>cX :CsvClear<CR>")
      pcall(vim.cmd, "nnoremap <buffer> <silent> cX :CsvClear<CR>")
    end)
  end,
})

local function smart_jump()
  local char = vim.fn.getcharstr()
  if char == "" or char == "\27" then return end

  pcall(vim.cmd, "silent! normal! /" .. char .. "\r")
  vim.opt.hlsearch = false

  vim.keymap.set("n", char, function()
    pcall(vim.cmd, "silent! normal! n")
    vim.opt.hlsearch = false
  end, { buffer = true, nowait = true })

  vim.api.nvim_create_autocmd({ "InsertEnter", "BufLeave" }, {
    once = true,
    callback = function()
      pcall(vim.keymap.del, "n", char, { buffer = true })
      vim.opt.hlsearch = false
    end,
  })

  vim.keymap.set("n", "<Esc>", function()
    pcall(vim.keymap.del, "n", char, { buffer = true })
    pcall(vim.keymap.del, "n", "<Esc>", { buffer = true })
    vim.opt.hlsearch = false
  end, { buffer = true })
end

vim.keymap.set("n", "s", smart_jump, { noremap = true, silent = true })

local opts_s = { noremap = true, silent = true }
vim.keymap.set("s", "<Down>", "<Esc>j$v", opts_s)
vim.keymap.set("s", "<Up>", "<Esc>k$v", opts_s)
vim.keymap.set("s", "<S-Down>", "<Esc>j$v", opts_s)
vim.keymap.set("s", "<S-Up>", "<Esc>k$v", opts_s)

vim.keymap.set("x", "<Down>", "j$", opts_s)
vim.keymap.set("x", "<Up>", "k$", opts_s)
vim.keymap.set("x", "<S-Down>", "j$", opts_s)
vim.keymap.set("x", "<S-Up>", "k$", opts_s)

vim.keymap.set("v", "}", "}l", { noremap = true, silent = true })
vim.keymap.set("v", "{", "{h", { noremap = true, silent = true })

-- Helper robusto para verificar se o Vim Visual Multi possui regiões ativas
local function is_vm_active()
  if vim.b.visual_multi ~= 1 then return false end
  local sel = vim.b.VM_Selection
  if type(sel) ~= "table" or not sel.Regions or #sel.Regions == 0 then
    return false
  end
  return true
end

local function vm_feed_down()
  pcall(vim.cmd, "call vm#commands#add_cursor_down(0, 1)")
end

local function vm_feed_up()
  pcall(vim.cmd, "call vm#commands#add_cursor_up(0, 1)")
end

local opts_force = { noremap = true, silent = true }

for _, key in ipairs({ "<C-Down>", "<Esc>[1;5B", "\x1b[1;5B" }) do
  vim.keymap.set({ "n", "x" }, key, vm_feed_down, opts_force)
end

for _, key in ipairs({ "<C-Up>", "<Esc>[1;5A", "\x1b[1;5A" }) do
  vim.keymap.set({ "n", "x" }, key, vm_feed_up, opts_force)
end

local function vm_feed_word_add()
  vim.schedule(function()
    vim.cmd("call vm#commands#find_under(0, 1)")
  end)
end

-- Solução nativa: modo visual (v) + <Plug>(VM-Find-Subword-Under) para iniciar + 'n' para avançar e criar cursores
local function vm_feed_char_cursor()
  local active = is_vm_active()

  if not active then
    vim.cmd("normal! v")
    vim.schedule(function()
      local keys = vim.api.nvim_replace_termcodes("<Plug>(VM-Find-Subword-Under)", true, false, true)
      vim.api.nvim_feedkeys(keys, "m", false)
    end)
  else
    local keys = vim.api.nvim_replace_termcodes("n", true, false, true)
    vim.api.nvim_feedkeys(keys, "m", false)
  end
end

for _, key in ipairs({ "<C-r>" }) do
  vim.keymap.set({ "n", "x" }, key, vm_feed_word_add, opts_force)
end

for _, key in ipairs({ "<C-s>", "\x13" }) do
  vim.keymap.set({ "n", "x" }, key, vm_feed_char_cursor, opts_force)
end

-- Keybinds: d / y + Seta Direita / Esquerda (incluindo o caractere atual sob o cursor)
vim.keymap.set("n", "d<Right>", "v$d", { desc = "Apagar do caractere ate o fim da linha", noremap = true, silent = true })
vim.keymap.set("n", "d<Left>", "v0d", { desc = "Apagar do caractere ate o inicio da linha", noremap = true, silent = true })

vim.keymap.set("n", "y<Right>", "v$y", { desc = "Copiar do caractere ate o fim da linha", noremap = true, silent = true })
vim.keymap.set("n", "y<Left>", "v0y", { desc = "Copiar do caractere ate o inicio da linha", noremap = true, silent = true })

vim.keymap.set("o", "<Right>", "v$", { noremap = true, silent = true })
vim.keymap.set("o", "<Left>", "v0", { noremap = true, silent = true })

pcall(require, "plugins.core.macros")

