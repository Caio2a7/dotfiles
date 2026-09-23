local M = {}

local win_buffers = {}

local function is_normal_win(win)
  if not win or not vim.api.nvim_win_is_valid(win) then return false end
  local cfg = vim.api.nvim_win_get_config(win)
  return cfg.relative == ""
end

local function on_buf_win_enter(args)
  local win = vim.api.nvim_get_current_win()
  local buf = args.buf
  if not is_normal_win(win) or not vim.api.nvim_buf_is_valid(buf) then return end
  if not vim.bo[buf].buflisted and vim.bo[buf].buftype ~= "terminal" then return end

  if not win_buffers[win] then win_buffers[win] = {} end
  if not vim.tbl_contains(win_buffers[win], buf) then
    table.insert(win_buffers[win], buf)
  end
end

local function on_win_closed(args)
  local closed_win = tonumber(args.match)
  if not closed_win then return end
  local bufs = win_buffers[closed_win] or {}
  win_buffers[closed_win] = nil

  local remaining = vim.tbl_filter(function(w)
    return is_normal_win(w) and w ~= closed_win
  end, vim.api.nvim_tabpage_list_wins(0))

  if #remaining > 0 and #bufs > 0 then
    local target_win = remaining[1]
    if not win_buffers[target_win] then win_buffers[target_win] = {} end
    for _, b in ipairs(bufs) do
      local is_tb = _G.SmartTerm and (b == _G.SmartTerm.term_buf or b == _G.SmartTerm.out_buf or vim.bo[b].buftype == "terminal")
      if not is_tb and vim.api.nvim_buf_is_valid(b) and vim.fn.buflisted(b) == 1 then
        if not vim.tbl_contains(win_buffers[target_win], b) then
          table.insert(win_buffers[target_win], b)
        end
      end
    end
  end
end

local function on_buf_deleted(args)
  local buf = args.buf
  for _, bufs in pairs(win_buffers) do
    for i = #bufs, 1, -1 do
      if bufs[i] == buf then table.remove(bufs, i) end
    end
  end
end

function M.setup()
  local group = vim.api.nvim_create_augroup("SmartWindowBuffersTracking", { clear = true })
  vim.api.nvim_create_autocmd({ "BufWinEnter", "BufEnter" }, { group = group, callback = on_buf_win_enter })
  vim.api.nvim_create_autocmd("WinClosed", { group = group, callback = on_win_closed })
  vim.api.nvim_create_autocmd({ "BufDelete", "BufWipeout" }, { group = group, callback = on_buf_deleted })
end

local function get_all_listed_buffers()
  local all = {}
  for b = 1, vim.fn.bufnr("$") do
    if vim.api.nvim_buf_is_valid(b) and vim.fn.buflisted(b) == 1 then
      local bt = vim.bo[b].buftype
      if bt ~= "quickfix" and bt ~= "prompt" then
        table.insert(all, b)
      end
    end
  end
  return all
end

local function get_term_window_buffers(cur_buf, win)
  local result, seen = {}, {}
  local function add(b)
    if b and vim.api.nvim_buf_is_valid(b) and not seen[b] then
      seen[b] = true
      table.insert(result, b)
    end
  end
  if _G.SmartTerm.out_buf and vim.api.nvim_buf_is_valid(_G.SmartTerm.out_buf) then
    add(_G.SmartTerm.out_buf)
  end
  if _G.SmartTerm.term_buf and vim.api.nvim_buf_is_valid(_G.SmartTerm.term_buf) then
    add(_G.SmartTerm.term_buf)
  end
  for _, b in ipairs(win_buffers[win] or {}) do
    if vim.api.nvim_buf_is_valid(b) and vim.fn.buflisted(b) == 1 then add(b) end
  end
  add(cur_buf)
  return result
end

local function get_code_window_buffers(win, tab_wins, smart_term_open)
  local result, seen = {}, {}
  local function add(b)
    if b and vim.api.nvim_buf_is_valid(b) and not seen[b] then
      seen[b] = true
      table.insert(result, b)
    end
  end
  for _, b in ipairs(win_buffers[win] or {}) do
    if vim.api.nvim_buf_is_valid(b) and vim.fn.buflisted(b) == 1 then
      local is_term_b = _G.SmartTerm and (b == _G.SmartTerm.term_buf or b == _G.SmartTerm.out_buf)
      if not (smart_term_open and is_term_b) then add(b) end
    end
  end
  if win == tab_wins[1] then
    local assigned = {}
    for _, w in ipairs(tab_wins) do
      for _, b in ipairs(win_buffers[w] or {}) do assigned[b] = true end
    end
    for _, b in ipairs(get_all_listed_buffers()) do
      local is_term_b = _G.SmartTerm and (b == _G.SmartTerm.term_buf or b == _G.SmartTerm.out_buf)
      if not assigned[b] and not (smart_term_open and is_term_b) then add(b) end
    end
  end
  return result
end

local function is_valid_window_target(win)
  if not win or not vim.api.nvim_win_is_valid(win) then return false end
  if _G.SmartTerm and _G.SmartTerm.float_win == win then return true end
  return is_normal_win(win)
end

