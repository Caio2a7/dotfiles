local function toggle_comment(lnum)
  local line = vim.api.nvim_buf_get_lines(0, lnum - 1, lnum, false)[1]
  if not line or not line:match("%S") then return end

  local cs = vim.bo.commentstring
  if not cs or cs == "" then cs = "# %s" end
  local left, right = cs:match("^(.*)%%s(.*)$")
  if not left then left = cs right = "" end

  local indent = line:match("^(%s*)")
  local content = line:sub(#indent + 1)

  local left_trim = vim.trim(left)
  local esc_left = vim.pesc(left_trim)
  local esc_right = vim.pesc(vim.trim(right))

  local is_commented = content:match("^" .. esc_left)

  local new_line
  if is_commented then
    local uncommented = content:gsub("^" .. esc_left .. "%s?", "", 1)
    if right ~= "" then
      uncommented = uncommented:gsub("%s?" .. esc_right .. "$", "")
    end
    new_line = indent .. uncommented
  else
    new_line = indent .. left .. content .. right
  end

  vim.api.nvim_buf_set_lines(0, lnum - 1, lnum, false, { new_line })
end

local function comment_logic_curr()
  toggle_comment(vim.api.nvim_win_get_cursor(0)[1])
end

local function comment_logic_visual()
  vim.cmd("normal! \27")
  local start_ln = vim.fn.line("'<")
  local end_ln = vim.fn.line("'>")
  if start_ln > end_ln then start_ln, end_ln = end_ln, start_ln end
  for i = start_ln, end_ln do
    toggle_comment(i)
  end
end

return {
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      opts = opts or {}
      opts.mappings = vim.tbl_deep_extend("force", opts.mappings or {}, {
        n = {
          ["<C-k>"] = { comment_logic_curr, desc = "Toggle Comentario" },
        },
        i = {
          ["<C-k>"] = {
            function()
              vim.cmd("stopinsert")
              comment_logic_curr()
            end,
            desc = "Toggle Comentario",
          },
        },
        v = {
          ["<C-k>"] = { comment_logic_visual, desc = "Toggle Selecao" },
        },
      })
      return opts
    end,
  },
}
