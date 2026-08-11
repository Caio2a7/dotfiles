local diagnostics_visible = false

vim.diagnostic.config({
  virtual_text = false,
  signs = false,
  underline = false,
  update_in_insert = false,
  severity_sort = true,
})

local function toggle_diagnostics()
  diagnostics_visible = not diagnostics_visible
  if diagnostics_visible then
    vim.diagnostic.config({
      virtual_text = {
        prefix = "●",
        spacing = 4,
      },
      signs = true,
      underline = true,
      update_in_insert = false,
      severity_sort = true,
    })
    vim.notify("Diagnósticos ativados", vim.log.levels.INFO)
  else
    vim.diagnostic.config({
      virtual_text = false,
      signs = false,
      underline = false,
      update_in_insert = false,
    })
    vim.notify("Diagnósticos desativados", vim.log.levels.INFO)
  end
end

vim.keymap.set({ "n", "i", "v" }, "<C-d>", function()
  local is_insert = vim.fn.mode() == "i"
  toggle_diagnostics()
  if is_insert then
    pcall(vim.cmd, "startinsert")
  end
end, { desc = "Toggle diagnósticos (Ctrl+d)", noremap = true, silent = true, nowait = true })

return {}
