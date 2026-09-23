local U = require("config.terminal_utils")
local UI = require("config.terminal_ui")

local M = {}
_G.SmartTerm = M

M.term_win = nil
M.float_win = nil
M.out_buf = nil
M.term_buf = nil
M.term_chan = nil
M.is_fullscreen = false
M.is_hidden = false
M.saved_term_height = nil
M.hidden_by_zoom = false
M.saved_code_win = nil
M.current_view_buf = nil

local function is_term_win_open() return UI.is_term_win_open(M) end
local function is_term_buf_valid() return M.term_buf ~= nil and vim.api.nvim_buf_is_valid(M.term_buf) and M.term_chan ~= nil end
local function is_out_buf_valid() return M.out_buf ~= nil and vim.api.nvim_buf_is_valid(M.out_buf) end

local function get_fallback_buffer(exclude_buf)
  for _, info in ipairs(vim.fn.getbufinfo({ buflisted = 1 })) do
    if info.bufnr ~= exclude_buf and vim.api.nvim_buf_is_valid(info.bufnr) then
      return info.bufnr
    end
  end
  return vim.api.nvim_create_buf(true, false)
end

function M.safe_close_buffer(buf)
  buf = buf or vim.api.nvim_get_current_buf()
  if not buf or not vim.api.nvim_buf_is_valid(buf) then return end

  if buf == M.term_buf and M.term_chan then
    pcall(vim.fn.jobstop, M.term_chan)
    M.term_chan = nil
  end
  if buf == M.term_buf then M.term_buf = nil end
  if buf == M.out_buf then M.out_buf = nil end
  if M.current_view_buf == buf then M.current_view_buf = nil end

  if M.float_win and vim.api.nvim_win_is_valid(M.float_win) then
    pcall(vim.api.nvim_win_close, M.float_win, false)
    M.float_win = nil
    M.is_fullscreen = false
  end

  local tab_wins = vim.api.nvim_tabpage_list_wins(0)
  for _, win in ipairs(vim.api.nvim_list_wins()) do
    if vim.api.nvim_win_is_valid(win) and vim.api.nvim_win_get_buf(win) == buf then
      if win == M.term_win and #tab_wins > 1 then
        pcall(vim.api.nvim_win_close, win, false)
        M.term_win = nil
        M.is_hidden = true
      else
        vim.api.nvim_win_set_buf(win, get_fallback_buffer(buf))
        if win == M.term_win then
          M.term_win = nil
          M.is_hidden = true
        end
      end
    end
  end

  pcall(vim.api.nvim_buf_delete, buf, { force = true })
end

local function handle_shell_exit(exited_buf)
  M.term_chan = nil
  M.term_buf = nil
  if M.float_win and vim.api.nvim_win_is_valid(M.float_win) then
    pcall(vim.api.nvim_win_close, M.float_win, false)
    M.float_win = nil
  end
  if is_term_win_open() and M.current_view_buf == exited_buf then
    pcall(vim.api.nvim_win_close, M.term_win, false)
    M.term_win = nil
    M.is_hidden = true
  end
  M.is_fullscreen = false
  M.hidden_by_zoom = false
  if exited_buf and vim.api.nvim_buf_is_valid(exited_buf) then
    vim.schedule(function() M.safe_close_buffer(exited_buf) end)
  end
end

function M.create_interactive_shell()
  M.term_buf = vim.api.nvim_create_buf(false, true)
  vim.bo[M.term_buf].buflisted = true
  vim.bo[M.term_buf].modified = false
  pcall(vim.api.nvim_buf_set_name, M.term_buf, "[Terminal Shell]")
  M.current_view_buf = M.term_buf

  if is_term_win_open() then
    vim.api.nvim_win_set_buf(M.term_win, M.term_buf)
    vim.api.nvim_set_current_win(M.term_win)
  end

  local exited_buf = M.term_buf
  M.term_chan = vim.fn.termopen(vim.o.shell, {
    cwd = vim.fn.getcwd(),
    on_exit = function() handle_shell_exit(exited_buf) end,
  })

  local km = {
    { { "n", "t" }, "<C-f>", function() M.toggle_fullscreen() end, "Fullscreen MESMO" },
    { { "n", "t" }, "<C-Tab>", function() M.cycle_window("next") end, "Proxima Aba" },
    { { "n", "t" }, "<C-S-Tab>", function() M.cycle_window("prev") end, "Aba Anterior" },
    { { "n", "v" }, "<C-w>", function() M.safe_close_buffer(M.term_buf) end, "Fechar Terminal" },
    { "n", "q", function() M.safe_close_buffer(M.term_buf) end, "Fechar Terminal" },
  }
  vim.keymap.set("t", "<Esc>", "<C-\\><C-n>", { buffer = M.term_buf, desc = "Voltar ao modo Normal" })
  for _, k in ipairs(km) do vim.keymap.set(k[1], k[2], k[3], { buffer = M.term_buf, desc = k[4] }) end
  for _, k in ipairs({ "<C-h>", "<C-H>", "<Esc>[104;5u", "\x1b[104;5u" }) do
    vim.keymap.set({ "n", "t" }, k, function() M.hide_terminal() end, { buffer = M.term_buf, desc = "Esconder" })
  end