function M.get_buffers_for_window(win)
  if not is_valid_window_target(win) then return {} end

  local cur_buf = vim.api.nvim_win_get_buf(win)
  local is_float_win = _G.SmartTerm and _G.SmartTerm.float_win == win
  local is_term_win = is_float_win or (_G.SmartTerm and _G.SmartTerm.term_win == win)
  local is_term = is_term_win or (_G.SmartTerm and (cur_buf == _G.SmartTerm.term_buf or cur_buf == _G.SmartTerm.out_buf or vim.bo[cur_buf].buftype == "terminal"))

  if is_term then return get_term_window_buffers(cur_buf, win) end

  local tab_wins = vim.tbl_filter(is_normal_win, vim.api.nvim_tabpage_list_wins(0))
  local term_open = _G.SmartTerm and _G.SmartTerm.term_win and vim.api.nvim_win_is_valid(_G.SmartTerm.term_win)
  if #tab_wins <= 1 then
    return vim.tbl_filter(function(b)
      local is_tb = _G.SmartTerm and (b == _G.SmartTerm.term_buf or b == _G.SmartTerm.out_buf)
      return not is_tb or cur_buf == b
    end, get_all_listed_buffers())
  end

  local res = get_code_window_buffers(win, tab_wins, term_open)
  if (vim.bo[cur_buf].buflisted or vim.bo[cur_buf].buftype == "terminal") and not vim.tbl_contains(res, cur_buf) then
    table.insert(res, cur_buf)
  end
  return res
end

function M.cycle_window_tabs(direction)
  local win = vim.api.nvim_get_current_win()
  if not is_valid_window_target(win) then return end

  local bufs = M.get_buffers_for_window(win)
  if not bufs or #bufs <= 1 then return end

  local cur_buf = vim.api.nvim_win_get_buf(win)
  local cur_idx = 1
  for i, b in ipairs(bufs) do
    if b == cur_buf then cur_idx = i; break end
  end

  local target_idx = direction == "prev" and (cur_idx - 1) or (cur_idx + 1)
  if target_idx < 1 then target_idx = #bufs end
  if target_idx > #bufs then target_idx = 1 end

  local target_buf = bufs[target_idx]
  if not target_buf or not vim.api.nvim_buf_is_valid(target_buf) then return end

  if vim.fn.mode() == "t" then vim.cmd("stopinsert") end
  vim.api.nvim_win_set_buf(win, target_buf)

  if _G.SmartTerm then
    _G.SmartTerm.current_view_buf = target_buf
    if _G.SmartTerm.term_win and vim.api.nvim_win_is_valid(_G.SmartTerm.term_win) and _G.SmartTerm.term_win ~= win then
      vim.api.nvim_win_set_buf(_G.SmartTerm.term_win, target_buf)
    end
  end

  if vim.bo[target_buf].buftype == "terminal" then
    vim.cmd("startinsert")
  else
    vim.cmd("stopinsert")
  end

  pcall(function() require("lualine").refresh({ scope = "all", place = { "winbar" } }) end)
end

local ComponentClass = nil
function M.get_component_class()
  if ComponentClass then return ComponentClass end
  local BuffersComponent = require("lualine.components.buffers")
  local WB = BuffersComponent:extend()

  function WB:init(options)
    options.component_name = options.component_name or ("wb_" .. (options.self and options.self.section or "c"))
    WB.super.init(self, options)
    self.highlights = {
      active = self:create_hl(self.options.buffers_color.active, "active"),
      inactive = self:create_hl(self.options.buffers_color.inactive, "inactive"),
    }
  end

  function WB:buffers()
    local win = vim.api.nvim_get_current_win()
    local bufs = M.get_buffers_for_window(win)
    local buffers = {}
    self.bufpos2nr = {}
    for i, b in ipairs(bufs) do
      buffers[#buffers + 1] = self:new_buffer(b, i)
      self.bufpos2nr[#buffers] = b
    end
    return buffers
  end

  ComponentClass = WB
  return ComponentClass
end

local function format_buffer_name(name, buffer)
  if _G.SmartTerm and buffer.bufnr == _G.SmartTerm.term_buf then
    return " bash"
  end
  if _G.SmartTerm and buffer.bufnr == _G.SmartTerm.out_buf then
    local bname = vim.api.nvim_buf_get_name(buffer.bufnr)
    local short = bname:match("%[Output%]%s*(.*)")
    return " " .. (short and short ~= "" and short or "Output")
  end
  return name
end

function M.get_winbar(c)
  return {
    lualine_c = {
      {
        M.get_component_class(),
        show_filename_only = true,
        show_modified_status = true,
        mode = 0,
        max_length = function() return vim.o.columns * 0.9 end,
        filetype_names = { snacks_dashboard = " Home", snacks_explorer = " Files", ["neo-tree"] = " Tree" },
        symbols = { modified = " ●", alternate_file = "", directory = " " },
        buffers_color = { active = { fg = c.base, bg = c.blue, gui = "bold" }, inactive = { fg = c.subtext0, bg = c.bg3 } },
        separator = { left = "", right = "" },
        padding = 1,
        fmt = format_buffer_name,
      },
    },
  }
end

function M.get_inactive_winbar(c)
  return {
    lualine_c = {
      {
        M.get_component_class(),
        show_filename_only = true,
        show_modified_status = true,
        mode = 0,
        max_length = function() return vim.o.columns * 0.9 end,
        filetype_names = { snacks_dashboard = " Home", snacks_explorer = " Files", ["neo-tree"] = " Tree" },
        symbols = { modified = " ●", alternate_file = "", directory = " " },
        buffers_color = { active = { fg = c.subtext1, bg = c.inactive_bg, gui = "bold" }, inactive = { fg = c.overlay0, bg = c.bg2 } },
        separator = { left = "", right = "" },
        padding = 1,
        fmt = format_buffer_name,
      },
    },
  }
end

M.setup()

return M
