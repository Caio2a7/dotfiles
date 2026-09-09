return {
  -- 0. Desativar nvim-metals para eliminar warnings do Metals CLI
  {
    "scalameta/nvim-metals",
    enabled = false,
  },

  -- 1. nvim-lspconfig: Registrar jdtls e impedir inicialização automática duplicada
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        jdtls = {},
      },
      setup = {
        jdtls = function()
          return true -- Gerenciado exclusivamente pelo nvim-jdtls
        end,
      },
    },
  },

  -- 2. Configuração Completa do JDTLS: Autocomplete, Inlay Hints, Tips e Keybinds
  {
    "mfussenegger/nvim-jdtls",
    ft = { "java" },
    opts = function(_, opts)
      opts = opts or {}

      opts.root_dir = function(fname)
        if not fname or fname == "" then fname = vim.api.nvim_buf_get_name(0) end
        if fname == "" then return vim.fn.getcwd() end
        local norm_path = fname:gsub("\\", "/")

        -- 1. Verificar ferramentas de build ou arquivos de projeto Eclipse
        local build_root = vim.fs.root(fname, {
          "pom.xml", "build.gradle", "build.gradle.kts",
          "mvnw", "gradlew", "settings.gradle", "settings.gradle.kts",
          ".project", ".classpath"
        })
        if build_root then return build_root end

        -- 2. Raiz do módulo a partir da pasta src/
        local s = norm_path:find("/src/")
        if s then
          return norm_path:sub(1, s - 1)
        end

        -- 3. Fallback para git ou diretório do arquivo
        local git_root = vim.fs.root(fname, { ".git" })
        if git_root then return git_root end

        return vim.fs.dirname(fname)
      end

      opts.project_name = function(root_dir)
        return root_dir and vim.fs.basename(root_dir) or "default"
      end

      opts.jdtls_config_dir = function(project_name)
        return vim.fn.stdpath("cache") .. "/jdtls/" .. project_name .. "/config"
      end

      opts.jdtls_workspace_dir = function(project_name)
        return vim.fn.stdpath("cache") .. "/jdtls/" .. project_name .. "/workspace"
      end

      local mason_path = vim.fn.stdpath("data") .. "/mason"
      local jdtls_bin = mason_path .. "/bin/jdtls"
      if vim.fn.filereadable(jdtls_bin) == 0 then
        jdtls_bin = vim.fn.exepath("jdtls")
      end

      local cmd = { jdtls_bin }
      local lombok_jar = mason_path .. "/share/jdtls/lombok.jar"
      if vim.fn.filereadable(lombok_jar) == 1 then
        table.insert(cmd, string.format("--jvm-arg=-javaagent:%s", lombok_jar))
      end
      opts.cmd = cmd

      opts.full_cmd = function(o, fname)
        fname = fname or vim.api.nvim_buf_get_name(0)
        local rdir = o.root_dir(fname)
        local pname = o.project_name(rdir)
        local c = vim.deepcopy(o.cmd)
        vim.list_extend(c, {
          "-configuration", o.jdtls_config_dir(pname),
          "-data", o.jdtls_workspace_dir(pname),
        })
        return c
      end

      opts.settings = {
        java = {
          signatureHelp = {
            enabled = true,
            description = { enabled = true },
          },
          contentProvider = { preferred = "fernflower" },
          inlayHints = {
            parameterNames = {
              enabled = "all", -- Exibir dicas de parâmetros (tips)
              exclusions = { "this" },
            },
          },
          completion = {
            favoriteStaticMembers = {
              "org.junit.Assert.*",
              "org.junit.Assume.*",
              "org.junit.jupiter.api.Assertions.*",
              "org.junit.jupiter.api.Assumptions.*",
              "org.junit.jupiter.api.DynamicContainer.*",
              "org.junit.jupiter.api.DynamicTest.*",
              "org.mockito.Mockito.*",
              "org.mockito.ArgumentMatchers.*",
              "org.hamcrest.MatcherAssert.assertThat",
              "org.hamcrest.Matchers.*",
              "org.hamcrest.CoreMatchers.*",
              "java.util.Objects.requireNonNull",
              "java.util.Objects.requireNonNullElse",
            },
            filteredTypes = {
              "com.sun.*",
              "io.micrometer.shaded.*",
              "java.awt.*",
              "jdk.*",
              "sun.*",
            },
            importOrder = {
              "java",
              "javax",
              "com",
              "org",
            },
            guessMethodArguments = true,
            matchCase = "firstLetter",
          },
          sources = {
            organizeImports = {
              starThreshold = 9999,
              staticStarThreshold = 9999,
            },
          },
          codeGeneration = {
            toString = {
              template = "${object.className}{${member.name()}=${member.value}, ${otherMembers}}",
            },
            useBlocks = true,
          },
          referencesCodeLens = { enabled = true },
          implementationsCodeLens = { enabled = true },
        },
      }

      return opts
    end,
    config = function(_, opts)
      local function bind_java_keys(bufnr)
        local options = { buffer = bufnr, silent = true, noremap = true }

        local function capitalize(str)
          return (str:gsub("^%l", string.upper))
        end

        local function generate_java_constructor()
          local ts = vim.treesitter
          local parser = ts.get_parser(bufnr, "java")
          if not parser then return end
          local tree = parser:parse()[1]
          local root = tree:root()

          local query_str = [[
            (class_declaration
              name: (identifier) @class_name
              body: (class_body
                (field_declaration
                  (modifiers)? @modifiers
                  type: _ @field_type
                  declarator: (variable_declarator name: (identifier) @field_name)
                ) @field_decl
              )
            )
          ]]
          local query = ts.query.parse("java", query_str)
          local class_name = nil
          local fields = {}
          local cur_mod = ""
          local cur_type = ""

          for id, node, _ in query:iter_captures(root, bufnr, 0, -1) do
            local name = query.captures[id]
            local text = ts.get_node_text(node, bufnr)
            if name == "class_name" and not class_name then
              class_name = text
            elseif name == "modifiers" then
              cur_mod = text
            elseif name == "field_type" then
              cur_type = text
            elseif name == "field_name" then
              local is_static = cur_mod:match("%f[%a]static%f[%A]") ~= nil
              if not is_static then
                table.insert(fields, { type = cur_type, name = text })
              end
              cur_mod = ""
              cur_type = ""
            end
          end

          if not class_name then
            vim.notify("Nenhuma classe encontrada.", vim.log.levels.WARN)
            return
          end

          local cursor_line = vim.fn.line(".")
          local gen_lines = {}

          if #fields == 0 then
            table.insert(gen_lines, "    public " .. class_name .. "() {}")
          else
            local args_list = {}
            local assign_list = {}
            for _, f in ipairs(fields) do
              table.insert(args_list, f.type .. " " .. f.name)
              table.insert(assign_list, "        this." .. f.name .. " = " .. f.name .. ";")
            end
            table.insert(gen_lines, "    public " .. class_name .. "(" .. table.concat(args_list, ", ") .. ") {")
            for _, a in ipairs(assign_list) do
              table.insert(gen_lines, a)
            end
            table.insert(gen_lines, "    }")
          end

          vim.api.nvim_buf_set_lines(bufnr, cursor_line, cursor_line, false, gen_lines)
          vim.notify("Construtor gerado com sucesso!", vim.log.levels.INFO, { title = "Java CodeGen" })
        end

        local function generate_java_getters_setters()
          local ts = vim.treesitter
          local parser = ts.get_parser(bufnr, "java")
          if not parser then return end
          local tree = parser:parse()[1]
          local root = tree:root()

          local query_str = [[
            (class_declaration
              body: (class_body
                (field_declaration
                  (modifiers)? @modifiers
                  type: _ @field_type
                  declarator: (variable_declarator name: (identifier) @field_name)
                ) @field_decl
              )
            )
          ]]
          local query = ts.query.parse("java", query_str)
          local fields = {}
          local cur_mod = ""
          local cur_type = ""

          for id, node, _ in query:iter_captures(root, bufnr, 0, -1) do
            local name = query.captures[id]
            local text = ts.get_node_text(node, bufnr)
            if name == "modifiers" then
              cur_mod = text
            elseif name == "field_type" then
              cur_type = text
            elseif name == "field_name" then
              local is_static = cur_mod:match("%f[%a]static%f[%A]") ~= nil
              local is_final = cur_mod:match("%f[%a]final%f[%A]") ~= nil
              if not is_static then
                table.insert(fields, {
                  type = cur_type,
                  name = text,
                  is_final = is_final,
                })
              end
              cur_mod = ""
              cur_type = ""
            end
          end

          if #fields == 0 then
            vim.notify("Nenhum campo aplicável para gerar Getters/Setters.", vim.log.levels.WARN)
            return
          end

          local existing_methods = {}
          local method_query = ts.query.parse("java", "(method_declaration name: (identifier) @mname)")
          for _, node, _ in method_query:iter_captures(root, bufnr, 0, -1) do
            existing_methods[ts.get_node_text(node, bufnr)] = true
          end

          local cursor_line = vim.fn.line(".")
          local gen_lines = {}
          local count = 0

          for _, f in ipairs(fields) do
            local cap_name = capitalize(f.name)
            local getter_prefix = (f.type == "boolean" and "is" or "get")
            local getter_name = getter_prefix .. cap_name
            local setter_name = "set" .. cap_name

            if not existing_methods[getter_name] then
              table.insert(gen_lines, "    public " .. f.type .. " " .. getter_name .. "() { return " .. f.name .. "; }")
              existing_methods[getter_name] = true
              count = count + 1
            end

            if not f.is_final and not existing_methods[setter_name] then
              table.insert(gen_lines, "    public void " .. setter_name .. "(" .. f.type .. " " .. f.name .. ") { this." .. f.name .. " = " .. f.name .. "; }")
              existing_methods[setter_name] = true
              count = count + 1
            end
          end

          if #gen_lines == 0 then
            vim.notify("Todos os Getters/Setters aplicáveis já existem.", vim.log.levels.INFO, { title = "Java CodeGen" })
            return
          end

          vim.api.nvim_buf_set_lines(bufnr, cursor_line, cursor_line, false, gen_lines)
          vim.notify("Getters & Setters gerados (" .. count .. " métodos)", vim.log.levels.INFO, { title = "Java CodeGen" })
        end

        vim.keymap.set("n", ";jc", generate_java_constructor, vim.tbl_extend("force", options, { desc = "Java: Gerar Construtor" }))
        vim.keymap.set("n", ";jg", generate_java_getters_setters, vim.tbl_extend("force", options, { desc = "Java: Gerar Getters & Setters" }))
        vim.keymap.set("n", ";jt", function()
          vim.lsp.buf.code_action({ filter = function(a) return (a.title or ""):lower():find("tostring") ~= nil end })
        end, vim.tbl_extend("force", options, { desc = "Java: Gerar toString()" }))
        vim.keymap.set("n", ";je", function()
          vim.lsp.buf.code_action({ filter = function(a) return (a.title or ""):lower():find("hashcode") ~= nil end })
        end, vim.tbl_extend("force", options, { desc = "Java: Gerar hashCode & equals" }))
        vim.keymap.set("n", ";jo", function() pcall(require("jdtls").organize_imports) end, vim.tbl_extend("force", options, { desc = "Java: Organizar Imports" }))
        vim.keymap.set("n", ";jv", function() pcall(require("jdtls").extract_variable) end, vim.tbl_extend("force", options, { desc = "Java: Extrair Variável" }))
        vim.keymap.set("n", ";jm", function() pcall(require("jdtls").extract_method) end, vim.tbl_extend("force", options, { desc = "Java: Extrair Método" }))
        vim.keymap.set("n", ";ja", function() vim.lsp.buf.code_action() end, vim.tbl_extend("force", options, { desc = "Java: Code Actions" }))
        vim.keymap.set("n", ";jd", function()
          pcall(require("nvim-dap-virtual-text").setup, { enabled = true, virt_text_pos = "eol", commented = true })
          pcall(require("jdtls").setup_dap, { hotcodereplace = "auto" })
          pcall(require("jdtls.dap").setup_dap_main_class_configs)
          pcall(require("dap").continue)
        end, vim.tbl_extend("force", options, { desc = "Java: Iniciar Debug DAP" }))
      end

      local function attach_jdtls(args)
        local bufnr = (args and args.buf) or vim.api.nvim_get_current_buf()
        if not vim.api.nvim_buf_is_valid(bufnr) then return end
        local fname = vim.api.nvim_buf_get_name(bufnr)
        if fname == "" or fname:sub(-5) ~= ".java" then return end

        local bundles = {}
        local mason_path = vim.fn.stdpath("data") .. "/mason"
        local debug_jar = vim.fn.glob(mason_path .. "/share/java-debug-adapter/com.microsoft.java.debug.plugin-*.jar", false, true)
        if #debug_jar > 0 then
          vim.list_extend(bundles, debug_jar)
          local test_jars = vim.fn.glob(mason_path .. "/share/java-test/com.microsoft.java.test.plugin-*.jar", false, true)
          if #test_jars > 0 then
            vim.list_extend(bundles, test_jars)
          end
        end

        local capabilities = nil
        local has_blink, blink = pcall(require, "blink.cmp")
        if has_blink and blink.get_lsp_capabilities then
          capabilities = blink.get_lsp_capabilities()
        else
          local has_cmp, cmp_lsp = pcall(require, "cmp_nvim_lsp")
          if has_cmp and cmp_lsp.default_capabilities then
            capabilities = cmp_lsp.default_capabilities()
          else
            capabilities = vim.lsp.protocol.make_client_capabilities()
          end
        end

        local config = {
          cmd = opts.full_cmd(opts, fname),
          root_dir = opts.root_dir(fname),
          init_options = {
            bundles = bundles,
            extendedClientCapabilities = {
              progressReportProvider = true,
              classFileContentsSupport = true,
              generateToStringPromptSupport = true,
              hashCodeEqualsPromptSupport = true,
              advancedExtractRefactoringSupport = true,
              advancedOrganizeImportsSupport = true,
              generateConstructorsPromptSupport = true,
              generateDelegateMethodsPromptSupport = true,
              moveRefactoringSupport = true,
              overrideMethodsPromptSupport = true,
              inferSelectionSupport = { "extractMethod", "extractVariable", "extractConstant" },
            },
          },
          settings = opts.settings,
          capabilities = capabilities,
        }

        require("jdtls").start_or_attach(config)
      end

      vim.api.nvim_create_autocmd("FileType", {
        pattern = "java",
        callback = attach_jdtls,
      })

      vim.api.nvim_create_autocmd("LspAttach", {
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.name == "jdtls" then
            if vim.lsp.inlay_hint then
              pcall(vim.lsp.inlay_hint.enable, true, { bufnr = args.buf })
            end
            bind_java_keys(args.buf)
          end
        end,
      })

      attach_jdtls()
    end,
    init = function()
      vim.lsp.config = vim.lsp.config or {}
      vim.lsp.config.jdtls = {
        root_markers = {
          "pom.xml", "build.gradle", "build.gradle.kts",
          "mvnw", "gradlew", "settings.gradle", "settings.gradle.kts",
          ".project", ".classpath", ".git"
        },
      }

      local group = vim.api.nvim_create_augroup("JavaPackageAutoCmd", { clear = true })
      vim.api.nvim_create_autocmd({ "BufNewFile", "BufReadPost", "BufEnter" }, {
        group = group,
        pattern = "*.java",
        callback = function(ev)
          local bufnr = ev.buf
          if not vim.api.nvim_buf_is_valid(bufnr) then return end
          local filepath = vim.api.nvim_buf_get_name(bufnr)
          if filepath == "" or filepath:sub(-5) ~= ".java" then return end

          local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
          local is_empty = true
          for _, l in ipairs(lines) do
            if vim.trim(l) ~= "" then
              is_empty = false
              break
            end
          end

          -- Se o arquivo já possui qualquer conteúdo, nunca altera nada
          if not is_empty then return end

          local norm_path = filepath:gsub("\\", "/")
          local filename = vim.fs.basename(norm_path)
          local class_name = filename:gsub("%.java$", "")
          if class_name == "" or class_name == "package-info" or class_name == "module-info" then return end

          local java_root_pat = "/src/[^/]+/java/"
          local s, e = norm_path:find(java_root_pat)
          if not s then s, e = norm_path:find("/java/") end
          if not s then s, e = norm_path:find("/src/") end

          local pkg_name = ""
          if e then
            local rel_path = norm_path:sub(e + 1)
            local dir_part = vim.fs.dirname(rel_path)
            if dir_part and dir_part ~= "." then
              pkg_name = dir_part:gsub("/", ".")
            end
          end

          local new_lines = {}
          if pkg_name ~= "" then
            table.insert(new_lines, "package " .. pkg_name .. ";")
            table.insert(new_lines, "")
          end

          local is_annotation = norm_path:find("/annotation/") ~= nil
            or norm_path:find("/annotations/") ~= nil
            or pkg_name:find("%.annotation$") ~= nil
            or pkg_name:find("%.annotation%.") ~= nil

          local is_interface = norm_path:find("/interface/") ~= nil
            or norm_path:find("/interfaces/") ~= nil

          local is_record = norm_path:find("/record/") ~= nil
            or norm_path:find("/records/") ~= nil

          local is_enum = norm_path:find("/enum/") ~= nil
            or norm_path:find("/enums/") ~= nil

          if is_annotation then
            table.insert(new_lines, "public @interface " .. class_name .. " {")
            table.insert(new_lines, "    ")
            table.insert(new_lines, "}")
          elseif is_interface then
            table.insert(new_lines, "public interface " .. class_name .. " {")
            table.insert(new_lines, "    ")
            table.insert(new_lines, "}")
          elseif is_record then
            table.insert(new_lines, "public record " .. class_name .. "() {")
            table.insert(new_lines, "    ")
            table.insert(new_lines, "}")
          elseif is_enum then
            table.insert(new_lines, "public enum " .. class_name .. " {")
            table.insert(new_lines, "    ")
            table.insert(new_lines, "}")
          else
            table.insert(new_lines, "public class " .. class_name .. " {")
            table.insert(new_lines, "    ")
            table.insert(new_lines, "}")
          end

          vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, new_lines)
          if vim.api.nvim_get_current_buf() == bufnr then
            local target_line = #new_lines > 1 and (#new_lines - 1) or #new_lines
            pcall(vim.api.nvim_win_set_cursor, 0, { target_line, 4 })
          end
        end,
      })
    end,
  },
}