end

function M.open_interactive_shell()
  if not is_term_win_open() then M.open_terminal_window() end
  if not is_term_buf_valid() then M.create_interactive_shell() end
  M.current_view_buf = M.term_buf
  local target_win = (M.float_win and vim.api.nvim_win_is_valid(M.float_win)) and M.float_win or M.term_win
  vim.api.nvim_win_set_buf(target_win, M.term_buf)
  if target_win ~= M.term_win and M.term_win and vim.api.nvim_win_is_valid(M.term_win) then
    vim.api.nvim_win_set_buf(M.term_win, M.term_buf)
  end
  vim.api.nvim_set_current_win(target_win)
  pcall(function() require("lualine").refresh({ scope = "all", place = { "winbar" } }) end)
  vim.cmd("startinsert")
end

function M.open_terminal_window(target_buf) return UI.open_terminal_window(M, target_buf) end
function M.cycle_window(direction) return UI.cycle_window(M, direction) end
function M.toggle_fullscreen() return UI.toggle_fullscreen(M) end
function M.hide_terminal() return UI.hide_terminal(M, get_fallback_buffer) end

local function handle_cmd_output(res, cmd, short_cmd)
  if not is_out_buf_valid() then return end
  local raw = (res.stdout and res.stdout ~= "") and res.stdout or (res.stderr or "")
  if raw == "" and res.code == 0 then raw = "✓ Concluído com sucesso (código 0)." end
  local clean = U.strip_ansi(raw)
  local ft = U.detect_filetype(cmd, clean)
  local lines = vim.split(clean, "\n", { trimempty = false })

  vim.bo[M.out_buf].filetype = ft
  vim.api.nvim_buf_set_lines(M.out_buf, 0, -1, false, lines)

  if is_term_win_open() and M.current_view_buf == M.out_buf then
    pcall(vim.api.nvim_win_set_cursor, M.term_win, { 1, 0 })
    pcall(function() require("lualine").refresh({ scope = "all", place = { "winbar" } }) end)
  end
end

function M.run_cmd(cmd)
  if not is_out_buf_valid() then
    M.out_buf = vim.api.nvim_create_buf(false, true)
    vim.bo[M.out_buf].buftype = "nofile"
    vim.bo[M.out_buf].bufhidden = "hide"
    vim.bo[M.out_buf].swapfile = false
    vim.bo[M.out_buf].buflisted = true

    local km = {
      { "n", "<CR>", function() M.open_interactive_shell() end, "Entrar no Shell" },
      { "n", "<C-f>", function() M.toggle_fullscreen() end, "Fullscreen MESMO" },
      { { "n", "v" }, "<C-Tab>", function() M.cycle_window("next") end, "Proxima Aba" },
      { { "n", "v" }, "<C-S-Tab>", function() M.cycle_window("prev") end, "Aba Anterior" },
      { { "n", "v" }, "<C-w>", function() M.safe_close_buffer(M.out_buf) end, "Fechar Output" },
      { "n", "q", function() M.safe_close_buffer(M.out_buf) end, "Fechar Output" },
    }
    for _, k in ipairs(km) do vim.keymap.set(k[1], k[2], k[3], { buffer = M.out_buf, desc = k[4] }) end
    for _, k in ipairs({ "<C-h>", "<C-H>", "<Esc>[104;5u", "\x1b[104;5u" }) do
      vim.keymap.set({ "n", "v" }, k, function() M.hide_terminal() end, { buffer = M.out_buf, desc = "Esconder" })
    end
  end

  local short_cmd = #cmd > 32 and (cmd:sub(1, 29) .. "...") or cmd
  local buf_name = "[Output] " .. short_cmd
  if vim.api.nvim_buf_get_name(M.out_buf) ~= buf_name then
    local ok = pcall(vim.api.nvim_buf_set_name, M.out_buf, buf_name)
    if not ok then pcall(vim.api.nvim_buf_set_name, M.out_buf, buf_name .. " (" .. M.out_buf .. ")") end
  end
  vim.bo[M.out_buf].buflisted = true

  M.current_view_buf = M.out_buf
  M.open_terminal_window(M.out_buf)

  vim.api.nvim_win_set_buf(M.term_win, M.out_buf)
  vim.api.nvim_set_current_win(M.term_win)
  vim.api.nvim_buf_set_lines(M.out_buf, 0, -1, false, { "  Executando: " .. cmd .. "..." })

  local cwd = vim.fn.getcwd()
  vim.system({ "sh", "-c", cmd }, { text = true, cwd = cwd }, function(res)
    vim.schedule(function() handle_cmd_output(res, cmd, short_cmd) end)
  end)
