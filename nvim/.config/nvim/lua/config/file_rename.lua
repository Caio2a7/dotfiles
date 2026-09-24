local pickers = require("telescope.pickers")
local finders = require("telescope.finders")
local conf = require("telescope.config").values
local action_state = require("telescope.actions.state")
local actions = require("telescope.actions")
local previewers = require("telescope.previewers")

local M = {}

local function get_all_project_files()
  local files = vim.fn.systemlist("rg --files --hidden --glob '!.git' 2>/dev/null")
  if vim.v.shell_error ~= 0 or #files == 0 then
    files = vim.fn.systemlist("git ls-files --cached --others --exclude-standard 2>/dev/null")
  end
  return files or {}
end

local function sync_renamed_buffer(old_path, new_path)
  local old_abs = vim.fn.fnamemodify(old_path, ":p")
  local new_abs = vim.fn.fnamemodify(new_path, ":p")
  for _, b in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(b) and vim.api.nvim_buf_get_name(b) == old_abs then
      pcall(vim.api.nvim_buf_set_name, b, new_abs)
      pcall(vim.api.nvim_buf_call, b, function()
        pcall(vim.cmd, "silent! edit!")
      end)
    end
  end
end

local function perform_rename(old_path, new_path)
  if not old_path or not new_path or old_path == "" or new_path == "" or old_path == new_path then
    return false, "Caminhos idênticos ou inválidos"
  end
  local target_dir = vim.fs.dirname(new_path)
  if target_dir and target_dir ~= "" and target_dir ~= "." and vim.fn.isdirectory(target_dir) == 0 then
    vim.fn.mkdir(target_dir, "p")
  end
  local ok, err = pcall(vim.uv.fs_rename, old_path, new_path)
  if not ok or err then
    local ok_os, err_os = os.rename(old_path, new_path)
    if not ok_os then return false, err or err_os end
  end
  sync_renamed_buffer(old_path, new_path)
  return true
end

local function execute_batch_rename(matched_files, search_term, replace_term)
  local count = 0
  for _, old_file in ipairs(matched_files) do
    if old_file:find(search_term, 1, true) then
      local new_file = old_file:gsub(vim.pesc(search_term), replace_term)
      local success = perform_rename(old_file, new_file)
      if success then count = count + 1 end
    end
  end
  if count > 0 then
    vim.notify(string.format("✓ Renomeados %d arquivos de '%s' para '%s'.", count, search_term, replace_term), vim.log.levels.INFO)
  else
    vim.notify("Nenhum arquivo pôde ser renomeado.", vim.log.levels.WARN)
  end
end

local function create_rename_previewer()
  return previewers.new_buffer_previewer({
    title = "Prévia da Renomeação",
    define_preview = function(self, entry)
      local cur_picker = action_state.get_current_picker(self.state.bufnr)
      local old_path = entry.value or entry[1] or ""
      local search_term = cur_picker and cur_picker._search_term
      local replace_term = cur_picker and cur_picker:_get_prompt() or ""

      local new_path = old_path
      if search_term and search_term ~= "" and old_path:find(search_term, 1, true) then
        new_path = old_path:gsub(vim.pesc(search_term), replace_term)
      end

      local lines = {
        "  ┌─────────────────────────────────────────────────────────────",
        "  │ ORIGINAL : " .. old_path,
        "  │ NOVO     : " .. new_path,
        "  └─────────────────────────────────────────────────────────────",
        "",
      }
      if search_term and search_term ~= "" then
        table.insert(lines, "  Aperte ENTER para renomear este arquivo.")
        table.insert(lines, "  Aperte Ctrl+ENTER para renomear TODOS em lote.")
      else
        table.insert(lines, "  Digite o termo a substituir no nome do arquivo.")
        table.insert(lines, "  Ou aperte ENTER para renomear diretamente este arquivo.")
      end
      vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, lines)
    end,
  })
end

local function setup_step2_mappings(prompt_bufnr, cur_picker, search_term, matched)
  cur_picker._search_term = search_term
  cur_picker._matched_files = matched

  if cur_picker.prompt_border and cur_picker.prompt_border.change_title then
    pcall(function() cur_picker.prompt_border:change_title("Renomear Arquivos no Projeto") end)
  end

  local batch_keys = { "<C-CR>", "<C-Enter>", "<C-s>", "<M-CR>", "<M-Enter>" }
  for _, k in ipairs(batch_keys) do
    vim.keymap.set({ "i", "n" }, k, function()
      local rep = cur_picker:_get_prompt()
      actions.close(prompt_bufnr)
      execute_batch_rename(matched, search_term, rep)
    end, { buffer = prompt_bufnr, nowait = true, silent = true })
  end

  actions.select_default:replace(function()
    local entry = action_state.get_selected_entry()
    local rep = cur_picker:_get_prompt()
    actions.close(prompt_bufnr)
    if entry then
      local old_path = entry.value or entry[1]
      local new_path = old_path:gsub(vim.pesc(search_term), rep)
      local ok, err = perform_rename(old_path, new_path)
      if ok then
        vim.notify(string.format("✓ Renomeado: %s -> %s", old_path, new_path), vim.log.levels.INFO)
      else
        vim.notify("Erro ao renomear: " .. tostring(err), vim.log.levels.ERROR)
      end
    end
  end)
end

local function on_step1_select(prompt_bufnr)
  local cur_picker = action_state.get_current_picker(prompt_bufnr)
  local search_term = cur_picker:_get_prompt()
  local entry = action_state.get_selected_entry()

  if not search_term or search_term == "" then
    if not entry then return end
    local old_path = entry.value or entry[1]
    actions.close(prompt_bufnr)
    vim.ui.input({ prompt = "Novo caminho do arquivo: ", default = old_path }, function(new_name)
      if new_name and new_name ~= "" and new_name ~= old_path then
        local ok, err = perform_rename(old_path, new_name)
        if ok then
          vim.notify(string.format("✓ Renomeado: %s -> %s", old_path, new_name), vim.log.levels.INFO)
        else
          vim.notify("Erro ao renomear: " .. tostring(err), vim.log.levels.ERROR)
        end
      end
    end)
    return
  end

  local all_files = get_all_project_files()
  local matched = {}
  for _, f in ipairs(all_files) do
    if f:find(search_term, 1, true) then table.insert(matched, f) end
  end

  if #matched == 0 then
    vim.notify("Nenhum arquivo encontrado com o termo '" .. search_term .. "'.", vim.log.levels.WARN)
    return
  end

  cur_picker:set_prompt("")
  cur_picker:refresh(finders.new_table({ results = matched }), { reset_prompt = true })
  setup_step2_mappings(prompt_bufnr, cur_picker, search_term, matched)
end

function M.telescope_batch_rename()
  if vim.fn.mode() == "i" then vim.cmd("stopinsert") end

  local files = get_all_project_files()
  if #files == 0 then
    vim.notify("Nenhum arquivo encontrado no projeto.", vim.log.levels.WARN)
    return
  end

  local picker = pickers.new({
    prompt_title = "Renomear Arquivos no Projeto",
    finder = finders.new_table({ results = files }),
    sorter = conf.file_sorter({}),
    previewer = create_rename_previewer(),
    layout_strategy = "horizontal",
    layout_config = {
      prompt_position = "top",
      width = 0.90,
      height = 0.90,
      horizontal = { preview_width = 0.55 },
    },
    sorting_strategy = "ascending",
    borderchars = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
    attach_mappings = function(prompt_bufnr, _)
      actions.select_default:replace(function()
        on_step1_select(prompt_bufnr)
      end)
      return true
    end,
  })

  picker:find()
end

return M
