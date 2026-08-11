local M = {}

local data_dir = vim.fn.stdpath("data")
local storage_file = data_dir .. "/saved_macros.json"

local state = {
  active_macro_name = "Memoria",
  saved_macros = {},
}

local function load_saved_macros()
  local f = io.open(storage_file, "r")
  if f then
    local content = f:read("*a")
    f:close()
    local ok, decoded = pcall(vim.json.decode, content)
    if ok and type(decoded) == "table" then
      state.saved_macros = decoded
    end
  end
end

local function save_macros_to_file()
  local f = io.open(storage_file, "w")
  if f then
    f:write(vim.json.encode(state.saved_macros))
    f:close()
  end
end

load_saved_macros()

local is_cancelling = false

local function is_recording()
  return vim.fn.reg_recording() ~= ""
end

local function toggle_recording()
  if not is_recording() then
    is_cancelling = false
    vim.cmd("normal! qm")
    vim.notify("⏺ Gravação de Macro iniciada [m] (Pressione @r para finalizar | @q para cancelar)", vim.log.levels.INFO)
  else
    is_cancelling = false
    local q_key = vim.api.nvim_replace_termcodes("q", true, false, true)
    vim.api.nvim_feedkeys(q_key, "n", false)
  end
end

local function cancel_recording()
  if is_recording() then
    is_cancelling = true
    local q_key = vim.api.nvim_replace_termcodes("q", true, false, true)
    vim.api.nvim_feedkeys(q_key, "n", false)
  else
    vim.notify("Nenhuma gravação de macro ativa.", vim.log.levels.INFO)
  end
end

-- HOOK C-LEVEL NA ENTRADA DO TECLADO: Intercepta @r e @q enquanto a gravação está ativa
local pending_at = false
local ns_on_key = vim.api.nvim_create_namespace("macro_on_key")

vim.on_key(function(key)
  if is_recording() then
    local char = vim.fn.keytrans(key)
    if char == "@" then
      pending_at = true
    elseif pending_at and (char == "r" or char == "R") then
      pending_at = false
      is_cancelling = false
      vim.schedule(function()
        local q_key = vim.api.nvim_replace_termcodes("q", true, false, true)
        vim.api.nvim_feedkeys(q_key, "n", false)
      end)
    elseif pending_at and (char == "q" or char == "Q") then
      pending_at = false
      is_cancelling = true
      vim.schedule(function()
        local q_key = vim.api.nvim_replace_termcodes("q", true, false, true)
        vim.api.nvim_feedkeys(q_key, "n", false)
      end)
    else
      pending_at = false
    end
  end
end, ns_on_key)

-- AUTOCMD NATIVO 'RecordingLeave': Dispara AUTOMATICAMENTE quando a gravação encerra
vim.api.nvim_create_autocmd("RecordingLeave", {
  group = vim.api.nvim_create_augroup("MacroSavePrompt", { clear = true }),
  callback = function()
    if is_cancelling then
      is_cancelling = false
      vim.fn.setreg("m", "")
      vim.notify("🚫 Gravação de Macro cancelada.", vim.log.levels.WARN)
      return
    end

    local raw_macro = vim.fn.getreg("m")
    if not raw_macro or raw_macro == "" then return end

    if raw_macro:sub(-2) == "@r" or raw_macro:sub(-2) == "@R" or raw_macro:sub(-2) == "@q" or raw_macro:sub(-2) == "@Q" then
      raw_macro = raw_macro:sub(1, -3)
      vim.fn.setreg("m", raw_macro)
    end

    if raw_macro == "" then return end

    vim.schedule(function()
      vim.ui.input({ prompt = "Nome para salvar a macro (Enter vazio = manter só em memória): " }, function(input)
        if input and vim.trim(input) ~= "" then
          local name = vim.trim(input)
          state.saved_macros[name] = raw_macro
          save_macros_to_file()
          state.active_macro_name = name
          vim.notify("Macro '" .. name .. "' salva e carregada no gatilho!", vim.log.levels.INFO)
        else
          state.active_macro_name = "Memoria"
          vim.notify("Macro mantida em memória no gatilho (@1 / @e)", vim.log.levels.INFO)
        end
      end)
    end)
  end,
})

-- Limpa movimentos verticais (descidas/subidas) do início e do fim da macro para execução em lote
local function clean_macro_for_line(raw)
  if not raw or raw == "" then return "" end
  local cleaned = raw
  cleaned = cleaned:gsub("^[j k\r\n]+", "")
  cleaned = cleaned:gsub("[j k\r\n]+$", "")
  if cleaned == "" then return raw end
  return cleaned
end

function _G.run_visual_macro_range(start_line, end_line)
  local raw_macro = vim.fn.getreg("m")
  if not raw_macro or raw_macro == "" then
    vim.notify("Nenhuma macro no gatilho. Grave com @r ou selecione com @l", vim.log.levels.WARN)
    return
  end

  -- Sai do modo visual sincronamente
  local mode = vim.fn.mode()
  if mode:match("[vV\22]") then
    vim.cmd("normal! \27")
  end

  if not start_line or start_line == 0 or not end_line or end_line == 0 then
    start_line = vim.fn.line("'<")
    end_line = vim.fn.line("'>")
    if start_line > end_line then start_line, end_line = end_line, start_line end
  end

  if start_line == 0 or end_line == 0 then
    vim.notify("Nenhuma seleção válida encontrada.", vim.log.levels.WARN)
    return
  end

  -- Limpa saltos verticais para evitar desvio de linha
  local macro_to_run = clean_macro_for_line(raw_macro)
  local old_z = vim.fn.getreg("z")
  vim.fn.setreg("z", macro_to_run)

  local total = (end_line - start_line + 1)

  for lnum = start_line, end_line do
    local max_line = vim.api.nvim_buf_line_count(0)
    if lnum > max_line then break end

    pcall(function()
      vim.api.nvim_win_set_cursor(0, { lnum, 0 })
      vim.cmd("normal! ^")
      vim.cmd("normal @z")
    end)
  end

  vim.fn.setreg("z", old_z)
  vim.notify("Macro executada em " .. total .. " linha(s) (" .. start_line .. " a " .. end_line .. ")", vim.log.levels.INFO)
