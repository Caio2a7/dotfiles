if vim.g.todo_terminal == 1 then return {} end

local superfile_open = false

local function open_superfile(cwd, on_close)
  if superfile_open then return end
  superfile_open = true
  local tmpfile = vim.fn.tempname()

  local cur_buf = vim.api.nvim_get_current_buf()
  local cur_name = vim.api.nvim_buf_get_name(cur_buf)
  local is_empty_buf = cur_name == "" and not vim.bo[cur_buf].modified and vim.bo[cur_buf].buftype == ""

  local term_buf
  if is_empty_buf then
    term_buf = cur_buf
  else
    vim.cmd("enew")
    term_buf = vim.api.nvim_get_current_buf()
  end

  vim.bo[term_buf].buflisted = false
  vim.opt_local.number = false
  vim.opt_local.relativenumber = false
  vim.opt_local.signcolumn = "no"
  vim.opt_local.scrollback = 1
  vim.fn.termopen(
    { "sh", "-c", "spf --chooser-file " .. vim.fn.shellescape(tmpfile) .. " 2>/dev/null" },
    { cwd = cwd }
  )
  vim.api.nvim_create_autocmd("TermClose", {
    buffer = term_buf,
    once = true,
    callback = function()
      superfile_open = false
      vim.schedule(function()
        local chosen = nil
        if vim.fn.filereadable(tmpfile) == 1 then
          local lines = vim.fn.readfile(tmpfile)
          vim.fn.delete(tmpfile)
          if #lines > 0 and lines[1] ~= "" then
            chosen = lines[1]
          end
        end
        on_close(chosen)
        if vim.api.nvim_buf_is_valid(term_buf) then
          pcall(vim.api.nvim_buf_delete, term_buf, { force = true })
        end
      end)
    end,
  })
  vim.cmd("startinsert")
  vim.keymap.set("t", "<C-e>", "q", { buffer = term_buf, nowait = true })
end

local group = vim.api.nvim_create_augroup("SuperfileExplorer", { clear = true })

vim.api.nvim_create_autocmd("VimEnter", {
  group = group,
  once = true,
  callback = function()
    if vim.g.superfile_vimenter_done == 1 then return end
    vim.g.superfile_vimenter_done = 1
    local arg = vim.fn.argv(0)
    if arg == "" or vim.fn.isdirectory(arg) == 1 then
      local cwd = arg ~= "" and vim.fn.fnamemodify(arg, ":p") or vim.fn.getcwd()
      local initial_bufs = vim.api.nvim_list_bufs()
      vim.schedule(function()
        open_superfile(cwd, function(chosen)
          if chosen then
            vim.cmd("edit " .. vim.fn.fnameescape(chosen))
            local cur = vim.api.nvim_get_current_buf()
            for _, b in ipairs(initial_bufs) do
              if b ~= cur and vim.api.nvim_buf_is_valid(b) then
                pcall(vim.api.nvim_buf_delete, b, { force = true })
              end
            end
          else
            vim.cmd("qa!")
          end
        end)
      end) 
    end
  end,
})

vim.keymap.set("n", "<C-e>", function()
  local prev_buf = vim.api.nvim_get_current_buf()
  local current_file = vim.api.nvim_buf_get_name(prev_buf)
  local cwd
  if current_file ~= "" then
    local dir = vim.fn.fnamemodify(current_file, ":p:h")
    cwd = vim.fn.isdirectory(dir) == 1 and dir or vim.fn.getcwd()
  else
    cwd = vim.fn.getcwd()
  end
  open_superfile(cwd, function(chosen)
    if chosen then
      vim.cmd("edit " .. vim.fn.fnameescape(chosen))
    elseif vim.api.nvim_buf_is_valid(prev_buf) then
      pcall(vim.api.nvim_set_current_buf, prev_buf)
    end
  end)
end)

return {}
