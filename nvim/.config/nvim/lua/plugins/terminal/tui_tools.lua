local function open_tui_tool(cmd_name, tool_title)
  if vim.fn.executable(cmd_name) == 0 then
    vim.notify("ERRO: O programa '" .. cmd_name .. "' não está instalado no sistema!", vim.log.levels.ERROR)
    return
  end

  require("snacks").terminal({ cmd_name }, {
    win = {
      style = "float",
      border = "rounded",
      width = 0.9,
      height = 0.9,
      title = " " .. tool_title .. " ",
      title_pos = "center",
    },
  })
end

return {
  {
    "folke/snacks.nvim",
    keys = {
      {
        "<C-q>",
        function()
          open_tui_tool("sqlit", "SQLit")
        end,
        desc = "SQLit (TUI Database)",
        mode = { "n", "v" },
      },
      {
        "<C-n>",
        function()
          open_tui_tool("termshark", "TermShark")
        end,
        desc = "TermShark (TUI Network)",
        mode = { "n", "v" },
      },
      {
        "<C-u>",
        function()
          open_tui_tool("lazydocker", "LazyDocker")
        end,
        desc = "LazyDocker (TUI Docker)",
        mode = { "n", "v" },
      },
      {
        "<C-S-m>",
        function()
          open_tui_tool("systemd-manager-tui", "Systemd Manager")
        end,
        desc = "Systemd Manager (TUI)",
        mode = { "n", "v" },
      },
    },
  },
}
