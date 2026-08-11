return {
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      local map = vim.keymap.set
      local opts_key = { noremap = true, silent = true }
      local opts_del = { noremap = true, silent = true }

      -- Regras de Deleção sem afetar a área de transferência (Blackhole register "_d, "_x)
      map({ "n", "v" }, "x", '"_x', opts_del)
      map({ "n", "v" }, "d", '"_d', opts_del)
      map({ "n", "v" }, "c", '"_c', opts_del)
      map("n", "D", '"_D', opts_del)
      map("n", "C", '"_C', opts_del)
      map("v", "<Del>", '"_d', opts_del)
      map("n", "<Del>", '"_x', opts_del)
      map("i", "<Del>", '<C-o>"_x', opts_del)
      map("v", "<BS>", '"_d', opts_del)

      map({ "n", "v" }, "<C-BS>", 'b"_d', opts_key)
      map({ "n", "v" }, "<C-Backspace>", 'b"_d', opts_key)

      -- Shift+Del: Fechar Todos os Buffers e Sair (Close All / qa)
      map({ "n", "i", "v", "t" }, "<S-Del>", "<cmd>qa<cr>", { desc = "Fechar Tudo (Close All)", noremap = true, silent = true, nowait = true })
      map({ "n", "i", "v", "t" }, "<S-Delete>", "<cmd>qa<cr>", { desc = "Fechar Tudo (Close All)", noremap = true, silent = true, nowait = true })

      return opts
    end,
  },
}
