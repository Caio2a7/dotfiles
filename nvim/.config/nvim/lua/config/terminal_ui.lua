local UI = {}

function UI.is_term_win_open(M)
  return M.term_win ~= nil and vim.api.nvim_win_is_valid(M.term_win)
end

function UI.close_float_fullscreen(M, was_in_terminal_mode)
  if M.float_win and vim.api.nvim_win_is_valid(M.float_win) then
    pcall(vim.api.nvim_win_close, M.float_win, false)
    M.float_win = nil
  end
  M.is_fullscreen = false
  if UI.is_term_win_open(M) then
    if M.current_view_buf and vim.api.nvim_buf_is_valid(M.current_view_buf) then
      vim.api.nvim_win_set_buf(M.term_win, M.current_view_buf)
    end
    vim.api.nvim_set_current_win(M.term_win)
    local cur_b = vim.api.nvim_win_get_buf(M.term_win)
    if was_in_terminal_mode or (cur_b and vim.bo[cur_b].buftype == "terminal") then
      vim.cmd("startinsert")
    else
      vim.cmd("stopinsert")
      pcall(vim.api.nvim_win_set_cursor, M.term_win, { 1, 0 })
    end
  end
end

function UI.open_float_fullscreen(M, buf, was_in_terminal_mode)
  if M.float_win and vim.api.nvim_win_is_valid(M.float_win) then return end
  if not buf or not vim.api.nvim_buf_is_valid(buf) then return end

  M.float_win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    row = 0,
    col = 0,
    width = vim.o.columns,
    height = vim.o.lines,
    border = "none",
    style = "minimal",
    zindex = 50,
  })
  M.is_fullscreen = true

  if M.term_win and vim.api.nvim_win_is_valid(M.term_win) then
    if vim.wo[M.term_win].winbar ~= "" then
      pcall(function() vim.wo[M.float_win].winbar = vim.wo[M.term_win].winbar end)
    end
    vim.wo[M.float_win].number = vim.wo[M.term_win].number
    vim.wo[M.float_win].relativenumber = vim.wo[M.term_win].relativenumber
    vim.wo[M.float_win].wrap = vim.wo[M.term_win].wrap
  end

  if was_in_terminal_mode or vim.bo[buf].buftype == "terminal" then
    vim.cmd("startinsert")
  else
    vim.cmd("stopinsert")
  end
end

local function is_term_target(M, b)
  if not b or not vim.api.nvim_buf_is_valid(b) then return false end
  return b == M.term_buf or b == M.out_buf or vim.bo[b].buftype == "terminal"
end

local function get_or_create_term_buf(M, target_buf)
  if target_buf and vim.api.nvim_buf_is_valid(target_buf) then
    return target_buf
  end
  if is_term_target(M, M.current_view_buf) then return M.current_view_buf end
  if is_term_target(M, M.out_buf) then return M.out_buf end
  if is_term_target(M, M.term_buf) then return M.term_buf end
  if M.create_interactive_shell then
    M.create_interactive_shell()
    return M.term_buf
  end
  return nil
end

local function configure_term_split(win, target_h)
  vim.wo[win].number = true
  vim.wo[win].relativenumber = false
  vim.wo[win].wrap = true
  vim.api.nvim_win_set_height(win, target_h)
end

local function open_term_window(M, target_buf)
  if UI.is_term_win_open(M) then
    if target_buf and vim.api.nvim_buf_is_valid(target_buf) then
      M.current_view_buf = target_buf
      vim.api.nvim_win_set_buf(M.term_win, target_buf)
    end
    vim.api.nvim_set_current_win(M.term_win)
    return M.term_win
  end

  local cur_win = vim.api.nvim_get_current_win()
  if cur_win ~= M.float_win then M.saved_code_win = cur_win end

  local half_h = math.max(3, math.floor(vim.o.lines * 0.5))
  local target_h = (M.saved_term_height and M.saved_term_height > 1) and M.saved_term_height or half_h

  vim.cmd("botright " .. target_h .. "split")
  M.term_win = vim.api.nvim_get_current_win()
  M.is_fullscreen = false
  M.is_hidden = false
  configure_term_split(M.term_win, target_h)

  local buf = get_or_create_term_buf(M, target_buf)
  if buf and vim.api.nvim_buf_is_valid(buf) then
    M.current_view_buf = buf
    vim.api.nvim_win_set_buf(M.term_win, buf)
  end

  vim.api.nvim_set_current_win(M.term_win)
  if buf and vim.bo[buf].buftype == "terminal" then
    vim.cmd("startinsert")
  else
    vim.cmd("stopinsert")
  end

  pcall(function() require("lualine").refresh({ scope = "all", place = { "winbar" } }) end)
  return M.term_win
