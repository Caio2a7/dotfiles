return {
  "saghen/blink.cmp",
  dependencies = "rafamadriz/friendly-snippets", -- Garante que você tenha snippets prontos
  version = "*",
  opts = function(_, opts)
    
    opts.completion = {
      ghost_text = { enabled = false },
      
      list = {
        selection = {
          preselect = false, -- Não seleciona nada sozinho
          auto_insert = false, -- Não insere nada sozinho
        },
      },

      menu = {
        auto_show = true,
        draw = {
          -- Desenha: Indice | Icone | Texto
          columns = { { "item_idx" }, { "kind_icon" }, { "label", "label_description", gap = 1 } },
          components = {
            item_idx = {
              text = function(ctx) return ctx.idx .. " " end,
              highlight = "Comment",
            },
          },
        },
      },
    }

    opts.sources = {
      default = { "lsp", "snippets", "path", "buffer" },
      
      providers = {
        lsp = {
          name = "LSP",
          module = "blink.cmp.sources.lsp",
          score_offset = 100, -- 
        },
        snippets = {
          name = "Snippets",
          module = "blink.cmp.sources.snippets",
          score_offset = 80, -- Snippets em segundo
        },
        buffer = {
          name = "Buffer",
          module = "blink.cmp.sources.buffer",
          score_offset = 0, -- Texto simples fica por último
        },
      },
    }

    -- Mapeamento travado como você pediu
    opts.keymap = {
      preset = "none",
      ["<C-space>"] = { "show", "show_documentation", "hide_documentation" },
      ["<C-e>"] = { "hide" },
      ["<CR>"] = { "fallback" }, -- Enter não aceita
      ["<C-y>"] = { "select_and_accept" }, -- Ctrl+y aceita

      -- SETAS SÃO IGNORADAS PELO MENU (Fallback para o editor mover o cursor)
      ["<Up>"] = { "fallback" },
      ["<Down>"] = { "fallback" },
      ["<Left>"] = { "fallback" },
      ["<Right>"] = { "fallback" },

      -- Navegação opcional dentro da lista caso queira rolar sem selecionar
      ["<C-p>"] = { "select_prev", "fallback" },
      ["<C-n>"] = { "select_next", "fallback" },
      ["<C-u>"] = { "scroll_documentation_up", "fallback" },
      ["<C-d>"] = { "scroll_documentation_down", "fallback" },
    }

    -- Loop para gerar Ctrl+1 até Ctrl+9 e Alt+1 até Alt+9
    for i = 1, 9 do
      opts.keymap["<C-" .. i .. ">"] = {
        function(cmp) cmp.accept({ index = i }) end,
      }
      opts.keymap["<M-" .. i .. ">"] = {
        function(cmp) cmp.accept({ index = i }) end,
      }
    end

    return opts
  end,
}