end

function M.run_pending()
  if M.pending then
    local cmd = M.pending
    M.pending = nil
    M.run_cmd(cmd)
  end
end

function M.should_intercept(raw)
  if not raw or raw == "" then return false end
  local trimmed = vim.trim(raw)
  if trimmed == "" then return false end

  local bang_cmd = trimmed:match("^!(.*)$")
  if bang_cmd then return true, vim.trim(bang_cmd) end
  if trimmed:match("^[%%%d,'<>.%-+]+[sgdv]/") or trimmed:match("^[sgdv]/") then return false end

  local first_token = trimmed:match("^(%S+)")
  if not first_token then return false end
  if first_token == "ls" then return true, trimmed end
  if U.protected_vim_cmds[first_token] then return false end
  if vim.api.nvim_get_commands({})[first_token] then return false end

  if vim.fn.executable(first_token) == 1 then return true, trimmed end
  return false
end

for _, k in ipairs({ "<C-h>", "<C-H>", "<Esc>[104;5u", "\x1b[104;5u" }) do
  vim.keymap.set({ "n", "v", "t" }, k, M.hide_terminal, { desc = "Terminal: Esconder / Alternar", noremap = true, silent = true, nowait = true })
  vim.keymap.set("i", k, function()
    vim.cmd("stopinsert")
    M.hide_terminal()
  end, { desc = "Terminal: Esconder / Alternar", noremap = true, silent = true, nowait = true })
end

local function is_target_close_cmd(raw)
  local t = vim.trim(raw)
  return t == "q" or t == "q!" or t == "quit" or t == "quit!"
    or t == "bd" or t == "bd!" or t == "bdelete" or t == "bdelete!"
    or t == "close" or t == "close!"
end

local function setup_cmdline_mapping()
  vim.keymap.set("c", "<CR>", function()
    local cmdtype = vim.fn.getcmdtype()
    if _G.strict_search_mode and cmdtype == "/" then
      _G.strict_search_mode = false
      return "<CR><Cmd>nohl<CR>"
    end

    if cmdtype == ":" then
      local raw = vim.fn.getcmdline()
      local cur_buf = vim.api.nvim_get_current_buf()
      local is_term_buf = (cur_buf == M.term_buf or cur_buf == M.out_buf or vim.bo[cur_buf].buftype == "terminal")
      local wins = vim.api.nvim_tabpage_list_wins(0)

      if is_term_buf and is_target_close_cmd(raw) then
        local t = vim.trim(raw)
        if #wins == 1 or t:sub(1, 2) == "bd" then
          vim.fn.histadd("cmd", raw)
          return "<C-u><Esc>:lua _G.SmartTerm.safe_close_buffer()<CR>"
        end
      end

      local intercept, term_cmd = M.should_intercept(raw)
      if intercept then
        M.pending = term_cmd
        vim.fn.histadd("cmd", raw)
        return "<C-u><Esc>:lua _G.SmartTerm.run_pending()<CR>"
      end
    end

    return "<CR>"
  end, { expr = true })
end

vim.api.nvim_create_autocmd("WinClosed", {
  group = vim.api.nvim_create_augroup("SmartTerminalWinWatcher", { clear = true }),
  callback = function(args)
    local win = tonumber(args.match)
    if win == M.term_win then
      M.term_win = nil
      M.is_hidden = true
    end
    if win == M.float_win then
      M.float_win = nil
      M.is_fullscreen = false
    end
  end,
})

setup_cmdline_mapping()
vim.schedule(setup_cmdline_mapping)

return {}