end

local function run_visual_macro_from_visual()
  local line_v = vim.fn.getpos("v")[2]
  local line_dot = vim.fn.getpos(".")[2]

  local start_line, end_line
  if line_v > 0 and line_dot > 0 then
    start_line = math.min(line_v, line_dot)
    end_line = math.max(line_v, line_dot)
  else
    start_line = vim.fn.line("'<")
    end_line = vim.fn.line("'>")
    if start_line > end_line then start_line, end_line = end_line, start_line end
  end

  _G.run_visual_macro_range(start_line, end_line)
end

function _G.run_visual_macro()
  run_visual_macro_from_visual()
end

function M.list_and_select_macro()
  load_saved_macros()

  local name_list = {}
  for name, _ in pairs(state.saved_macros) do
    table.insert(name_list, name)
  end
  table.sort(name_list)

  if #name_list == 0 then
    vim.notify("Nenhuma macro salva em disco. Grave uma com @r", vim.log.levels.WARN)
    return
  end

  if _G.Snacks and _G.Snacks.picker then
    local items = {}
    for _, name in ipairs(name_list) do
      local raw = state.saved_macros[name]
      table.insert(items, {
        text = name .. " " .. vim.fn.keytrans(raw),
        name = name,
        raw = raw,
      })
    end

    _G.Snacks.picker({
      title = "Buscar Macro (Digite para filtrar | Enter=Carregar | Delete=Deletar)",
      items = items,
      format = function(item)
        return {
          { item.name, "SnacksPickerLabel" },
          { "  ➔  [" .. vim.fn.keytrans(item.raw) .. "]", "SnacksPickerComment" },
        }
      end,
      confirm = function(picker, item)
        picker:close()
        item = item or picker:current()
        if item and item.name then
          vim.fn.setreg("m", item.raw)
          state.active_macro_name = item.name
          vim.notify("Gatilho carregado: '" .. item.name .. "' (@1 / @e)", vim.log.levels.INFO)
        end
      end,
      actions = {
        delete_macro = function(picker)
          local item = picker:current()
          if item and item.name then
            local choice = vim.fn.confirm("Deseja deletar a macro '" .. item.name .. "'?", "&Sim\n&Nao", 2)
            if choice == 1 then
              state.saved_macros[item.name] = nil
              save_macros_to_file()
              picker:close()
              vim.notify("Macro '" .. item.name .. "' deletada.", vim.log.levels.INFO)
            end
          end
        end,
      },
      win = {
        input = {
          keys = {
            ["<Del>"] = { "delete_macro", mode = { "n", "i" } },
            ["<Delete>"] = { "delete_macro", mode = { "n", "i" } },
            ["\x1b[3~"] = { "delete_macro", mode = { "n", "i" } },
          },
        },
        list = {
          keys = {
            ["<Del>"] = { "delete_macro", mode = { "n", "i" } },
            ["<Delete>"] = { "delete_macro", mode = { "n", "i" } },
            ["\x1b[3~"] = { "delete_macro", mode = { "n", "i" } },
          },
        },
      },
    })
    return
  end

  local choices = {}
  for _, name in ipairs(name_list) do
    local raw = state.saved_macros[name]
    table.insert(choices, name .. " ➔ [" .. vim.fn.keytrans(raw) .. "]")
  end

  vim.ui.select(choices, { prompt = "Buscar Macro (Digite o nome para filtrar):" }, function(choice, idx)
    if choice and idx then
      local selected_name = name_list[idx]
      local raw_content = state.saved_macros[selected_name]
      if raw_content then
        vim.fn.setreg("m", raw_content)
        state.active_macro_name = selected_name
        vim.notify("Gatilho carregado: '" .. selected_name .. "' (@1 / @e)", vim.log.levels.INFO)
      end
    end
  end)
end

function M.setup()
  local map = vim.keymap.set
  local opts = { noremap = true, silent = true, nowait = true }

  map("n", "@r", toggle_recording, opts)
  map("n", "@q", cancel_recording, opts)
  map("n", "@l", M.list_and_select_macro, opts)

  map({ "v", "x" }, "@e", run_visual_macro_from_visual, opts)
  map({ "v", "x" }, "@E", run_visual_macro_from_visual, opts)

  for i = 1, 9 do
    map("n", "@" .. i, function()
      local raw_macro = vim.fn.getreg("m")
      if not raw_macro or raw_macro == "" then
        vim.notify("Nenhuma macro no gatilho. Grave com @r ou selecione com @l", vim.log.levels.WARN)
        return
      end
      for _ = 1, i do
        vim.cmd("normal! @m")
      end
      vim.notify("Macro executada " .. i .. "x", vim.log.levels.INFO)
    end, opts)
  end
end

-- Ativa o mapeamento globalmente na inicialização
M.setup()

return {
  {
    "LazyVim/LazyVim",
    optional = true,
    opts = function()
      M.setup()
    end,
  },
}
