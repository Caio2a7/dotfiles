local function toggle_checkbox(lnum)
  local line = vim.api.nvim_buf_get_lines(0, lnum - 1, lnum, false)[1]
  if not line then return end

  local s1, e1 = line:find("%[%s*%]")
  local s2, e2 = line:find("%[[xX]%]")

  local start_pos, end_pos, is_checked

  if s1 and s2 then
    if s1 < s2 then
      start_pos, end_pos, is_checked = s1, e1, false
    else
      start_pos, end_pos, is_checked = s2, e2, true
    end
  elseif s1 then
    start_pos, end_pos, is_checked = s1, e1, false
  elseif s2 then
    start_pos, end_pos, is_checked = s2, e2, true
  end

  if start_pos then
    local new_line
    if is_checked then
      new_line = line:sub(1, start_pos - 1) .. "[]" .. line:sub(end_pos + 1)
    else
      new_line = line:sub(1, start_pos - 1) .. "[X]" .. line:sub(end_pos + 1)
    end
    vim.api.nvim_buf_set_lines(0, lnum - 1, lnum, false, { new_line })
  end
end

local function checkbox_logic_curr()
  toggle_checkbox(vim.api.nvim_win_get_cursor(0)[1])
end

local function checkbox_logic_visual()
  vim.cmd("normal! \27")
  local start_ln = vim.fn.line("'<")
  local end_ln = vim.fn.line("'>")
  if start_ln > end_ln then start_ln, end_ln = end_ln, start_ln end
  for i = start_ln, end_ln do
    toggle_checkbox(i)
  end
end

return {
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      -- Checkbox mappings can be invoked on demand or bound as needed
      return opts
    end,
  },
}