end

function UI.open_terminal_window(M, target_buf)
  return open_term_window(M, target_buf)
end

function UI.cycle_window(_, direction)
  require("config.window_buffers").cycle_window_tabs(direction)
end

function UI.toggle_fullscreen(M)
  local cur_win = vim.api.nvim_get_current_win()
  local cur_buf = vim.api.nvim_get_current_buf()
  local was_term_mode = (vim.fn.mode() == "t")

  local is_in_term = (cur_buf == M.out_buf or cur_buf == M.term_buf)
    or (M.term_win ~= nil and cur_win == M.term_win)
    or (M.float_win ~= nil and cur_win == M.float_win)

  if is_in_term then
    if M.is_fullscreen then
      UI.close_float_fullscreen(M, was_term_mode)
    else
      UI.open_float_fullscreen(M, cur_buf, was_term_mode)
    end
  end
end

local function restore_code_window_focus(M, win_to_close)
  local code_win = M.saved_code_win
  if not (code_win and vim.api.nvim_win_is_valid(code_win) and code_win ~= win_to_close) then
    for _, w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
      if w ~= win_to_close and vim.api.nvim_win_is_valid(w) then
        code_win = w
        break
      end
    end
  end
  if code_win and vim.api.nvim_win_is_valid(code_win) then
    M.saved_code_win = code_win
    vim.api.nvim_set_current_win(code_win)
  end
end

local function close_term_window(M, get_fallback_buffer)
  if not UI.is_term_win_open(M) then return end

  local win_to_close = M.term_win
  local buf = vim.api.nvim_win_get_buf(win_to_close)
  if is_term_target(M, buf) then M.current_view_buf = buf end

  local cur_h = vim.api.nvim_win_get_height(win_to_close)
  if cur_h > 3 then M.saved_term_height = cur_h end

  local tab_wins = vim.api.nvim_tabpage_list_wins(0)
  if #tab_wins <= 1 then
    vim.cmd("aboveleft split")
    M.saved_code_win = vim.api.nvim_get_current_win()
    if get_fallback_buffer then
      vim.api.nvim_win_set_buf(M.saved_code_win, get_fallback_buffer(buf))
    end
  end

  local ok = pcall(vim.api.nvim_win_close, win_to_close, false)
  if ok then
    M.term_win = nil
    M.is_hidden = true
    M.hidden_by_zoom = false
  end

  restore_code_window_focus(M, win_to_close)
  vim.cmd("stopinsert")

  local cur_b = vim.api.nvim_get_current_buf()
  if is_term_target(M, cur_b) and get_fallback_buffer then
    vim.api.nvim_win_set_buf(0, get_fallback_buffer(cur_b))
  end

  pcall(function() require("lualine").refresh({ scope = "all", place = { "winbar" } }) end)
end

function UI.hide_terminal(M, get_fallback_buffer)
  if M.float_win and vim.api.nvim_win_is_valid(M.float_win) then
    pcall(vim.api.nvim_win_close, M.float_win, false)
    M.float_win = nil
    M.is_fullscreen = false
  end

  local cur_buf = vim.api.nvim_get_current_buf()
  local cur_win = vim.api.nvim_get_current_win()

  if cur_win ~= M.term_win and is_term_target(M, cur_buf) then
    M.current_view_buf = cur_buf
    if get_fallback_buffer then
      vim.api.nvim_win_set_buf(0, get_fallback_buffer(cur_buf))
    end
  end

  if UI.is_term_win_open(M) then
    close_term_window(M, get_fallback_buffer)
  else
    open_term_window(M)
  end
end

return UI
