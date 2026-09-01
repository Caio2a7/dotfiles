return {
  -- 0. Desativar nvim-metals para eliminar warnings do Metals CLI
  {
    "scalameta/nvim-metals",
    enabled = false,
  },

  -- 1. Diagnósticos Instantâneos de Sintaxe para Java via nvim-lint + javac
  {
    "mfussenegger/nvim-lint",
    ft = { "java" },
    config = function()
      local lint = require("lint")

      local function get_java_source_and_classpath(filepath)
        if not filepath or filepath == "" then return nil, nil end
        local norm_path = filepath:gsub("\\", "/")

        local bufnr = vim.api.nvim_get_current_buf()
        local lines = vim.api.nvim_buf_is_valid(bufnr) and vim.api.nvim_buf_get_lines(bufnr, 0, 50, false) or {}
        local pkg = nil
        for _, l in ipairs(lines) do
          local p = l:match("^%s*package%s+([%w_%.]+)%s*;")
          if p then
            pkg = p
            break
          end
        end

        local source_dir = nil
        if pkg and pkg ~= "" then
          local pkg_path = pkg:gsub("%.", "/")
          local s = norm_path:find(pkg_path, 1, true)
          if s then
            source_dir = norm_path:sub(1, s - 1):gsub("/+$", "")
          end
        end

        if not source_dir or source_dir == "" then
          local s, e = norm_path:find("/src/[^/]+/java")
          if e then
            source_dir = norm_path:sub(1, e)
          else
            local s2, e2 = norm_path:find("/src")
            if e2 then
              source_dir = norm_path:sub(1, e2)
            else
              source_dir = vim.fs.dirname(norm_path)
            end
          end
        end

        local root = vim.fs.root(filepath, { "pom.xml", "build.gradle", ".git", ".project" }) or vim.fs.dirname(source_dir)
        local cp_entries = { source_dir }

        if root then
          local possible_cp = {
            root .. "/target/classes",
            root .. "/target/test-classes",
            root .. "/build/classes/java/main",
            root .. "/build/classes/java/test",
            root .. "/bin",
          }
          for _, dir in ipairs(possible_cp) do
            if vim.fn.isdirectory(dir) == 1 then
              table.insert(cp_entries, dir)
            end
          end

          local jars = vim.fn.glob(root .. "/**/lib*/*.jar", false, true)
          if #jars > 0 then
            for _, j in ipairs(jars) do
              table.insert(cp_entries, j)
            end
          end
        end

        local sep = package.config:sub(1, 1) == "\\" and ";" or ":"
        local classpath = table.concat(cp_entries, sep)

        return source_dir, classpath
      end

      lint.linters.javac = {
        name = "javac",
        cmd = "javac",
        args = {
          "-sourcepath",
          function()
            local filepath = vim.api.nvim_buf_get_name(0)
            local src, _ = get_java_source_and_classpath(filepath)
            return src or vim.fs.dirname(filepath)
          end,
          "-cp",
          function()
            local filepath = vim.api.nvim_buf_get_name(0)
            local _, cp = get_java_source_and_classpath(filepath)
            return cp or "."
          end,
          "-Xlint:all",
          "-d",
          "/tmp",
          "-proc:none",
        },
        stdin = false,
        stream = "stderr",
        ignore_exitcode = true,
        parser = function(output, bufnr)
          local diagnostics = {}
          local pattern = "([^:]+):(%d+):%s*(%a+):%s*(.*)"
          for _, line in ipairs(vim.split(output, "\n")) do
            local file, lnum, sev, msg = line:match(pattern)
            if file and lnum and msg then
              local is_missing_ext_package = msg:match("package%s+[%w_%.]+%s+does not exist")
              local is_import_symbol = msg:match("cannot find symbol") and msg:match("import%s+")

              if not is_missing_ext_package and not is_import_symbol then
                local severity = vim.diagnostic.severity.ERROR
                if sev:lower() == "warning" or sev:lower() == "warn" then
                  severity = vim.diagnostic.severity.WARN
                end
                table.insert(diagnostics, {
                  bufnr = bufnr,
                  lnum = tonumber(lnum) - 1,
                  col = 0,
                  severity = severity,
                  message = msg,
                  source = "javac",
                })
              end
            end
          end
          return diagnostics
        end,
      }

      lint.linters_by_ft.java = { "javac" }

      local lint_group = vim.api.nvim_create_augroup("JavaLint", { clear = true })
      vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave", "TextChanged" }, {
        group = lint_group,
        pattern = "*.java",
        callback = function()
          lint.try_lint("javac")
        end,
      })
    end,
  },

  -- 2. Configuração Completa e Robusta do JDTLS (Autocomplete Inteligente + Tips + Atalhos)
  {
    "mfussenegger/nvim-jdtls",
    ft = { "java" },
    opts = function(_, opts)
      opts = opts or {}

      local root_markers = {
        "mvnw", "gradlew", "pom.xml", "build.gradle", "build.gradle.kts",
        "settings.gradle", "settings.gradle.kts", ".project", ".classpath", ".git"
      }

      opts.root_dir = function(fname)
        local root = require("jdtls.setup").find_root(root_markers, fname)
        if not root or root == "" then
          root = vim.fs.dirname(fname)
        end
        return root
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

      opts.full_cmd = function(o)
        local fname = vim.api.nvim_buf_get_name(0)
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
          signatureHelp = { enabled = true },
          contentProvider = { preferred = "fernflower" },
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
          inlayHints = {
            parameterNames = {
              enabled = "all",
            },
          },
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

        local function get_java_fields(b)
          b = b or vim.api.nvim_get_current_buf()
          local lines = vim.api.nvim_buf_get_lines(b, 0, -1, false)
          local fields = {}
          local class_name = "Class"

          for _, line in ipairs(lines) do
            local cname = line:match("public%s+class%s+([%w_]+)")
              or line:match("class%s+([%w_]+)")
              or line:match("public%s+record%s+([%w_]+)")
            if cname then class_name = cname end

            local clean = line:gsub("//.*$", ""):gsub("@%w+%(?.-%)?", "")
            local rest = vim.trim(clean)
              :gsub("^public%s+", "")
              :gsub("^private%s+", "")
              :gsub("^protected%s+", "")
              :gsub("^static%s+", "")
              :gsub("^final%s+", "")
              :gsub("^transient%s+", "")
              :gsub("^volatile%s+", "")
              :gsub("^static%s+", "")
              :gsub("^final%s+", "")

            local tname, fname = rest:match("^([%w_<>%[%]%?]+)%s+([%w_]+)%s*[%s=;]")
            if tname and fname then
              local reserved = {
                ["class"] = true, ["interface"] = true, ["enum"] = true, ["record"] = true,
                ["return"] = true, ["void"] = true, ["package"] = true, ["import"] = true,
                ["public"] = true, ["private"] = true, ["protected"] = true,
              }
              if not reserved[tname] and not reserved[fname] then
                table.insert(fields, { type = tname, name = fname })
              end
            end
          end
          return fields, class_name
        end

        local function generate_java_constructor()
          local b = vim.api.nvim_get_current_buf()
          local fields, class_name = get_java_fields(b)
          local cursor_line = vim.fn.line(".")

          local params = {}
          local assignments = {}
          for _, f in ipairs(fields) do
            table.insert(params, f.type .. " " .. f.name)
            table.insert(assignments, "        this." .. f.name .. " = " .. f.name .. ";")
          end

          local gen_lines = {}
          table.insert(gen_lines, "")
          table.insert(gen_lines, "    public " .. class_name .. "(" .. table.concat(params, ", ") .. ") {")
          for _, a in ipairs(assignments) do
            table.insert(gen_lines, a)
          end
          table.insert(gen_lines, "    }")

          vim.api.nvim_buf_set_lines(b, cursor_line, cursor_line, false, gen_lines)
          vim.notify("Construtor gerado para " .. class_name, vim.log.levels.INFO, { title = "Java CodeGen" })
        end

        local function generate_java_getters_setters()
          local b = vim.api.nvim_get_current_buf()
          local fields = get_java_fields(b)
          if #fields == 0 then
            vim.notify("Nenhum campo encontrado para gerar Getters/Setters", vim.log.levels.WARN, { title = "Java CodeGen" })
            return
          end

          local cursor_line = vim.fn.line(".")
          local gen_lines = {}

          for _, f in ipairs(fields) do
            local cap_name = capitalize(f.name)
            local getter_prefix = (f.type == "boolean" and "is" or "get")
            local getter_name = getter_prefix .. cap_name
            local setter_name = "set" .. cap_name

            table.insert(gen_lines, "    public " .. f.type .. " " .. getter_name .. "() { return " .. f.name .. "; }")
            table.insert(gen_lines, "    public void " .. setter_name .. "(" .. f.type .. " " .. f.name .. ") { this." .. f.name .. " = " .. f.name .. "; }")
          end

          vim.api.nvim_buf_set_lines(b, cursor_line, cursor_line, false, gen_lines)
          vim.notify("Getters & Setters gerados em linha única (" .. #fields .. " campos)", vim.log.levels.INFO, { title = "Java CodeGen" })
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

      local function attach_jdtls()
        local fname = vim.api.nvim_buf_get_name(0)
        if fname == "" or fname:sub(-5) ~= ".java" then return end

        local bundles = {}
        local mason_path = vim.fn.stdpath("data") .. "/mason"
        local debug_jar = vim.fn.glob(mason_path .. "/share/java-debug-adapter/com.microsoft.java.debug.plugin-*.jar", false, true)
        if #debug_jar > 0 then
          vim.list_extend(bundles, debug_jar)
          local test_jars = vim.fn.glob(mason_path .. "/share/java-test/*.jar", false, true)
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
          cmd = opts.full_cmd(opts),
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
            bind_java_keys(args.buf)
          end
        end,
      })

      attach_jdtls()
    end,
    init = function()
      local group = vim.api.nvim_create_augroup("JavaPackageAutoCmd", { clear = true })
      vim.api.nvim_create_autocmd({ "FileType", "BufNewFile", "BufReadPost", "BufEnter" }, {
        group = group,
        pattern = "*",
        callback = function(ev)
          local bufnr = ev.buf
          if not vim.api.nvim_buf_is_valid(bufnr) then return end
          local filepath = vim.api.nvim_buf_get_name(bufnr)
          if filepath == "" or filepath:sub(-5) ~= ".java" then return end

          local norm_path = filepath:gsub("\\", "/")
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

          local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
          local is_empty = (#lines == 0 or (#lines == 1 and lines[1] == ""))
          if is_empty then lines = {} end

          local has_package = false
          local has_type_def = false

          if not is_empty then
            for _, l in ipairs(lines) do
              if l:match("^%s*package%s+") then has_package = true end
              if l:match("^%s*public%s+class%s+") or l:match("^%s*class%s+")
                or l:match("^%s*public%s+interface%s+") or l:match("^%s*interface%s+")
                or l:match("^%s*public%s+enum%s+") or l:match("^%s*enum%s+")
                or l:match("^%s*public%s+record%s+") or l:match("^%s*record%s+") then
                has_type_def = true
              end
            end
          end

          local filename = vim.fs.basename(norm_path)
          local class_name = filename:gsub("%.java$", "")

          local modified = false
          if not has_package and pkg_name ~= "" then
            table.insert(lines, 1, "package " .. pkg_name .. ";")
            table.insert(lines, 2, "")
            modified = true
          end

          if not has_type_def and class_name ~= "" then
            table.insert(lines, "public class " .. class_name .. " {")
            table.insert(lines, "    ")
            table.insert(lines, "}")
            modified = true
          end

          if modified then
            vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
          end
        end,
      })
    end,
  },
}
