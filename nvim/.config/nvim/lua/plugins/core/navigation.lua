return {
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      local map = vim.keymap.set
      local opts_key = { noremap = true, silent = true }

      map("v", "<Tab>", ">gv", opts_key)
      map("v", "<S-Tab>", "<gv", opts_key)

      -- Tab normal: insere indentação no início e posiciona no 1º char
      map("n", "<Tab>", function()
        vim.cmd("normal! 0")
        local line = vim.api.nvim_get_current_line()
        if vim.bo.expandtab then
          local spaces = string.rep(" ", vim.bo.shiftwidth)
          vim.api.nvim_buf_set_lines(0, vim.fn.line(".") - 1, vim.fn.line("."), false, { spaces .. line })
        else
          vim.api.nvim_buf_set_lines(0, vim.fn.line(".") - 1, vim.fn.line("."), false, { "\t" .. line })
        end
        vim.cmd("normal! ^")
      end, opts_key)

      -- S-Tab normal: remove uma indentação do início e posiciona no 1º char
      map("n", "<S-Tab>", function()
        local line = vim.api.nvim_get_current_line()
        local new_line

        if vim.bo.expandtab then
          local spaces = string.rep(" ", vim.bo.shiftwidth)
          if line:sub(1, #spaces) == spaces then
            new_line = line:sub(#spaces + 1)
          else
            new_line = line:gsub("^%s+", "", 1)
            if new_line == line then return end
          end
        else
          if line:sub(1, 1) == "\t" then
            new_line = line:sub(2)
          else
            return
          end
        end

        vim.api.nvim_buf_set_lines(0, vim.fn.line(".") - 1, vim.fn.line("."), false, { new_line })
        vim.cmd("normal! ^")
      end, opts_key)

      map("n", "o", "o<Esc>", opts_key)
      map({ "n", "v" }, "<C-Home>", "gg", opts_key)
      map("i", "<C-Home>", "<C-o>gg", opts_key)
      map({ "n", "v" }, "<C-]>", "G", opts_key)
      map("i", "<C-]>", "<C-o>G", opts_key)

      -- Ctrl+. (Ir para o final da linha)
      map({ "n", "v" }, "<C-.>", "$", opts_key)
      map({ "n", "v" }, "<C->>", "$", opts_key)
      map({ "n", "v" }, "<C-S-.>", "$", opts_key)
      map("i", "<C-.>", "<C-o>$", opts_key)
      map("i", "<C->>", "<C-o>$", opts_key)
      map("i", "<C-S-.>", "<C-o>$", opts_key)

      -- Ctrl+, (Ir para o começo da linha)
      map({ "n", "v" }, "<C-,>", "0", opts_key)
      map({ "n", "v" }, "<C-<>", "0", opts_key)
      map({ "n", "v" }, "<C-S-,>", "0", opts_key)
      map("i", "<C-,>", "<C-o>0", opts_key)
      map("i", "<C-<>", "<C-o>0", opts_key)
      map("i", "<C-S-,>", "<C-o>0", opts_key)

      map({ "n", "i" }, "<C-Right>", "<C-o>e<Right>", { desc = "Prox Palavra" })
      map({ "n", "i" }, "<C-Left>", "<C-o>b", { desc = "Palavra Ant" })

      -- Fechar Buffer Inteligente (Ctrl+w)
      map({ "n", "i", "v" }, "<C-w>", function()
        local current_buf = vim.api.nvim_get_current_buf()
        local file_name = vim.fn.expand("%:t")
        if file_name == "" then file_name = "Sem Titulo" end
        local perform_close = function(buf, force)
          if #vim.fn.getbufinfo({ buflisted = 1 }) > 1 then vim.cmd("bprevious") else vim.cmd("enew") end
          pcall(vim.cmd, (force and "bdelete! " or "bdelete ") .. buf)
        end
        if vim.bo[current_buf].modified then
          local choice = vim.fn.confirm("Salvar alteracoes em '" .. file_name .. "'?", "&Sim\n&Nao\n&Cancelar", 1)
          if choice == 1 then vim.cmd("write"); perform_close(current_buf, false)
          elseif choice == 2 then perform_close(current_buf, true) end
        else
          perform_close(current_buf, false)
        end
      end, { desc = "Fechar Buffer (Smart)" })

      map("i", "<C-S-Left>", "<Esc>lvb", opts_key)
      map("i", "<C-S-Right>", "<C-o>ve", opts_key)
      map("v", "<C-S-Left>", "b", opts_key)
      map("v", "<C-S-Right>", "e", opts_key)

      local undo_triggers = { " ", ",", ".", "!", "?", ";", ":" }
      for _, char in ipairs(undo_triggers) do map("i", char, char .. "<C-g>u", opts_key) end

      vim.api.nvim_create_autocmd("VimEnter", {
        callback = function()
          map("n", "<C-y>", "<C-r>", { desc = "Redo" })
          map("i", "<C-y>", "<C-o><C-r>", { desc = "Redo" })
          map("v", "<C-y>", "<Esc><C-r>", { desc = "Redo" })

          local keys_to_purge = { "<S-Left>", "<S-Right>", "<S-Up>", "<S-Down>" }
          local modes_to_purge = { "n", "i", "v" }
          for _, mode in ipairs(modes_to_purge) do
            for _, key in ipairs(keys_to_purge) do
              pcall(vim.keymap.del, mode, key)
            end
          end
        end,
      })

      -- Alt+z: Toggle Text Wrap (em Normal, Insert e Visual)
      local toggle_wrap = function()
        vim.wo.wrap = not vim.wo.wrap
      end

      for _, k in ipairs({ "<M-z>", "<A-z>", "\x1bz", "<Esc>z", "<Esc>[122;3u" }) do
        map({ "n", "i", "v" }, k, toggle_wrap, { desc = "Toggle Text Wrap", noremap = true, silent = true, nowait = true })
      end
      map({ "n", "i", "v" }, "<C-z>", "<C-o>u", { desc = "Undo" })
      map("n", "<C-z>", "u", { desc = "Undo" })
      map({ "n", "i" }, "<C-a>", "<Esc>ggVG", { desc = "Select All" })
      map("v", "<C-a>", "ggVG", { desc = "Select All" })

      map({ "n", "i", "t", "v" }, "<M-Left>", "<C-\\><C-n><C-w>h", opts_key)
      map({ "n", "i", "t", "v" }, "<M-Right>", "<C-\\><C-n><C-w>l", opts_key)
      map("n", "<M-Up>", "<C-w>k", opts_key)
      map("n", "<M-Down>", "<C-w>j", opts_key)
      map("t", "<M-Up>", "<C-\\><C-n><C-w>k", opts_key)
      map("t", "<M-Down>", "<C-\\><C-n><C-w>j", opts_key)

      map("i", "<M-Down>", "<Esc><cmd>m .+1<cr>==gi", opts_key)
      map("i", "<M-Up>", "<Esc><cmd>m .-2<cr>==gi", opts_key)
      map("v", "<M-Down>", ":m '>+1<cr>gv=gv", opts_key)
      map("v", "<M-Up>", ":m '<-2<cr>gv=gv", opts_key)

      map({ "n", "v" }, "<C-Tab>", "<cmd>bnext<cr>", { desc = "Proximo Buffer" })
      map({ "n", "v" }, "<C-S-Tab>", "<cmd>bprevious<cr>", { desc = "Buffer Anterior" })
      map("i", "<C-Tab>", "<cmd>stopinsert<cr><cmd>bnext<cr>", { desc = "Proximo Buffer" })
      map("i", "<C-S-Tab>", "<cmd>stopinsert<cr><cmd>bprevious<cr>", { desc = "Buffer Anterior" })

      map("i", "<C-H>", "<C-w>", opts_key)
      map("i", "<C-h>", "<C-w>", opts_key)
      map("i", "<C-BS>", "<C-w>", opts_key)
      map("i", "<C-Backspace>", "<C-w>", opts_key)

      return opts
    end,
  },
}
