return {
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      vim.opt.timeoutlen = 300
      vim.opt.ttimeoutlen = 0

      vim.api.nvim_create_autocmd({ "VimEnter", "BufEnter", "InsertEnter" }, {
        callback = function()
          vim.opt.timeoutlen = 300
          vim.opt.ttimeoutlen = 0
        end,
      })

      vim.opt.number = true
      vim.opt.relativenumber = true
      vim.opt.whichwrap:append("<,>,[,],h,l")
      vim.opt.selection = "exclusive"
      vim.opt.virtualedit = "onemore"
      vim.opt.keymodel = "startsel,stopsel"
      vim.opt.guicursor = "n-c-sm:block,i-ci-ve-v:ver25,r-cr-o:hor20"
      vim.api.nvim_set_hl(0, "CursorLineNr", { fg = "#FFFF00", bold = true })
      vim.opt.clipboard = "unnamedplus"

      return opts
    end,
  },
}
