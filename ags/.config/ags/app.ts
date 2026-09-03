import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import {  Work } from "./widget/Work"
import {  Hub } from "./widget/Hub"
import {  TodoCards } from "./widget/TodoCards"
import {  HabitsModal, checkAndPromptUnfilledHabits, openHabitsModal } from "./widget/HabitsModal"

app.start({
  css: "/home/caio/.config/ags/style.css",
  requestHandler(request, res) {
    const raw = Array.isArray(request) ? request.join(" ") : String(request || "")
    const cmd = raw.trim()
    if (cmd === "check-habits") {
      checkAndPromptUnfilledHabits()
      res("checked")
    } else if (cmd === "habits-today" || cmd === "toggle-habits") {
      openHabitsModal("today")
      res("opened")
    } else if (cmd.startsWith("habits-date:")) {
      const date = cmd.slice("habits-date:".length).trim()
      openHabitsModal(date)
      res("opened date " + date)
    } else {
      res("unknown command: " + cmd)
    }
  },
  main() {
    Hub(0)
    Work(0)
    TodoCards(0)
    HabitsModal(0)

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
      checkAndPromptUnfilledHabits()
      return GLib.SOURCE_REMOVE
    })
  },
})
