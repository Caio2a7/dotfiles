return {
  "MeanderingProgrammer/render-markdown.nvim",
  ft = { "markdown", "norg", "rmd", "org" },
  dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
  opts = {
    render_modes = { "n", "c", "t" },
    anti_conceal = { enabled = false },
    heading = {
      enabled = true,
      sign = true,
      icons = { "󰲡 ", "󰲣 ", "󰲥 ", "󰲧 ", "󰲩 ", "󰲫 " },
      backgrounds = {
        "RenderMarkdownH1Bg",
        "RenderMarkdownH2Bg",
        "RenderMarkdownH3Bg",
        "RenderMarkdownH4Bg",
        "RenderMarkdownH5Bg",
        "RenderMarkdownH6Bg",
      },
    },
    code = {
      enabled = true,
      sign = true,
      style = "full",
      position = "left",
      width = "block",
      left_pad = 2,
      right_pad = 2,
    },
    dash = {
      enabled = true,
      icon = "─",
      width = "full",
    },
    bullet = {
      enabled = true,
      icons = { "●", "○", "◆", "◇" },
    },
    checkbox = {
      enabled = true,
      unchecked = { icon = "󰄱 ", highlight = "RenderMarkdownTodo" },
      checked   = { icon = "󰱒 ", highlight = "RenderMarkdownDone" },
    },
    link = {
      enabled = false,
    },
    quote = {
      enabled = true,
      icon = "▋",
    },
    callout = {
      note      = { raw = "[!NOTE]",      rendered = "󰋽 Note",      highlight = "RenderMarkdownInfo" },
      tip       = { raw = "[!TIP]",       rendered = "󰌶 Tip",       highlight = "RenderMarkdownTip" },
      important = { raw = "[!IMPORTANT]", rendered = "󰅾 Important", highlight = "RenderMarkdownWarn" },
      warning   = { raw = "[!WARNING]",   rendered = "󰀪 Warning",   highlight = "RenderMarkdownError" },
      caution   = { raw = "[!CAUTION]",   rendered = "󰳦 Caution",   highlight = "RenderMarkdownCaution" },
      done      = { raw = "[!DONE]",      rendered = "󰄬 Done",      highlight = "RenderMarkdownSuccess" },
      success   = { raw = "[!SUCCESS]",   rendered = "󰗠 Success",   highlight = "RenderMarkdownSuccess" },
    },
  },
  config = function(_, opts)
    require("render-markdown").setup(opts)

    local function setup_markdown_buf()
      vim.opt_local.conceallevel = 2
      vim.opt_local.concealcursor = "nc"
    end

    local function force_colors()
      local h_style = { fg = "#FFFFFF", bg = "#000000", bold = true, underline = false, nocombine = true }
      for i = 1, 6 do
        vim.api.nvim_set_hl(0, "RenderMarkdownH" .. i, h_style)
        vim.api.nvim_set_hl(0, "RenderMarkdownH" .. i .. "Bg", { fg = "#FFFFFF", bg = "#000000", underline = false, nocombine = true })
      end
      vim.api.nvim_set_hl(0, "RenderMarkdownTodo", { fg = "#888888", bg = "NONE", bold = false, strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownDone", { fg = "#50fa7b", bg = "NONE", bold = false, strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "@markup.list.checked.markdown",   { fg = "#50fa7b", bg = "NONE", strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "@markup.list.unchecked.markdown", { fg = "#888888", bg = "NONE", nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "@markup.strikethrough",           { strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownError",   { fg = "#ff5555", bg = "#1a0a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownWarn",    { fg = "#ffb86c", bg = "#1a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownSuccess", { fg = "#50fa7b", bg = "#0a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownTip",     { fg = "#5936A2", bg = "#0a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownCaution", { fg = "#A42E05", bg = "#0a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownInfo",    { fg = "#8be9fd", bg = "#0a0a1a", bold = true, nocombine = true, force = true })
    end

    local is_moving_tasks = false

    local function get_section_type(line)
      local clean = line:lower()
      if clean:find("urgente") then
        return "urgentes"
      elseif clean:find("pendente") then
        return "pendentes"
      elseif clean:find("conclu") then
        return "concluidas"
      end
      return nil
    end

    local function is_checked_task(line)
      return line:find("%[%s*[xX]%s*%]") ~= nil
    end

    local function auto_move_completed_tasks(buf)
      if is_moving_tasks then return end
      buf = buf or vim.api.nvim_get_current_buf()
      if not vim.api.nvim_buf_is_valid(buf) then return end
      local ft = vim.bo[buf].filetype
      if ft ~= "markdown" and ft ~= "rmd" then return end

      local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
      if #lines == 0 then return end

      local cur_section = nil
      local concluidas_idx = nil
      local to_move = {}

      for i, line in ipairs(lines) do
        local sec = get_section_type(line)
        if sec then
          cur_section = sec
          if sec == "concluidas" then
            concluidas_idx = i
          end
        elseif (cur_section == "urgentes" or cur_section == "pendentes") and is_checked_task(line) then
          table.insert(to_move, { line = line, idx = i })
        end
      end

      if #to_move == 0 then return end

      is_moving_tasks = true
      local view = vim.fn.winsaveview()

      if not concluidas_idx then
        table.insert(lines, "")
        table.insert(lines, "> [!DONE] Concluídas")
        concluidas_idx = #lines
      end

      table.sort(to_move, function(a, b) return a.idx > b.idx end)

      local moved_lines = {}
      for _, item in ipairs(to_move) do
        table.insert(moved_lines, 1, item.line)
        table.remove(lines, item.idx)
        if item.idx < concluidas_idx then
          concluidas_idx = concluidas_idx - 1
        end
      end

      local insert_at = concluidas_idx + 1
      for _, moved_line in ipairs(moved_lines) do
        table.insert(lines, insert_at, moved_line)
        insert_at = insert_at + 1
      end

      vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
      pcall(vim.fn.winrestview, view)

      vim.schedule(function()
        pcall(vim.fn.winrestview, view)
        is_moving_tasks = false
      end)
    end

    local group = vim.api.nvim_create_augroup("RenderMarkdownSetup", { clear = true })
    vim.api.nvim_create_autocmd({ "FileType", "BufEnter", "BufWinEnter" }, {
      group = group,
      pattern = { "markdown", "rmd" },
      callback = function(ev)
        setup_markdown_buf()
        auto_move_completed_tasks(ev.buf)
        vim.schedule(force_colors)
      end,
    })

    vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI", "BufWritePre" }, {
      group = group,
      pattern = { "*.md", "*.rmd" },
      callback = function(ev)
        auto_move_completed_tasks(ev.buf)
      end,
    })

    setup_markdown_buf()
    auto_move_completed_tasks(0)
    vim.schedule(force_colors)
  end,
}
