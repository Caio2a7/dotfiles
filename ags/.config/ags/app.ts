import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import { Work } from "./widget/Work"
import { Hub } from "./widget/Hub"
import { AppPickerModal } from "./widget/AppPickerModal"
import { HabitsModal, toggleHabitsModal } from "./widget/HabitsModal"

app.start({
  css: "/home/caio/.config/ags/style.css",
  requestHandler(request, res) {
    if (request[0] === "habits") {
      toggleHabitsModal()
      res("ok")
      return
    }
    res("ok")
  },
  main() {
    app.apply_css("/home/caio/.config/ags/css/habits.css", false)
    Hub(0)
    Work(0)
    AppPickerModal(0)
    HabitsModal(0)
  },
})
