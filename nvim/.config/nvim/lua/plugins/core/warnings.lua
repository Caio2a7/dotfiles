local diagnostics_visible = true

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
    if vim.lsp.inlay_hint then
      pcall(vim.lsp.inlay_hint.enable, true)
    end
    pcall(function()
      require("nvim-dap-virtual-text").enable()
    end)
    vim.notify("Modo Debug / Diagnósticos ATIVADOS", vim.log.levels.INFO)
  else
    vim.diagnostic.config({
      virtual_text = false,
      signs = false,
      underline = false,
      update_in_insert = false,
    })
    if vim.lsp.inlay_hint then
      pcall(vim.lsp.inlay_hint.enable, false)
    end
    pcall(function()
      require("nvim-dap-virtual-text").disable()
    end)
    vim.notify("Modo Debug / Diagnósticos DESATIVADOS", vim.log.levels.INFO)
  end
end

vim.keymap.set({ "n", "i", "v" }, "<C-d>", function()
  local is_insert = vim.fn.mode() == "i"
  toggle_diagnostics()
  if is_insert then
    pcall(vim.cmd, "startinsert")
  end
end, { desc = "Toggle modo debug/diagnósticos (Ctrl+d)", noremap = true, silent = true, nowait = true })

return {}
