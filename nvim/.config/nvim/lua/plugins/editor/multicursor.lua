return {
  {
    "mg979/vim-visual-multi",
    branch = "master",
    lazy = false,
    init = function()
      vim.g.VM_theme = "nord"
      vim.g.VM_default_mappings = 0

      vim.g.VM_maps = {
        ["Find Under"]         = "<C-r>",
        ["Find Subword Under"] = "<C-r>",
        ["Select All"]         = "<C-M-a>",
        ["Add Cursor Down"]    = "<C-Down>",
        ["Add Cursor Up"]      = "<C-Up>",
        ["Skip Region"]        = "<C-s>",
        ["Remove Region"]      = "<leader>x",
      }

      local map = vim.keymap.set
      local opts = { noremap = true, silent = true }

      -- Disparo direto das funções nativas do vim-visual-multi sem passar pelo Ctrl+r
      local function add_down()
        pcall(vim.cmd, "call vm#commands#add_cursor_down(0, 1)")
      end

      local function add_up()
        pcall(vim.cmd, "call vm#commands#add_cursor_up(0, 1)")
      end

      map({ "n", "v" }, "<C-Down>", add_down, opts)
      map({ "n", "v" }, "<C-Up>", add_up, opts)
      map({ "n", "v" }, "<Esc>[1;5B", add_down, opts)
      map({ "n", "v" }, "<Esc>[1;5A", add_up, opts)
    end,
    config = function()
      local set_yellow_hl = function()
        vim.api.nvim_set_hl(0, "VM_Cursor", { bg = "#ffff00", fg = "#000000", bold = true, force = true })
        vim.api.nvim_set_hl(0, "VM_Selection", { bg = "#ffd700", fg = "#000000", bold = true, force = true })
        vim.api.nvim_set_hl(0, "VM_Extend", { bg = "#ffff00", fg = "#000000", bold = true, force = true })
        vim.api.nvim_set_hl(0, "VM_Mono", { bg = "#ffff00", fg = "#000000", bold = true, force = true })
        vim.api.nvim_set_hl(0, "VM_Insert", { bg = "#ffff00", fg = "#000000", bold = true, force = true })
      end

      set_yellow_hl()

      vim.api.nvim_create_autocmd({ "ColorScheme", "User" }, {
        pattern = { "*", "visual_multi_start", "visual_multi_mode" },
        callback = set_yellow_hl,
      })

      vim.cmd([[
        call vm#plugs#permanent()
      ]])
    end,
  },
}
