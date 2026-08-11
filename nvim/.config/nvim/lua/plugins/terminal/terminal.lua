return {
  {
    "akinsho/toggleterm.nvim",
    opts = {
      start_in_insert = true,
      persist_mode    = false,
      direction       = "horizontal",
      size = function(term)
        if term.direction == "horizontal" then
          return math.floor(vim.o.lines * 0.3)
        elseif term.direction == "vertical" then
          return math.floor(vim.o.columns * 0.5)
        end
      end,
      on_open = function(term)
        vim.api.nvim_buf_set_option(term.bufnr, "bufhidden", "hide")
      end,
      float_opts = {
        border   = "none",
        width    = function() return vim.o.columns end,
        height   = function() return vim.o.lines end,
        row      = 0,
        col      = 0,
        relative = "editor",
        winblend = 0,
      },
    },
  },
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      local is_fullscreen = false

      local function get_term()
        return require("toggleterm.terminal").get(1)
      end

      local function set_fullscreen(enable)
        local term = get_term()
        if not term or not term:is_open() then return end
        local win = vim.fn.bufwinid(term.bufnr)
        if win == -1 then return end
        if enable then
          vim.api.nvim_win_call(win, function()
            vim.cmd("resize " .. vim.o.lines)
            vim.cmd("vertical resize " .. vim.o.columns)
          end)
          is_fullscreen = true
        else
          vim.api.nvim_win_call(win, function()
            vim.cmd("resize " .. math.floor(vim.o.lines * 0.3))
          end)
          is_fullscreen = false
        end
      end

      opts.autocmds = vim.tbl_deep_extend("force", opts.autocmds or {}, {
        force_insert = {
          {
            event   = { "BufEnter", "WinEnter", "TermOpen" },
            pattern = "term://*",
            callback = function()
              vim.cmd("startinsert")
              vim.schedule(function() vim.cmd("startinsert") end)
            end,
          },
        },
      })

      opts.mappings = vim.tbl_deep_extend("force", opts.mappings or {}, {
        n = {
          -- Navegação entre janelas com Alt+setas
          ["<A-Left>"]  = { "<C-w>h", desc = "Janela esquerda" },
          ["<A-Right>"] = { "<C-w>l", desc = "Janela direita"  },
          ["<A-Up>"]    = { "<C-w>k", desc = "Janela acima"    },
          ["<A-Down>"]  = { "<C-w>j", desc = "Janela abaixo"   },

          -- Ctrl+T: abre/fecha terminal no bottom
          ["<C-t>"] = {
            function()
              local term = get_term()
              if term and term:is_open() then
                is_fullscreen = false
                term:close()
              else
                vim.cmd("ToggleTerm direction=horizontal")
              end
            end,
            desc = "Toggle terminal (bottom)",
          },

          -- Ctrl+Shift+T: fullscreen / restaura terminal
          ["<C-S-t>"] = {
            function()
              local term = get_term()
              if not term or not term:is_open() then
                vim.cmd("ToggleTerm direction=horizontal")
                vim.schedule(function() set_fullscreen(true) end)
                return
              end
              set_fullscreen(not is_fullscreen)
            end,
            desc = "Terminal fullscreen toggle",
          },
          ["<C-S-T>"] = {
            function()
              local term = get_term()
              if not term or not term:is_open() then
                vim.cmd("ToggleTerm direction=horizontal")
                vim.schedule(function() set_fullscreen(true) end)
                return
              end
              set_fullscreen(not is_fullscreen)
            end,
            desc = "Terminal fullscreen toggle",
          },
        },

        t = {
          -- Navegação entre janelas com Alt+setas (de dentro do terminal)
          ["<A-Left>"]  = { "<C-\\><C-n><C-w>h", desc = "Janela esquerda" },
          ["<A-Right>"] = { "<C-\\><C-n><C-w>l", desc = "Janela direita"  },
          ["<A-Up>"]    = { "<C-\\><C-n><C-w>k", desc = "Janela acima"    },
          ["<A-Down>"]  = { "<C-\\><C-n><C-w>j", desc = "Janela abaixo"   },

          -- Ctrl+T de dentro do terminal: fecha terminal
          ["<C-t>"] = {
            function()
              local term = get_term()
              if term and term:is_open() then
                is_fullscreen = false
                term:close()
              end
            end,
            desc = "Fechar terminal",
          },

          -- Ctrl+Shift+T de dentro do terminal: fullscreen / restaura
          ["<C-S-t>"] = {
            function()
              set_fullscreen(not is_fullscreen)
            end,
            desc = "Terminal fullscreen toggle",
          },
          ["<C-S-T>"] = {
            function()
              set_fullscreen(not is_fullscreen)
            end,
            desc = "Terminal fullscreen toggle",
          },
        },

        v = {
          -- Envia seleção visual para o terminal com Ctrl+T
          ["<C-t>"] = {
            function()
              vim.cmd('noau normal! "vy"')
              local text = vim.fn.getreg("v")
              text = string.gsub(text, "\n+$", "")

              local term = get_term()
              if not term or not term:is_open() then
                vim.cmd("ToggleTerm direction=horizontal")
                vim.defer_fn(function()
                  term = get_term()
                  if term then term:send(text, false) end
                end, 150)
              else
                term:send(text, false)
              end
            end,
            desc = "Enviar selecao para o terminal",
          },
        },
      })

      return opts
    end,
  },
}
