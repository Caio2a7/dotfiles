local M = {}

M.colors = {
  bg = "#0a0a0f",
  bg1 = "#0f0f17",
  bg2 = "#13131e",
  bg3 = "#181825",
  inactive_bg = "#2D2E2F",
  text = "#cdd6f4",
  subtext1 = "#bac2de",
  subtext0 = "#a6adc8",
  overlay0 = "#6c7086",
  blue = "#00D4FF",
  lavender = "#b4befe",
  sapphire = "#74c7ec",
  sky = "#89dceb",
  teal = "#94e2d5",
  green = "#a6e3a1",
  yellow = "#f9e2af",
  peach = "#fab387",
  red = "#f38ba8",
  pink = "#f5c2e7",
  mauve = "#cba4f7",
  base = "#1e1e2e",
  white = "#ffffff",
}

local c = M.colors

M.mode_color = {
  n = { fg = c.base, bg = c.blue, gui = "bold" },
  i = { fg = c.base, bg = c.green, gui = "bold" },
  v = { fg = c.base, bg = c.mauve, gui = "bold" },
  [""] = { fg = c.base, bg = c.mauve, gui = "bold" },
  V = { fg = c.base, bg = c.mauve, gui = "bold" },
  c = { fg = c.base, bg = c.peach, gui = "bold" },
  s = { fg = c.base, bg = c.teal, gui = "bold" },
  S = { fg = c.base, bg = c.teal, gui = "bold" },
  R = { fg = c.base, bg = c.red, gui = "bold" },
  r = { fg = c.base, bg = c.red, gui = "bold" },
  ["!"] = { fg = c.base, bg = c.yellow, gui = "bold" },
  t = { fg = c.base, bg = c.yellow, gui = "bold" },
}

M.theme = {
  normal = {
    a = { fg = c.base, bg = c.blue, gui = "bold" },
    b = { fg = c.lavender, bg = c.bg2 },
    c = { fg = c.subtext0, bg = "NONE" },
  },
  insert = {
    a = { fg = c.base, bg = c.green, gui = "bold" },
    b = { fg = c.lavender, bg = c.bg2 },
    c = { fg = c.subtext0, bg = "NONE" },
  },
  visual = {
    a = { fg = c.base, bg = c.mauve, gui = "bold" },
    b = { fg = c.lavender, bg = c.bg2 },
    c = { fg = c.subtext0, bg = "NONE" },
  },
  replace = {
    a = { fg = c.base, bg = c.red, gui = "bold" },
    b = { fg = c.lavender, bg = c.bg2 },
    c = { fg = c.subtext0, bg = "NONE" },
  },
  command = {
    a = { fg = c.base, bg = c.peach, gui = "bold" },
    b = { fg = c.lavender, bg = c.bg2 },
    c = { fg = c.subtext0, bg = "NONE" },
  },
  terminal = {
    a = { fg = c.base, bg = c.yellow, gui = "bold" },
    b = { fg = c.lavender, bg = c.bg2 },
    c = { fg = c.subtext0, bg = "NONE" },
  },
  inactive = {
    a = { fg = c.overlay0, bg = "NONE" },
    b = { fg = c.overlay0, bg = "NONE" },
    c = { fg = c.overlay0, bg = "NONE" },
  },
}

return M
