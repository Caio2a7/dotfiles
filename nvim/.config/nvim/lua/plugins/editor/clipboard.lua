return {
  {
    "AstroNvim/astrocore",
    opts = function()
      vim.opt.clipboard = "" -- Mantendo sua config de limpar o clipboard nativo
      local map = vim.keymap.set

      -- Função modificada para voltar ao Insert Mode
      local function copy_to_wl()
        -- 1. Copia a seleção para o registro 'v'
        vim.cmd('noau normal! "vy')
        
        -- 2. Envia para o Wayland
        local text = vim.fn.getreg("v")
        vim.fn.system("wl-copy", text)
        
        -- 3. Notifica
        vim.notify("Copiado!", vim.log.levels.INFO)

        -- 4. O TRUQUE: Se a seleção terminou, força a volta para o modo Insert
        -- Como o 'y' (yank) já joga para o modo Normal, basta dar startinsert
        -- Mas verificamos se o cursor não está no final da linha para evitar bugs visuais
        vim.cmd("startinsert")
      end

      local function paste_from_wl()
        local content = vim.fn.system("wl-paste --no-newline")
        if content ~= "" then
          vim.api.nvim_put(vim.split(content, "\n"), "c", true, true)
        end
      end

      local function paste_from_wl_insert()
        local content = vim.fn.system("wl-paste --no-newline")
        if content ~= "" then
          vim.api.nvim_put(vim.split(content, "\n"), "c", false, true)
        end
      end

      local function cut_to_wl()
        -- Para cortar, copiamos e deletamos. 
        -- Aqui talvez você queira manter o modo Insert também?
        vim.cmd('noau normal! "vy') -- Copia
        local text = vim.fn.getreg("v")
        vim.fn.system("wl-copy", text)
        vim.cmd('normal! "_d') -- Deleta (blackhole)
        vim.notify("Cortado!", vim.log.levels.INFO)
        vim.cmd("startinsert") -- Volta para Insert
      end

      -- Mapeamentos
      -- Use 'x' ou 'v' aqui. 'x' é visual mode (excluindo select mode)
      map("x", "<C-c>", copy_to_wl, { desc = "Copiar e voltar para Insert" })
      
      map("v", "<C-x>", cut_to_wl, { desc = "Cortar" })
      
      map("n", "<C-v>", paste_from_wl, { desc = "Colar" })
      
      -- No modo visual, colar deleta a seleção e cola o novo texto
      map("v", "<C-v>", function()
        vim.cmd('noau normal! "_d')
        paste_from_wl()
        -- Opcional: Se quiser que após colar ele fique em insert mode:
        -- vim.cmd("startinsert") 
      end, { desc = "Colar" })
      
      map("i", "<C-v>", paste_from_wl_insert, { desc = "Colar" })
    end,
  },
}
